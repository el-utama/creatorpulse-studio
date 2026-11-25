# Rencana Implementasi: CreatorPulse Studio

> **Arsip historis — rencana awal sebelum workspace multi-account.** Untuk desain, fitur dan status terkini, baca [Workspace V4](WORKSPACE_V4.md) dan [Local-first architecture](ARCHITECTURE_LOCAL_FIRST.md). Bagian lama di bawah dipertahankan sebagai rekam keputusan, bukan instruksi aktif.

Proyek web fullstack lengkap menggunakan **Next.js (App Router)**, **TypeScript**, dan **Tailwind CSS**, siap di-deploy gratis ke **Vercel (Hobby Plan)** tanpa database berbayar, dirancang untuk memenuhi persyaratan teknis dan UX Guidelines App Review **TikTok for Developers** dengan 3 fitur utama: **TikTok Login**, **Posting Video (Content Posting API)**, dan **Penarikan Analitik (Display API)**.

---

## 1. Struktur Folder Proyek

```
creatorpulse-studio/
├── .env.example
├── .gitignore
├── next.config.mjs
├── package.json
├── tailwind.config.ts
├── tsconfig.json
├── README.md
├── public/
│   └── favicon.ico
└── src/
    ├── config/
    │   └── app.ts                  # Konfigurasi terpusat (nama, scopes, email, dsb.)
    ├── app/
    │   ├── layout.tsx              # Root layout dengan font & metadata
    │   ├── page.tsx                # Halaman utama (/)
    │   ├── dashboard/
    │   │   └── page.tsx            # Dashboard (3 tab: Profil/Analitik, Upload/Posting, Riwayat)
    │   ├── privacy/
    │   │   └── page.tsx            # /privacy (Privacy Policy formal Inggris)
    │   ├── terms/
    │   │   └── page.tsx            # /terms (Terms of Service formal Inggris)
    │   └── api/
    │       ├── auth/
    │       │   ├── tiktok/
    │       │   │   ├── route.ts            # GET /api/auth/tiktok
    │       │   │   └── callback/
    │       │   │       └── route.ts        # GET /api/auth/tiktok/callback
    │       ├── auth/
    │       │   └── logout/
    │       │       └── route.ts            # POST /api/auth/logout
    │       ├── tiktok/
    │       │   ├── analytics/
    │       │   │   └── route.ts            # GET /api/tiktok/analytics
    │       │   ├── publish/
    │       │   │   └── route.ts            # POST /api/tiktok/publish
    │       │   └── publish/
    │       │       └── status/
    │       │           └── route.ts        # POST /api/tiktok/publish/status
    │       └── ...
    ├── components/
    │   ├── ui/
    │   │   ├── button.tsx
    │   │   ├── card.tsx
    │   │   ├── input.tsx
    │   │   ├── label.tsx
    │   │   ├── select.tsx
    │   │   ├── checkbox.tsx
    │   │   ├── tabs.tsx
    │   │   └── textarea.tsx
    │   ├── TikTokConnectButton.tsx
    │   ├── AnalyticsCards.tsx
    │   ├── VideoList.tsx
    │   ├── VideoUploadForm.tsx
    │   ├── PublishStatusChecker.tsx
    │   └── Navbar.tsx
    ├── lib/
    │   ├── cookies.ts              # Helper set/get/delete HTTP-only cookie
    │   ├── tiktok.ts               # Helper panggil TikTok API (token exchange, refresh)
    │   └── utils.ts
    ├── types/
    │   └── tiktok.ts               # TypeScript interfaces untuk respons TikTok API
    └── middleware.ts               # (Opsional) redirect /dashboard jika belum login
```

---

## 2. Konfigurasi Terpusat — `src/config/app.ts`

Simpan semua konstanta di satu tempat agar mudah diubah:

```ts
export const APP_CONFIG = {
  name: "CreatorPulse Studio",
  description:
    "Manajemen konten dan analitik kreator TikTok: login, posting video, dan analitik performa.",
  contactEmail: "hello@example.com",
  scopes: [
    "user.info.basic",
    "user.info.profile",
    "user.info.stats",
    "video.list",
    "video.upload",
    "video.publish",
  ],
  tiktokAuthorizeUrl: "https://www.tiktok.com/v2/auth/authorize/",
  tiktokTokenUrl: "https://open.tiktokapis.com/v2/oauth/token/",
  tiktokUserInfoUrl: "https://open.tiktokapis.com/v2/user/info/",
  tiktokVideoListUrl: "https://open.tiktokapis.com/v2/video/list/",
  tiktokPublishInitInbox:
    "https://open.tiktokapis.com/v2/post/publish/inbox/video/init/",
  tiktokPublishInitProfile:
    "https://open.tiktokapis.com/v2/post/publish/video/init/",
  tiktokPublishStatus:
    "https://open.tiktokapis.com/v2/post/publish/status/fetch/",
  cookieNames: {
    accessToken: "creatorpulse_access_token",
    refreshToken: "creatorpulse_refresh_token",
    oauthState: "creatorpulse_oauth_state",
  },
  maxDirectUploadMB: 4.5, // Batas serverless Vercel Hobby untuk upload langsung
} as const;
```

