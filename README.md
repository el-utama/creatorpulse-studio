# CreatorPulse Studio

**V3 local-first design (development):** [architecture and progress log](docs/ARCHITECTURE_LOCAL_FIRST.md) · [Local Bridge setup](local-bridge/README.md) · [Hermes integration](integrations/hermes/README.md). V2 manual dashboard remains supported. The V3 gateway is opt-in, with no Redis cloud requirement.

Web fullstack lengkap menggunakan **Next.js (App Router)**, **TypeScript**, dan **Tailwind CSS**, siap di-deploy gratis ke **Vercel (Hobby Plan)** tanpa database berbayar, dirancang untuk memenuhi persyaratan teknis dan UX Guidelines App Review **TikTok for Developers** dengan 3 fitur utama:

1. **TikTok Login** (Login Kit / OAuth 2.0)
2. **Posting Video** (Content Posting API)
3. **Penarikan Analitik** (Display API)

---

## Struktur Folder

```
creatorpulse-studio/
├── .env.example
├── .gitignore
├── next.config.mjs
├── package.json
├── tailwind.config.ts
├── tsconfig.json
├── README.md
├── docs/
│   └── PLAN_CREATORPULSE.md
├── public/
│   └── favicon.ico
└── src/
    ├── config/
    │   └── app.ts
    ├── app/
    │   ├── layout.tsx
    │   ├── page.tsx
    │   ├── globals.css
    │   ├── dashboard/page.tsx
    │   ├── privacy/page.tsx
    │   ├── terms/page.tsx
    │   ├── api/
    │   │   ├── auth/tiktok/route.ts
    │   │   ├── auth/tiktok/callback/route.ts
    │   │   ├── auth/logout/route.ts
    │   │   ├── tiktok/analytics/route.ts
    │   │   ├── tiktok/publish/route.ts
    │   │   └── tiktok/publish/status/route.ts
    │   └── middleware.ts
    ├── components/
    │   ├── Navbar.tsx
    │   ├── TikTokConnectButton.tsx
    │   ├── AnalyticsCards.tsx
    │   ├── VideoList.tsx
    │   ├── VideoUploadForm.tsx
    │   └── PublishStatusChecker.tsx
    │   └── ui/ (button, card, input, label, select, checkbox, tabs, textarea)
    ├── lib/
    │   ├── cookies.ts
    │   ├── tiktok.ts
    │   └── utils.ts
    ├── types/
    │   └── tiktok.ts
    └── middleware.ts
```

---

## Fitur Utama

| Fitur | Deskripsi | Endpoint / API TikTok |
|-------|-----------|----------------------|
| TikTok Login | OAuth 2.0 login dengan `state` di cookie HTTP-only | `GET /api/auth/tiktok`, `/v2/oauth/token/` |
| Profil & Analitik | Info profil kreator + kartu metrik + daftar video terbaru | `GET /v2/user/info/`, `POST /v2/video/list/` |
| Upload & Posting | Upload file video atau lewat URL, atur privacy & interaksi, publikasi ke draft atau profil | `POST /v2/post/publish/video/init/`, `/v2/post/publish/inbox/video/init/`, `/v2/post/publish/status/fetch/` |
| Logout | Hapus semua cookie sesi | `POST /api/auth/logout` |

---

## Persyaratan Sistem

- Node.js 18+
- npm / yarn / pnpm
- Akun TikTok for Developers
- Akun Vercel (Hobby Plan gratis)

---

## Instalasi Lokal

```bash
# Clone repository
git clone <repo-url>
cd creatorpulse-studio

# Install dependencies
npm install

# Salin file environment
cp .env.example .env.local

# Isi nilai di .env.local dengan kredensial TikTok Anda

# Jalankan development server
npm run dev

# Buka http://localhost:3000
```

---

## Konfigurasi Environment (`.env.example`)

```env
TIKTOK_CLIENT_KEY=your_tiktok_client_key
TIKTOK_CLIENT_SECRET=your_tiktok_client_secret
TIKTOK_REDIRECT_URI=https://your-app.vercel.app/api/auth/tiktok/callback
APP_URL=https://your-app.vercel.app
```

---

## Panduan Deploy ke Vercel (Gratis, Hobby Plan)

### 1. Push ke GitHub
Push kode repository ke GitHub / GitLab / Bitbucket.

### 2. Import ke Vercel
1. Login ke [vercel.com](https://vercel.com).
2. Klik **Add New → Project**.
3. Impor repository Anda.
4. Framework preset: **Next.js** (biarkan default).
5. Klik **Deploy**.

### 3. Tambah Environment Variables
Di dashboard Vercel → project → **Settings → Environment Variables**, tambahkan:
- `TIKTOK_CLIENT_KEY`
- `TIKTOK_CLIENT_SECRET`
- `TIKTOK_REDIRECT_URI` (contoh: `https://creatorpulse.vercel.app/api/auth/tiktok/callback`)
- `APP_URL` (contoh: `https://creatorpulse.vercel.app`)

### 4. Redeploy
Setelah menambahkan env vars, klik **Redeploy** di deployment terbaru.

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

### Batas Upload Serverless Vercel
Serverless function di Vercel Hobby Plan memiliki batas ukuran body request sekitar **4.5 MB**. Jika file video lebih besar dari ini:
- Gunakan metode **PULL_FROM_URL** (unggah video ke penyimpanan publik, berikan URL ke aplikasi).
- Atau kompresi video sebelum upload.

### Keamanan
- Semua token disimpan dalam **HTTP-only cookie** (tidak bisa diakses via JavaScript).
- Cookie menggunakan `Secure` di production dan `SameSite=Lax`.
- Tidak ada database eksternal; session hanya di cookie.
- Tidak ada library berbayar digunakan.

### Refresh Token
Jika access token expired, sistem otomatis mencoba refresh menggunakan refresh token yang disimpan di cookie.

---

## Halaman Legal

- `/privacy` — Privacy Policy (formal, bahasa Inggris)
- `/terms` — Terms of Service (formal, bahasa Inggris)

Kedua halaman wajib tersedia dan diakses publik untuk proses App Review TikTok.

---

## Lisensi

MIT