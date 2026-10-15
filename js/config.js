/* ===========================================================================
   KONFIGURASI — satu-satunya berkas yang perlu Anda ubah.
   Isi APP_API_URL dengan URL Web App Apps Script Anda (berakhiran /exec).
   =========================================================================== */
window.APP_API_URL = 'https://script.google.com/macros/s/AKfycbxCtYqMyK2fAwOih1SwtKCKsGfy6RvXHdPr6pfQpRzzimMlmVPGIj3yJs7HoWZtfQi7/exec';

/* Jangan diubah: parameter alamat (?lacak=... / ?rute=...) dan alamat situs ini. */
(function () {
  var p = {};
  try { new URLSearchParams(location.search).forEach(function (v, k) { p[k] = v; }); } catch (e) { /* abaikan */ }
  window.AWAL = {
    param: { lacak: String(p.lacak || '').slice(0, 40), rute: String(p.rute || '').slice(0, 80) },
    urlApp: location.origin + location.pathname,
    versi: 'web'
  };
})();
