# PT. AGRI WANGI BERRY — Situs & Panel Admin (GitHub Pages)

Berkas statis (HTML/CSS/JS). Seluruh data dan logika bisnis ada di Google Apps Script + Google Sheets
(backend API JSON murni — berkas `Kode.gs` dikirim terpisah, TIDAK ada di repository ini).

- `index.html` — halaman utama (wajib berada di akar repository)
- `css/style.css` — seluruh tampilan
- `js/config.js` — **satu-satunya berkas yang diubah**: isi `APP_API_URL` dengan URL `/exec` dari Apps Script
- `js/app.js` — seluruh logika situs publik dan panel admin (semua panggilan server memakai `fetch`)

Panduan lengkap langkah demi langkah: `PANDUAN-INSTALASI.md`.
