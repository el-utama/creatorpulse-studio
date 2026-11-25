#!/usr/bin/env python3
"""PC09 Sandbox resume controller. Never elevates, posts, or reads owner secrets."""
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys

ROOT = Path(__file__).resolve().parent
REPO = ROOT.parent.parent
OWNER = ROOT / "windows-owner-agent.ps1"
DASHBOARD = "https://creatorpulse-studio-git-sandbox-total-management1.vercel.app/dashboard"
REQUIRED_TOOLS = {"list_accounts", "list_videos", "get_analytics"}


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


def checked_git():
    branch = run(["git", "-C", REPO, "branch", "--show-current"], timeout=20)
    status = run(["git", "-C", REPO, "status", "--porcelain", "--untracked-files=normal"], timeout=20)
    head = run(["git", "-C", REPO, "rev-parse", "HEAD"], timeout=20)
    upstream = run(["git", "-C", REPO, "rev-parse", "refs/remotes/origin/sandbox"], timeout=20)
    if any(p.returncode for p in (branch, status, head, upstream)) or branch.stdout.strip() != "sandbox" or status.stdout.strip() or head.stdout.strip() != upstream.stdout.strip():
        return None
    return head.stdout.strip()


def rpc_batch(command, calls):
    messages = [{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-11-25","capabilities":{},"clientInfo":{"name":"creatorpulse-resume","version":"1"}}},
                {"jsonrpc":"2.0","method":"notifications/initialized"},
                {"jsonrpc":"2.0","id":2,"method":"tools/list"}]
    for i, (name, arguments) in enumerate(calls, 3):
        if name not in REQUIRED_TOOLS:
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


def execute():
    if os.name != "nt":
        return result("WINDOWS_REQUIRED")
    commit = checked_git()
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
    out = Path(r"C:\ProgramData\CreatorPulseAgent-Sandbox")
    receipt_path = out/"provisioning.json"
    if not receipt_path.is_file():
        syntax = run([*ps,"-File",ROOT/"windows-agent-check.ps1","-Mode","Syntax"])
        if syntax.returncode:
            return result("OWNER_HELPER_SYNTAX_FAILED",commit=commit)
        return result("OWNER_PROVISION",commit=commit,owner_script=str(OWNER),
                      sha256=hashlib.sha256(OWNER.read_bytes()).hexdigest(),
                      action="Open the reviewed script location for the owner. Owner independently stages in administrator-controlled directory, checks this revision passed Windows CI, and runs elevated with no arguments. Never elevate Hermes.")
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
    try:
        yaml = bootstrap.load_yaml()
        data = yaml.safe_load((profile/"config.yaml").read_text(encoding="utf-8"))
        entry = data.get("mcp_servers",{}).get("creatorpulse",{})
        same = entry.get("command")==sys.executable and entry.get("args")==cmd[1:] and entry.get("enabled") is True and dest.is_file() and dest.read_bytes()==(ROOT/"proxy.py").read_bytes() and (dest.parent/"environment.py").read_bytes()==(ROOT/"environment.py").read_bytes() and proxy.key_from_env(env,"sandbox")==key
    except (OSError,ValueError,AttributeError,TypeError):
        same = False
    if not same:
        installed = bootstrap.install(profile,True,source,environment="sandbox",preview_bypass_file=bypass if extra else None)
        if next_gate(preflight,receipt,installed.get("connection",{})) != "ACTIVATE_MCP":
            return result("BOOTSTRAP_CONNECTION_UNVERIFIED",commit=commit)
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
    return result("READONLY_VALIDATED",commit=commit,adapter_readonly="passed",hermes_cli_test_exit=0,accounts=count,
                  caveat="Owner isolation review is an attestation; persistence across reboot and default Hermes messaging are not independently tested here.")


if __name__ == "__main__":
    try:
        print(json.dumps(execute(),ensure_ascii=False))
    except Exception as exc:
        # Do not print exception messages, tracebacks, credential values or upstream data.
        print(json.dumps(result("EXECUTION_BLOCKED",error_type=type(exc).__name__)))
