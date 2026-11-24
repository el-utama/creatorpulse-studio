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

ROOT=Path(__file__).resolve().parent
def profile_home(value):
    if value: return Path(value).expanduser().resolve()
    if os.environ.get("HERMES_HOME"): return Path(os.environ["HERMES_HOME"]).expanduser().resolve()
    windows=Path(os.environ["LOCALAPPDATA"])/"hermes" if os.name=="nt" and os.environ.get("LOCALAPPDATA") else None
    candidates=[p for p in [windows,Path.home()/".hermes"] if p and (p/"config.yaml").is_file()]
    if len(candidates)!=1: raise ValueError("Cannot resolve active profile unambiguously. Supply --hermes-home.")
    if any((candidates[0]/"profiles").glob("*/config.yaml")): raise ValueError("Multiple Hermes profiles found. Specify --hermes-home for the existing chat profile.")
    return candidates[0].resolve()
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
def install(home, apply=False, agent_env=None):
    yaml=load_yaml()
    config=home/"config.yaml"
    if not config.is_file(): raise ValueError("Existing Hermes config.yaml not found; no new profile will be created.")
    original=config.read_text(encoding="utf-8")
    data=yaml.safe_load(original)
    if not isinstance(data,dict): raise ValueError("Invalid Hermes config.")
    servers=data.get("mcp_servers",{})
    if not isinstance(servers,dict): raise ValueError("Invalid mcp_servers mapping.")
    old=servers.get("creatorpulse")
    if old and not (isinstance(old,dict) and (old.get("url")=="https://creatorpulse-studio-six.vercel.app/api/mcp" or "creatorpulse-local" in str(old.get("args",[])))):
        raise ValueError("Existing unrelated creatorpulse MCP entry; no overwrite.")
    dest=home/"integrations"/"creatorpulse-local"
    skill=home/"skills"/"creatorpulse"/"SKILL.md"
    env=home/".env"
    envtext=env.read_text(encoding="utf-8") if env.is_file() else ""
    current=[l.partition("=")[2].strip().strip('"').strip("'") for l in envtext.splitlines() if l.startswith("CREATORPULSE_AGENT_KEY=")]
    if len(current)>1: raise ValueError("Duplicate agent credentials; resolve locally.")
    if agent_env:
        source=Path(agent_env).expanduser()
        rows=[l.partition("=")[2].strip() for l in source.read_text(encoding="utf-8").splitlines() if l.startswith("CREATORPULSE_AGENT_KEY=")]
        import re
        if len(rows)!=1 or not re.fullmatch(r"[A-Za-z0-9_-]{32,}",rows[0]): raise ValueError("Invalid agent-only credential file.")
        if current and current[0]!=rows[0]: raise ValueError("Existing different agent key; no overwrite.")
        if not current: envtext=envtext.rstrip()+"\nCREATORPULSE_AGENT_KEY="+rows[0]+"\n";current=rows
    entry={"command":sys.executable,"args":[str(dest/"proxy.py"),"--env-file",str(env)],"enabled":True,"timeout":60,"supports_parallel_tool_calls":False,"tools":{"resources":False,"prompts":False}}
    updated=dict(data);updated["mcp_servers"]={**servers,"creatorpulse":entry}
    rendered=yaml.safe_dump(updated,sort_keys=False,allow_unicode=True)
    if yaml.safe_load(rendered)!=updated: raise ValueError("Config roundtrip failed.")
    if not apply: return {"mode":"plan","profile":str(home),"changes":["creatorpulse MCP entry","creatorpulse skill","local stdio adapter"],"agent_key_present":bool(current),"model_and_messaging":"unchanged"}
    os.umask(0o077)
    backup=home/"integrations"/("creatorpulse-backup-"+datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S%fZ"))
    backup.mkdir(parents=True,mode=0o700)
    # Do not duplicate the entire .env; existing credentials are not overwritten.
    for src,name in [(config,"config.yaml"),(skill,"SKILL.md"),(dest/"proxy.py","proxy.py")]:
        if src.exists(): shutil.copyfile(src,backup/name)
    atomic_write(dest/"proxy.py",(ROOT/"proxy.py").read_text(encoding="utf-8"))
    atomic_write(skill,(ROOT/"skills"/"creatorpulse"/"SKILL.md").read_text(encoding="utf-8"))
    if agent_env and envtext!=(env.read_text(encoding="utf-8") if env.exists() else ""): atomic_write(env,envtext)
    atomic_write(config,rendered)
    proc=subprocess.run([sys.executable,str(dest/"proxy.py"),"--env-file",str(env),"--check"],capture_output=True,text=True,timeout=90)
    try: connection=json.loads(proc.stdout)
    except ValueError: connection={"gateway":"blocked","reason":"Connection check returned invalid output."}
    return {"mode":"installed","profile":str(home),"backup":str(backup),"model_and_messaging":"unchanged","connection":connection,"next":"Use /reload-mcp in existing Hermes session, then test from private chat. No posts were sent."}
def main():
    p=argparse.ArgumentParser()
    p.add_argument("--hermes-home")
    p.add_argument("--agent-env",help="Path to agent-only credential file; never an operator/bridge secret file.")
    p.add_argument("--apply",action="store_true",help="Without this, only show plan.")
    a=p.parse_args()
    try: result=install(profile_home(a.hermes_home),a.apply,a.agent_env);print(json.dumps(result,ensure_ascii=False));return 0
    except (ValueError,OSError,subprocess.TimeoutExpired) as e: print(json.dumps({"status":"blocked","reason":str(e)}));return 1
if __name__=="__main__": raise SystemExit(main())
