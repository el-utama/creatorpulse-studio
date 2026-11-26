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