---

## 3. Halaman Utama (`/`)

**Desain:** modern, bersih, responsif dengan Tailwind CSS.

**Konten wajib:**
- Hero / judul aplikasi + tagline.
- Ringkasan 3 fitur utama dengan kartu (icon + judul + deskripsi singkat):
  1. **One-Click TikTok OAuth Login**
  2. **Content Posting & Draft Uploader**
  3. **Video Performance Analytics**
- Tombol utama **"Connect with TikTok"** → mengarah ke `/api/auth/tiktok`.
- Footer wajib dengan tautan aktif: `/privacy` dan `/terms`.

---

## 4. Alur OAuth 2.0 TikTok

### `GET /api/auth/tiktok`
- Buat `state` acak (`crypto.randomUUID`), simpan di **HTTP-only cookie** (`creatorpulse_oauth_state`, `SameSite=Lax`, `Secure` di production, `maxAge` singkat mis. 10 menit).
- Redirect ke `https://www.tiktok.com/v2/auth/authorize/` dengan query:
  - `client_key` = `TIKTOK_CLIENT_KEY`
  - `redirect_uri` = `TIKTOK_REDIRECT_URI`
  - `response_type=code`
  - `scope` = scopes digabungkan dengan koma (`,`)

### `GET /api/auth/tiktok/callback`
- Ambil `code` dan `state` dari query string.
- Bandingkan `state` dengan nilai di cookie `creatorpulse_oauth_state`. Jika tidak cocok → error 400.
- Hapus cookie `state`.
- POST ke `https://open.tiktokapis.com/v2/oauth/token/`:
  - `client_key`, `client_secret`, `code`, `grant_type=authorization_code`, `redirect_uri`
- Simpan respons:
  - `access_token` → cookie HTTP-only `creatorpulse_access_token`
  - `refresh_token` → cookie HTTP-only `creatorpulse_refresh_token`
  - (Jika ada `expires_in`, simpan masa berlaku untuk logika refresh otomatis)
- Redirect ke `/dashboard`.

### Logika refresh token otomatis
- Saat memanggil TikTok API dan mendapat `401` / token expired, gunakan `refresh_token` ke endpoint token dengan `grant_type=refresh_token`, perbarui cookie access token, lalu coba ulang permintaan asli.

### `POST /api/auth/logout`
- Hapus semua cookie sesi (`access_token`, `refresh_token`, `oauth_state`) dengan `max-age=0`.
- Redirect ke `/`.

---

## 5. Halaman Dashboard (`/dashboard`) — 3 Tab / Bagian

Halaman ini memerlukan autentikasi (cek cookie `access_token`). Jika belum ada, redirect ke `/`.

### Tab A: Profil & Analitik Akun
Endpoint backend: `GET /api/tiktok/analytics`

Panggil TikTok:
1. `GET https://open.tiktokapis.com/v2/user/info/?fields=open_id,union_id,avatar_url,display_name,bio_description,follower_count,following_count,likes_count,video_count`
   - Tampilkan profil kreator (avatar, nama, bio) + kartu metrik: **Followers, Following, Total Likes, Total Videos**.
2. `POST https://open.tiktokapis.com/v2/video/list/?fields=id,title,video_description,cover_image_url,create_time,share_url,view_count,like_count,comment_count,share_count`
   - Tampilkan tabel/grid video terbaru dengan kolom: Views, Likes, Comments, Shares, serta tombol buka video (`share_url`).
- Tombol **"Refresh Analytics"** untuk memuat ulang data.

### Tab B: Upload & Posting Video
Endpoint backend: `POST /api/tiktok/publish` dan `POST /api/tiktok/publish/status`

UX Guidelines TikTok Content Posting API yang harus ada:
- Tampilkan identitas akun tujuan (`display_name` + avatar) dari sesi/login.
- Pilihan mode posting:
  - **"Send to TikTok Draft / Inbox"** → `POST /v2/post/publish/inbox/video/init/`
  - **"Direct Post to Profile"** → `POST /v2/post/publish/video/init/`
