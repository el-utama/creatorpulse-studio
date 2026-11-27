#!/usr/bin/env python3
"""Install only CreatorPulse config, skill, and local MCP adapter. No network install."""
import argparse
import json
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path
from datetime import datetime, timezone

from environment import HOSTS, PROFILES, key_prefix
ROOT=Path(__file__).resolve().parent
def profile_home(value,environment):
    if not value: raise ValueError("Explicit --hermes-home required; default profile is never modified.")
    home=Path(value).expanduser().resolve()
    if home.name!=PROFILES[environment] or home.parent.name!="profiles":
        raise ValueError("Target must be the dedicated Hermes profile for this environment.")
    return home
def atomic_write(path, content):
    path.parent.mkdir(parents=True,exist_ok=True)
    fd,tmp=tempfile.mkstemp(prefix=".creatorpulse-",dir=path.parent)
    try:
        with os.fdopen(fd,"w",encoding="utf-8") as f: f.write(content)
        os.replace(tmp,path)
    finally:
        if os.path.exists(tmp): os.unlink(tmp)
def load_yaml():
    try: import yaml;return yaml
    except ImportError: raise ValueError("PyYAML unavailable in this Python. Run with the existing Hermes Python environment; do not install or change Hermes blindly.")
def rendered_skill(environment):
    return (ROOT/"skills"/"creatorpulse"/"SKILL.md").read_text(encoding="utf-8").replace("{{ENVIRONMENT}}",environment).replace("{{DASHBOARD_URL}}",HOSTS[environment]+"/dashboard")

def sync_managed_skill(home, *, environment):
    """Refresh only the dedicated profile's CreatorPulse skill; no MCP/config reinstall."""
    home=profile_home(home,environment)
    skill=home/"skills"/"creatorpulse"/"SKILL.md"
    if any(p.is_symlink() for p in (home/"skills",skill.parent,skill)):
        raise ValueError("Skill path is redirected.")
    rendered=rendered_skill(environment)
    if skill.exists():
        old=skill.read_text(encoding="utf-8")
        if old==rendered:
            return "current"
        if not old.startswith("---\nname: creatorpulse\n") or ("# CreatorPulse content operations — "+environment+"\n") not in old:
            raise ValueError("Existing unrelated skill; no overwrite.")
    atomic_write(skill,rendered)
    return "updated"

