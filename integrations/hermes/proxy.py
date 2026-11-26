#!/usr/bin/env python3
"""Local stdio MCP adapter. No background requests; only explicit tool calls reach Vercel."""
import argparse
import hashlib
import stat
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
REGION = {"type":"string","pattern":"^[A-Za-z]{2}$","description":"ISO alpha-2 country code, e.g. ID for Indonesia."}
def tool(name, description, properties=None, required=None):
    return {"name": name, "description": description, "inputSchema": {"type":"object", "properties":properties or {}, "required":required or [], "additionalProperties":False}}
TOOLS = [
    tool("list_accounts","List enrolled TikTok accounts; no tokens."),
    tool("get_analytics","Read account metrics.",{"accountId":ACCOUNT},["accountId"]),
    tool("list_videos","Read one page of videos.",{"accountId":ACCOUNT,"cursor":{"type":"integer","minimum":0}},["accountId"]),
    tool("get_capabilities","Read publication capabilities.",{"accountId":ACCOUNT},["accountId"]),
    tool("list_trends","Read stored sourced observations, not verified live rankings.",{"region":REGION,"days":{"type":"integer","minimum":1,"maximum":90}}),
    tool("record_trend","Save real evidence from an authorized research source.",{"topic":STR,"type":{"enum":["topic","hashtag","music","video","keyword"]},"region":REGION,"source":{"enum":["tiktok_creative_center","tiktok_discovery_api","google_trends","web_research","manual"]},"sourceUrl":STR,"observedAt":STR,"evidence":STR,"changePct":{"type":"number"},"metric":STR},["topic","type","region","source","sourceUrl","observedAt","evidence"]),
    tool("prepare_post","Create inbox or Direct Post draft; profile requires duration in seconds. Human selects final settings.",{"requestId":ID,"accountId":ACCOUNT,"videoUrl":STR,"caption":STR,"mode":{"enum":["inbox","profile"]},"duration":{"type":"number","exclusiveMinimum":0}},["requestId","accountId","videoUrl","caption","mode"]),
    tool("prepare_local_post","Sandbox: prepare draft for an owner-supplied local MP4 (max 4 MiB); sends only basename, size and SHA-256. Explicit owner file authorization required.",{"requestId":ID,"accountId":ACCOUNT,"filePath":STR,"caption":STR,"mode":{"enum":["inbox","profile"]},"duration":{"type":"number","exclusiveMinimum":0}},["requestId","accountId","filePath","caption","mode"]),
    tool("execute_local_post","Sandbox: upload the same reviewed local MP4 once, only with explicit owner instruction and dashboard approval. Never retry uncertain submissions.",{"postId":ID,"filePath":STR},["postId","filePath"]),
    tool("list_posts","Read publication queue."),
    tool("get_post","Inspect exact draft and state.",{"postId":ID},["postId"]),
    tool("execute_approved_post","Submit approved draft to TikTok once; do not retry uncertain results.",{"postId":ID},["postId"]),
    tool("get_publish_status","Check publication status; statusSource=tiktok only when upstream queried, stored otherwise. API completion does not prove playback.",{"postId":ID},["postId"]),
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
    if isinstance(body,bytes):
        headers["Content-Type"]="video/mp4"
        data=body
    else:
        if body is not None: headers["Content-Type"]="application/json"
        data=json.dumps(body).encode() if body is not None else None
    req=urllib.request.Request(HOSTS[ENVIRONMENT]+"/api/gateway/v1"+path, data=data, method=method, headers=headers)
    try:
        with urllib.request.build_opener(NoRedirect()).open(req, timeout=40) as r:
            raw=r.read(2_000_001)
            if len(raw)>2_000_000: raise ValueError("Response too large.")
            return json.loads(raw)
    except urllib.error.HTTPError as exc:
        # Only allow exact, known static trend validation messages. Never echo raw upstream bodies.
        detail = ""
        if exc.code == 400 and path.split("?",1)[0] == "/trends":
            try:
                raw = exc.read(4097)
                if len(raw) <= 4096:
                    body = json.loads(raw)
                    error = body.get("error") if isinstance(body,dict) else None
                    known = {
                        "Filter tren tidak valid.":"Invalid region or days; use ID and integer 1–90.",
                        "Observasi tidak valid.":"Observation must be an object.",
                        "Topik, tipe, negara, sumber, tautan dan bukti wajib diisi.":"Check required observation fields, region and source/type enums.",
                        "Tautan sumber HTTPS tidak cocok.":"HTTPS source URL does not match source type.",
                        "Waktu observasi tidak valid atau terlalu lama.":"Observation timestamp must be valid and within 90 days.",
                        "Perubahan persentase tidak valid.":"Invalid changePct.",
                        "Definisi metrik wajib untuk persentase perubahan.":"Metric definition required with changePct.",
                    }
                    if isinstance(error,str):
                        detail = known.get(error,"")
            except (ValueError,OSError,TypeError):
                pass
        raise ValueError("Gateway HTTP "+str(exc.code)+". "+(detail or "Check configuration, enrollment or approval.")) from None
    except (urllib.error.URLError, TimeoutError):
        raise ValueError("Gateway unreachable or timed out. Do not retry uncertain publishing.") from None
def identifier(value, pattern):
    if not isinstance(value,str) or not pattern.fullmatch(value):
        raise ValueError("Invalid account or post identifier.")
    return value
def trend_region(value):
    if isinstance(value,str):
        value = value.strip()
        # Common natural-language input for this deployment, without guessing other regions.
        if value.casefold() == "indonesia":
            return "ID"
        if re.fullmatch(r"[A-Za-z]{2}",value):
            return value.upper()
    raise ValueError("Trend region must be a two-letter country code (ID for Indonesia).")

def local_video(path):
    if ENVIRONMENT!="sandbox": raise ValueError("Local agent upload is Sandbox-only.")
    if not isinstance(path,str): raise ValueError("Explicit owner-supplied MP4 path required.")
    p=Path(path)
    try:
        if not p.is_absolute() or p.suffix.lower()!=".mp4" or p.resolve(strict=True)!=p.absolute() or p.is_symlink() or not stat.S_ISREG(p.stat().st_mode):
            raise ValueError("Explicit regular MP4 file required.")
        with p.open("rb") as f:
            data=f.read(4*1024*1024+1)
    except OSError:
        raise ValueError("Local video not readable.") from None
    if not 12<=len(data)<=4*1024*1024 or data[4:8]!=b"ftyp": raise ValueError("Local video must be MP4, at most 4 MiB.")
    return data,{"name":p.name,"size":len(data),"sha256":hashlib.sha256(data).hexdigest()}

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
        region=trend_region(a.get("region","ID"))
        days=a.get("days",7)
        if type(days) is not int or not 1 <= days <= 90:
            raise ValueError("Trend days must be an integer from 1 to 90.")
        return request("/trends?"+urlencode({"region":region,"days":days}),key)
    if name=="record_trend":
        normalized={**a,"region":trend_region(a["region"])}
        return request("/trends",key,normalized,"POST")
    if name=="prepare_post": return request("/posts",key,a,"POST")
    if name=="prepare_local_post":
        _,media=local_video(a["filePath"])
        return request("/posts",key,{**{k:v for k,v in a.items() if k!="filePath"},"localMedia":media},"POST")
    post=identifier(a["postId"],UUID)
    if name=="get_post": return request("/posts/"+post,key)
    if name=="execute_local_post":
        current=request("/posts/"+post,key)
        if current.get("state")!="approved" or not isinstance(current.get("localMedia"),dict): raise ValueError("Local draft must be approved; do not retry uncertain uploads.")
        data,media=local_video(a["filePath"])
        if media!=current["localMedia"]: raise ValueError("Local video changed after review.")
        return request("/posts/"+post+"/execute-file",key,data,"POST")
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
