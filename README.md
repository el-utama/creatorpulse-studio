# CreatorPulse Studio

Workspace operasional kreator TikTok untuk satu operator dengan maksimum tiga akun, menggunakan Next.js App Router, TypeScript dan Tailwind. Hermes adalah agent opsional; Local Bridge menyediakan penyimpanan SQLite lokal.

**Status Sandbox (2026-11-26):** Bridge, enrollment, riset, sinkronisasi lintas browser dan dedicated one-shot cron telah melalui pengujian aktual yang dilaporkan. Fokus MVP: riset → pembuatan konten nyata → laporan/review → publikasi setelah persetujuan manusia. Lihat [checkpoint dan acceptance evidence](docs/STATUS.md) untuk baseline, batas bukti, blocker dan langkah berikutnya. Production merupakan release gate terpisah.

## Hermes: install or resume from repository

Agents must start with [AGENTS.md](AGENTS.md) and execute the [Sandbox installation and recovery runbook](integrations/hermes/SANDBOX_RUNBOOK.md). It includes safe Windows preflight and owner-only persistent startup. Do not repeat completed steps or relay individual terminal commands.

## Dokumentasi aktif

| Dokumen | Kegunaan |
|---|---|
| [Sandbox checkpoint / MVP](docs/STATUS.md) | Status pengujian aktual, keputusan, blocker dan handoff |
| [Workspace V4](docs/WORKSPACE_V4.md) | Target desain, baseline aktual, alur pengguna dan release gates |
| [Local-first architecture](docs/ARCHITECTURE_LOCAL_FIRST.md) | Batas tanggung jawab, storage, keamanan |
| [Local Bridge](local-bridge/README.md) | Setup host, HTTPS, secrets, enrollment dan backup |
| [Hermes onboarding](integrations/hermes/ONBOARDING.md) | Bootstrap profil khusus environment dan pengujian MCP terminal |
| [Integrations](integrations/README.md) | REST/MCP, OpenAPI dan opsi n8n historis |
| [Agent OpenAPI](public/agent-openapi.json) | Kontrak gateway v1 |
| [Audit V3](docs/AUDIT_V3.md) | Temuan historis dan risiko yang masih terbuka |
| [Rencana awal](docs/PLAN_CREATORPULSE.md) | Arsip desain awal, bukan spesifikasi UI aktif |

## Workspace V4 (baseline, bukan desain final)

Overview merangkum akun browser dan konten yang sudah dimuat; Accounts mengelola koneksi; Content menyajikan koleksi lintas akun; Publishing memisahkan Queue, Review, History dan New post; AI Agent menangani integrasi dan riset. Pemilihan target dilakukan sebelum editor manual. Approval agent hanya lewat operator yang berwenang. Jumlah view adalah view video yang sudah dimuat, bukan total historis atau growth. Gateway tidak perlu dikonfigurasi untuk penggunaan manual akun yang belum enrolled.

## Pengembangan lokal

Gunakan Node.js 22 LTS atau versi yang kompatibel dengan Next.js 16 (jangan gunakan Node 18), npm dan Python 3.10+ untuk Bridge/Hermes. Untuk bootstrap Hermes diperlukan PyYAML di interpreter Hermes.

```sh
git clone https://github.com/el-utama/creatorpulse-studio
cd creatorpulse-studio
npm ci
cp .env.example .env.local
npm run dev
```

Isi environment secara lokal sesuai `.env.example`; jangan commit secret. Pada Windows gunakan Copy-Item untuk menyalin file. APP_URL dan redirect harus sesuai environment yang benar-benar terdaftar di TikTok. Untuk project existing jangan ubah redirect atau kredensial TikTok hanya demi preview. Use canonical Sandbox Preview with separate TikTok Sandbox credentials. See Hermes onboarding; never share gateway keys between environments.

## Deployment

Project existing: https://creatorpulse-studio-six.vercel.app. Vercel membangun dari main; cek deployment READY **dan** commit yang dilayani domain production, bukan hanya preview. Hobby memiliki batas kuota dan penggunaan personal/non-komersial; tidak ada jaminan gratis untuk penggunaan komersial. Jangan membeli paket tanpa persetujuan. Gateway opsional membutuhkan lima variabel server-only sesuai panduan Local Bridge. Jangan ubah flag TIKTOK_DIRECT_POST_AUDITED tanpa audit resmi.

## Pengujian

