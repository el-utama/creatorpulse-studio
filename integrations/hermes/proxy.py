#!/usr/bin/env python3
"""Local stdio MCP adapter. No background requests; only explicit tool calls reach Vercel."""
import argparse
import json
import os
import re
import sys
import urllib.error
import urllib.request
from pathlib import Path
from urllib.parse import urlencode

from environment import HOSTS, key_prefix
ENVIRONMENT = None
BYPASS_FILE = None
SLOT = re.compile(r"[a-f0-9]{32}")
UUID = re.compile(r"[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}")
VERSIONS = ("2025-03-26", "2025-06-18", "2025-11-25")
STR = {"type": "string"}
ID = {"type": "string", "format": "uuid"}
ACCOUNT = {"type": "string", "pattern": "^[a-f0-9]{32}$"}
def tool(name, description, properties=None, required=None):
    return {"name": name, "description": description, "inputSchema": {"type":"object", "properties":properties or {}, "required":required or [], "additionalProperties":False}}
TOOLS = [
    tool("list_accounts","List enrolled TikTok accounts; no tokens."),
    tool("get_analytics","Read account metrics.",{"accountId":ACCOUNT},["accountId"]),
    tool("list_videos","Read one page of videos.",{"accountId":ACCOUNT,"cursor":{"type":"integer","minimum":0}},["accountId"]),
    tool("get_capabilities","Read publication capabilities.",{"accountId":ACCOUNT},["accountId"]),
    tool("list_trends","Read stored sourced observations, not verified live rankings.",{"region":STR,"days":{"type":"integer","minimum":1,"maximum":90}}),
    tool("record_trend","Save real evidence from an authorized research source.",{"topic":STR,"type":{"enum":["topic","hashtag","music","video","keyword"]},"region":STR,"source":{"enum":["tiktok_creative_center","tiktok_discovery_api","google_trends","web_research","manual"]},"sourceUrl":STR,"observedAt":STR,"evidence":STR,"changePct":{"type":"number"},"metric":STR},["topic","type","region","source","sourceUrl","observedAt","evidence"]),
    tool("prepare_post","Create inbox or Direct Post draft; profile requires duration in seconds. Human selects final settings.",{"requestId":ID,"accountId":ACCOUNT,"videoUrl":STR,"caption":STR,"mode":{"enum":["inbox","profile"]},"duration":{"type":"number","exclusiveMinimum":0}},["requestId","accountId","videoUrl","caption","mode"]),
    tool("list_posts","Read publication queue."),
    tool("get_post","Inspect exact draft and state.",{"postId":ID},["postId"]),
    tool("execute_approved_post","Submit approved draft to TikTok once; do not retry uncertain results.",{"postId":ID},["postId"]),
    tool("get_publish_status","Check TikTok publication state.",{"postId":ID},["postId"]),
]
BY_NAME = {t["name"]:t for t in TOOLS}
class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self,*args,**kwargs):
        return None
def key_from_env(path, environment):
    if not path or not Path(path).is_file():
        raise ValueError("Explicit profile credential file required.")
    rows=[line.partition("=")[2].strip().strip('"').strip("'") for line in Path(path).read_text(encoding="utf-8").splitlines() if line.startswith("CREATORPULSE_AGENT_KEY=")]
    prefix=key_prefix(environment)
    if len(rows)!=1 or not rows[0].startswith(prefix) or not re.fullmatch(r"[A-Za-z0-9_-]{32,}", rows[0][len(prefix):]):
        raise ValueError("Missing, invalid or wrong-environment agent credential.")
    return rows[0]
def request(path, key=None, body=None, method="GET"):
    if ENVIRONMENT not in HOSTS: raise ValueError("Explicit environment required.")
    if key and not key.startswith(key_prefix(ENVIRONMENT)): raise ValueError("Wrong-environment credential.")
    headers={"Accept":"application/json","X-CreatorPulse-Environment":ENVIRONMENT}
    if key: headers["Authorization"]="Bearer "+key
    if BYPASS_FILE:
        if ENVIRONMENT!="sandbox": raise ValueError("Preview protection credentials are sandbox-only.")
        try: bypass=Path(BYPASS_FILE).read_text(encoding="utf-8").strip()
        except OSError: raise ValueError("Cannot read the local Preview protection credential.") from None
        if not re.fullmatch(r"[A-Za-z0-9_-]{20,256}",bypass): raise ValueError("Invalid Preview protection credential file.")
        headers["x-vercel-protection-bypass"]=bypass
    if body is not None: headers["Content-Type"]="application/json"
    data=json.dumps(body).encode() if body is not None else None
    req=urllib.request.Request(HOSTS[ENVIRONMENT]+"/api/gateway/v1"+path, data=data, method=method, headers=headers)
    try:
        with urllib.request.build_opener(NoRedirect()).open(req, timeout=40) as r:
            raw=r.read(2_000_001)
            if len(raw)>2_000_000: raise ValueError("Response too large.")
            return json.loads(raw)
    except urllib.error.HTTPError as exc:
        # Avoid echoing upstream response bodies, which might contain sensitive data.
        raise ValueError("Gateway HTTP "+str(exc.code)+". Check configuration, enrollment or approval.") from None
    except (urllib.error.URLError, TimeoutError):
        raise ValueError("Gateway unreachable or timed out. Do not retry uncertain publishing.") from None