- Input:
  - File video lokal (`.mp4` / `.mov`) + preview video di browser (URL.createObjectURL).
  - Caption / Title.
  - Dropdown Privacy Level: `SELF_ONLY`, `MUTUAL_FOLLOW_FRIENDS`, `FOLLOWER_OF_CREATOR`, `PUBLIC_TO_EVERYONE`.
  - Checkbox interaksi: `Disable Comment`, `Disable Duet`, `Disable Stitch`.
  - Checkbox persetujuan eksplisit pengguna ("Saya setuju...") — tombol **Publish to TikTok** aktif hanya jika centang ini dicentang.
- Alur backend `/api/tiktok/publish`:
  1. Inisialisasi upload ke TikTok (`SOURCE_TYPE: "FILE_UPLOAD"`).
  2. Terima `upload_url` dari TikTok.
  3. Unggah chunk file video ke `upload_url`.
  4. Kembalikan `publish_id` ke frontend.
- Frontend mengecek status via `POST /api/tiktok/publish/status` (`/v2/post/publish/status/fetch/`).
- Catatan batas: serverless Vercel Hobby maksimal ~4.5 MB untuk upload langsung lewat API route. Jika lebih besar, dukung metode `PULL_FROM_URL` (user menyediakan URL video yang dapat diakses TikTok) sebagai alternatif.

### Tab C (opsional): Riwayat / Status Publikasi
Tabel publish_id + status terakhir (mis. `PUBLISH_COMPLETE`, `FAILED`, dll).

---

## 6. Halaman Legal Wajib App Review

### `/privacy` — Privacy Policy (bahasa Inggris formal)
Harus secara spesifik menjelaskan:
- Akses data profil & statistik (`user.info.*`, `video.list`) untuk menampilkan analitik kreator.
- Izin unggah video (`video.upload`, `video.publish`) **hanya dieksekusi saat pengguna menekan tombol unggah secara eksplisit**.
- Tidak menyimpan video permanen di server.
- Tidak menjual data ke pihak ketiga.
- Data disimpan hanya dalam cookie sesi (access/refresh token), tidak ada database eksternal.
- Hak pengguna untuk menghapus data / logout.

### `/terms` — Terms of Service (bahasa Inggris formal)
- Kepatuhan terhadap TikTok Terms of Service dan Community Guidelines.
- Tanggung jawab hak cipta konten pengguna (user hanya mengunggah konten yang mereka miliki atau berizin).
- Ketentuan penggunaan layanan CreatorPulse Studio.
- Penolakannya jaminan, keterbatasan tanggung jawab, perubahan layanan, hukum yang berlaku.

---

## 7. Panduan Sandbox & Checklist App Review

