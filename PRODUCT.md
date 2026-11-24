# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Agensi digital yang mengelola banyak kreator dan akun TikTok secara bersamaan. Mereka perlu mengelola konten, posting video, dan memantau analitik performa untuk beberapa akun klien atau merek dari satu aplikasi.

## Product Purpose

CreatorPulse Studio membantu agensi digital dan kreator TikTok mengelola konten dan analitik dari satu tempat: login dengan TikTok OAuth 2.0, unggah dan posting video melalui Content Posting API, serta menarik analitik akun dan daftar video melalui Display API — tanpa database eksternal dan tanpa biaya berlangganan, siap di-deploy gratis ke Vercel Hobby Plan.

## Positioning

Satu aplikasi yang menggabungkan tiga produk TikTok for Developers (Login Kit, Content Posting API, dan Display API) dalam satu alur, di-deploy gratis ke Vercel Hobby Plan tanpa database berbayar, dirancang untuk lolos App Review TikTok dengan Privacy Policy dan Terms of Service yang jelas.

## Operating Context

Pengguna mengakses aplikasi melalui browser web di desktop, tablet, atau HP. Alur utama: login melalui TikTok OAuth, dasbor menampilkan profil dan metrik akun (followers, following, likes, videos), upload dan posting video dengan opsi privacy dan interaksi, serta memantau status publikasi. Tidak ada database eksternal; semua sesi disimpan di HTTP-only cookie.

## Capabilities and Constraints

- TikTok Login via OAuth 2.0 (user.info.basic, user.info.profile, user.info.stats, video.list, video.upload, video.publish)
- Profil dan analitik akun: avatar, display_name, bio, followers, following, likes, video_count
- Daftar video terbaru dengan views, likes, comments, shares
- Upload dan posting video: FILE_UPLOAD (maks ~4.5 MB lewat serverless) atau PULL_FROM_URL
- Mode posting: Draft/Inbox atau Direct Post ke profil
- Opsi privacy: SELF_ONLY, MUTUAL_FOLLOW_FRIENDS, FOLLOWER_OF_CREATOR, PUBLIC_TO_EVERYONE
- Opsi interaksi: Disable Comment, Disable Duet, Disable Stitch
- Persetujuan eksplisit pengguna sebelum publish
- Status publikasi via /v2/post/publish/status/fetch/
- Batas: serverless Vercel Hobby ~4.5 MB untuk upload langsung lewat API route
- Tidak ada database eksternal; sesi hanya di cookie HTTP-only
- Halaman legal: /privacy dan /terms (bahasa Inggris formal untuk App Review)

## Brand Commitments

Nama aplikasi: CreatorPulse Studio (placeholder, mudah diubah di src/config/app.ts). Kontak email: hello@example.com. Tidak ada logo atau aset visual yang diikat.

## Evidence on Hand

- Implementasi visual sudah ada: halaman utama, dasbor, privacy, terms, dan 6 API route
- Repositori: F:\TOY4U\Repo\tiktok-dev-vercel
- Di-deploy ke: https://creatorpulse-studio-six.vercel.app
- Tidak ada testimoni, case study, atau data penggunaan yang tersedia saat ini

## Product Principles

1. Gratis tanpa database berbayar — semua fitur berjalan di Vercel Hobby Plan tanpa biaya bulanan.
2. Satu aplikasi untuk tiga produk TikTok — Login Kit, Content Posting API, dan Display API dalam satu alur yang kohesif.
3. Privasi dan keamanan sesi — token disimpan di HTTP-only cookie, tidak menyimpan video permanen di server, tidak menjual data ke pihak ketiga.
4. Siap App Review TikTok — Privacy Policy dan Terms of Service formal dalam bahasa Inggris, Redirect URI cocak dengan portal TikTok for Developers.

## Accessibility & Inclusion

Omit — tidak ada requirement aksesibilitas spesifik yang ditetapkan saat ini.