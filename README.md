# Sigap Chat - Halaman Web Sendiri (Tanpa Platform Pihak Ketiga)

Chatbot AI sebagai halaman web sendiri -- nggak butuh akun Telegram, Discord, atau platform manapun. Cukup buka link-nya di browser. Jalan di Cloudflare Workers, satu file JavaScript saja, 100% gratis tanpa kartu kredit.

## Kenapa ini lebih simpel daripada penggunaan platform pihak ketiga?

- **Tidak ada akun pihak ketiga** -- nggak perlu daftar Telegram atau Discord, jadi nggak ada risiko gagal login di platform orang lain
- **Tidak ada dependency npm** -- beda dari versi Discord yang butuh package `discord-interactions`, di sini cukup 1 file `src/index.js`, tidak ada `npm install` sama sekali
- **Tidak ada proses verifikasi/webhook ke pihak luar** -- nggak perlu daftarkan URL ke siapapun, begitu di-deploy langsung bisa dibuka

## Cara kerja

Satu file `src/index.js` ngerjain dua peran sekaligus:
1. Kalau dibuka di browser (GET request) → menyajikan halaman HTML (tampilan chat)
2. Kalau menerima pesan dari form chat (POST ke `/api/chat`) → jadi backend yang manggil Gemini API, lalu kirim balik jawabannya

`GEMINI_API_KEY` tetap aman tersimpan di server (Cloudflare Secrets), **tidak pernah** dikirim atau terlihat di browser pengguna.

## Setup dari Nol

### 1. Upload ke GitHub

Upload semua file di sini: `src/index.js`, `wrangler.jsonc`, `.gitignore`. (File `.dev.vars` kalau kamu buat dari `.dev.vars.example`, **jangan diupload**.)

### 2. Hubungkan ke Cloudflare Workers

1. Dashboard Cloudflare (akun yang sama dari percobaan sebelumnya) → **Workers & Pages** → **Create** → **Import a Git Repository**
2. Pilih repo ini, beri izin akses
3. Cloudflare otomatis deploy -- karena tidak ada dependency npm, prosesnya lebih cepat dari versi Discord
4. Kamu dapat URL seperti `https://sigap-web.<username-kamu>.workers.dev`

### 3. Isi Secret

Di halaman Worker kamu → **Settings → Variables and Secrets**, tambahkan:
- `GEMINI_API_KEY` = API key Gemini kamu (key lama dari proyek-proyek sebelumnya masih bisa dipakai)

### 4. Buka link-nya!

Buka URL Worker kamu langsung di browser -- selesai, chat-nya langsung bisa dipakai. Nggak ada langkah lain.

## Catatan teknis

- **Tanpa SDK** -- panggilan ke Gemini API murni pakai `fetch()` ke REST endpoint, sama seperti 2 versi sebelumnya
- **Riwayat chat disimpan di memori browser (JavaScript variable)** -- hilang kalau refresh halaman. Ini sengaja dibuat sederhana; kalau mau riwayat permanen, bisa pakai pendekatan seperti di proyek Kawan (database eksternal)
- **Tampilan**: HTML + CSS murni, tanpa framework (tidak ada React/Vue), supaya tetap satu file dan mudah dipahami

## Ide pengembangan lanjutan

- Tambah riwayat permanen (localStorage browser, atau database seperti Supabase)
- Tambah password sederhana sebelum bisa chat
- Pecah HTML ke file terpisah kalau makin kompleks
