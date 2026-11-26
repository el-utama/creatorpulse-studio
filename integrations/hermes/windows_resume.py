#!/usr/bin/env python3
"""PC09 Sandbox resume controller. Never elevates, posts, or reads owner secrets."""
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys

sys.dont_write_bytecode = True

ROOT = Path(__file__).resolve().parent
REPO = ROOT.parent.parent
OWNER = ROOT / "windows-owner-agent.ps1"
DASHBOARD = "https://creatorpulse-studio-git-sandbox-total-management1.vercel.app/dashboard"
REQUIRED_TOOLS = {"list_accounts", "list_videos", "get_analytics"}


# Known retired paths; direct file-open probes do not read any bytes.
LEGACY_SUBTREES = (".secrets/sandbox", "local-bridge/.secrets/sandbox",
                   "data/sandbox", "local-bridge/data/sandbox")
LEGACY_FILES = (".secrets/bridge.env", ".secrets/vercel.env", ".secrets/hermes.env",
                "local-bridge/.secrets/bridge.env", "local-bridge/.secrets/vercel.env",
                "local-bridge/.secrets/hermes.env", ".env.local", "local-bridge/.env.local")


def access_status(path, directory=False):
    """Test effective listing/open rights only; never read file data."""
    try:
        if directory:
            with os.scandir(path):
                pass
        else:
            fd = os.open(path, os.O_RDONLY | getattr(os, "O_BINARY", 0))
            os.close(fd)
        return "accessible"
    except (FileNotFoundError, NotADirectoryError):
        return "absent"
    except PermissionError:
        return "denied"
    except OSError:
        return "unknown"


def audit_legacy(root):
    probes = {}
    for rel in LEGACY_SUBTREES:
        probes[rel] = access_status(root/rel, True)
        filenames = ("bridge.env","vercel.env","hermes.env") if ".secrets/" in rel else ("creatorpulse.sqlite3","creatorpulse.sqlite3-wal","creatorpulse.sqlite3-shm")
        for name in filenames:
            probes[rel+"/"+name] = access_status(root/rel/name)
    for rel in LEGACY_FILES:
        probes[rel] = access_status(root/rel)
    return probes


def legacy_clear(probes):
    return bool(probes) and all(v in ("absent","denied") for v in probes.values())


def result(state, **fields):
    return {"schema": 1, "state": state, "environment": "sandbox", **fields}


def next_gate(preflight, receipt, gateway=None):
    """Pure ordered decision table. No previous report is trusted as host evidence."""
    if preflight.get("host", "").upper() != "PC09-PR" or preflight.get("identity", "").upper() != "PC09-PR\\USER" or preflight.get("elevated") is not False:
        return "WRONG_HOST_OR_IDENTITY"
    if preflight.get("service_account") != "enabled":
        return "BRIDGE_ACCOUNT_UNVERIFIED"
    listeners = preflight.get("listener")
    if isinstance(listeners, dict):
        listeners = [listeners]
    if not isinstance(listeners, list) or len(listeners) != 1 or listeners[0].get("LocalAddress") != "127.0.0.1" or listeners[0].get("LocalPort") != 8766:
        return "BRIDGE_LISTENER_UNVERIFIED"
    if receipt is None:
        return "OWNER_PROVISION"
    if not isinstance(receipt, dict) or receipt.get("schema") != 1 or receipt.get("owner_isolation_reviewed") is not True or type(receipt.get("bypass_approved")) is not bool:
        return "OWNER_RECEIPT_INVALID"
    if gateway is None:
        return "CHECK_GATEWAY"
    if gateway.get("gateway") != "connected" or gateway.get("environment") != "sandbox":
        return "GATEWAY_BLOCKED" if receipt["bypass_approved"] else "PREVIEW_ACCESS_OR_GATEWAY_BLOCKED"
    n = gateway.get("accounts")
    if type(n) is not int or not 0 <= n <= 3:
        return "GATEWAY_RESPONSE_INVALID"
    if not n:
        return "OWNER_ENROLL"
    return "ACTIVATE_MCP"