def identifier(value, pattern):
    if not isinstance(value,str) or not pattern.fullmatch(value):
        raise ValueError("Invalid account or post identifier.")
    return value
def call(name,a,key):
    if name not in BY_NAME or not isinstance(a,dict):
        raise ValueError("Unknown tool or invalid arguments.")
    schema=BY_NAME[name]["inputSchema"]
    if not set(schema["required"])<=set(a) or not set(a)<=set(schema["properties"]):
        raise ValueError("Missing or unexpected arguments.")
    if name=="list_accounts": return request("/accounts",key)
    if name=="list_posts": return request("/posts",key)
    if name in ("get_analytics","list_videos","get_capabilities"):
        slot=identifier(a["accountId"],SLOT)
        end={"get_analytics":"analytics","list_videos":"videos","get_capabilities":"capabilities"}[name]
        query="?"+urlencode({"cursor":a.get("cursor",0)}) if name=="list_videos" else ""
        return request("/accounts/"+slot+"/"+end+query,key)
    if name=="list_trends":
        return request("/trends?"+urlencode({"region":a.get("region","ID"),"days":a.get("days",7)}),key)
    if name=="record_trend": return request("/trends",key,a,"POST")
    if name=="prepare_post": return request("/posts",key,a,"POST")
    post=identifier(a["postId"],UUID)
    if name=="get_post": return request("/posts/"+post,key)
    return request("/posts/"+post+("/execute" if name=="execute_approved_post" else "/status"),key,method="POST")
def rpc(message, get_key):
    if not isinstance(message,dict) or message.get("jsonrpc")!="2.0":
        return {"jsonrpc":"2.0","id":None,"error":{"code":-32600,"message":"Invalid request"}}
    if "id" not in message: return None
    ident=message["id"];method=message.get("method");params=message.get("params") or {}
    response={"jsonrpc":"2.0","id":ident}
    if method=="initialize":
        requested=params.get("protocolVersion")
        response["result"]={"protocolVersion":requested if requested in VERSIONS else VERSIONS[-1],"capabilities":{"tools":{}},"serverInfo":{"name":"creatorpulse-local","version":"3.4.0"}}
    elif method=="ping": response["result"]={}
    elif method=="tools/list": response["result"]={"tools":TOOLS}
    elif method=="tools/call":
        try:
            data=call(params.get("name"),params.get("arguments",{}),get_key())
            response["result"]={"content":[{"type":"text","text":json.dumps(data,ensure_ascii=False)}],"isError":False}
        except (ValueError,KeyError,TypeError) as exc:
            response["result"]={"content":[{"type":"text","text":str(exc)}],"isError":True}
    else: response["error"]={"code":-32601,"message":"Method not found"}
    return response
def main():
    global ENVIRONMENT,BYPASS_FILE
    parser=argparse.ArgumentParser()
    parser.add_argument("--environment",choices=HOSTS,required=True)
    parser.add_argument("--env-file")
    parser.add_argument("--preview-bypass-file",help="Optional owner-authorized local file containing ONLY the Vercel automation bypass secret; sandbox only.")
    parser.add_argument("--call",choices=BY_NAME.keys())
    parser.add_argument("--args",default="{}")
    parser.add_argument("--check",action="store_true")
    parser.add_argument("--history-check",action="store_true")
    args=parser.parse_args()
    ENVIRONMENT=args.environment
    BYPASS_FILE=args.preview_bypass_file
    if BYPASS_FILE and ENVIRONMENT!="sandbox": parser.error("Preview protection credentials are sandbox-only.")
    get_key=lambda:key_from_env(args.env_file,ENVIRONMENT)
    if args.history_check:
        try:
            data=request("/manual-history-capability",get_key())
            version=data.get("version")
            if type(version) is not int or version not in (0,1): raise ValueError("Invalid history capability.")
            print(json.dumps({"history_version":version}));return 0
        except ValueError:
            print(json.dumps({"history_check":"unverified"}));return 1
    if args.check:
        try:
            health=request("/health")
            if health.get("environment")!=ENVIRONMENT: raise ValueError("Gateway environment mismatch.")
            if not health.get("configured"): raise ValueError("Gateway is not configured.")
            accounts=request("/accounts",get_key()).get("accounts",[])
            print(json.dumps({"gateway":"connected","environment":ENVIRONMENT,"accounts":len(accounts),"posting":health.get("posting","unknown"),"research":"agent_sourced"}))
            return 0 if accounts else 2
        except ValueError as e:
            print(json.dumps({"gateway":"blocked","reason":str(e)}));return 1
    if args.call:
        try: print(json.dumps(call(args.call,json.loads(args.args),get_key()),ensure_ascii=False));return 0
        except ValueError as e: print(json.dumps({"error":str(e)}));return 1
    for line in sys.stdin:
        try: response=rpc(json.loads(line),get_key)
        except (ValueError,TypeError,AttributeError): response={"jsonrpc":"2.0","id":None,"error":{"code":-32700,"message":"Invalid JSON-RPC"}}
        if response is not None: print(json.dumps(response,ensure_ascii=False),flush=True)
    return 0
if __name__=="__main__":
    raise SystemExit(main())
