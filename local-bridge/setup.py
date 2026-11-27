"""Generate one-time secrets without printing them. Never overwrite."""
import argparse
import base64
import os
import secrets
from pathlib import Path

root = Path(__file__).resolve().parent
parser=argparse.ArgumentParser()
parser.add_argument("--environment",choices=["sandbox","production"],required=True)
args=parser.parse_args()
environment=args.environment
target = root / ".secrets" / environment
if environment=="production" and any((root/".secrets"/n).exists() for n in ["bridge.env","vercel.env","hermes.env"]):
    raise SystemExit("Legacy bridge secrets exist. Preserve them; explicit migration required.")
os.umask(0o077)
target.mkdir(mode=0o700, parents=True, exist_ok=True)
names = ["bridge.env", "vercel.env", "hermes.env"]
if any((target / n).exists() for n in names):
    raise SystemExit("Secrets already exist; refusing to overwrite. Restore existing files if necessary.")
url = input("Stable HTTPS bridge URL (https://host/storage/v1), or Enter to fill later: ").strip()
from urllib.parse import urlsplit
if url:
    u = urlsplit(url)
    if u.scheme != "https" or not u.hostname or u.username or u.password or u.path != "/storage/v1" or u.query or u.fragment:
        raise SystemExit("Invalid HTTPS bridge URL.")
bridge = "cp_"+environment+"_bridge_"+secrets.token_urlsafe(48)
agent = "cp_"+environment+"_agent_"+secrets.token_urlsafe(48)
operator = "cp_"+environment+"_operator_"+secrets.token_urlsafe(48)
vault = base64.b64encode(secrets.token_bytes(32)).decode()
files = {
    "bridge.env": f"CREATORPULSE_BRIDGE_TOKEN={bridge}\n",
    "vercel.env": f"CREATORPULSE_BRIDGE_URL={url}\nCREATORPULSE_BRIDGE_TOKEN={bridge}\nCREATORPULSE_VAULT_KEY={vault}\nCREATORPULSE_OPERATOR_KEY={operator}\nCREATORPULSE_AGENT_KEY={agent}\n",
    "hermes.env": f"CREATORPULSE_AGENT_KEY={agent}\n",
}
for name, content in files.items():
    with (target / name).open("x", encoding="utf-8") as out:
        out.write(content)
print("Secret files created in local-bridge/.secrets/"+environment+"/. No secrets printed.")
print("Restrict filesystem access, especially on Windows; configure HTTPS and Vercel before enrollment.")