def install(home, apply=False, agent_env=None, *, environment, preview_bypass_file=None):
    home=profile_home(home,environment)
    prefix=key_prefix(environment)
    import re
    if preview_bypass_file:
        if environment!="sandbox": raise ValueError("Preview bypass is sandbox-only.")
        preview_bypass_file=Path(preview_bypass_file).expanduser().resolve()
        if not preview_bypass_file.is_file(): raise ValueError("Preview bypass file is missing.")
        if not re.fullmatch(r"[A-Za-z0-9_-]{20,256}",preview_bypass_file.read_text(encoding="utf-8").strip()): raise ValueError("Invalid Preview bypass file.")
    yaml=load_yaml()
    config=home/"config.yaml"
    if not config.is_file(): raise ValueError("Existing Hermes config.yaml not found; no new profile will be created.")
    original=config.read_text(encoding="utf-8")
    try: data=yaml.safe_load(original)
    except yaml.YAMLError: raise ValueError("Hermes YAML cannot be parsed safely; no changes made.") from None
    if not isinstance(data,dict): raise ValueError("Invalid Hermes config.")
    servers=data.get("mcp_servers",{})
    if not isinstance(servers,dict): raise ValueError("Invalid mcp_servers mapping.")
    old=servers.get("creatorpulse")
    if old and not (isinstance(old,dict) and "--environment" in old.get("args",[]) and environment in old.get("args",[]) and str(home/"integrations"/"creatorpulse-local"/"proxy.py") in old.get("args",[])):
        raise ValueError("Existing unrelated creatorpulse MCP entry; no overwrite.")
    dest=home/"integrations"/"creatorpulse-local"
    skill=home/"skills"/"creatorpulse"/"SKILL.md"
    env=home/".env"
    envtext=env.read_text(encoding="utf-8") if env.is_file() else ""
    current=[l.partition("=")[2].strip().strip('"').strip("'") for l in envtext.splitlines() if l.startswith("CREATORPULSE_AGENT_KEY=")]
    if len(current)>1 or any(not k.startswith(prefix) or not re.fullmatch(r"[A-Za-z0-9_-]{32,}",k[len(prefix):]) for k in current): raise ValueError("Duplicate, invalid or wrong-environment agent credential; resolve locally.")
    if agent_env:
        source=Path(agent_env).expanduser()
        lines=[l for l in source.read_text(encoding="utf-8").splitlines() if l.strip() and not l.lstrip().startswith("#")]
        rows=[l.partition("=")[2].strip() for l in lines if l.startswith("CREATORPULSE_AGENT_KEY=")]
        if len(lines)!=1 or len(rows)!=1 or not rows[0].startswith(prefix) or not re.fullmatch(r"[A-Za-z0-9_-]{32,}",rows[0][len(prefix):]): raise ValueError("Invalid agent-only credential file.")
        if current and current[0]!=rows[0]: raise ValueError("Existing different agent key; no overwrite.")
        if not current: envtext=envtext.rstrip()+"\nCREATORPULSE_AGENT_KEY="+rows[0]+"\n";current=rows
    adapter_args=[str(dest/"proxy.py"),"--environment",environment,"--env-file",str(env)]
    if preview_bypass_file: adapter_args.extend(["--preview-bypass-file",str(preview_bypass_file)])
    entry={"command":sys.executable,"args":adapter_args,"enabled":True,"timeout":60,"supports_parallel_tool_calls":False,"tools":{"resources":False,"prompts":False}}
    updated=dict(data);updated["mcp_servers"]={**servers,"creatorpulse":entry}
    rendered=yaml.safe_dump(updated,sort_keys=False,allow_unicode=True)
    if yaml.safe_load(rendered)!=updated: raise ValueError("Config roundtrip failed.")
    if not apply: return {"mode":"plan","environment":environment,"gateway":HOSTS[environment],"profile":str(home),"changes":["creatorpulse MCP entry","creatorpulse skill","local stdio adapter"],"agent_key_present":bool(current),"model_and_messaging":"unchanged"}
    os.umask(0o077)
    backup=home/"integrations"/("creatorpulse-backup-"+datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S%fZ"))
    backup.mkdir(parents=True,mode=0o700)
    # Do not duplicate the entire .env; existing credentials are not overwritten.
    for src,name in [(config,"config.yaml"),(skill,"SKILL.md"),(dest/"proxy.py","proxy.py"),(dest/"environment.py","environment.py")]:
        if src.exists(): shutil.copyfile(src,backup/name)
    atomic_write(dest/"proxy.py",(ROOT/"proxy.py").read_text(encoding="utf-8"))
    atomic_write(dest/"environment.py",(ROOT/"environment.py").read_text(encoding="utf-8"))
    atomic_write(skill,rendered_skill(environment))
    if agent_env and envtext!=(env.read_text(encoding="utf-8") if env.exists() else ""): atomic_write(env,envtext)
    atomic_write(config,rendered)
    proc=subprocess.run([sys.executable,*adapter_args,"--check"],capture_output=True,text=True,timeout=90)
    try: connection=json.loads(proc.stdout)
    except ValueError: connection={"gateway":"blocked","reason":"Connection check returned invalid output."}
    return {"mode":"installed","environment":environment,"profile":str(home),"backup":str(backup),"model_and_messaging":"unchanged","connection":connection,"next":"Use an explicit dedicated-profile terminal session; no messaging changes or posts were made."}
def main():
    p=argparse.ArgumentParser()
    p.add_argument("--environment",choices=HOSTS,required=True)
    p.add_argument("--hermes-home",required=True)
    p.add_argument("--preview-bypass-file",help="Optional owner-approved Sandbox automation bypass file (secret only).")
    p.add_argument("--agent-env",help="Path to agent-only credential file; never an operator/bridge secret file.")
    p.add_argument("--apply",action="store_true",help="Without this, only show plan.")
    a=p.parse_args()
    try: result=install(profile_home(a.hermes_home,a.environment),a.apply,a.agent_env,environment=a.environment,preview_bypass_file=a.preview_bypass_file);print(json.dumps(result,ensure_ascii=False));return 0 if not a.apply or result.get("connection",{}).get("gateway")=="connected" and result.get("connection",{}).get("accounts",0)>0 else 2
    except (ValueError,OSError,subprocess.TimeoutExpired) as e: print(json.dumps({"status":"blocked","reason":str(e)}));return 1
if __name__=="__main__": raise SystemExit(main())
