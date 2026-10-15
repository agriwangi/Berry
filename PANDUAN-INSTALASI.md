# PANDUAN INSTALASI — PT. AGRI WANGI BERRY

Arsitektur: **Frontend** (berkas di folder ini) → di-host di **GitHub Pages**.
**Backend** (`Kode.gs`) → **Google Apps Script** sebagai API JSON murni, data di Google Sheets + Drive.

Urutan wajib: **BAGIAN A (backend) dulu → dapat URL `/exec` → BAGIAN B (isi config) → BAGIAN C (GitHub).**

---

## BAGIAN A — BACKEND (Google Apps Script)

1. Buka https://script.google.com → **Proyek baru**. Beri nama, mis. `AWB Backend`.
2. Di editor, berkas `Code.gs` bawaan: ganti seluruh isinya dengan isi `Kode.gs` (dikirim terpisah). Nama berkas boleh tetap `Code.gs`.
   **Tidak ada berkas HTML** yang perlu ditambahkan — backend ini hanya API.
3. (Disarankan) Klik ikon roda gigi **Project Settings** → centang **Show "appsscript.json" manifest file in editor**.
   Kembali ke **Editor**, buka `appsscript.json`, ganti isinya dengan `appsscript.json` yang dikirim terpisah.
4. Jalankan setup — **HANYA SEKALI**:
   - Dropdown fungsi (di atas editor) → pilih **`setupAppEnvironment`** → klik ▶ **Run**.
   - Klik **Review permissions** → pilih akun Google Anda → **Advanced** → **Go to … (unsafe)** → **Allow**
     (wajar: skrip ini memang meminta akses Drive, Sheets, dan Gmail milik Anda sendiri).
   - Buka **Execution log**. Cari baris:
     `AKUN SUPER ADMIN — email: … | kata sandi sementara: …`
     **Catat kedua nilainya** — kata sandi sementara hanya tampil sekali.
   - Cek Google Drive: folder **AWB** terbentuk, berisi spreadsheet `DB_AWB_Utama` dan sub-folder.
5. Deploy: **Deploy → New deployment** → ikon roda gigi → **Web app**:
   - **Execute as: Me**
   - **Who has access: Anyone**
   - Klik **Deploy** → **salin URL Web App** (berakhiran `/exec`).
6. Uji backend: tempel di browser `URL_ANDA/exec?action=ping`. Harus muncul:
   `{"success":true,"versi":"1.0.0","nama":"PT. AGRI WANGI BERRY","mode":"api"}`
   Jika muncul halaman login Google atau error → langkah 5 belum "Anyone".

> **Saat kode backend diubah di kemudian hari:** Deploy → **Manage deployments** → ikon pensil → **Version: New version** → Deploy.
> URL `/exec` tetap sama. (Memilih "New deployment" akan menghasilkan URL baru — hindari.)

---

## BAGIAN B — ISI URL BACKEND DI FRONTEND

Folder kerja: **`agri-wangi-berry-web`** (hasil ekstrak ZIP; di dalamnya langsung terlihat `index.html`).

1. Buka `js/config.js` dengan Notepad.
2. Ganti `GANTI_DENGAN_URL_EXEC_APPS_SCRIPT_ANDA` dengan URL `/exec` dari langkah A5 (tetap di dalam tanda kutip). Contoh:
   `window.APP_API_URL = 'https://script.google.com/macros/s/AKfycb.../exec';`
3. Simpan.

---

## BAGIAN C — DEPLOY KE GITHUB PAGES (lewat terminal)

> **Folder tempat semua perintah Git dijalankan = `agri-wangi-berry-web`**
> (folder yang berisi `index.html`, `css`, `js`). Bukan folder di atasnya, bukan folder di dalamnya.
> Jangan memakai "Upload files" di situs GitHub — struktur folder `css/` dan `js/` akan rusak.

