"""Load private bridge configuration and start the loopback server."""
import os
from pathlib import Path
from bridge import Store, serve
root = Path(__file__).resolve().parent
path = root / ".secrets" / "bridge.env"
if not path.is_file():
    raise SystemExit("Run local-bridge/setup.py first.")
os.umask(0o077)
for line in path.read_text(encoding="utf-8").splitlines():
    if line and not line.startswith("#"):
        key, value = line.split("=", 1)
        if key == "CREATORPULSE_BRIDGE_TOKEN":
            os.environ.setdefault(key, value)
token = os.environ.get("CREATORPULSE_BRIDGE_TOKEN", "")
if len(token) < 32:
    raise SystemExit("Invalid bridge credential.")
db = Path(os.environ.get("CREATORPULSE_BRIDGE_DB", str(root / "data" / "creatorpulse.sqlite3"))).expanduser().resolve()
db.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
serve(Store(db), token, int(os.environ.get("CREATORPULSE_BRIDGE_PORT", "8765")))
