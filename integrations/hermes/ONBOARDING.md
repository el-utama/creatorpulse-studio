# CreatorPulse Hermes onboarding — model-independent

## Paste into existing Hermes chat

```text
Hubungkan profil Hermes yang sedang aktif dengan CreatorPulse Studio V3. Jangan mengganti model/provider NVIDIA NIM, konfigurasi WhatsApp/Telegram, profil, atau toolset lain. Jangan hanya menjelaskan; gunakan terminal untuk menjalankan langkah aman yang tersedia.
1. Ambil repository https://github.com/el-utama/creatorpulse-studio branch main ke direktori kerja baru (atau gunakan checkout yang sudah ada). Jangan menimpa pekerjaan lokal. Catat commit.
2. Baca integrations/hermes/ONBOARDING.md. Jalankan python integrations/hermes/bootstrap.py tanpa --apply untuk rencana terlebih dahulu. Gunakan interpreter Python Hermes yang memiliki PyYAML. Pastikan HERMES_HOME adalah profil chat yang benar; jika ambigu, minta lokasi profil saja.
3. Jalankan bootstrap.py --apply pada profil tersebut setelah rencana sesuai. Jika agent key belum tersedia, minta saya memasangnya secara lokal pada .env profil, atau menyediakan path file hermes.env yang hanya berisi agent key melalui --agent-env. JANGAN meminta saya mengirim key, token TikTok, operator key, bridge key, atau file .env melalui chat.
4. Jalankan diagnosis adapter lokal (--check) sesuai dokumentasi dan hermes mcp test creatorpulse bila tersedia. Jika gateway belum dikonfigurasi, laporkan blocker yang tepat, jangan mengarang koneksi berhasil. Jangan mengubah konfigurasi TikTok Developer, mengaktifkan layanan berbayar, atau mengambil alih Vercel.
5. Gunakan /reload-mcp atau sesi baru bila diperlukan; jangan restart gateway pesan tanpa persetujuan. Uji list_accounts dan analytics secara read-only. Jangan membuat atau menjalankan publikasi selama onboarding.
6. Laporkan commit, profil, hasil health, jumlah akun, dan status uji MCP, tanpa secret. Setelah terhubung, gunakan skill creatorpulse dari chat WhatsApp/Telegram yang sudah ada. Jangan mengatur bot baru. Jika model gagal melakukan tool call, gunakan fallback CLI yang didokumentasikan.
```

## What bootstrap actually does
Python 3.10+ with PyYAML in the existing Hermes environment. Default is dry-run. On apply, makes a timestamped backup of existing config and old CreatorPulse files; installs the skill and local stdio adapter; merges only the creatorpulse MCP entry into the selected profile; leaves all other configuration values (including model and WhatsApp/Telegram) unchanged. YAML comments and formatting may be normalized. Do not run concurrently with other config edits. Existing conflicting agent key or unrelated MCP entry is not overwritten. The optional --agent-env must refer to the agent-only credential file, not vercel.env or bridge.env.

Run from repository root:
```sh
python integrations/hermes/bootstrap.py
python integrations/hermes/bootstrap.py --apply
# If needed, provide explicit profile and an agent-only file path:
python integrations/hermes/bootstrap.py --apply --hermes-home /path/to/active/profile --agent-env /private/path/hermes.env
```
On Windows use the Python interpreter from Hermes's installed environment (or py -3 when it has PyYAML). On Docker/SSH run the installer where the actual Hermes profile is mounted, not an unrelated sandbox. Never create a new profile to work around discovery. The script does not install dependencies or restart the gateway.

## Secure owner setup (not assigned to the LLM)
The owner must first install Local Bridge as a separate restricted service/OS identity, configure a stable HTTPS tunnel or reverse proxy, set Vercel environment variables, deploy V3, and enroll real accounts. See ../../local-bridge/README.md. Hand Hermes only the agent credential via a local secret file or existing profile .env. The bootstrap script cannot grant itself administrator access, create a tunnel account, configure Vercel without authorization, or log into TikTok for you. Never put operator, vault or bridge keys in the agent profile or its accessible shell environment. Files with 0600 permissions still remain readable by the same OS user; use OS separation.

## Verification
Use installed adapter via its actual path and profile .env:
```sh
python /path/to/profile/integrations/creatorpulse-local/proxy.py --env-file /path/to/profile/.env --check
hermes mcp test creatorpulse
```
The adapter prints no credentials. A connected gateway with zero accounts means enrollment is still required; the installer must not report complete. Use /reload-mcp or a new session; if the installed Hermes version cannot reload, arrange a controlled gateway restart. Test via existing private WhatsApp/Telegram chat: "Tampilkan akun TikTok CreatorPulse dan statistiknya, jangan posting." If MCP works in terminal but not chat, check that chat is routed to the same profile and its MCP toolset is enabled. Do not regenerate the bot token or pair WhatsApp again. Keep allowed users restricted to the owner. No new messaging webhook is needed.

## Nemotron / weaker model fallback
The installer is ordinary code, not an LLM-generated configuration. Local stdio MCP tool discovery and ping never contact Vercel. If the model narrates instead of calling tools, use the skill's explicit instructions or the CLI fallback (requires terminal permission):
```sh
python /path/to/profile/integrations/creatorpulse-local/proxy.py --env-file /path/to/profile/.env --call list_accounts --args '{}'
```
Other tools use the same names and JSON argument shapes in the skill/OpenAPI. Only agent permissions are supported; no approval function exists. A local adapter does not guarantee the selected NIM model's actual tool-calling quality; test live with the existing model. Do not switch models or force global tool settings without owner consent. No network traffic is generated on MCP discovery or idle ping.

## Publishing from chat
Hermes can prepare a draft and return the exact account, media, caption suggestion and ID. Human approval remains in the dashboard, then Hermes can execute the approved submission and report status. Inbox requires completion in TikTok. Direct Post requires duration, video preview, explicit operator-selected visibility, interaction settings, final caption and disclosure/policy confirmations; unaudited clients remain SELF_ONLY on private accounts. Direct chat approval needs a separate trusted callback verifying sender identity, with operator credentials isolated from the agent. Not implemented. No scheduled posting during installation. Research cron is optional and runs on Hermes; use modest cadence, e.g. once daily, no constant polling. 

## Cost boundary
No n8n, no Redis cloud, no AI model calls, cron, video generation, search/scraping, message gateway, or media hosting added to Vercel. Only explicit tool calls reach Vercel; SQLite stays on Hermes host. URL-based inbox submission avoids proxying large video bytes. Existing manual file upload remains capped at 4 MB. List accounts/posts use one storage request each. Actual Hobby quota consumption is not measured by these tests; review project usage in Vercel. Hobby is intended for personal/non-commercial use, not an unconditional free commercial hosting guarantee.