```sh
npm ci
npx tsc --noEmit
npm run build
npm install --no-save --package-lock=false @playwright/test@1.56.1
npx playwright install chromium
npx playwright test
npx playwright test --config playwright.gateway.config.mjs
python -m unittest discover -s local-bridge -p "test_*.py"
python -m unittest discover -s integrations/hermes -p "test_*.py"
```

Tes browser memakai fixture TikTok, bukan akun nyata; tes gateway memakai bridge lokal. Hasil lulus tidak berarti UI sudah diterima atau App Review sudah disetujui. Uji live tanpa publikasi terlebih dahulu.

---

## Panduan Sandbox & Checklist App Review TikTok

### A. Mengaktifkan Mode Sandbox

1. Login ke [TikTok for Developers](https://developers.tiktok.com/).
2. Buat aplikasi baru atau buka aplikasi existing.
3. Di halaman aplikasi, aktifkan **Sandbox Mode** (toggle on).
4. Sandbox memungkinkan pengujian awal tanpa harus melalui App Review production.

### B. Menambahkan Target User

1. Di portal TikTok for Developers, buka menu **Target Users** (atau Test Users).
2. Tambahkan username TikTok Anda sendiri dan username para penguji.
3. Hanya Target User yang dapat login dan mengakses API saat dalam mode Sandbox.
4. Catat `Client Key` dan `Client Secret` dari halaman aplikasi.

### C. Checklist Produk di Portal TikTok

Dalam **satu aplikasi** TikTok for Developers, aktifkan ketiga produk berikut:

| Produk | Fungsi di CreatorPulse Studio |
|--------|------------------------------|
| **Login Kit** | Alur OAuth 2.0 login (`/api/auth/tiktok`) |
| **Content Posting API** | Upload & posting video (`/api/tiktok/publish`) |
| **Display API** | Tarik analitik & daftar video (`/api/tiktok/analytics`) |

### D. Pemetaan URL ke Domain Vercel

Isi di portal TikTok for Developers dengan domain production Vercel Anda:

| Field Portal | Contoh Nilai |
|--------------|-------------|
| Website URL | `https://creatorpulse.vercel.app` |
| Privacy Policy URL | `https://creatorpulse.vercel.app/privacy` |
| Terms of Service URL | `https://creatorpulse.vercel.app/terms` |
| Redirect URI | `https://creatorpulse.vercel.app/api/auth/tiktok/callback` |

**Penting:** `Redirect URI` di portal harus **sama persis** dengan `TIKTOK_REDIRECT_URI` di Vercel Environment Variables.

### E. Scopes yang Diperlukan

Pilih semua scope berikut saat mengajukan App Review:
- `user.info.basic`
- `user.info.profile`
- `user.info.stats`
- `video.list`
- `video.upload`
- `video.publish`

---

## Catatan Teknis Penting

### Media dan penyimpanan
File manual MP4/MOV maksimal 4 MB; video lebih besar menggunakan HTTPS URL pada domain/prefix yang diverifikasi TikTok. Gunakan URL immutable. Inbox memerlukan penyelesaian di TikTok; Direct Post memerlukan preview, durasi, pilihan privasi, interaksi, disclosure dan persetujuan eksplisit. Jangan mengaktifkan flag audit tanpa persetujuan TikTok yang sebenarnya.

### Keamanan
- Maksimal tiga sesi TikTok terpisah dalam browser. Token akun belum enrolled berada dalam cookie HttpOnly, Secure di produksi, SameSite=Lax.
- Gateway opsional memakai SQLite Local Bridge; Vercel melakukan enkripsi/dekripsi dan panggilan TikTok. Agent tidak memperoleh token OAuth atau operator/bridge/vault key.
- Sandbox history protocol v1 menyediakan riwayat publikasi manual terpusat untuk akses operator yang berwenang; akses lintas browser telah dikonfirmasi owner. Legacy localStorage dan status permintaan belum pasti tetap perlu diperlakukan sesuai jalur kompatibilitas; lihat checkpoint. Logout tidak memutus vault atau mencabut izin TikTok.
- Persetujuan agent dilakukan operator melalui dashboard, bukan oleh model.

### Refresh Token
Operasi baca mencoba refresh sekali saat diperlukan menggunakan sesi akun terkait atau vault enrolled. Inisialisasi publikasi tidak otomatis diulang.

---

## Halaman Legal

- `/privacy` — Privacy Policy (formal, bahasa Inggris)
- `/terms` — Terms of Service (formal, bahasa Inggris)

Kedua halaman wajib tersedia dan diakses publik untuk proses App Review TikTok.

---

## Lisensi

MIT