### 7a. Mengaktifkan Mode Sandbox & Menambahkan Target User
1. Login ke [TikTok for Developers](https://developers.tiktok.com/), buka aplikasi Anda (atau buat baru).
2. Di pengaturan aplikasi, aktifkan **Sandbox Mode** (toggle). Ini memungkinkan pengujian awal tanpa harus melalui App Review production.
3. Masuk ke daftar **Target Users** (pengguna target/uji).
4. Tambahkan username TikTok Anda sendiri dan username para penguji (tester) yang diizinkan.
5. Di mode Sandbox, panggilan API dan scopes hanya berlaku untuk Target User yang terdaftar.
6. Catatkan `Client Key` dan `Client Secret`, lalu isi `Redirect URI` agar sama persis dengan domain Vercel Anda.

### 7b. Checklist Produk di Portal TikTok (Satu App)
Dalam satu aplikasi TikTok for Developers, aktifkan/daftarkan ketiga produk ini:

| Produk | Fungsi di Aplikasi |
|--------|-------------------|
| **Login Kit** | Alur OAuth 2.0 login (`/api/auth/tiktok`) |
| **Content Posting API** | Upload & posting video (`/api/tiktok/publish`) |
| **Display API** | Tarik analitik & daftar video (`/api/tiktok/analytics`) |

### 7c. Pemetaan URL ke Domain Vercel
Isi di portal TikTok for Developers dengan domain production Vercel Anda (misal `https://creatorpulse-studio.vercel.app`):

| Field Portal | Nilai (contoh) |
|--------------|----------------|
| Website URL | `https://creatorpulse-studio.vercel.app` |
| Privacy Policy URL | `https://creatorpulse-studio.vercel.app/privacy` |
| Terms of Service URL | `https://creatorpulse-studio.vercel.app/terms` |
| Redirect URI | `https://creatorpulse-studio.vercel.app/api/auth/tiktok/callback` |

Pastikan `TIKTOK_REDIRECT_URI` di Vercel Environment Variables sama persis dengan Redirect URI di portal TikTok.

---

## 8. Kelengkapan Deploy Gratis ke Vercel

### `.env.example`
```env
TIKTOK_CLIENT_KEY=your_tiktok_client_key
TIKTOK_CLIENT_SECRET=your_tiktok_client_secret
TIKTOK_REDIRECT_URI=https://your-app.vercel.app/api/auth/tiktok/callback
NEXT_PUBLIC_APP_URL=https://your-app.vercel.app
```

### Catatan penting
- Tidak ada database eksternal (sesimulasi via cookie HTTP-only).
- Tidak ada library berbayar.
- Tidak ada build-time secret yang bocor (semua di Vercel Environment Variables).
- Build dan deploy menggunakan Vercel Hobby Plan (gratis).

### Panduan Singkat Deploy ke Vercel
1. Push kode ke GitHub / GitLab / Bitbucket.
2. Login ke [vercel.com](https://vercel.com), pilih **Add New → Project**, impor repo.
3. Framework preset: **Next.js**, biarkan default.
4. Tambahkan Environment Variables dari `.env.example` (isi nilai sebenarnya).
5. Klik **Deploy**.
6. Setelah deploy, catatkan URL production (mis. `https://creatorpulse.vercel.app`).
7. Perbarui `TIKTOK_REDIRECT_URI` di Vercel agar cocok dengan URL production: `https://creatorpulse.vercel.app/api/auth/tiktok/callback`.
8. Redeploy jika diperlukan.

### Pengisian Form Portal TikTok for Developers
1. Buat aplikasi di [TikTok for Developers](https://developers.tiktok.com/), dapatkan `Client Key` dan `Client Secret`.
2. Isi `Redirect URI` yang sama persis dengan `TIKTOK_REDIRECT_URI` di atas.
3. Pilih scopes yang diminta: `user.info.basic`, `user.info.profile`, `user.info.stats`, `video.list`, `video.upload`, `video.publish`.
4. Di form App Review, sertakan:
   - Deskripsi aplikasi dan 3 fitur utama.
   - Link Privacy Policy (`/privacy`) dan Terms of Service (`/terms`).
   - Screenshot/video demo alur: Login → Dashboard → Upload → Analytics.
   - Jelaskan bahwa video tidak disimpan permanen di server dan data tidak dijual.
   - Tentukan App Review category yang sesuai (mis. *Content Management / Analytics*).

---

## 9. File yang Perlu Dibuat (Checklist Implementasi)

- [ ] `.env.example`
- [ ] `.gitignore`
- [ ] `next.config.mjs`
- [ ] `package.json`
- [ ] `tailwind.config.ts`
- [ ] `tsconfig.json`
- [ ] `src/config/app.ts`
- [ ] `src/app/layout.tsx`
- [ ] `src/app/page.tsx`
- [ ] `src/app/dashboard/page.tsx`
- [ ] `src/app/privacy/page.tsx`
- [ ] `src/app/terms/page.tsx`
- [ ] `src/app/api/auth/tiktok/route.ts`
- [ ] `src/app/api/auth/tiktok/callback/route.ts`
- [ ] `src/app/api/auth/logout/route.ts`
- [ ] `src/app/api/tiktok/analytics/route.ts`
- [ ] `src/app/api/tiktok/publish/route.ts`
- [ ] `src/app/api/tiktok/publish/status/route.ts`
- [ ] `src/components/ui/*.tsx` (button, card, input, label, select, checkbox, tabs, textarea)
- [ ] `src/components/TikTokConnectButton.tsx`
- [ ] `src/components/AnalyticsCards.tsx`
- [ ] `src/components/VideoList.tsx`
- [ ] `src/components/VideoUploadForm.tsx`
- [ ] `src/components/PublishStatusChecker.tsx`
- [ ] `src/components/Navbar.tsx`
- [ ] `src/lib/cookies.ts`
- [ ] `src/lib/tiktok.ts`
- [ ] `src/lib/utils.ts`
- [ ] `src/types/tiktok.ts`
- [ ] `src/middleware.ts`
- [ ] `README.md` (panduan deploy singkat)

---

Dokumen ini adalah **rencana implementasi** yang menjadi acuan saat menulis kode secara nyata. Semua file di atas belum dibuat; siap untuk diimplementasikan setelah rencana ini disetujui.