**C1. Pasang Git (wajib berhasil dulu sebelum langkah lain).**
Windows: unduh dari https://git-scm.com/download/win → jalankan installer → klik **Next** terus (pengaturan default) → **Install** → **Finish**.
**Setelah selesai, TUTUP semua jendela PowerShell lalu buka PowerShell yang BARU** (jendela lama tidak mengenali Git yang baru dipasang).
Cek dengan:
```
git --version
```
Harus muncul tulisan seperti `git version 2.4x.x.windows.x`.
Jika muncul `'git' is not recognized` → Git belum terpasang atau PowerShell belum dibuka ulang. Ulangi pemasangan, lalu buka PowerShell baru. **Jangan lanjut ke C2 sebelum `git --version` berhasil.**

**C2. Akun GitHub.** Daftar di https://github.com (username jadi bagian alamat situs: `username.github.io`).

**C3. Identitas Git (sekali saja):**
```
git config --global user.name "Nama Anda"
git config --global user.email "email@akun-github-anda.com"
```

**C4. Buat repository:** github.com → tombol **+** → **New repository** → nama mis. `agri-wangi-berry` →
**Public** → **jangan** centang README/.gitignore/license → **Create repository**.

**C5. Masuk ke folder kerja & verifikasi** (cara cepat Windows: buka folder `agri-wangi-berry-web` di File Explorer,
klik address bar, ketik `powershell`, Enter):
```
dir
```
Harus terlihat **`index.html`**, `css`, `js` (dan `README.md`, `PANDUAN-INSTALASI.md`). Tidak ada file `.gs`.
Jika yang terlihat justru folder `agri-wangi-berry-web` lagi, masuk dulu: `cd agri-wangi-berry-web`, lalu `dir` ulang.

**C6. Push pertama** (satu per satu):
```
git init
git add .
git commit -m "Upload pertama"
git branch -M main
git remote add origin https://github.com/USERNAME/NAMA-REPO.git
git push -u origin main
```
Saat diminta *Username*: username GitHub. *Password*: **Personal Access Token** (bukan password akun).
Saat mengetik/paste token, layar tampak kosong — itu normal; tekan Enter.

**C7. Buat token** (jika diminta): https://github.com/settings/tokens → **Generate new token (classic)** →
centang scope **repo** → Generate → salin `ghp_...` (hanya tampil sekali).

**C8. Aktifkan Pages:** repo di GitHub → **Settings → Pages** → Source: **Deploy from a branch** →
Branch **main** / **(root)** → Save → tunggu 1–2 menit → centang **Enforce HTTPS**.
Situs: `https://USERNAME.github.io/NAMA-REPO/`

**C9. Uji:** buka situs → beranda & produk tampil → login admin dengan email + kata sandi sementara dari A4 →
sistem meminta ganti kata sandi.

---

## UPDATE SETELAH INI (redeploy frontend)

Dari folder `agri-wangi-berry-web`:
```
git add .
git commit -m "Deskripsi perubahan"
git push
```
Tunggu 1–2 menit, lalu **Ctrl+Shift+R**.

---

## MASALAH UMUM

| Gejala | Penyebab | Solusi |
|---|---|---|
| "URL Web App belum diisi…" | `js/config.js` belum diisi | Isi `APP_API_URL`, lalu add/commit/push |
| "Respons server tidak valid…" | Akses Web App bukan "Anyone", atau URL salah | Ulang A5; uji `?action=ping` |
| Perubahan backend tidak terasa | Belum "New version" | Manage deployments → New version |
| Situs 404 | `index.html` tidak di akar repo | Lihat repo di browser; push ulang dari folder yang benar |
| Halaman tanpa gaya | Folder `css/` `js/` tidak ikut | Push ulang dari terminal (bukan Upload files) |
| `'git' is not recognized as the name of a cmdlet` | Git belum dipasang, atau PowerShell belum dibuka ulang setelah pemasangan | Pasang Git (C1), tutup semua PowerShell, buka yang baru, cek `git --version` |
| `Password authentication is not supported` | Memakai password akun | Pakai Personal Access Token (C7) |
| Email notifikasi berhenti | Kuota harian Gmail (±100/hari akun biasa) | Tunggu reset harian; antrean terkirim otomatis |
