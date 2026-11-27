"""Start only an explicitly selected environment with isolated credentials and DB."""
import argparse
import os
from pathlib import Path
from bridge import Store, serve
root=Path(__file__).resolve().parent
parser=argparse.ArgumentParser()
parser.add_argument("--environment",choices=["sandbox","production"],required=True)
args=parser.parse_args()
environment=args.environment
path=root/".secrets"/environment/"bridge.env"
if not path.is_file(): raise SystemExit("Run setup.py for the same environment first.")
os.umask(0o077)
rows=[line.partition("=")[2].strip() for line in path.read_text(encoding="utf-8").splitlines() if line.startswith("CREATORPULSE_BRIDGE_TOKEN=")]
prefix="cp_"+environment+"_bridge_"
if len(rows)!=1 or not rows[0].startswith(prefix) or len(rows[0])<len(prefix)+32:
    raise SystemExit("Invalid or wrong-environment bridge credential.")
# Do not inherit another process's DB, port or credentials.
db=root/"data"/environment/"creatorpulse.sqlite3"
db.parent.mkdir(mode=0o700,parents=True,exist_ok=True)
serve(Store(db),rows[0],8766 if environment=="sandbox" else 8765)