def run(args, *, input_text=None, timeout=90):
    return subprocess.run([str(x) for x in args], input=input_text, text=True,
                          encoding="utf-8", errors="replace", capture_output=True,
                          timeout=timeout, check=False)


def parse_json(proc):
    try:
        obj = json.loads(proc.stdout)
        return obj if isinstance(obj, dict) else {}
    except (ValueError, TypeError):
        return {}


def git_executable():
    # PC09 has a working machine-wide Git; do not spawn the WindowsApps alias.
    installed = Path(r"C:\Program Files\Git\cmd\git.exe")
    if installed.is_file():
        return str(installed)
    resolved = shutil.which("git.exe") or shutil.which("git")
    if not resolved or "windowsapps" in Path(resolved).parts[-1].lower() or any(p.lower()=="windowsapps" for p in Path(resolved).parts):
        return None
    return resolved


def checked_git(git):
    branch = run([git, "-C", REPO, "branch", "--show-current"], timeout=20)
    status = run([git, "-C", REPO, "status", "--porcelain", "--untracked-files=normal"], timeout=20)
    head = run([git, "-C", REPO, "rev-parse", "HEAD"], timeout=20)
    upstream = run([git, "-C", REPO, "rev-parse", "refs/remotes/origin/sandbox"], timeout=20)
    if any(p.returncode for p in (branch, status, head, upstream)) or branch.stdout.strip() != "sandbox" or status.stdout.strip() or head.stdout.strip() != upstream.stdout.strip():
        return None
    return head.stdout.strip()


