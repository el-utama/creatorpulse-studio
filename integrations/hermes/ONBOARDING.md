# CreatorPulse Hermes onboarding — isolated profiles

Start with Sandbox, not Production. The dedicated profile names are `creatorpulse-sandbox` and `creatorpulse`. One repository, separate checkouts/branches and runtime state. Keep existing default Hermes and messaging untouched.

## Copy-paste prompt — Sandbox
```text
Siapkan profil Hermes khusus creatorpulse-sandbox (CreatorPulse Lab), hanya untuk sandbox. Jangan ubah profil default, provider/model existing, WhatsApp/Telegram, bot, jadwal atau koneksi lain. Jangan clone profil atau menyalin seluruh .env/memori. Jangan posting.
1. Ambil repo https://github.com/el-utama/creatorpulse-studio branch sandbox ke direktori terpisah; jangan timpa pekerjaan lokal. Catat commit. Baca integrations/hermes/ONBOARDING.md.
2. Periksa hermes profile create --help; buat profil bersih dengan --no-credentials --no-alias jika tersedia. Jangan jadikan default. Konfigurasikan hanya provider/model NVIDIA NIM yang sudah disetujui secara lokal pada profil baru; jika opsi tidak tersedia, berhenti dan laporkan.
3. Gunakan path profil khusus yang benar. Jalankan python integrations/hermes/bootstrap.py --environment sandbox --hermes-home <path-profil> (dry-run). Owner menyiapkan Local Bridge sandbox, Vercel dan enrollment; jangan meminta secret di chat. Owner hanya memberikan path file hermes.env khusus sandbox atau memasang agent key secara lokal.
4. Setelah rencana benar, ulangi dengan --apply dan opsional --agent-env <path-hermes.env>. Jangan memakai file vercel.env/bridge.env atau kredensial operator.
5. Jalankan pemeriksaan adapter dan hermes -p creatorpulse-sandbox mcp test creatorpulse jika didukung. Uji list_accounts dan analytics read-only dalam sesi terminal profil khusus; jangan restart gateway pesan. Laporkan commit, environment, profil dan blocker tanpa secret. Jangan membuat atau menjalankan publikasi.
```

## Production (only after Sandbox acceptance)
```text
Siapkan profil Hermes khusus creatorpulse (CreatorPulse Director), hanya untuk production. Jangan ubah profil default, provider/model existing, WhatsApp/Telegram, bot, jadwal atau koneksi lain. Jangan clone profil atau menyalin seluruh .env/memori. Jangan posting.
1. Ambil repo https://github.com/el-utama/creatorpulse-studio branch main ke direktori terpisah; jangan timpa pekerjaan lokal. Catat commit. Baca integrations/hermes/ONBOARDING.md.
2. Periksa hermes profile create --help; buat profil bersih dengan --no-credentials --no-alias jika tersedia. Jangan jadikan default. Konfigurasikan hanya provider/model NVIDIA NIM yang sudah disetujui secara lokal pada profil baru; jika opsi tidak tersedia, berhenti dan laporkan.
3. Gunakan path profil khusus yang benar. Jalankan python integrations/hermes/bootstrap.py --environment production --hermes-home <path-profil> (dry-run). Owner menyiapkan Local Bridge production, Vercel dan enrollment; jangan meminta secret di chat. Owner hanya memberikan path file hermes.env khusus production atau memasang agent key secara lokal.
4. Setelah rencana benar, ulangi dengan --apply dan opsional --agent-env <path-hermes.env>. Jangan memakai file vercel.env/bridge.env atau kredensial operator.
5. Jalankan pemeriksaan adapter dan hermes -p creatorpulse mcp test creatorpulse jika didukung. Uji list_accounts dan analytics read-only dalam sesi terminal profil khusus; jangan restart gateway pesan. Laporkan commit, environment, profil dan blocker tanpa secret. Jangan membuat atau menjalankan publikasi.
```

## Owner prerequisites
Use official Hermes [profile commands](https://hermes-agent.nousresearch.com/docs/reference/profile-commands/). Check installed CLI help first. Create a fresh named profile, not a clone; `hermes profile create creatorpulse-sandbox --no-credentials --no-alias`. On versions without these flags, stop rather than clone or copy the default credential file. Configure NVIDIA NIM provider/model only in that profile, locally; never send credentials to chat. Do not run profile use, start a new message gateway, or copy default memory. Verify the profile directory (typically ~/.hermes/profiles/creatorpulse-sandbox). OS profile separation alone is not a security sandbox.

Follow ../../local-bridge/README.md. Owner creates isolated bridge, HTTPS routing, Vercel secrets and dashboard enrollment. The agent must only receive its environment-specific agent key. Never give it operator, vault, bridge or TikTok secrets. Keep private secret files outside the agent's OS access; only copy the agent-only file to its restricted profile. Do not grant agent elevated permissions.

## Installer and check
From the matching repo checkout, use Hermes's Python 3.10+ with PyYAML:
```sh
python integrations/hermes/bootstrap.py --environment sandbox --hermes-home /actual/profiles/creatorpulse-sandbox
python integrations/hermes/bootstrap.py --environment sandbox --hermes-home /actual/profiles/creatorpulse-sandbox --agent-env /private/agent-only/hermes.env --apply
python /actual/profiles/creatorpulse-sandbox/integrations/creatorpulse-local/proxy.py --environment sandbox --env-file /actual/profiles/creatorpulse-sandbox/.env --check
hermes -p creatorpulse-sandbox mcp test creatorpulse
```
The first command is dry run. The installer requires an existing dedicated profile and rejects mismatched names/keys, backs up config and installs only CreatorPulse adapter, environment allowlist, and rendered skill. It will not create a profile itself, edit other profiles, install dependencies, change model settings, or start/restart messaging. It refuses unrelated or legacy MCP entries rather than silently migrating them. CLI fallback: replace --check with --call list_accounts --args '{}'. Use explicit profile selection for chat and CLI; no default profile changes. For Production use production, profile creatorpulse and main checkout. Do not reuse credentials or clone a Sandbox profile.

The adapter's local discovery and ping do not make remote calls. All tool calls use a fixed allowlisted HTTPS endpoint, no redirects, explicit environment header and prefixed agent key read from the specified profile file (not inherited process env). Health must identify the environment; zero accounts is not completed enrollment. No actual Hermes host test is implied by CI.

## Publication and research
Use Publishing > Review in the same environment; human approval is independent and expires. Agent cannot approve, must never retry uncertain publication, and cannot assume submission equals publication. Inbox requires completion in TikTok. No posting during installation, no unattended posting, no new chat gateway. Research is sourced evidence, not verified TikTok discovery. Keep cron disabled until live read-only verification and operator acceptance.
