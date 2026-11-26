# Owner-only additive SQLite upgrade. Review this exact self-contained script and stage under administrator control.
# Do not run from an agent-writable directory. Never elevate Hermes.
$ErrorActionPreference = 'Stop'
function Get-BridgePayload {
    $source = @'
#!/usr/bin/env python3
"""Private SQLite storage bridge for CreatorPulse. No arbitrary SQL/Lua execution."""
import argparse
from datetime import datetime, timezone
import hmac
import json
import os
import re
import sqlite3
import time
from contextlib import closing
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

VAULT = "creatorpulse:v3:vault"
POSTS = "creatorpulse:v3:posts"
ARCHIVED = "creatorpulse:v3:posts:archived"
TRENDS = "creatorpulse:v3:trends"
LOCK = re.compile(r"creatorpulse:v3:lock:[a-f0-9]{32}")
PUBLISH = re.compile(r"creatorpulse:publish:v1:[a-f0-9]{64}")
SLOT = re.compile(r"[a-f0-9]{32}")
UUID = re.compile(r"[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}")
# Exact protocol signatures; these strings are identifiers, not executable programs.
CAS = "if redis.call('HGET',KEYS[1],ARGV[1])~=ARGV[2] then return 0 end redis.call('HSET',KEYS[1],ARGV[1],ARGV[3]) return 1"
ENROLL = "if redis.call('HEXISTS',KEYS[1],ARGV[1])==0 and redis.call('HLEN',KEYS[1])>=3 then return 0 end redis.call('HSET',KEYS[1],ARGV[1],ARGV[2]) return 1"
CREATE = "-- post_create\nif redis.call('HEXISTS',KEYS[1],ARGV[1])==1 then return 2 end if redis.call('HLEN',KEYS[1])>=100 then return 0 end redis.call('HSET',KEYS[1],ARGV[1],ARGV[2]) return 1"
APPEND = "redis.call('LPUSH',KEYS[1],ARGV[1]); redis.call('LTRIM',KEYS[1],0,499); return 1"
UNLOCK = "if redis.call('GET',KEYS[1])==ARGV[1] then return redis.call('DEL',KEYS[1]) end return 0"

def require(condition):
    if not condition:
        raise ValueError("Unsupported storage operation")

def field(table, key):
    return isinstance(key, str) and ((table == VAULT and SLOT.fullmatch(key)) or (table in (POSTS, ARCHIVED) and UUID.fullmatch(key)))

def bounded(value, limit=65536):
    return isinstance(value, str) and 0 < len(value.encode("utf-8")) <= limit

class Store:
    def __init__(self, path):
        self.path = str(path)
        with closing(self.connect()) as c:
            c.execute("PRAGMA journal_mode=WAL")
            c.executescript("""
              CREATE TABLE IF NOT EXISTS records (bucket TEXT NOT NULL, field TEXT NOT NULL, value TEXT NOT NULL, PRIMARY KEY(bucket,field));
              CREATE TABLE IF NOT EXISTS ephemeral (key TEXT PRIMARY KEY, value TEXT NOT NULL, expires REAL NOT NULL);
              CREATE TABLE IF NOT EXISTS rate_limit (id INTEGER PRIMARY KEY CHECK(id=1), minute INTEGER NOT NULL, count INTEGER NOT NULL);
              CREATE TABLE IF NOT EXISTS trends (seq INTEGER PRIMARY KEY AUTOINCREMENT, value TEXT NOT NULL);
              CREATE TABLE IF NOT EXISTS manual_publications (
                account TEXT NOT NULL, request_id TEXT NOT NULL, publish_id TEXT,
                created_at TEXT NOT NULL, mode TEXT NOT NULL, state TEXT NOT NULL,
                status TEXT, updated_at TEXT NOT NULL, failure_reason TEXT,
                imported INTEGER NOT NULL DEFAULT 0,
                PRIMARY KEY(account,request_id), UNIQUE(account,publish_id)
              );
              CREATE INDEX IF NOT EXISTS manual_history_account ON manual_publications(account,created_at DESC);
            """)

    def connect(self):
        c = sqlite3.connect(self.path, timeout=10, isolation_level=None)
        c.execute("PRAGMA busy_timeout=10000")
        c.execute("PRAGMA synchronous=FULL")
        return c

    def run(self, command):
        require(isinstance(command, list) and 1 <= len(command) <= 8)
        require(all(type(x) in (str, int) for x in command))
        with closing(self.connect()) as c:
            c.execute("BEGIN IMMEDIATE")
            try:
                result = self.dispatch(c, command)
                c.execute("COMMIT")
                return result
            except Exception:
                c.execute("ROLLBACK")
                raise

    def dispatch(self, c, cmd):
        op, *a = cmd
        if op == "RATE_AGENT" and not a:
            minute=int(time.time()//60)
            c.execute("INSERT INTO rate_limit VALUES(1,?,1) ON CONFLICT(id) DO UPDATE SET count=CASE WHEN minute=excluded.minute THEN MIN(count+1,61) ELSE 1 END,minute=excluded.minute",(minute,))
            return c.execute("SELECT count FROM rate_limit WHERE id=1").fetchone()[0]
        if op == "PING" and not a:
            return "PONG"
        if op == "MANUAL_CAPS" and not a:
            return 1
        if isinstance(op,str) and op.startswith("MANUAL_"):
            return self.manual(c,op,a)
        if op == "ARCHIVE_POST" and len(a) == 2 and field(POSTS,a[0]) and bounded(a[1]):
            row=c.execute("SELECT value FROM records WHERE bucket=? AND field=?", (POSTS,a[0])).fetchone()
            if not row or row[0] != a[1]: return 0
            c.execute("INSERT INTO records VALUES(?,?,?)",(ARCHIVED,a[0],a[1]))
            c.execute("DELETE FROM records WHERE bucket=? AND field=?",(POSTS,a[0]))
            return 1
        if op == "HGET" and len(a) == 2 and field(*a):
            row = c.execute("SELECT value FROM records WHERE bucket=? AND field=?", a).fetchone()
            return row[0] if row else None
        if op == "HGETALL" and len(a) == 1 and a[0] in (VAULT, POSTS):
            return [v for row in c.execute("SELECT field,value FROM records WHERE bucket=? ORDER BY field", a) for v in row]
        if op == "HKEYS" and len(a) == 1 and a[0] in (VAULT, POSTS):
            return [r[0] for r in c.execute("SELECT field FROM records WHERE bucket=? ORDER BY field", a)]
        if op == "HDEL" and len(a) == 2 and a[0] == VAULT and field(*a):
            return c.execute("DELETE FROM records WHERE bucket=? AND field=?", a).rowcount
        if op == "LRANGE" and a == [TRENDS, 0, 499]:
            return [r[0] for r in c.execute("SELECT value FROM trends ORDER BY seq DESC LIMIT 500")]
        if op in ("SET", "GET"):
            return self.ephemeral(c, op, a)
        if op == "EVAL":
            return self.atomic(c, a)
        raise ValueError("Unsupported storage operation")

    def manual(self,c,op,a):
        # Only account-scoped fixed operations; no arbitrary SQL, no tokens or video bytes.
        require(bool(a) and isinstance(a[0],str) and SLOT.fullmatch(a[0]))
        account = a[0]
        now = datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00","Z")
        columns = "request_id,publish_id,created_at,mode,state,status,updated_at,failure_reason,imported"
        def record(row):
            return dict(zip(("requestId","id","createdAt","mode","state","status","updatedAt","failureReason","imported"),row)) if row else None
        def valid_id(value):
            return isinstance(value,str) and re.fullmatch(r"[A-Za-z0-9_.~-]{1,256}",value)
        def valid_status(value):
            return isinstance(value,str) and re.fullmatch(r"[A-Z0-9_]{1,64}",value)
        def valid_mode(value):
            return value in ("inbox","profile","unknown")
        if op == "MANUAL_LIST":
            require(len(a)==1)
            return [record(r) for r in c.execute("SELECT "+columns+" FROM manual_publications WHERE account=? ORDER BY created_at DESC,request_id DESC LIMIT 200",(account,))]
        if op == "MANUAL_BEGIN":
            require(len(a)==3 and isinstance(a[1],str) and UUID.fullmatch(a[1]) and a[2] in ("inbox","profile"))
            row=c.execute("SELECT "+columns+" FROM manual_publications WHERE account=? AND request_id=?",(account,a[1])).fetchone()
            if row: return record(row)
            c.execute("INSERT INTO manual_publications(account,request_id,created_at,mode,state,updated_at) VALUES(?,?,?,?,?,?)",(account,a[1],now,a[2],"pending",now))
            return None
        if op == "MANUAL_ACCEPT":
            require(len(a)==3 and isinstance(a[1],str) and UUID.fullmatch(a[1]) and valid_id(a[2]))
            row=c.execute("SELECT publish_id,state FROM manual_publications WHERE account=? AND request_id=?",(account,a[1])).fetchone()
            require(row and ((row[0] is None and row[1]=="pending") or row[0]==a[2]))
            c.execute("UPDATE manual_publications SET publish_id=?,state='accepted',updated_at=? WHERE account=? AND request_id=?",(a[2],now,account,a[1]))
            return 1
        if op == "MANUAL_REJECT":
            require(len(a)==4 and isinstance(a[1],str) and UUID.fullmatch(a[1]) and a[2] in ("rejected","uncertain") and isinstance(a[3],str) and re.fullmatch(r"[a-z0-9_]{1,100}",a[3]))
            return c.execute("UPDATE manual_publications SET state=?,failure_reason=?,updated_at=? WHERE account=? AND request_id=? AND state='pending' AND publish_id IS NULL",(a[2],a[3],now,account,a[1])).rowcount
        if op == "MANUAL_STATUS":
            require(len(a)==4 and valid_id(a[1]) and valid_status(a[2]) and isinstance(a[3],str) and (not a[3] or re.fullmatch(r"[a-z0-9_]{1,100}",a[3])))
            # Never let a delayed processing response overwrite a confirmed final status.
            return c.execute("UPDATE manual_publications SET status=?,failure_reason=?,updated_at=? WHERE account=? AND publish_id=? AND (status IS NULL OR status NOT IN ('PUBLISH_COMPLETE','FAILED') OR status=?)",(a[2],a[3] or None,now,account,a[1],a[2])).rowcount
        if op == "MANUAL_IMPORT":
            require(len(a)==6 and valid_id(a[1]) and valid_mode(a[3]) and valid_status(a[4]) and isinstance(a[5],str) and (not a[5] or re.fullmatch(r"[a-z0-9_]{1,100}",a[5])))
            require(isinstance(a[2],str) and re.fullmatch(r"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z",a[2]))
            created=datetime.fromisoformat(a[2].replace("Z","+00:00"))
            require(created.year>=2020 and created<=datetime.now(timezone.utc))
            c.execute("INSERT OR IGNORE INTO manual_publications(account,request_id,publish_id,created_at,mode,state,status,updated_at,failure_reason,imported) VALUES(?,?,?,?,?,'accepted',?,?,?,1)",(account,"import:"+a[1],a[1],a[2],a[3],a[4],now,a[5] or None))
            return record(c.execute("SELECT "+columns+" FROM manual_publications WHERE account=? AND publish_id=?",(account,a[1])).fetchone())
        raise ValueError("Unsupported manual history operation")

    def ephemeral(self, c, op, a):
        require(bool(a) and isinstance(a[0], str))
        key = a[0]
        now = time.time()
        if op == "GET":
            require(len(a) == 1 and PUBLISH.fullmatch(key))
            row = c.execute("SELECT value FROM ephemeral WHERE key=? AND expires>?", (key, now)).fetchone()
            return row[0] if row else None
        require(len(a) >= 4 and bounded(a[1], 8192))
        value, *flags = a[1:]
        if LOCK.fullmatch(key):
            require(flags == ["NX", "PX", 60000] and bool(re.fullmatch(r"[a-f0-9]{48}", value)))
            expires, nx = now + 60, True
        elif PUBLISH.fullmatch(key):
            require(flags in (["EX", 86400, "NX"], ["EX", 86400]))
            expires, nx = now + 86400, "NX" in flags
        else:
            raise ValueError("Unsupported key")
        c.execute("DELETE FROM ephemeral WHERE expires<=?", (now,))
        if nx:
            n = c.execute("INSERT OR IGNORE INTO ephemeral VALUES(?,?,?)", (key, value, expires)).rowcount
            return "OK" if n else None
        c.execute("INSERT INTO ephemeral VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,expires=excluded.expires", (key, value, expires))
        return "OK"

    def atomic(self, c, a):
        require(len(a) >= 4 and a[1] == 1)
        script, _, bucket, *args = a
        if script == UNLOCK:
            require(isinstance(bucket, str) and LOCK.fullmatch(bucket) and len(args) == 1 and bounded(args[0], 48))
            return c.execute("DELETE FROM ephemeral WHERE key=? AND value=?", (bucket, args[0])).rowcount
        if script == APPEND:
            require(bucket == TRENDS and len(args) == 1 and bounded(args[0], 8192))
            c.execute("INSERT INTO trends(value) VALUES(?)", args)
            c.execute("DELETE FROM trends WHERE seq NOT IN (SELECT seq FROM trends ORDER BY seq DESC LIMIT 500)")
            return 1
        require(script in (CAS, ENROLL, CREATE) and len(args) in (2, 3) and field(bucket, args[0]))
        key, *values = args
        require(all(bounded(v) for v in values))
        row = c.execute("SELECT value FROM records WHERE bucket=? AND field=?", (bucket, key)).fetchone()
        if script == CAS:
            require(bucket in (VAULT,POSTS) and len(values) == 2)
            if not row or row[0] != values[0]:
                return 0
            c.execute("UPDATE records SET value=? WHERE bucket=? AND field=?", (values[1], bucket, key))
            return 1
        require(len(values) == 1 and ((script == ENROLL and bucket == VAULT) or (script == CREATE and bucket == POSTS)))
        if script == CREATE and (row or c.execute("SELECT 1 FROM records WHERE bucket=? AND field=?",(ARCHIVED,key)).fetchone()):
            return 2
        limit = 3 if bucket == VAULT else 100
        if not row and c.execute("SELECT COUNT(*) FROM records WHERE bucket=?", (bucket,)).fetchone()[0] >= limit:
            return 0
        c.execute("INSERT INTO records VALUES(?,?,?) ON CONFLICT(bucket,field) DO UPDATE SET value=excluded.value", (bucket, key, values[0]))
        return 1

def serve(store, token, port):
    class Handler(BaseHTTPRequestHandler):
        server_version = "CreatorPulseBridge"
        sys_version = ""
        def setup(self):
            super().setup()
            self.connection.settimeout(15)
        def log_message(self, *_):
            pass  # Never log request bodies, paths or credentials.
        def respond(self, status, value):
            raw = json.dumps(value, separators=(",", ":")).encode()
            self.send_response(status)
            self.send_header("Content-Type", "application/json")
            self.send_header("Cache-Control", "no-store")
            self.send_header("Content-Length", str(len(raw)))
            self.end_headers()
            self.wfile.write(raw)
        def do_GET(self):
            self.respond(405, {"error": "POST required"})
        def do_POST(self):
            if self.path != "/storage/v1":
                return self.respond(404, {"error": "Not found"})
            supplied = self.headers.get("Authorization", "")
            if not hmac.compare_digest(supplied.encode(), ("Bearer " + token).encode()):
                return self.respond(401, {"error": "Unauthorized"})
            if self.headers.get("Transfer-Encoding") or self.headers.get("Content-Type", "").split(";")[0] != "application/json":
                return self.respond(415, {"error": "JSON required"})
            try:
                n = int(self.headers.get("Content-Length", "0"))
                if not 0 < n <= 262144:
                    return self.respond(413, {"error": "Invalid body size"})
                command = json.loads(self.rfile.read(n))
                self.respond(200, {"result": store.run(command)})
            except (ValueError, TypeError, UnicodeError):
                self.respond(400, {"error": "Invalid operation"})
            except sqlite3.Error:
                self.respond(503, {"error": "Storage unavailable"})
            except (TimeoutError, BrokenPipeError, ConnectionResetError):
                return
    server = ThreadingHTTPServer(("127.0.0.1", port), Handler)
    print(f"CreatorPulse Local Bridge listening on 127.0.0.1:{server.server_port}", flush=True)
    server.serve_forever()

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--db", default=os.environ.get("CREATORPULSE_BRIDGE_DB", "./data/creatorpulse.sqlite3"))
    parser.add_argument("--port", type=int, default=int(os.environ.get("CREATORPULSE_BRIDGE_PORT", "8765")))
    args = parser.parse_args()
    token = os.environ.get("CREATORPULSE_BRIDGE_TOKEN", "")
    if len(token) < 32:
        raise SystemExit("Set CREATORPULSE_BRIDGE_TOKEN to a random secret (>=32 characters).")
    os.umask(0o077)
    path = Path(args.db).expanduser().resolve()
    path.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
    serve(Store(path), token, args.port)
'@
    return (($source -replace "\r\n","`n") + "`n")
}
function Get-BridgeBlobSha([string]$Source) {
    $utf8 = [Text.UTF8Encoding]::new($false)
    $bytes = $utf8.GetBytes(($Source -replace "\r\n","`n"))
    $header = $utf8.GetBytes("blob $($bytes.Length)" + [char]0)
    $sha = [Security.Cryptography.SHA1]::Create()
    try { return ([BitConverter]::ToString($sha.ComputeHash([byte[]]($header + $bytes)))).Replace('-','').ToLowerInvariant() }
    finally { $sha.Dispose() }
}
function Assert-PrivatePath([string]$Path,[string]$ServiceSid,[bool]$Writable=$false,[bool]$AllowInherited=$false,[string]$ReviewOwner='') {
    $item = Get-Item -LiteralPath $Path -Force
    if ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) { throw "Protected path contains a reparse point: $Path" }
    $acl = Get-Acl -LiteralPath $Path
    $allowed = @('S-1-5-18','S-1-5-32-544',$ServiceSid)
    $rules = @($acl.GetAccessRules($true,$true,[Security.Principal.SecurityIdentifier]))
    $trustedOwners = @('S-1-5-18','S-1-5-32-544')
    if ($Writable) { $trustedOwners += $ServiceSid }
    $owner = $acl.GetOwner([Security.Principal.SecurityIdentifier]).Value
    if (-not $AllowInherited -and -not $acl.AreAccessRulesProtected) { throw "ACL inheritance unexpected: $Path" }
    if ($owner -notin $trustedOwners -and ($ReviewOwner -eq '' -or $owner -ne $ReviewOwner)) { throw "ACL owner unexpected: $Path (owner=$owner)" }
    # Multiple inherited ACEs for the same permitted identity are safe only if
    # every ACE is Allow, every identity is expected, and effective rights match.
    $rights = @{}
    $writeMask = [Security.AccessControl.FileSystemRights]('Write,Delete,ChangePermissions,TakeOwnership,DeleteSubdirectoriesAndFiles')
    foreach ($r in $rules) {
        $id = $r.IdentityReference.Value
        if ($id -notin $allowed -or $r.AccessControlType -ne 'Allow') { throw "Unexpected ACL identity/type: $Path (sid=$id,type=$($r.AccessControlType))" }
        if ($id -eq $ServiceSid -and -not $Writable -and ($r.FileSystemRights -band $writeMask)) { throw "Service can modify protected code or credentials: $Path" }
        if ($r.PropagationFlags -band [Security.AccessControl.PropagationFlags]::InheritOnly) { continue }
        $rights[$id] = ([int64]$rights[$id] -bor [int64]$r.FileSystemRights)
    }
    foreach ($id in $allowed) {
        $required = if ($id -eq $ServiceSid) { if ($Writable) {[Security.AccessControl.FileSystemRights]::Modify} else {[Security.AccessControl.FileSystemRights]::ReadAndExecute} } else {[Security.AccessControl.FileSystemRights]::FullControl}
        if (-not $rights.ContainsKey($id) -or (($rights[$id] -band [int64]$required) -ne [int64]$required)) { throw "Required ACL rights missing: $Path (sid=$id)" }
    }
    if ($owner -notin $trustedOwners) { return $Path }
}
function Assert-EmbeddedRuntime([string]$Runtime,[string]$Archive,[string[]]$Paths) {
    # Compare the complete runtime to the pinned official archive without executing Python.
    # Only the expected owner mismatch may be repaired; altered or extra code is rejected.
    $item = Get-Item -LiteralPath $Archive -Force
    if ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'Python archive is a reparse point.' }
    if ((Get-FileHash -LiteralPath $Archive -Algorithm SHA256).Hash -ne '9e35319bffedab8b36ad44d8f377cb4f1733bcec257a0b6d04d94f01486ddb38') { throw 'Existing Python archive does not match pinned official SHA256.' }
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $zip = [IO.Compression.ZipFile]::OpenRead($Archive)
    $sha = [Security.Cryptography.SHA256]::Create()
    try {
        $expected = @{}
        foreach ($entry in $zip.Entries) {
            if (-not $entry.Name) { continue }
            $name = $entry.FullName.Replace('/','\')
            if ([IO.Path]::IsPathRooted($name) -or $name.Split('\') -contains '..' -or $expected.ContainsKey($name)) { throw 'Unexpected archive layout.' }
            $stream = $entry.Open()
            try { $expected[$name] = ([BitConverter]::ToString($sha.ComputeHash($stream))).Replace('-','') } finally { $stream.Dispose() }
        }
        foreach ($path in $Paths) {
            $entry = Get-Item -LiteralPath $path -Force
            if ($entry.PSIsContainer) { continue }
            $name = $path.Substring($Runtime.Length+1)
            if (-not $expected.ContainsKey($name) -or (Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash -ne $expected[$name]) { throw "Runtime file differs from official archive: $path" }
            $expected.Remove($name)
        }
        if ($expected.Count) { throw 'Runtime files missing from official archive.' }
    } finally { $sha.Dispose(); $zip.Dispose() }
}
function Repair-ReviewedRuntimeOwner([string]$Path,[string]$ServiceSid) {
    $acl = Get-Acl -LiteralPath $Path
    $acl.SetOwner([Security.Principal.SecurityIdentifier]::new('S-1-5-32-544'))
    Set-Acl -LiteralPath $Path -AclObject $acl
    Assert-PrivatePath $Path $ServiceSid $false $true
}
function Get-ScopedPaths([string]$Root) {
    # Enumerate only explicitly selected Sandbox trees, parent before child.
    $bridge = Join-Path $Root 'local-bridge'
    foreach ($relative in @('','local-bridge','local-bridge\data','local-bridge\.secrets','sandbox-launcher.py','local-bridge\bridge.py','local-bridge\run.py','python-3.13.17-embed-amd64.zip')) {
        $path = if ($relative) { Join-Path $Root $relative } else { $Root }
        $item = Get-Item -LiteralPath $path -Force
        if ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) { throw "Reparse point: $path" }
        $path
    }
    foreach ($relative in @('python','local-bridge\data\sandbox','local-bridge\.secrets\sandbox')) {
        $pending = [Collections.Generic.Stack[string]]::new()
        $pending.Push((Join-Path $Root $relative))
        while ($pending.Count) {
            $path = $pending.Pop()
            $item = Get-Item -LiteralPath $path -Force
            if ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) { throw "Reparse point: $path" }
            $path
            if ($item.PSIsContainer) {
                foreach ($child in @(Get-ChildItem -LiteralPath $path -Force)) { $pending.Push($child.FullName) }
            }
        }
    }
}
function Remove-ScopedUserAllow([string]$Path,[string]$UserSid) {
    $item = Get-Item -LiteralPath $Path -Force
    if ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) { throw "Reparse point: $Path" }
    $acl = Get-Acl -LiteralPath $Path
    $changed = $false
    foreach ($rule in @($acl.GetAccessRules($true,$false,[Security.Principal.SecurityIdentifier]))) {
        if ($rule.IdentityReference.Value -eq $UserSid -and $rule.AccessControlType -eq 'Allow') {
            $acl.RemoveAccessRuleSpecific($rule)
            $changed = $true
        }
    }
    if ($changed) { Set-Acl -LiteralPath $Path -AclObject $acl }
    $actual = Get-Acl -LiteralPath $Path
    if (@($actual.GetAccessRules($true,$true,[Security.Principal.SecurityIdentifier]) | Where-Object {$_.IdentityReference.Value -eq $UserSid -and $_.AccessControlType -eq 'Allow'}).Count) { throw "USER Allow still present: $Path" }
}
function Get-SandboxUserAllowPaths([string[]]$Paths,[string]$UserSid,[string]$ServiceSid,[string]$Data) {
    foreach ($path in $Paths) {
        $acl = Get-Acl -LiteralPath $path
        $allowed = @('S-1-5-18','S-1-5-32-544',$ServiceSid,$UserSid)
        $writable = $path -eq $Data -or $path.StartsWith($Data+'\',[StringComparison]::OrdinalIgnoreCase)
        $owner = $acl.GetOwner([Security.Principal.SecurityIdentifier]).Value
        $ownerAllowed = @('S-1-5-18','S-1-5-32-544')
        if ($writable) { $ownerAllowed += $ServiceSid }
        # Runtime files created by the previous installer may have USER owner;
        # their separate verified-runtime ownership repair handles this case.
        $runtime = $path -match '(?i)\\CreatorPulseBridge\\python(?:\\|$)'
        if ($runtime -or $path -match '(?i)\\python-3\.13\.17-embed-amd64\.zip[string]$Uri,[string]$Command,[string]$Token) {
    $r = Invoke-RestMethod -Uri $Uri -Method Post -Headers @{Authorization="Bearer $Token"} -ContentType 'application/json' -Body $Command -TimeoutSec 10 -MaximumRedirection 0
    return $r.result
}
function Wait-Bridge([string]$Token,[string]$ServiceSid,[bool]$History) {
    for ($i=0;$i -lt 45;$i++) {
        try {
            $listeners = @(Get-NetTCPConnection -LocalPort 8766 -State Listen -ErrorAction SilentlyContinue)
            if ($listeners.Count -eq 1 -and $listeners[0].LocalAddress -eq '127.0.0.1') {
                $process = Get-CimInstance Win32_Process -Filter "ProcessId=$($listeners[0].OwningProcess)"
                $owner = Invoke-CimMethod -InputObject $process -MethodName GetOwnerSid
                if ($owner.ReturnValue -eq 0 -and $owner.Sid -eq $ServiceSid) {
                    $local = Invoke-Storage 'http://127.0.0.1:8766/storage/v1' '["PING"]' $Token
                    $remote = Invoke-Storage 'https://pc09-pr.markhor-cat.ts.net:10000/storage/v1' '["PING"]' $Token
                    if ($local -eq 'PONG' -and $remote -eq 'PONG') {
                        if (-not $History) { return }
                        $l = Invoke-Storage 'http://127.0.0.1:8766/storage/v1' '["MANUAL_CAPS"]' $Token
                        $r = Invoke-Storage 'https://pc09-pr.markhor-cat.ts.net:10000/storage/v1' '["MANUAL_CAPS"]' $Token
                        if ($l -eq 1 -and $r -eq 1) { return }
                    }
                }
            }
        } catch { }
        Start-Sleep -Seconds 1
    }
    throw 'Verified Sandbox listener, identity, local/HTTPS PING or history capability unavailable.'
}
function Stop-KnownTask {
    Stop-ScheduledTask -TaskName 'CreatorPulseBridge-Sandbox' -TaskPath '\'
    for ($i=0;$i -lt 30;$i++) {
        if ((Get-ScheduledTask -TaskName 'CreatorPulseBridge-Sandbox' -TaskPath '\').State -ne 'Running' -and -not (Get-NetTCPConnection -LocalPort 8766 -State Listen -ErrorAction SilentlyContinue)) { return }
        Start-Sleep -Seconds 1
    }
    throw 'Known Sandbox task did not stop; no code replacement allowed.'
}
$principal = [Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator) -or $env:COMPUTERNAME -ne 'PC09-PR') { throw 'Run only as the owner on PC09-PR, elevated.' }
$root = 'C:\ProgramData\CreatorPulseBridge'
$bridge = Join-Path $root 'local-bridge'
$code = Join-Path $bridge 'bridge.py'
$python = Join-Path $root 'python\python.exe'
$launcher = Join-Path $root 'sandbox-launcher.py'
$data = Join-Path $bridge 'data\sandbox'
$db = Join-Path $data 'creatorpulse.sqlite3'
$secret = Join-Path $bridge '.secrets\sandbox\bridge.env'
$service = Get-LocalUser -Name 'CreatorPulseBridge'
if (-not $service.Enabled) { throw 'Restricted service account is unavailable.' }
$sid = $service.SID.Value
$task = Get-ScheduledTask -TaskName 'CreatorPulseBridge-Sandbox' -TaskPath '\'
$taskSid = try { ([Security.Principal.NTAccount]::new($task.Principal.UserId)).Translate([Security.Principal.SecurityIdentifier]).Value } catch { $task.Principal.UserId }
$actions = @($task.Actions)
if ($taskSid -ne $sid -or $task.Principal.RunLevel.ToString() -ne 'Limited' -or $actions.Count -ne 1 -or $actions[0].Execute -ne $python -or $actions[0].WorkingDirectory -ne $bridge -or $actions[0].Arguments -cne ('-I -B "' + $launcher + '"') -or $task.State -ne 'Running') { throw 'Not the known running restricted Sandbox task. No changes made.' }
$userSid = (Get-LocalUser -Name 'USER').SID.Value
if ($userSid -eq $sid -or $userSid -in @('S-1-5-18','S-1-5-32-544')) { throw 'USER identity is not distinct from the service.' }
$approved = $false
$aclRepaired = $false
# Root may have a USER FullControl rule reintroduced after installer success.
# No permission changes are made without a fresh explicit owner decision.
$rootItem = Get-Item -LiteralPath $root -Force
if ($rootItem.Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'Unexpected protected root reparse point.' }
$rootAcl = Get-Acl -LiteralPath $root
$rootUser = @($rootAcl.GetAccessRules($true,$true,[Security.Principal.SecurityIdentifier]) | Where-Object {$_.IdentityReference.Value -eq $userSid -and $_.AccessControlType -eq 'Allow'})
if ($rootUser.Count) {
    # Do not affect production descendants through inheritance.
    foreach ($path in @((Join-Path $bridge 'data'),(Join-Path $bridge '.secrets'))) {
        $item = Get-Item -LiteralPath $path -Force
        if ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) { throw "Unexpected environment parent: $path" }
        if (@(Get-ChildItem -LiteralPath $path -Force | Where-Object {$_.Name -ne 'sandbox'}).Count) { throw "Other environment or files present: $path; root repair blocked." }
    }
    $scope = @(Get-ScopedPaths $root)
    $affected = @(Get-SandboxUserAllowPaths $scope $userSid $sid $data)
    Write-Host "USER has unexpected Allow access on $($affected.Count) known Sandbox paths. This may have exposed data or allowed modification. No historical integrity claim is possible."
    Write-Host 'Repair removes only USER Allow ACEs on the reviewed Sandbox paths. Preserve SYSTEM, Administrators and service access; preserve credentials and database; do not modify production or tunnels.'
    Write-Host 'After repair, verify the official runtime and reviewed source before upgrade. If verification fails, stop; security restrictions remain in place.'
    if ((Read-Host 'Type UPGRADE to approve scoped ACL repair and Bridge upgrade') -cne 'UPGRADE') { throw 'Owner declined. No changes.' }
    $approved = $true
    # Root first, then parent-before-child. Do not restore unsafe ACEs on failure.
    foreach ($path in $affected) { Remove-ScopedUserAllow $path $userSid }
    $remaining = @(Get-SandboxUserAllowPaths @(Get-ScopedPaths $root) $userSid $sid $data)
    if ($remaining.Count) { throw 'Unexpected USER Allow persists after scoped repair.' }
    $aclRepaired = $true
    Write-Host 'Scoped USER Allow removal verified. Existing service task and DB have not been changed.'
}
foreach ($p in @($root,$bridge,$code,$launcher,(Join-Path $bridge '.secrets'),(Join-Path $bridge '.secrets\sandbox'),$secret,(Join-Path $bridge 'run.py'),(Join-Path $bridge 'data'))) {
    Assert-PrivatePath $p $sid
}
# The previous installer extracted Python after ACL normalization. Inherited ACLs
# are acceptable only when the complete tree has exactly the same trusted identities,
# trusted owners and no service write permission.
$runtimeRoot = Join-Path $root 'python'
$reviewOwner = [Security.Principal.WindowsIdentity]::GetCurrent().User.Value
$runtimeItems = [Collections.Generic.List[string]]::new()
$runtimeRepairs = [Collections.Generic.List[string]]::new()
$runtimePaths = [Collections.Generic.Stack[string]]::new()
$runtimePaths.Push($runtimeRoot)
while ($runtimePaths.Count) {
    $runtimePath = $runtimePaths.Pop()
    $runtimeItems.Add($runtimePath)
    $repair = Assert-PrivatePath $runtimePath $sid $false $true $reviewOwner
    if ($repair) { $runtimeRepairs.Add($repair) }
    $runtimeItem = Get-Item -LiteralPath $runtimePath -Force
    if ($runtimeItem.PSIsContainer) {
        foreach ($child in @(Get-ChildItem -LiteralPath $runtimePath -Force)) { $runtimePaths.Push($child.FullName) }
    }
}
if ($runtimeRepairs.Count -or $aclRepaired) {
    Assert-EmbeddedRuntime $runtimeRoot (Join-Path $root 'python-3.13.17-embed-amd64.zip') $runtimeItems.ToArray()
    Write-Host "Verified official Python runtime. $($runtimeRepairs.Count) item(s) created with the owner USER SID require trusted Administrators ownership; no permissions granted."
}
$signature = Get-AuthenticodeSignature -LiteralPath $python
if ($signature.Status -ne 'Valid' -or $signature.SignerCertificate.Subject -notmatch 'Python Software Foundation') { throw 'Existing Python signer could not be verified.' }
Assert-PrivatePath $data $sid $true
Assert-PrivatePath $db $sid $true $true
$payload = Get-BridgePayload
$expected = '8c604ceee7419d42a4354846094f6b69a5ddb4a6'
if ((Get-BridgeBlobSha $payload) -ne $expected) { throw 'Embedded source does not match reviewed Git blob.' }
$oldBytes = [IO.File]::ReadAllBytes($code)
$installed = Get-BridgeBlobSha ([Text.Encoding]::UTF8.GetString($oldBytes))
if ($installed -notin @('ac5239c5fb104e6f0af75f64ef29dc38d5fcf5e8',$expected)) { throw 'Unrecognized installed bridge.py revision; report mismatch without editing.' }
if ($aclRepaired) {
    if ((Get-BridgeBlobSha ([IO.File]::ReadAllText((Join-Path $bridge 'run.py')))) -ne '39c6d17a2ddbc056a2880bff039f16e8359174d4') { throw 'Installed run.py differs from reviewed source; do not execute.' }
    $expectedLauncher = @'
import json
import runpy
import sys
from pathlib import Path

root = Path(__file__).resolve().parent
bridge = root / "local-bridge"
status = bridge / "data" / "sandbox" / "bridge-startup.json"
def record(stage, error=None):
    data = {"stage": stage}
    if error is not None:
        data["error_type"] = type(error).__name__
        for attr in ("errno", "winerror", "sqlite_errorcode"):
            value = getattr(error, attr, None)
            if isinstance(value, int):
                data[attr] = value
    status.write_text(json.dumps(data), encoding="utf-8")

try:
    record("launcher_started")
    sys.path.insert(0, str(bridge))
    import bridge as bridge_module
    record("bridge_imported")
    sys.argv = [str(bridge / "run.py"), "--environment", "sandbox"]
    runpy.run_path(sys.argv[0], run_name="__main__")
    record("bridge_exited")
    sys.exit(1)
except BaseException as exc:
    if isinstance(exc, KeyboardInterrupt):
        raise
    record("startup_failed", exc)
    raise SystemExit(1) from None
'@
    $actualLauncher = [IO.File]::ReadAllText($launcher)
    if (($actualLauncher -replace "\r\n","`n").TrimEnd() -cne ($expectedLauncher -replace "\r\n","`n").TrimEnd()) { throw 'Installed launcher differs from reviewed source; do not execute.' }
}
$rows = @([IO.File]::ReadAllLines($secret) | Where-Object { $_.StartsWith('CREATORPULSE_BRIDGE_TOKEN=') })
if ($rows.Count -ne 1) { throw 'Existing Sandbox credential unavailable.' }
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$token = $rows[0].Substring('CREATORPULSE_BRIDGE_TOKEN='.Length).Trim()
if ($token -notmatch '^cp_sandbox_bridge_[A-Za-z0-9_-]{32,}$') { throw 'Wrong environment credential.' }
Wait-Bridge $token $sid $false
if ($installed -eq $expected -and -not $runtimeRepairs.Count) {
    try { Wait-Bridge $token $sid $true; [pscustomobject]@{state='HISTORY_READY';changed=$false;local='PONG';https='PONG';history_version=1} | ConvertTo-Json; return } catch { throw 'New code already installed but history probe failed. Inspect existing service; do not reinstall.' }
}
Write-Host 'Upgrade only the known Sandbox bridge.py. Stop/restart its existing scheduled task, back up the SQLite database, preserve all credentials, runtime bytes, task configuration and tunnel routes. If reported above, correct ownership only on the verified existing Python runtime. Production is untouched.'
if (-not $approved -and (Read-Host 'Type UPGRADE to approve this scoped change') -cne 'UPGRADE') { throw 'Owner declined. No changes.' }
$backup = Join-Path $data ('creatorpulse.pre-history.' + [guid]::NewGuid().ToString('N') + '.sqlite3')
$codeBackup = Join-Path $bridge ('bridge.py.pre-history.' + [guid]::NewGuid().ToString('N'))
$codeAcl = Get-Acl -LiteralPath $code
$dbAcl = Get-Acl -LiteralPath $db
$utf8 = [Text.UTF8Encoding]::new($false)
$stopped = $false
$changed = $false
try {
    Stop-KnownTask
    $stopped = $true
    if ($runtimeRepairs.Count) {
        foreach ($item in $runtimeRepairs) { Repair-ReviewedRuntimeOwner $item $sid }
        foreach ($item in $runtimeItems) { Assert-PrivatePath $item $sid $false $true }
        Assert-EmbeddedRuntime $runtimeRoot (Join-Path $root 'python-3.13.17-embed-amd64.zip') $runtimeItems.ToArray()
        Write-Host 'Verified Python runtime ownership corrected; no runtime files replaced.'
    }
    if ($aclRepaired) { Assert-EmbeddedRuntime $runtimeRoot (Join-Path $root 'python-3.13.17-embed-amd64.zip') $runtimeItems.ToArray() }
    & $python -I -B -c "import sqlite3,sys; s=sqlite3.connect(sys.argv[1]); d=sqlite3.connect(sys.argv[2]); s.backup(d); assert d.execute('PRAGMA quick_check').fetchone()[0]=='ok'; d.close(); s.close()" $db $backup
    if ($LASTEXITCODE -ne 0 -or -not (Test-Path -LiteralPath $backup -PathType Leaf)) { throw 'SQLite backup failed.' }
    Set-Acl -LiteralPath $backup -AclObject $dbAcl
    Assert-PrivatePath $backup $sid $true $true
    [IO.File]::WriteAllBytes($codeBackup,$oldBytes)
    Set-Acl -LiteralPath $codeBackup -AclObject $codeAcl
    Assert-PrivatePath $codeBackup $sid
    $changed = $true
    [IO.File]::WriteAllText($code,$payload,$utf8)
    Assert-PrivatePath $code $sid
    if ((Get-BridgeBlobSha ([IO.File]::ReadAllText($code))) -ne $expected) { throw 'Installed source verification failed.' }
    & $python -I -B -c "import sys; compile(open(sys.argv[1],encoding='utf-8').read(),sys.argv[1],'exec')" $code
    if ($LASTEXITCODE -ne 0) { throw 'Updated Python source failed compilation.' }
    Start-ScheduledTask -TaskName 'CreatorPulseBridge-Sandbox' -TaskPath '\'
    Wait-Bridge $token $sid $true
    [pscustomobject]@{state='HISTORY_READY';changed=$true;sqlite_backup=$backup;code_backup=$codeBackup;local='PONG';https='PONG';history_version=1} | ConvertTo-Json
} catch {
    # Do not replace the live database with a stale backup. Schema addition is backward compatible.
    if ($stopped) {
        try {
            if ((Get-ScheduledTask -TaskName 'CreatorPulseBridge-Sandbox' -TaskPath '\').State -eq 'Running') { Stop-KnownTask }
            if ($changed) { [IO.File]::WriteAllBytes($code,$oldBytes); Set-Acl -LiteralPath $code -AclObject $codeAcl }
            Start-ScheduledTask -TaskName 'CreatorPulseBridge-Sandbox' -TaskPath '\'
            Wait-Bridge $token $sid $false
        } catch { throw 'Upgrade failed and old service recovery is not verified. Keep backups; no other changes.' }
        throw 'Upgrade failed; old Bridge restarted and PONG verified. Existing database retained.'
    }
    throw 'Upgrade stopped before code replacement. Inspect known scheduled task state.'
}
) { $ownerAllowed += $UserSid }
        if ($owner -notin $ownerAllowed) { throw "Unexpected owner before ACL repair: $path" }
        $rules = @($acl.GetAccessRules($true,$true,[Security.Principal.SecurityIdentifier]))
        if (@($rules | Where-Object {$_.IdentityReference.Value -notin $allowed -or $_.AccessControlType -ne 'Allow'}).Count) { throw "Unexpected other ACL before repair: $path" }
        if (@($rules | Where-Object {$_.IdentityReference.Value -eq $UserSid}).Count) { $path }
    }
}
function Invoke-Storage([string]$Uri,[string]$Command,[string]$Token) {
    $r = Invoke-RestMethod -Uri $Uri -Method Post -Headers @{Authorization="Bearer $Token"} -ContentType 'application/json' -Body $Command -TimeoutSec 10 -MaximumRedirection 0
    return $r.result
}
function Wait-Bridge([string]$Token,[string]$ServiceSid,[bool]$History) {
    for ($i=0;$i -lt 45;$i++) {
        try {
            $listeners = @(Get-NetTCPConnection -LocalPort 8766 -State Listen -ErrorAction SilentlyContinue)
            if ($listeners.Count -eq 1 -and $listeners[0].LocalAddress -eq '127.0.0.1') {
                $process = Get-CimInstance Win32_Process -Filter "ProcessId=$($listeners[0].OwningProcess)"
                $owner = Invoke-CimMethod -InputObject $process -MethodName GetOwnerSid
                if ($owner.ReturnValue -eq 0 -and $owner.Sid -eq $ServiceSid) {
                    $local = Invoke-Storage 'http://127.0.0.1:8766/storage/v1' '["PING"]' $Token
                    $remote = Invoke-Storage 'https://pc09-pr.markhor-cat.ts.net:10000/storage/v1' '["PING"]' $Token
                    if ($local -eq 'PONG' -and $remote -eq 'PONG') {
                        if (-not $History) { return }
                        $l = Invoke-Storage 'http://127.0.0.1:8766/storage/v1' '["MANUAL_CAPS"]' $Token
                        $r = Invoke-Storage 'https://pc09-pr.markhor-cat.ts.net:10000/storage/v1' '["MANUAL_CAPS"]' $Token
                        if ($l -eq 1 -and $r -eq 1) { return }
                    }
                }
            }
        } catch { }
        Start-Sleep -Seconds 1
    }
    throw 'Verified Sandbox listener, identity, local/HTTPS PING or history capability unavailable.'
}
function Stop-KnownTask {
    Stop-ScheduledTask -TaskName 'CreatorPulseBridge-Sandbox' -TaskPath '\'
    for ($i=0;$i -lt 30;$i++) {
        if ((Get-ScheduledTask -TaskName 'CreatorPulseBridge-Sandbox' -TaskPath '\').State -ne 'Running' -and -not (Get-NetTCPConnection -LocalPort 8766 -State Listen -ErrorAction SilentlyContinue)) { return }
        Start-Sleep -Seconds 1
    }
    throw 'Known Sandbox task did not stop; no code replacement allowed.'
}
$principal = [Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator) -or $env:COMPUTERNAME -ne 'PC09-PR') { throw 'Run only as the owner on PC09-PR, elevated.' }
$root = 'C:\ProgramData\CreatorPulseBridge'
$bridge = Join-Path $root 'local-bridge'
$code = Join-Path $bridge 'bridge.py'
$python = Join-Path $root 'python\python.exe'
$launcher = Join-Path $root 'sandbox-launcher.py'
$data = Join-Path $bridge 'data\sandbox'
$db = Join-Path $data 'creatorpulse.sqlite3'
$secret = Join-Path $bridge '.secrets\sandbox\bridge.env'
$service = Get-LocalUser -Name 'CreatorPulseBridge'
if (-not $service.Enabled) { throw 'Restricted service account is unavailable.' }
$sid = $service.SID.Value
foreach ($p in @($root,$bridge,$code,$launcher,(Join-Path $bridge '.secrets'),(Join-Path $bridge '.secrets\sandbox'),$secret,(Join-Path $bridge 'run.py'),(Join-Path $bridge 'data'))) {
    Assert-PrivatePath $p $sid
}
# The previous installer extracted Python after ACL normalization. Inherited ACLs
# are acceptable only when the complete tree has exactly the same trusted identities,
# trusted owners and no service write permission.
$runtimeRoot = Join-Path $root 'python'
$reviewOwner = [Security.Principal.WindowsIdentity]::GetCurrent().User.Value
$runtimeItems = [Collections.Generic.List[string]]::new()
$runtimeRepairs = [Collections.Generic.List[string]]::new()
$runtimePaths = [Collections.Generic.Stack[string]]::new()
$runtimePaths.Push($runtimeRoot)
while ($runtimePaths.Count) {
    $runtimePath = $runtimePaths.Pop()
    $runtimeItems.Add($runtimePath)
    $repair = Assert-PrivatePath $runtimePath $sid $false $true $reviewOwner
    if ($repair) { $runtimeRepairs.Add($repair) }
    $runtimeItem = Get-Item -LiteralPath $runtimePath -Force
    if ($runtimeItem.PSIsContainer) {
        foreach ($child in @(Get-ChildItem -LiteralPath $runtimePath -Force)) { $runtimePaths.Push($child.FullName) }
    }
}
if ($runtimeRepairs.Count) {
    Assert-EmbeddedRuntime $runtimeRoot (Join-Path $root 'python-3.13.17-embed-amd64.zip') $runtimeItems.ToArray()
    Write-Host "Verified official Python runtime. $($runtimeRepairs.Count) item(s) created with the owner USER SID require trusted Administrators ownership; no permissions granted."
}
$signature = Get-AuthenticodeSignature -LiteralPath $python
if ($signature.Status -ne 'Valid' -or $signature.SignerCertificate.Subject -notmatch 'Python Software Foundation') { throw 'Existing Python signer could not be verified.' }
Assert-PrivatePath $data $sid $true
Assert-PrivatePath $db $sid $true $true
$task = Get-ScheduledTask -TaskName 'CreatorPulseBridge-Sandbox' -TaskPath '\'
$taskSid = try { ([Security.Principal.NTAccount]::new($task.Principal.UserId)).Translate([Security.Principal.SecurityIdentifier]).Value } catch { $task.Principal.UserId }
$actions = @($task.Actions)
if ($taskSid -ne $sid -or $task.Principal.RunLevel.ToString() -ne 'Limited' -or $actions.Count -ne 1 -or $actions[0].Execute -ne $python -or $actions[0].WorkingDirectory -ne $bridge -or $actions[0].Arguments -cne ('-I -B "' + $launcher + '"') -or $task.State -ne 'Running') { throw 'Not the known running restricted Sandbox task. No changes made.' }
$payload = Get-BridgePayload
$expected = '8c604ceee7419d42a4354846094f6b69a5ddb4a6'
if ((Get-BridgeBlobSha $payload) -ne $expected) { throw 'Embedded source does not match reviewed Git blob.' }
$oldBytes = [IO.File]::ReadAllBytes($code)
$installed = Get-BridgeBlobSha ([Text.Encoding]::UTF8.GetString($oldBytes))
if ($installed -notin @('ac5239c5fb104e6f0af75f64ef29dc38d5fcf5e8',$expected)) { throw 'Unrecognized installed bridge.py revision; report mismatch without editing.' }
$rows = @([IO.File]::ReadAllLines($secret) | Where-Object { $_.StartsWith('CREATORPULSE_BRIDGE_TOKEN=') })
if ($rows.Count -ne 1) { throw 'Existing Sandbox credential unavailable.' }
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$token = $rows[0].Substring('CREATORPULSE_BRIDGE_TOKEN='.Length).Trim()
if ($token -notmatch '^cp_sandbox_bridge_[A-Za-z0-9_-]{32,}$') { throw 'Wrong environment credential.' }
Wait-Bridge $token $sid $false
if ($installed -eq $expected -and -not $runtimeRepairs.Count) {
    try { Wait-Bridge $token $sid $true; [pscustomobject]@{state='HISTORY_READY';changed=$false;local='PONG';https='PONG';history_version=1} | ConvertTo-Json; return } catch { throw 'New code already installed but history probe failed. Inspect existing service; do not reinstall.' }
}
Write-Host 'Upgrade only the known Sandbox bridge.py. Stop/restart its existing scheduled task, back up the SQLite database, preserve all credentials, runtime bytes, task configuration and tunnel routes. If reported above, correct ownership only on the verified existing Python runtime. Production is untouched.'
if ((Read-Host 'Type UPGRADE to approve this scoped change') -cne 'UPGRADE') { throw 'Owner declined. No changes.' }
$backup = Join-Path $data ('creatorpulse.pre-history.' + [guid]::NewGuid().ToString('N') + '.sqlite3')
$codeBackup = Join-Path $bridge ('bridge.py.pre-history.' + [guid]::NewGuid().ToString('N'))
$codeAcl = Get-Acl -LiteralPath $code
$dbAcl = Get-Acl -LiteralPath $db
$utf8 = [Text.UTF8Encoding]::new($false)
$stopped = $false
$changed = $false
try {
    Stop-KnownTask
    $stopped = $true
    if ($runtimeRepairs.Count) {
        foreach ($item in $runtimeRepairs) { Repair-ReviewedRuntimeOwner $item $sid }
        foreach ($item in $runtimeItems) { Assert-PrivatePath $item $sid $false $true }
        Assert-EmbeddedRuntime $runtimeRoot (Join-Path $root 'python-3.13.17-embed-amd64.zip') $runtimeItems.ToArray()
        Write-Host 'Verified Python runtime ownership corrected; no runtime files replaced.'
    }
    & $python -I -B -c "import sqlite3,sys; s=sqlite3.connect(sys.argv[1]); d=sqlite3.connect(sys.argv[2]); s.backup(d); assert d.execute('PRAGMA quick_check').fetchone()[0]=='ok'; d.close(); s.close()" $db $backup
    if ($LASTEXITCODE -ne 0 -or -not (Test-Path -LiteralPath $backup -PathType Leaf)) { throw 'SQLite backup failed.' }
    Set-Acl -LiteralPath $backup -AclObject $dbAcl
    Assert-PrivatePath $backup $sid $true $true
    [IO.File]::WriteAllBytes($codeBackup,$oldBytes)
    Set-Acl -LiteralPath $codeBackup -AclObject $codeAcl
    Assert-PrivatePath $codeBackup $sid
    $changed = $true
    [IO.File]::WriteAllText($code,$payload,$utf8)
    Assert-PrivatePath $code $sid
    if ((Get-BridgeBlobSha ([IO.File]::ReadAllText($code))) -ne $expected) { throw 'Installed source verification failed.' }
    & $python -I -B -c "import sys; compile(open(sys.argv[1],encoding='utf-8').read(),sys.argv[1],'exec')" $code
    if ($LASTEXITCODE -ne 0) { throw 'Updated Python source failed compilation.' }
    Start-ScheduledTask -TaskName 'CreatorPulseBridge-Sandbox' -TaskPath '\'
    Wait-Bridge $token $sid $true
    [pscustomobject]@{state='HISTORY_READY';changed=$true;sqlite_backup=$backup;code_backup=$codeBackup;local='PONG';https='PONG';history_version=1} | ConvertTo-Json
} catch {
    # Do not replace the live database with a stale backup. Schema addition is backward compatible.
    if ($stopped) {
        try {
            if ((Get-ScheduledTask -TaskName 'CreatorPulseBridge-Sandbox' -TaskPath '\').State -eq 'Running') { Stop-KnownTask }
            if ($changed) { [IO.File]::WriteAllBytes($code,$oldBytes); Set-Acl -LiteralPath $code -AclObject $codeAcl }
            Start-ScheduledTask -TaskName 'CreatorPulseBridge-Sandbox' -TaskPath '\'
            Wait-Bridge $token $sid $false
        } catch { throw 'Upgrade failed and old service recovery is not verified. Keep backups; no other changes.' }
        throw 'Upgrade failed; old Bridge restarted and PONG verified. Existing database retained.'
    }
    throw 'Upgrade stopped before code replacement. Inspect known scheduled task state.'
}