def rpc_batch(command, calls):
    messages = [{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-11-25","capabilities":{},"clientInfo":{"name":"creatorpulse-resume","version":"1"}}},
                {"jsonrpc":"2.0","method":"notifications/initialized"},
                {"jsonrpc":"2.0","id":2,"method":"tools/list"}]
    for i, (name, arguments) in enumerate(calls, 3):
        if name not in REQUIRED_TOOLS | {"list_trends"}:
            raise ValueError("Non-read-only validation forbidden")
        messages.append({"jsonrpc":"2.0","id":i,"method":"tools/call","params":{"name":name,"arguments":arguments}})
    proc = run(command, input_text="".join(json.dumps(m)+"\n" for m in messages), timeout=150)
    if proc.returncode:
        raise ValueError("MCP subprocess failed")
    responses = {}
    for line in proc.stdout.splitlines():
        obj = json.loads(line)
        if obj.get("id") in responses:
            raise ValueError("Duplicate MCP response")
        responses[obj.get("id")] = obj
    if not responses.get(1,{}).get("result",{}).get("serverInfo"):
        raise ValueError("MCP initialize failed")
    names = {t["name"] for t in responses.get(2,{}).get("result",{}).get("tools",[])}
    if not REQUIRED_TOOLS <= names:
        raise ValueError("MCP discovery incomplete")
    data = []
    for i in range(3,3+len(calls)):
        res = responses.get(i,{}).get("result",{})
        if res.get("isError") is not False:
            raise ValueError("MCP read-only call failed")
        data.append(json.loads(res["content"][0]["text"]))
    return data


def account_id(payload):
    import re
    accounts = payload.get("accounts") if isinstance(payload, dict) else None
    if not isinstance(accounts, list) or not 1 <= len(accounts) <= 3:
        raise ValueError("No valid enrolled accounts")
    first = accounts[0]
    if not isinstance(first, dict):
        raise ValueError("Account schema invalid")
    ids = {first.get(k) for k in ("id","accountId","slotId","slot") if isinstance(first.get(k),str) and re.fullmatch(r"[a-f0-9]{32}",first[k])}
    if len(ids) != 1:
        raise ValueError("Account identifier schema invalid")
    return ids.pop(), len(accounts)


def validate_adapter(command):
    payload, = rpc_batch(command, [("list_accounts",{})])
    slot, count = account_id(payload)
    videos, analytics = rpc_batch(command, [("list_videos",{"accountId":slot}),("get_analytics",{"accountId":slot})])
    if not all(isinstance(x,dict) and "error" not in x for x in (videos,analytics)):
        raise ValueError("Read-only response schema invalid")
    return count


def check_research_read(command):
    try:
        data, = rpc_batch(command, [("list_trends",{"region":"ID","days":7})])
        if (not isinstance(data,dict) or data.get("region")!="ID" or data.get("days")!=7
                or data.get("provenance")!="agent_submitted_unverified" or not isinstance(data.get("observations"),list)):
            return {"state":"unverified","region":"ID","days":7}
        return {"state":"passed","region":"ID","days":7,"observations":len(data["observations"])}
    except (ValueError, OSError, TypeError, KeyError, subprocess.TimeoutExpired):
        return {"state":"unverified","region":"ID","days":7}


def report_validation(commit, count, key, bypass_file):
    # Only called after successful adapter reads and dedicated Hermes CLI test.
    # Uses the existing restricted Sandbox credential; never sends raw tool output.
    import proxy
    proxy.ENVIRONMENT = "sandbox"
    proxy.BYPASS_FILE = bypass_file
    try:
        response = proxy.request("/hermes-validation", key, {
            "schema": 1, "commit": commit, "accounts": count,
            "adapter_readonly": "passed", "hermes_cli_test_exit": 0,
        }, "POST")
        report = response.get("report", {})
        if (response.get("state") != "reported" or report.get("commit") != commit
                or report.get("accounts") != count or report.get("source") != "controller_report"
                or not isinstance(report.get("reportedAt"), str)):
            return {"state": "unverified"}
        return {"state": "reported", "reported_at": report["reportedAt"]}
    except Exception:
        # A telemetry failure cannot turn a successful local validation into a failure.
        return {"state": "unverified"}


def finish_validation(cmd, commit, key, bypass_file):
    count = validate_adapter(cmd)
    hermes = shutil.which("hermes")
    if not hermes:
        return result("HERMES_CLI_UNVERIFIED",commit=commit,adapter_readonly="passed",accounts=count)
    # Inspect installed command support before invocation. Never run an agent chat or messaging gateway.
    help_result = run([hermes,"-p","creatorpulse-sandbox","mcp","test","--help"],timeout=30)
    if help_result.returncode or "test" not in help_result.stdout.lower():
        return result("HERMES_CLI_TEST_UNSUPPORTED",commit=commit,adapter_readonly="passed",accounts=count)
    tested = run([hermes,"-p","creatorpulse-sandbox","mcp","test","creatorpulse"],timeout=120)
    if tested.returncode:
        return result("HERMES_CLI_TEST_FAILED",commit=commit,adapter_readonly="passed",accounts=count)
    report = report_validation(commit, count, key, bypass_file)
    return result("READONLY_VALIDATED",commit=commit,adapter_readonly="passed",hermes_cli_test_exit=0,accounts=count,dashboard_validation=report,
                  caveat="Known old paths passed access probes; isolation elsewhere is owner-attested. Persistence across reboot and default Hermes messaging are not independently tested here.")


def controller_yaml(bootstrap):
    # Reuse an already installed dependency, including the isolated scratch
    # library provisioned on PC09. Never pip-install or modify Hermes here.
    try:
        return bootstrap.load_yaml()
    except ValueError:
        local = os.environ.get("LOCALAPPDATA")
        if not local:
            return None
        library = Path(local)/"hermes"/"cache"/"scratch"/"pyyaml-lib"
        if not (library/"yaml"/"__init__.py").is_file():
            return None
        path = str(library)
        sys.path.append(path)
        try:
            return bootstrap.load_yaml()
        except (ValueError, ImportError, OSError):
            return None
        finally:
            sys.path.remove(path)


def execute():
    if os.name != "nt":
        return result("WINDOWS_REQUIRED")
    git = git_executable()
    if not git:
        return result("GIT_EXECUTION_BLOCKED", action="No usable Git executable; do not change system PATH or install software.")
    try:
        commit = checked_git(git)
    except (OSError, subprocess.TimeoutExpired):
        return result("GIT_EXECUTION_BLOCKED", action="Git subprocess unavailable; report blocker without changing system PATH.")
    if not commit:
        return result("CHECKOUT_BLOCKED", action="Use clean sandbox checkout; fetch and fast-forward only. Never reset dirty files.")
    ps = ["powershell.exe","-NoProfile","-NonInteractive"]
    pre = run([*ps,"-File",ROOT/"windows-preflight.ps1"])
    if pre.returncode:
        return result("PREFLIGHT_FAILED", commit=commit)
    preflight = parse_json(pre)
    initial = next_gate(preflight,None)
    if initial != "OWNER_PROVISION":
        return result(initial, commit=commit)
    profile = Path(os.environ["LOCALAPPDATA"])/"hermes"/"profiles"/"creatorpulse-sandbox"
    if not (profile/"config.yaml").is_file():
        return result("DEDICATED_PROFILE_MISSING",commit=commit)
    legacy = audit_legacy(Path(r"C:\Users\USER\CreatorPulseBridge"))
    profile_env = access_status(profile/".env")
    if profile_env not in ("accessible","absent"):
        return result("PROFILE_ENV_ACCESS_BLOCKED",commit=commit,profile_env=profile_env)
    out = Path(r"C:\ProgramData\CreatorPulseAgent-Sandbox")
    receipt_path = out/"provisioning.json"
    if not receipt_path.is_file():
        syntax = run([*ps,"-File",ROOT/"windows-agent-check.ps1","-Mode","Syntax"])
        if syntax.returncode:
            return result("OWNER_HELPER_SYNTAX_FAILED",commit=commit)
        return result("OWNER_PROVISION",commit=commit,owner_script=str(OWNER),
                      sha256=hashlib.sha256(OWNER.read_bytes()).hexdigest(),
                      legacy_access=legacy, profile_env=profile_env,
                      action="Open the reviewed script location for the owner. Owner independently stages in administrator-controlled directory, checks this revision passed Windows CI, and runs elevated with no arguments. Never elevate Hermes.")
    if not legacy_clear(legacy):
        return result("OWNER_LEGACY_ACCESS_BLOCKED",commit=commit,legacy_access=legacy,
                      action="Do not activate MCP. Report the remaining known paths without reading contents.")
    acl = run([*ps,"-File",ROOT/"windows-agent-check.ps1","-Mode","Receipt"])
    if acl.returncode:
        return result("OWNER_RECEIPT_ACL_UNVERIFIED",commit=commit)
    receipt = json.loads(receipt_path.read_text(encoding="ascii"))
    state = next_gate(preflight,receipt)
    if state != "CHECK_GATEWAY":
        return result(state,commit=commit)
    source = out/"hermes.env"
    bypass = out/"preview-bypass.secret"
    extra = ["--preview-bypass-file",str(bypass)] if receipt["bypass_approved"] else []
    check = run([sys.executable,ROOT/"proxy.py","--environment","sandbox","--env-file",source,*extra,"--check"])
    gateway = parse_json(check)
    state = next_gate(preflight,receipt,gateway)
    if state in ("OWNER_ENROLL","ACTIVATE_MCP"):
        history = run([sys.executable,ROOT/"proxy.py","--environment","sandbox","--env-file",source,*extra,"--history-check"])
        capability = parse_json(history)
        if history.returncode or type(capability.get("history_version")) is not int:
            return result("HISTORY_CAPABILITY_UNVERIFIED",commit=commit,action="Check deployment and authenticated Gateway; do not reinstall or elevate.")
        if capability["history_version"] == 0:
            helper = ROOT/"windows-owner-history.ps1"
            syntax = run([*ps,"-File",ROOT/"windows-agent-check.ps1","-Mode","HistorySyntax"])
            if syntax.returncode:
                return result("OWNER_HELPER_SYNTAX_FAILED",commit=commit)
            return result("OWNER_HISTORY_UPGRADE",commit=commit,owner_script=str(helper),
                          sha256=hashlib.sha256(helper.read_bytes()).hexdigest(),
                          account_count=gateway.get("accounts"),
                          action="Open the exact reviewed helper location. Owner checks Verify and Windows CI for this revision, independently stages in an administrator-controlled directory, then runs elevated with no arguments and approves UPGRADE. No Hermes elevation or secret access. Resume same controller afterward.")
        if capability["history_version"] != 1:
            return result("HISTORY_CAPABILITY_UNVERIFIED",commit=commit)
    if state == "OWNER_ENROLL":
        return result(state,commit=commit,owner_url=DASHBOARD,action="Owner connects TikTok and enrolls at least one account using existing Operator Key. Resume after enrollment.")
    if state != "ACTIVATE_MCP":
        return result(state,commit=commit,action="Report blocker without changing credentials or protection.")
    # No owner files are accessed here; the helper exported only the agent key.
    import bootstrap
    import proxy
    key = proxy.key_from_env(source,"sandbox")
    dest = profile/"integrations"/"creatorpulse-local"/"proxy.py"
    env = profile/".env"
    cmd = [sys.executable,str(dest),"--environment","sandbox","--env-file",str(env),*extra]
    yaml = controller_yaml(bootstrap)
    if yaml is None:
        return result("PY_YAML_UNAVAILABLE",commit=commit,action="No existing compatible PyYAML. Report blocker; do not install into Hermes or improvise a wrapper.")
    try:
        data = yaml.safe_load((profile/"config.yaml").read_text(encoding="utf-8"))
        entry = data.get("mcp_servers",{}).get("creatorpulse",{})
        same = entry.get("command")==sys.executable and entry.get("args")==cmd[1:] and entry.get("enabled") is True and dest.is_file() and dest.read_bytes()==(ROOT/"proxy.py").read_bytes() and (dest.parent/"environment.py").read_bytes()==(ROOT/"environment.py").read_bytes() and proxy.key_from_env(env,"sandbox")==key
    except (OSError,ValueError,AttributeError,TypeError):
        same = False
    if not same:
        installed = bootstrap.install(profile,True,source,environment="sandbox",preview_bypass_file=bypass if extra else None)
        if next_gate(preflight,receipt,installed.get("connection",{})) != "ACTIVATE_MCP":
            return result("BOOTSTRAP_CONNECTION_UNVERIFIED",commit=commit)
    try:
        skill_state = bootstrap.sync_managed_skill(profile,environment="sandbox")
    except (OSError,ValueError):
        return result("CREATORPULSE_SKILL_SYNC_BLOCKED",commit=commit,action="Report blocker; do not overwrite an unrelated skill or modify Hermes configuration.")
    final = finish_validation(cmd, commit, key, bypass if extra else None)
    final["skill_sync"] = skill_state
    if final["state"] == "READONLY_VALIDATED":
        final["research_read"] = check_research_read(cmd)
    final["host_observation"] = {"boot_utc": preflight.get("boot_utc", "unknown"), "bridge_task": preflight.get("task", "unknown"), "listener_verified": True}
    return final


if __name__ == "__main__":
    try:
        print(json.dumps(execute(),ensure_ascii=False))
    except Exception as exc:
        # Do not print exception messages, tracebacks, credential values or upstream data.
        print(json.dumps(result("EXECUTION_BLOCKED",error_type=type(exc).__name__)))
