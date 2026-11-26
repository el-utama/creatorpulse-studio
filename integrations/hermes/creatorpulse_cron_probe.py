#!/usr/bin/env python3
"""PC09 dedicated-profile cron probe. No LLM, publication, trend writes or profile changes."""
import json
import os
import re
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

TOOLS = frozenset(("list_accounts", "get_analytics", "list_videos", "list_trends"))


def profile_context(script, environ):
    local = environ.get("LOCALAPPDATA")
    home = environ.get("HERMES_HOME")
    if not local or not home:
        raise ValueError("PROFILE_CONTEXT_UNVERIFIED")
    expected = (Path(local)/"hermes"/"profiles"/"creatorpulse-sandbox").resolve()
    if Path(home).resolve() != expected or Path(script).resolve().parent != expected/"scripts":
        raise ValueError("WRONG_PROFILE_CONTEXT")
    return expected


def adapter_command(profile):
    receipt = Path(r"C:\ProgramData\CreatorPulseAgent-Sandbox\provisioning.json")
    approval = json.loads(receipt.read_text(encoding="ascii"))
    if (not isinstance(approval, dict) or approval.get("schema") != 1
            or approval.get("owner_isolation_reviewed") is not True
            or type(approval.get("bypass_approved")) is not bool):
        raise ValueError("OWNER_RECEIPT_UNVERIFIED")
    command = [sys.executable, str(profile/"integrations"/"creatorpulse-local"/"proxy.py"),
               "--environment", "sandbox", "--env-file", str(profile/".env")]
    if approval["bypass_approved"]:
        command.extend(["--preview-bypass-file", r"C:\ProgramData\CreatorPulseAgent-Sandbox\preview-bypass.secret"])
    return command


def read_tool(command, name, args):
    if name not in TOOLS:
        raise ValueError("NON_READ_TOOL")
    proc = subprocess.run([*command,"--call",name,"--args",json.dumps(args)],
                          capture_output=True, text=True, encoding="utf-8",
                          errors="replace", timeout=60, check=False)
    if proc.returncode:
        raise ValueError("MCP_READ_FAILED")
    data = json.loads(proc.stdout)
    if not isinstance(data,dict) or "error" in data:
        raise ValueError("MCP_RESPONSE_INVALID")
    return data


def collect(command):
    accounts = read_tool(command,"list_accounts",{}).get("accounts")
    if not isinstance(accounts,list) or not 1 <= len(accounts) <= 3:
        raise ValueError("ACCOUNT_RESPONSE_INVALID")
    rows = []
    for account in accounts:
        if not isinstance(account,dict):
            raise ValueError("ACCOUNT_RESPONSE_INVALID")
        slot = account.get("id")
        if not isinstance(slot,str) or not re.fullmatch(r"[a-f0-9]{32}",slot):
            raise ValueError("ACCOUNT_RESPONSE_INVALID")
        user = read_tool(command,"get_analytics",{"accountId":slot}).get("user")
        if not isinstance(user,dict):
            raise ValueError("ANALYTICS_RESPONSE_INVALID")
        fields = ("follower_count","following_count","likes_count","video_count")
        metrics = {field:user.get(field) for field in fields}
        if any(type(v) is not int or v < 0 for v in metrics.values()):
            raise ValueError("ANALYTICS_RESPONSE_INVALID")
        page = read_tool(command,"list_videos",{"accountId":slot,"cursor":0})
        if not isinstance(page.get("videos"),list) or type(page.get("has_more")) is not bool:
            raise ValueError("VIDEOS_RESPONSE_INVALID")
        rows.append({"account_name":account.get("name"),"metrics":metrics,
                     "first_page_videos":len(page["videos"]),"has_more":page["has_more"]})
    trends = read_tool(command,"list_trends",{"region":"ID","days":7})
    if (trends.get("region") != "ID" or trends.get("days") != 7
            or trends.get("provenance") != "agent_submitted_unverified"
            or not isinstance(trends.get("observations"),list)):
        raise ValueError("TRENDS_RESPONSE_INVALID")
    return {"schema":1,"state":"PASSED","environment":"sandbox","profile":"creatorpulse-sandbox",
            "observed_at":datetime.now(timezone.utc).isoformat(),"accounts":rows,
            "trend_observations":len(trends["observations"]),"mode":"script_only",
            "publication_calls":0,"trend_writes":0}


def main():
    try:
        if os.name != "nt":
            raise ValueError("WINDOWS_REQUIRED")
        profile = profile_context(__file__,os.environ)
        print(json.dumps(collect(adapter_command(profile)),ensure_ascii=True))
        return 0
    except Exception as exc:
        # Never expose exception text from the adapter, filesystem, or upstream.
        print(json.dumps({"schema":1,"state":"BLOCKED","error_type":type(exc).__name__}))
        return 1


if __name__ == "__main__":
    sys.exit(main())
