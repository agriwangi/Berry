/* ===================================================================
   AWB — JavaScript klien (SPA). Satu kali muat, navigasi 0 ms.
   Prinsip: SPA, UI optimistis + localStorage, cache di server,
   panggilan batch (satu panggilan per aksi), debounce pada pencarian.
   =================================================================== */
(function () {
'use strict';

/* ---------- utilitas dasar ---------- */
var $ = function (s, r) { return (r || document).querySelector(s); };
var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
var S = { token: '', exp: 0, user: null, admin: null, pub: null, keranjang: [], stok: {}, rute: '', aktif: 'publik', captcha: null };

function tambahKids(el, kids) {
  for (var i = 0; i < kids.length; i++) {
    var k = kids[i];
    if (k === null || k === undefined || k === false || k === true) continue;
    if (Array.isArray(k)) tambahKids(el, k);
    else if (k.nodeType) el.appendChild(k);
    else el.appendChild(document.createTextNode(String(k)));
  }
}
function h(tag, props) {
  var el = document.createElement(tag);
  var kids = Array.prototype.slice.call(arguments, 2);
  var nilai;
  if (props) {
    for (var k in props) {
      var v = props[k];
      if (v === null || v === undefined || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'style') { if (typeof v === 'object') Object.assign(el.style, v); else el.style.cssText = v; }
      else if (k.slice(0, 2) === 'on' && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
      else if (k === 'value') nilai = v;
      else if (k === 'checked' || k === 'disabled' || k === 'selected' || k === 'readOnly') el[k] = !!v;
      else if (k === 'data') { for (var d in v) el.dataset[d] = v[d]; }
      else el.setAttribute(k, v === true ? '' : v);
    }
  }
  tambahKids(el, kids);
  if (nilai !== undefined) el.value = nilai;
  return el;
}
function kosongkan(el) { while (el.firstChild) el.removeChild(el.firstChild); return el; }
function isi(el) { kosongkan(el); tambahKids(el, Array.prototype.slice.call(arguments, 1)); return el; }
function debounce(fn, ms) { var t; return function () { var a = arguments, c = this; clearTimeout(t); t = setTimeout(function () { fn.apply(c, a); }, ms || 300); }; }
function simpanLokal(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* abaikan */ } }
function bacaLokal(k, def) { try { var s = localStorage.getItem(k); return s ? JSON.parse(s) : def; } catch (e) { return def; } }
function hapusLokal(k) { try { localStorage.removeItem(k); } catch (e) { /* abaikan */ } }
function rp(n) { return 'Rp ' + String(Math.round(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, '.'); }
function angkaFmt(n) { return String(Math.round((Number(n) || 0) * 100) / 100).replace(/\B(?=(\d{3})+(?!\d))/g, '.'); }
var BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
function tglFmt(s, denganJam) {
  if (!s) return '';
  var m = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?/.exec(String(s));
  if (!m) return String(s);
  var t = Number(m[3]) + ' ' + BULAN[Number(m[2]) - 1] + ' ' + m[1];
  return denganJam && m[4] ? t + ' ' + m[4] + ':' + m[5] : t;
}
function relWaktu(s) {
  var m = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})/.exec(String(s || ''));
  if (!m) return tglFmt(s);
  var d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4] - 7, +m[5], +m[6]));
  var det = Math.round((Date.now() - d.getTime()) / 1000);
  if (det < 60) return 'baru saja'; if (det < 3600) return Math.floor(det / 60) + ' menit lalu';
  if (det < 86400) return Math.floor(det / 3600) + ' jam lalu'; if (det < 604800) return Math.floor(det / 86400) + ' hari lalu';
  return tglFmt(s);
}
function inisial(n) { var p = String(n || '?').trim().split(/\s+/); return ((p[0] || '?')[0] + ((p[1] || '')[0] || '')).toUpperCase(); }
function warnaAvatar(n) { var w = ['#1D4B4B', '#C8102E', '#5B8C3A', '#7C3AED', '#0369A1', '#B45309', '#BE185D']; var x = 0; String(n || '').split('').forEach(function (c) { x += c.charCodeAt(0); }); return w[x % w.length]; }
function foto(id, w) { return id ? 'https://lh3.googleusercontent.com/d/' + encodeURIComponent(id) + '=w' + (w || 600) : ''; }
function aman(url) { url = String(url || ''); return /^(https?:\/\/|#\/|mailto:|tel:)/i.test(url) ? url : '#/'; }
function tautanLuar(hash) { var d = (window.AWAL && window.AWAL.urlApp) || ''; try { if (!d && document.referrer) d = document.referrer; } catch (e) {} return (d || location.href.split('#')[0]) + (hash || ''); }
function salinTeks(t) {
  var ok = function () { toast('Disalin ke papan klip.', 'ok'); };
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(ok, function () { salinCadangan(t, ok); });
  else salinCadangan(t, ok);
}
function salinCadangan(t, cb) { var a = h('textarea', { style: 'position:fixed;opacity:0' }); a.value = t; document.body.appendChild(a); a.select(); try { document.execCommand('copy'); cb(); } catch (e) { /* abaikan */ } a.remove(); }
function unduhTeks(nama, isiTeks, mime) {
  var blob = new Blob([isiTeks], { type: mime || 'text/csv;charset=utf-8' }); var a = h('a', { href: URL.createObjectURL(blob), download: nama });
  document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}
function unduhB64(nama, mime, b64) {
  var bin = atob(b64), arr = new Uint8Array(bin.length); for (var i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  var blob = new Blob([arr], { type: mime || 'application/octet-stream' }); var a = h('a', { href: URL.createObjectURL(blob), download: nama });
  document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 800);
}

/* ---------- ikon (gaya Lucide, 1.75 px) ---------- */
var IK = {
  'search': '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>', 'x': '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>', 'plus': '<path d="M5 12h14"/><path d="M12 5v14"/>',
  'minus': '<path d="M5 12h14"/>', 'trash': '<path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
  'pencil': '<path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>', 'eye': '<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>',
  'eye-off': '<path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" x2="22" y1="2" y2="22"/>',
  'grip': '<circle cx="9" cy="6" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="9" cy="18" r="1"/><circle cx="15" cy="6" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="18" r="1"/>',
  'lock': '<rect width="18" height="11" x="3" y="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>', 'chevron-down': '<path d="m6 9 6 6 6-6"/>', 'chevron-right': '<path d="m9 18 6-6-6-6"/>',
  'chevron-left': '<path d="m15 18-6-6 6-6"/>', 'chevron-up': '<path d="m18 15-6-6-6 6"/>', 'check': '<path d="M20 6 9 17l-5-5"/>',
  'alert': '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
  'download': '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/><path d="M12 15V3"/>', 'upload': '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m17 8-5-5-5 5"/><path d="M12 3v12"/>',
  'copy': '<rect width="14" height="14" x="8" y="8" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>',
  'cart': '<circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/>',
  'log-out': '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/>', 'bell': '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
  'sun': '<circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/>',
  'moon': '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>', 'refresh': '<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>',
  'menu': '<line x1="4" x2="20" y1="12" y2="12"/><line x1="4" x2="20" y1="6" y2="6"/><line x1="4" x2="20" y1="18" y2="18"/>',
  'house': '<path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"/><path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  'info': '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>', 'map-pin': '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>',
  'briefcase': '<rect width="20" height="14" x="2" y="7" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>', 'mail': '<rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>',
  'package': '<path d="m7.5 4.27 9 5.15"/><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/>',
  'shopping-basket': '<path d="m15 11-1 9"/><path d="m19 11-4-7"/><path d="M2 11h20"/><path d="m3.5 11 1.6 7.4a2 2 0 0 0 2 1.6h9.8a2 2 0 0 0 2-1.6l1.7-7.4"/><path d="m5 11 4-7"/><path d="m9 11 1 9"/>',
  'newspaper': '<path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2"/><path d="M18 14h-8"/><path d="M15 18h-5"/><path d="M10 6h8v4h-8V6Z"/>',
  'handshake': '<path d="m11 17 2 2a1 1 0 1 0 3-3"/><path d="m14 14 2.5 2.5a1 1 0 1 0 3-3l-3.88-3.88a3 3 0 0 0-4.24 0l-.88.88a1 1 0 1 1-3-3l2.81-2.81a5.79 5.79 0 0 1 7.06-.87l.47.28a2 2 0 0 0 1.42.25L21 4"/><path d="m21 3 1 11h-2"/><path d="M3 3 2 14l6.5 6.5a1 1 0 1 0 3-3"/><path d="M3 4h8"/>',
  'package-search': '<path d="M21 10V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l2-1.14"/><path d="m7.5 4.27 9 5.15"/><polyline points="3.29 7 12 12 20.71 7"/><line x1="12" x2="12" y1="22" y2="12"/><circle cx="18.5" cy="15.5" r="2.5"/><path d="M20.27 17.27 22 19"/>',
  'layout-dashboard': '<rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/><rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/>',
  'receipt': '<path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z"/><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8"/><path d="M12 17.5v-11"/>',
  'users': '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  'inbox': '<polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>',
  'chart-column': '<path d="M3 3v16a2 2 0 0 0 2 2h16"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/>',
  'palette': '<circle cx="13.5" cy="6.5" r=".5"/><circle cx="17.5" cy="10.5" r=".5"/><circle cx="8.5" cy="7.5" r=".5"/><circle cx="6.5" cy="12.5" r=".5"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/>',
  'database': '<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5V19A9 3 0 0 0 21 19V5"/><path d="M3 12A9 3 0 0 0 21 12"/>',
  'user-cog': '<circle cx="18" cy="15" r="3"/><circle cx="9" cy="7" r="4"/><path d="M10 15H6a4 4 0 0 0-4 4v2"/><path d="m21.7 16.4-.9-.3"/><path d="m15.2 13.9-.9-.3"/><path d="m16.6 18.7.3-.9"/><path d="m19.1 12.2.3-.9"/><path d="m19.6 18.7-.4-1"/><path d="m16.8 12.3-.4-1"/><path d="m14.3 16.6 1-.4"/><path d="m20.7 13.8 1-.4"/>',
  'shield': '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/>',
  'settings': '<circle cx="12" cy="12" r="3"/><path d="M12 2v3"/><path d="M12 19v3"/><path d="m4.93 4.93 2.12 2.12"/><path d="m16.95 16.95 2.12 2.12"/><path d="M2 12h3"/><path d="M19 12h3"/><path d="m4.93 19.07 2.12-2.12"/><path d="m16.95 7.05 2.12-2.12"/>',
  'history': '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l4 2"/>', 'star': '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>',
  'image': '<rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>',
  'file': '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/>',
  'external-link': '<path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
  'phone': '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>',
  'clock': '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>', 'calendar': '<path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/>',
  'filter': '<polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>', 'arrow-up': '<path d="m5 12 7-7 7 7"/><path d="M12 19V5"/>', 'arrow-down': '<path d="M12 5v14"/><path d="m19 12-7 7-7-7"/>',
  'user': '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>', 'link': '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
  'message-circle': '<path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/>', 'layers': '<path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z"/><path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65"/><path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65"/>',
  'more': '<circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/>', 'list': '<line x1="8" x2="21" y1="6" y2="6"/><line x1="8" x2="21" y1="12" y2="12"/><line x1="8" x2="21" y1="18" y2="18"/><line x1="3" x2="3.01" y1="6" y2="6"/><line x1="3" x2="3.01" y1="12" y2="12"/><line x1="3" x2="3.01" y1="18" y2="18"/>',
  'type': '<polyline points="4 7 4 4 20 4 20 7"/><line x1="9" x2="15" y1="20" y2="20"/><line x1="12" x2="12" y1="4" y2="20"/>', 'video': '<path d="m16 13 5.223 3.482a.5.5 0 0 0 .777-.416V7.87a.5.5 0 0 0-.752-.432L16 10.5"/><rect x="2" y="6" width="14" height="12" rx="2"/>',
  'grid': '<rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/>',
  'square': '<rect width="18" height="18" x="3" y="3" rx="2"/>', 'hash': '<line x1="4" x2="20" y1="9" y2="9"/><line x1="4" x2="20" y1="15" y2="15"/><line x1="10" x2="8" y1="3" y2="21"/><line x1="16" x2="14" y1="3" y2="21"/>',
  'bold': '<path d="M6 12h9a4 4 0 0 1 0 8H7a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h7a4 4 0 0 1 0 8"/>', 'italic': '<line x1="19" x2="10" y1="4" y2="4"/><line x1="14" x2="5" y1="20" y2="20"/><line x1="15" x2="9" y1="4" y2="20"/>',
  'save': '<path d="M15.2 3a2 2 0 0 1 1.4.6l3.8 3.8a2 2 0 0 1 .6 1.4V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/><path d="M17 21v-7a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v7"/><path d="M7 3v4a1 1 0 0 0 1 1h7"/>',
  'send': '<path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/>', 'tag': '<path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z"/><circle cx="7.5" cy="7.5" r=".5"/>',
  'key': '<circle cx="7.5" cy="15.5" r="5.5"/><path d="m21 2-9.6 9.6"/><path d="m15.5 7.5 3 3L22 7l-3-3"/>', 'unlock': '<rect width="18" height="11" x="3" y="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/>',
  'smartphone': '<rect width="14" height="20" x="5" y="2" rx="2" ry="2"/><path d="M12 18h.01"/>', 'monitor': '<rect width="20" height="14" x="2" y="3" rx="2"/><line x1="8" x2="16" y1="21" y2="21"/><line x1="12" x2="12" y1="17" y2="21"/>',
  'tablet': '<rect width="16" height="20" x="4" y="2" rx="2" ry="2"/><line x1="12" x2="12.01" y1="18" y2="18"/>', 'file-text': '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/>'
};
function ik(nama, kelas) {
  var d = IK[nama] || '<circle cx="12" cy="12" r="9"/>';
  var t = document.createElement('template');
  t.innerHTML = '<svg class="ik ' + (kelas || '') + '" viewBox="0 0 24 24" aria-hidden="true">' + d + '</svg>';
  return t.content.firstChild;
}
function lambangBuah(ukuran, warna) {
  var t = document.createElement('template');
  t.innerHTML = '<svg viewBox="0 0 32 32" width="' + ukuran + '" height="' + ukuran + '" aria-hidden="true"><path d="M16 29C9 29 5 23 5 17.5 5 13 8 10.5 11 10c2-.3 3.5.6 5 .6s3-.9 5-.6c3 .5 6 3 6 7.5C27 23 23 29 16 29z" fill="' + (warna || '#C8102E') + '"/><path d="M9 10c1-3 4-4.5 7-4.5s6 1.5 7 4.5c-2-1-4.5-1.5-7-1.5S11 9 9 10z" fill="#5B8C3A"/><path d="M16 6V2.5" stroke="#5B8C3A" stroke-width="2" stroke-linecap="round"/><g fill="#FFE9A8"><circle cx="12" cy="16" r=".9"/><circle cx="16" cy="15" r=".9"/><circle cx="20" cy="16" r=".9"/><circle cx="14" cy="20" r=".9"/><circle cx="18" cy="20" r=".9"/><circle cx="16" cy="24" r=".9"/></g></svg>';
  return t.content.firstChild;
}

/* ---------- toast, modal, laci, konfirmasi ---------- */
function toast(pesan, jenis, aksi, ms) {
  var root = $('#toast-root');
  var el = h('div', { class: 'toast ' + (jenis || 'in'), role: jenis === 'er' ? 'alert' : 'status' }, ik(jenis === 'ok' ? 'check' : jenis === 'er' ? 'alert' : jenis === 'wr' ? 'alert' : 'info', 'kecil'), h('span', null, pesan));
  var tutup = function () { if (el.parentNode) el.remove(); };
  if (aksi) el.appendChild(h('button', { class: 't-aksi', onclick: function () { tutup(); aksi.fn(); } }, aksi.label));
  root.appendChild(el);
  setTimeout(tutup, ms || (aksi ? 8000 : (jenis === 'er' ? 6500 : 3800)));
  return tutup;
}
var tumpukModal = [];
function tutupModalTeratas() { var m = tumpukModal[tumpukModal.length - 1]; if (m) m.tutup(); }
document.addEventListener('keydown', function (e) { if (e.key === 'Escape') tutupModalTeratas(); });
function modal(o) {
  var dim = h('div', { class: 'dim' + (o.laci ? ' drawer-dim' : ''), role: 'dialog', 'aria-modal': 'true', 'aria-label': o.judul || '' });
  var tombolWrap = h('div', { class: 'modal-f' });
  var kotak = h('div', { class: o.laci ? 'drawer' + (o.ukuran === 'lebar' ? ' lebar' : '') : 'modal ' + (o.ukuran || '') },
    h('div', { class: 'modal-h' }, h('h3', null, o.judul || ''), h('button', { class: 'ikon-btn-a', 'aria-label': 'Tutup', onclick: function () { api.tutup(); } }, ik('x'))),
    h('div', { class: 'modal-b' }, o.isi), tombolWrap);
  var api = {
    el: kotak, badan: $('.modal-b', kotak), footer: tombolWrap,
    tutup: function (hasil) { if (api.sudah) return; api.sudah = true; dim.remove(); var i = tumpukModal.indexOf(api); if (i >= 0) tumpukModal.splice(i, 1); if (o.saatTutup) o.saatTutup(hasil); },
    setTombol: function (list) { kosongkan(tombolWrap); (list || []).forEach(function (t) { tombolWrap.appendChild(t); }); tombolWrap.hidden = !(list && list.length); }
  };
  api.setTombol(o.tombol);
  dim.addEventListener('mousedown', function (e) { if (e.target === dim && !o.tahan) api.tutup(); });
  dim.appendChild(kotak);
  $('#modal-root').appendChild(dim);
  tumpukModal.push(api);
  var f = $('input:not([type=hidden]),select,textarea,button.btn-a', kotak.querySelector('.modal-b')); if (f && !o.tanpaFokus) setTimeout(function () { try { f.focus(); } catch (e) { /* abaikan */ } }, 30);
  return api;
}
function laciSamping(o) { o.laci = true; return modal(o); }
function tombolA(label, kelas, fn, ikon) {
  var b = h('button', { type: 'button', class: 'btn-a ' + (kelas || ''), onclick: fn }, ikon ? ik(ikon, 'kecil') : null, label);
  return b;
}
function konfirmasi(o) {
  return new Promise(function (res) {
    var input = o.ketik ? h('input', { type: 'text', placeholder: 'Ketik ' + o.ketik, 'aria-label': 'Konfirmasi', style: 'margin-top:12px' }) : null;
    var ya = tombolA(o.ya || 'Ya, lanjutkan', o.bahaya ? 'bahaya' : '', function () { m.tutup(true); });
    var sel = false;
    var m = modal({ judul: o.judul || 'Konfirmasi', ukuran: 'sempit', isi: h('div', null, h('p', { style: 'margin:0' }, o.pesan || ''), input), tombol: [tombolA('Batal', 'hantu', function () { m.tutup(false); }), ya],
      saatTutup: function (v) { if (!sel) { sel = true; res(!!v); } } });
    if (input) { ya.disabled = true; input.addEventListener('input', function () { ya.disabled = input.value !== o.ketik; }); }
  });
}
function spinnerTombol(btn, aktif, teks) {
  if (aktif) { btn.dataset.asli = btn.textContent; btn.disabled = true; btn.textContent = teks || 'Memproses…'; }
  else { btn.disabled = false; if (btn.dataset.asli !== undefined) btn.textContent = btn.dataset.asli; }
}

/* ---------- RPC (fetch ke Web App Apps Script → Promise) ---------- */
function tanganiHasil(r, res, rej) {
  if (r && r.success === false) {
    if (r.kode === 'SESI_HABIS') sesiHabis();
    rej(r);
  } else res(r);
}
function rpc() {
  var args = Array.prototype.slice.call(arguments), fn = args.shift();
  return new Promise(function (res, rej) {
    var urlApi = window.APP_API_URL || '';
    if (/GANTI_DENGAN/.test(urlApi)) { rej({ message: 'URL Web App belum diisi. Buka js/config.js lalu isi APP_API_URL dengan URL /exec dari Apps Script.' }); return; }
    /* semua panggilan server lewat fetch POST ke Web App Apps Script */
    {
      var ctl = (typeof AbortController !== 'undefined') ? new AbortController() : null, waktu = ctl ? setTimeout(function () { ctl.abort(); }, 90000) : 0;
      fetch(urlApi, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' }, /* text/plain: menghindari preflight CORS yang diblokir GAS */
        body: JSON.stringify({ fn: fn, args: args }),
        signal: ctl ? ctl.signal : undefined
      }).then(function (r) { return r.text(); }).then(function (t) {
        clearTimeout(waktu);
        var j; try { j = JSON.parse(t); } catch (e) { rej({ message: 'Respons server tidak valid. Pastikan URL Web App benar dan akses diatur "Siapa saja".' }); return; }
        tanganiHasil(j, res, rej);
      }).catch(function (e) { clearTimeout(waktu); rej({ message: (e && e.name === 'AbortError') ? 'Server terlalu lama menjawab. Coba lagi.' : 'Gagal terhubung ke server. Periksa koneksi internet.' }); });
      return;
    }
  });
}
function rpcA(fn) { // panggilan admin: token otomatis disisipkan
  var a = Array.prototype.slice.call(arguments, 1);
  return rpc.apply(null, [fn, S.token].concat(a));
}
function pesanGalat(e) { return (e && e.message) ? e.message : 'Terjadi kesalahan.'; }
function gagalToast(e) { if (e && e.kode === 'SESI_HABIS') return; toast(pesanGalat(e), 'er'); }

/* ---------- sesi ---------- */
function simpanSesi(token, exp) { S.token = token; S.exp = exp; simpanLokal('awb_sesi', { t: token, e: exp }); }
function hapusSesi() { S.token = ''; S.exp = 0; S.user = null; S.admin = null; hapusLokal('awb_sesi'); }
function muatSesi() { var s = bacaLokal('awb_sesi', null); if (s && s.t && s.e > Date.now()) { S.token = s.t; S.exp = s.e; return true; } hapusLokal('awb_sesi'); return false; }
var sedangKeluar = false;
function sesiHabis() {
  if (sedangKeluar || !S.token) return; sedangKeluar = true;
  hapusSesi(); toast('Sesi Anda berakhir. Silakan masuk kembali.', 'wr');
  location.hash = '#/masuk'; setTimeout(function () { sedangKeluar = false; }, 500);
}

/* ---------- kompres & baca berkas ---------- */
function bacaDataUrl(file) { return new Promise(function (res, rej) { var r = new FileReader(); r.onload = function () { res(r.result); }; r.onerror = function () { rej({ message: 'Gagal membaca berkas.' }); }; r.readAsDataURL(file); }); }
function kompresGambar(file, maksSisi, mutu) {
  maksSisi = maksSisi || 1280; mutu = mutu || 0.82;
  return bacaDataUrl(file).then(function (url) {
    return new Promise(function (res) {
      var img = new Image();
      img.onload = function () {
        var s = Math.min(1, maksSisi / Math.max(img.width, img.height)), c = document.createElement('canvas');
        c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        var out = c.toDataURL('image/jpeg', mutu);
        res({ nama: file.name.replace(/\.[^.]+$/, '') + '.jpg', b64: out.split(',')[1], preview: out });
      };
      img.onerror = function () { res({ nama: file.name, b64: url.split(',')[1], preview: url, mentah: true }); };
      img.src = url;
    });
  });
}
function siapkanBerkas(file, opsi) {
  opsi = opsi || {};
  var maks = (opsi.maksMB || 5) * 1024 * 1024;
  if (/^image\//.test(file.type) && !/gif$/.test(file.type)) return kompresGambar(file, opsi.sisi, opsi.mutu);
  if (file.size > maks) return Promise.reject({ message: 'Ukuran berkas melebihi ' + (opsi.maksMB || 5) + ' MB.' });
  return bacaDataUrl(file).then(function (u) { return { nama: file.name, b64: u.split(',')[1], preview: /^image\//.test(file.type) ? u : '', mentah: true }; });
}
/** Zona unggah (klik / seret). Mengembalikan {el, ambil():berkas|null, setAda(url)}. */
function zonaUnggah(o) {
  var hasil = null, input = h('input', { type: 'file', accept: o.accept || '', class: 'sr', tabindex: '-1' });
  var teks = h('div', null, h('div', null, ik('upload', 'besar')), h('div', { style: 'font-weight:600' }, o.label || 'Klik atau seret berkas ke sini'), h('div', { class: 'bantu' }, o.bantu || ''));
  var pre = h('div'); var galat = h('div', { class: 'pesan-salah', hidden: true });
  var el = h('div', { class: 'zona-unggah', tabindex: '0', role: 'button', 'aria-label': o.label || 'Pilih berkas' }, input, teks, pre);
  function pilih(file) {
    if (!file) return;
    galat.hidden = true;
    siapkanBerkas(file, o).then(function (b) {
      hasil = b; kosongkan(pre);
      if (b.preview) pre.appendChild(h('img', { src: b.preview, alt: 'Pratinjau' }));
      else pre.appendChild(h('div', { style: 'margin-top:8px;font-weight:600' }, ik('file', 'kecil'), ' ', b.nama));
      if (o.saatPilih) o.saatPilih(b);
    }, function (e) { hasil = null; galat.textContent = pesanGalat(e); galat.hidden = false; });
  }
  el.addEventListener('click', function () { input.click(); });
  el.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.click(); } });
  input.addEventListener('click', function (e) { e.stopPropagation(); });
  input.addEventListener('change', function () { pilih(input.files[0]); });
  ['dragenter', 'dragover'].forEach(function (n) { el.addEventListener(n, function (e) { e.preventDefault(); el.classList.add('tarik'); }); });
  ['dragleave', 'drop'].forEach(function (n) { el.addEventListener(n, function (e) { e.preventDefault(); el.classList.remove('tarik'); }); });
  el.addEventListener('drop', function (e) { pilih(e.dataTransfer.files[0]); });
  var bungkus = h('div', null, el, galat);
  return { el: bungkus, ambil: function () { return hasil; }, setAda: function (url) { if (url) { kosongkan(pre); pre.appendChild(h('img', { src: url, alt: 'Saat ini' })); } }, setGalat: function (t) { galat.textContent = t; galat.hidden = !t; }, reset: function () { hasil = null; kosongkan(pre); } };
}

/* ---------- font & tema ---------- */
var fontDimuat = { 'Bowlby One': 1, 'DM Sans': 1 };
function muatFont(nama) {
  if (!nama || fontDimuat[nama]) return; fontDimuat[nama] = 1;
  var l = document.createElement('link'); l.rel = 'stylesheet';
  l.href = 'https://fonts.googleapis.com/css2?family=' + encodeURIComponent(nama).replace(/%20/g, '+') + ':wght@400;500;600;700;800&display=swap';
  document.head.appendChild(l);
}
function terapkanTema(P, el) {
  el = el || document.documentElement;
  var set = function (k, v) { if (v !== undefined && v !== null && v !== '') el.style.setProperty(k, v); };
  var px = function (v) { return Number(v) + 'px'; };
  set('--utama', P.warna_utama); set('--kedua', P.warna_kedua); set('--aksen', P.warna_aksen); set('--teks', P.warna_teks); set('--latar', P.warna_latar); set('--gelap', P.warna_gelap);
  var u = P.warna_utama || '#C8102E'; set('--utama-gelap', u);
  muatFont(P.huruf_judul); muatFont(P.huruf_isi);
  set('--f-judul', "'" + (P.huruf_judul || 'Bowlby One') + "', 'Arial Black', sans-serif"); set('--f-isi', "'" + (P.huruf_isi || 'DM Sans') + "', system-ui, sans-serif");
  set('--fs', px(P.huruf_dasar || 16)); set('--h1', px(P.huruf_h1 || 56)); set('--h2', px(P.huruf_h2 || 36)); set('--h3', px(P.huruf_h3 || 22));
  set('--fw-judul', P.huruf_tebal_judul); set('--ls', px(P.huruf_jarak || 0)); set('--lh', P.huruf_tinggi_baris);
  set('--rasio-produk', P.foto_rasio_produk); set('--tinggi-produk', px(P.foto_tinggi_produk || 0)); set('--tinggi-hero', px(P.foto_tinggi_hero || 560)); set('--tinggi-logo', px(P.foto_ukuran_logo || 44));
  set('--r-foto', P.foto_sudut === 'Tajam' ? '0px' : '16px'); set('--foto-potong', P.foto_potong === 'Muat' ? 'contain' : 'cover');
  set('--max', px(P.tata_lebar_maks || 1200)); set('--kol-d', P.tata_kolom_desktop); set('--kol-hp', P.tata_kolom_hp); set('--jarak', px(P.tata_jarak_bagian || 96));
  set('--r-kartu', px(P.tata_sudut_kartu || 16)); set('--r-tombol', px(P.tata_sudut_tombol || 999));
  var by = P.tata_bayangan; set('--bayang', by === 'Tanpa' ? 'none' : by === 'Tegas' ? '0 8px 28px rgba(31,42,42,.22)' : '0 6px 20px rgba(31,42,42,.08)');
  set('--bayang-naik', by === 'Tanpa' ? 'none' : '0 10px 28px rgba(31,42,42,.16)');
  set('--menu-fs', px(P.menu_huruf || 14)); set('--tombol-warna', P.tombol_warna || P.warna_utama);
  el.classList.toggle('gelap', P.mode_gelap === 'Ya');
  el.classList.toggle('tombol-garis', P.tombol_gaya === 'Garis');
  el.classList.toggle('tombol-kecil', P.tombol_ukuran === 'Kecil'); el.classList.toggle('tombol-besar', P.tombol_ukuran === 'Besar');
}
function terapkanTemaAdmin(P) {
  var r = document.documentElement;
  r.style.setProperty('--a-fs', (Number(P.admin_huruf) || 14) + 'px');
  r.style.setProperty('--a-baris', P.admin_kepadatan === 'Rapat' ? '40px' : P.admin_kepadatan === 'Lega' ? '60px' : '52px');
}

/* ---------- markdown sederhana (aman: semua di-escape dulu) ---------- */
function escHtml(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function mdInline(t) {
  t = escHtml(t);
  t = t.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>').replace(/`([^`]+)`/g, '<code>$1</code>');
  t = t.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
  t = t.replace(/!\[([^\]]*)\]\((https?:\/\/[^\s)]+)\)/g, '<img src="$2" alt="$1">');
  return t;
}
function mdKeDom(src) {
  var box = h('div', { class: 'md' });
  var lines = String(src || '').replace(/\r/g, '').split('\n'), i = 0;
  while (i < lines.length) {
    var ln = lines[i];
    if (!ln.trim()) { i++; continue; }
    var m;
    if ((m = /^(#{1,3})\s+(.*)$/.exec(ln))) { var e = h('h' + (m[1].length + 1)); e.innerHTML = mdInline(m[2]); box.appendChild(e); i++; continue; }
    if (/^\s*[-*]\s+/.test(ln)) { var ul = h('ul'); while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) { var li = h('li'); li.innerHTML = mdInline(lines[i].replace(/^\s*[-*]\s+/, '')); ul.appendChild(li); i++; } box.appendChild(ul); continue; }
    if (/^\s*\d+\.\s+/.test(ln)) { var ol = h('ol'); while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) { var l2 = h('li'); l2.innerHTML = mdInline(lines[i].replace(/^\s*\d+\.\s+/, '')); ol.appendChild(l2); i++; } box.appendChild(ol); continue; }
    if (/^>\s?/.test(ln)) { var bq = h('blockquote'); bq.innerHTML = mdInline(ln.replace(/^>\s?/, '')); box.appendChild(bq); i++; continue; }
    var buf = []; while (i < lines.length && lines[i].trim() && !/^(#{1,3}\s|\s*[-*]\s|\s*\d+\.\s|>)/.test(lines[i])) { buf.push(lines[i]); i++; }
    var p = h('p'); p.innerHTML = mdInline(buf.join('\n')).replace(/\n/g, '<br>'); box.appendChild(p);
  }
  return box;
}

/* ---------- tabel berhalaman generik (paginasi server, requestSeq, skeleton, galat) ---------- */
function tabelBerhalaman(cfg) {
  var st = { opsi: Object.assign({ halaman: 1, cari: '', filter: {}, urut: cfg.urut || '', arah: cfg.arah || 'asc' }, cfg.opsiAwal || {}), seq: 0, data: null, pilih: {} };
  var wadah = h('div', { class: 'kartu-a' }); var barMassal = h('div', { class: 'bar-massal', hidden: true, role: 'region', 'aria-label': 'Aksi massal' }); var isiEl = h('div', { class: 'tbl-wrap' }); var nav = h('div');
  wadah.appendChild(isiEl); wadah.appendChild(nav); wadah.appendChild(barMassal);
  function renderBarMassal() {
    var ids = Object.keys(st.pilih); kosongkan(barMassal); barMassal.hidden = !cfg.massal || !ids.length; if (barMassal.hidden) return;
    barMassal.appendChild(h('span', { class: 'jml' }, ids.length + ' dipilih'));
    cfg.massal.forEach(function (a) { barMassal.appendChild(h('button', { type: 'button', class: 'btn-a kecil ' + (a.bahaya ? 'bahaya' : 'garis-terang'), onclick: function () { a.fn(ids, function () { st.pilih = {}; renderBarMassal(); muat(true); }); } }, a.ikon ? ik(a.ikon, 'kecil') : null, a.label)); });
    barMassal.appendChild(h('button', { type: 'button', class: 'btn-a kecil hantu-terang', onclick: function () { st.pilih = {}; renderBarMassal(); render(); } }, 'Batal pilih'));
  }
  function skeleton() {
    var rows = []; for (var i = 0; i < 6; i++) rows.push(h('div', { class: 'skel', style: 'height:34px;margin:12px 16px' })); isi.apply(null, [isiEl].concat(rows)); kosongkan(nav);
  }
  function render() {
    var d = st.data; kosongkan(isiEl); kosongkan(nav);
    if (!d.baris.length) {
      var k = cfg.kosong || {};
      isiEl.appendChild(h('div', { class: 'kosong-a' }, ik(k.ikon || 'inbox'), h('h4', null, st.opsi.cari || Object.keys(st.opsi.filter).some(function (x) { return st.opsi.filter[x]; }) ? 'Tidak ada data yang cocok' : (k.judul || 'Belum ada data')),
        h('div', null, k.pesan || ''), k.cta && !st.opsi.cari ? h('div', { style: 'margin-top:12px' }, k.cta) : null));
      return;
    }
    var thead = h('tr');
    if (cfg.massal) { var semua = h('input', { type: 'checkbox', class: 'cek', 'aria-label': 'Pilih semua baris' }); semua.checked = d.baris.every(function (b) { return st.pilih[b.id]; }); semua.addEventListener('change', function () { d.baris.forEach(function (b) { if (semua.checked) st.pilih[b.id] = 1; else delete st.pilih[b.id]; }); renderBarMassal(); render(); }); thead.appendChild(h('th', { scope: 'col', style: 'width:44px' }, semua)); }
    cfg.kolom.forEach(function (c) {
      var th = h('th', { class: (c.r ? 'r ' : '') + (c.urut ? 'urut' : ''), scope: 'col' }, c.l, c.urut && st.opsi.urut === c.k ? (st.opsi.arah === 'asc' ? ' ↑' : ' ↓') : '');
      if (c.urut) th.addEventListener('click', function () { st.opsi.arah = st.opsi.urut === c.k && st.opsi.arah === 'asc' ? 'desc' : 'asc'; st.opsi.urut = c.k; st.opsi.halaman = 1; muat(); });
      thead.appendChild(th);
    });
    if (cfg.aksi) thead.appendChild(h('th', { scope: 'col' }, h('span', { class: 'sr' }, 'Aksi')));
    var tbody = h('tbody');
    d.baris.forEach(function (b) {
      var tr = h('tr', { class: (cfg.klik ? 'klik' : '') + (st.pilih[b.id] ? ' sel' : '') });
      if (cfg.massal) { var cb = h('input', { type: 'checkbox', class: 'cek', 'aria-label': 'Pilih baris' }); cb.checked = !!st.pilih[b.id]; cb.addEventListener('change', function () { if (cb.checked) st.pilih[b.id] = 1; else delete st.pilih[b.id]; tr.classList.toggle('sel', cb.checked); renderBarMassal(); }); tr.appendChild(h('td', null, cb)); }
      if (cfg.klik) { tr.addEventListener('click', function (e) { if (e.target.closest('button,a,input,select,label')) return; cfg.klik(b); }); }
      cfg.kolom.forEach(function (c) {
        var v = c.fmt ? c.fmt(b[c.k], b) : (b[c.k] === undefined || b[c.k] === null ? '' : String(b[c.k]));
        tr.appendChild(h('td', { class: c.r ? 'r' : '', 'data-l': c.l, title: typeof v === 'string' ? v : null }, v));
      });
      if (cfg.aksi) tr.appendChild(h('td', { class: 'aksi' }, cfg.aksi(b)));
      tbody.appendChild(tr);
    });
    renderBarMassal();
    isiEl.appendChild(h('table', { class: 'tbl kartu-hp' }, h('thead', null, thead), tbody));
    var tp = Math.max(1, Math.ceil(d.total / d.ukuran)), hal = d.halaman;
    var pil = function (n, l, nonaktif) { return h('button', { type: 'button', class: 'pil' + (n === hal && !l ? ' aktif' : ''), disabled: nonaktif, onclick: function () { st.opsi.halaman = n; muat(); }, 'aria-label': l ? l : 'Halaman ' + n }, l || n); };
    var tombols = [pil(hal - 1, '‹', hal <= 1)]; var mulai = Math.max(1, hal - 2), akhir = Math.min(tp, mulai + 4); mulai = Math.max(1, akhir - 4);
    for (var n = mulai; n <= akhir; n++) tombols.push(pil(n));
    tombols.push(pil(hal + 1, '›', hal >= tp));
    nav.appendChild(h('div', { class: 'halaman-nav' }, h('span', null, 'Menampilkan ' + ((hal - 1) * d.ukuran + 1) + '–' + Math.min(d.total, hal * d.ukuran) + ' dari ' + d.total), tp > 1 ? h('div', { class: 'hn' }, tombols) : null));
  }
  function muat(diam) {
    var no = ++st.seq; if (!diam) skeleton();
    return cfg.ambil(st.opsi).then(function (r) {
      if (no !== st.seq) return; st.data = r.data; if (r.data.halaman !== st.opsi.halaman) st.opsi.halaman = r.data.halaman;
      render(); if (cfg.saatMuat) cfg.saatMuat(r.data);
    }, function (e) {
      if (no !== st.seq) return; kosongkan(isiEl); kosongkan(nav);
      isiEl.appendChild(h('div', { class: 'kosong-a' }, ik('alert'), h('h4', null, 'Gagal memuat data'), h('div', null, pesanGalat(e)), h('div', { style: 'margin-top:12px' }, tombolA('Coba Lagi', 'garis', function () { muat(); }, 'refresh'))));
    });
  }
  return { el: wadah, muat: muat, opsi: st.opsi, set: function (o) { Object.assign(st.opsi, o); st.opsi.halaman = 1; return muat(); }, data: function () { return st.data; } };
}
function statusBadge(s) {
  var peta = { 'Baru': '', 'Menunggu Verifikasi Pembayaran': 'wr', 'Menunggu Verifikasi': 'wr', 'Dibayar': 'in', 'Diproses': 'pu', 'Dikirim': 'tl', 'Selesai': 'ok', 'Dibatalkan': 'er', 'Aktif': 'ok', 'Terbit': 'ok', 'Dibuka': 'ok',
    'Nonaktif': '', 'Draf': '', 'Ditutup': '', 'Ditinjau': 'in', 'Wawancara': 'pu', 'Diterima': 'ok', 'Ditolak': 'er', 'Belum Dibaca': 'wr', 'Dibaca': '', 'Dibalas': 'ok', 'Terkirim': 'ok', 'Gagal': 'er', 'Menunggu': 'wr' };
  return h('span', { class: 'badge ' + (peta[s] || '') }, s);
}


/* =====================================================================
   SITUS PUBLIK
   ===================================================================== */
function pubData() { return (S.pub && S.pub.data) || { produk: [], kategori: [], toko: [], mitra: [], berita: [], lowongan: [], menu: [], halaman: [], tombol: [], modulPublik: [], pengaturan: {}, statusPesanan: [] }; }
function PP() { return pubData().pengaturan || {}; }
function nilaiP(k, def) { var v = PP()[k]; return v === undefined || v === '' ? def : v; }

/* ----- keranjang (optimistis: UI + localStorage seketika) ----- */
function muatKeranjang() { S.keranjang = bacaLokal('awb_keranjang', []).filter(function (x) { return x && x.id && x.n > 0; }); }
function simpanKeranjang() { simpanLokal('awb_keranjang', S.keranjang); perbaruiLencanaKeranjang(); perbaruiMiniKeranjang(); }
function produkById(id) { return pubData().produk.filter(function (p) { return p.id === id; })[0]; }
function stokProduk(p) { return S.stok[p.id] !== undefined ? S.stok[p.id] : p.stok; }
function tambahKeranjang(id, n) {
  var p = produkById(id); if (!p) return;
  var maks = stokProduk(p), ada = S.keranjang.filter(function (x) { return x.id === id; })[0], sekarang = ada ? ada.n : 0;
  if (sekarang + (n || 1) > maks) { toast('Stok "' + p.nama + '" tinggal ' + maks + '.', 'wr'); return; }
  if (ada) ada.n += n || 1; else S.keranjang.push({ id: id, n: n || 1 });
  simpanKeranjang(); toast(p.nama + ' ditambahkan ke keranjang.', 'ok', { label: 'Lihat', fn: function () { location.hash = '#/keranjang'; } }, 2800);
}
function ubahJumlah(id, n) {
  var ada = S.keranjang.filter(function (x) { return x.id === id; })[0]; if (!ada) return;
  var p = produkById(id); if (p && n > stokProduk(p)) { toast('Stok tinggal ' + stokProduk(p) + '.', 'wr'); return; }
  ada.n = n; if (ada.n < 1) S.keranjang = S.keranjang.filter(function (x) { return x.id !== id; }); simpanKeranjang();
}
function totalKeranjang() { return S.keranjang.reduce(function (a, x) { var p = produkById(x.id); return a + (p ? p.harga * x.n : 0); }, 0); }
function jumlahKeranjang() { return S.keranjang.reduce(function (a, x) { return a + x.n; }, 0); }
function perbaruiLencanaKeranjang() { var l = $('#lenc-keranjang'); var n = jumlahKeranjang(); l.textContent = n; l.hidden = !n; }
function perbaruiMiniKeranjang() {
  var root = $('#mini-keranjang-root'); kosongkan(root);
  var rute = S.rute.split('/')[1] || '';
  if (!jumlahKeranjang() || rute === 'keranjang' || rute === 'masuk' || rute === 'admin' || rute === 'sukses') return;
  root.appendChild(h('div', { class: 'mini-keranjang' }, h('span', null, jumlahKeranjang() + ' barang · ', h('strong', null, rp(totalKeranjang()))),
    h('a', { class: 'btn btn-utama kecil', href: '#/keranjang' }, 'Lihat Keranjang')));
}

/* ----- data publik: tampilkan cache lokal dulu, segarkan di belakang layar ----- */
function muatPublikLokal() { var c = bacaLokal('awb_pub', null); if (c && c.data && c.ver) S.pub = c; }
function segarkanPublik() {
  return rpc('getDataPublik', S.pub ? S.pub.ver : '').then(function (r) {
    if (r.data && r.data.sama) return false;
    S.pub = { ver: r.data.ver, data: r.data }; simpanLokal('awb_pub', S.pub); return true;
  });
}
function segarkanStok() {
  return rpc('getStokPublik').then(function (r) { S.stok = r.data || {}; }, function () { /* abaikan */ });
}

/* ----- tautan menu & tombol kustom ----- */
function hrefMenu(m) {
  if (m.tipe === 'Tautan') return aman(m.target);
  if (m.tipe === 'Modul Kustom') return '#/data/' + String(m.target).replace(/^mk_/, '');
  var t = m.target || m.slug; return t === 'beranda' ? '#/' : '#/' + t;
}
function hrefTombol(t) {
  if (t.aksi === 'WhatsApp') return 'https://wa.me/' + String(t.target).replace(/\D/g, '');
  if (t.aksi === 'Buka halaman') return '#/' + String(t.target).replace(/^#?\/?/, '');
  return aman(t.target);
}
function tombolKustom(t, ekstra) {
  var ext = /^https?:/.test(hrefTombol(t));
  return h('a', { class: 'btn ' + (t.gaya === 'Garis' ? 'btn-garis' : 'btn-utama') + ' ' + (ekstra || ''), href: hrefTombol(t), target: ext ? '_blank' : null, rel: ext ? 'noopener noreferrer' : null }, t.label);
}

/* ----- kerangka: nav, footer ----- */
function ruteAktif() { return S.rute.replace(/^#?\/?/, '').split('/'); }
function renderNav() {
  var P = PP(), D = pubData();
  var merek = $('#merek'); kosongkan(merek);
  merek.appendChild(P.identitas_logo ? h('img', { src: foto(P.identitas_logo, 240), alt: P.identitas_nama || 'Logo' }) : h('span', { class: 'lencana' }, lambangBuah(Math.round((Number(P.foto_ukuran_logo) || 44) * .7))));
  merek.appendChild(h('span', null, P.identitas_nama ? String(P.identitas_nama).replace(/^PT\.?\s*/i, '') : 'AGRI WANGI BERRY'));
  var aktif = ruteAktif()[0];
  var atas = D.menu.filter(function (m) { return !m.induk; }), anak = function (m) { return D.menu.filter(function (x) { return x.induk === m.slug; }); };
  var ul = $('#menu-atas'); kosongkan(ul);
  atas.forEach(function (m) {
    var a = h('a', { href: hrefMenu(m), class: (m.target || m.slug) === aktif || (m.slug === 'beranda' && aktif === '') ? 'aktif' : '' }, m.label);
    var ch = anak(m);
    if (ch.length) ul.appendChild(h('li', { class: 'sub' }, a, h('ul', null, ch.map(function (c) { return h('li', null, h('a', { href: hrefMenu(c) }, c.label)); }))));
    else ul.appendChild(h('li', null, a));
  });
  var tn = $('#tombol-nav'); kosongkan(tn);
  D.tombol.filter(function (t) { return t.lokasi === 'Navbar'; }).forEach(function (t) { tn.appendChild(tombolKustom(t, 'kecil')); });
  var laci = $('#laci-isi'); kosongkan(laci);
  atas.concat(D.menu.filter(function (m) { return m.induk; })).forEach(function (m) { laci.appendChild(h('a', { href: hrefMenu(m), class: (m.target || m.slug) === aktif ? 'aktif' : '', onclick: function () { $('#laci').classList.remove('buka'); } }, m.label)); });
  laci.appendChild(h('a', { href: '#/keranjang', onclick: function () { $('#laci').classList.remove('buka'); } }, 'Keranjang'));
  document.title = (P.identitas_nama || 'PT. AGRI WANGI BERRY');
}
function renderFooter() {
  var P = PP(), D = pubData(); var f = $('#footer'); kosongkan(f);
  var wa = P.kontak_wa ? 'https://wa.me/' + String(P.kontak_wa).replace(/\D/g, '') : '';
  f.appendChild(h('div', { class: 'wadah' },
    h('div', { class: 'kolom' },
      h('div', null, h('div', { class: 'merek', style: 'margin-bottom:12px' }, lambangBuah(34), h('span', null, P.identitas_nama || 'AGRI WANGI BERRY')), h('p', { style: 'margin:0' }, P.identitas_slogan || '')),
      h('div', null, h('h4', null, 'Menu'), D.menu.filter(function (m) { return !m.induk; }).slice(0, 8).map(function (m) { return h('a', { href: hrefMenu(m) }, m.label); })),
      h('div', null, h('h4', null, 'Layanan'), h('a', { href: '#/lacak' }, 'Lacak Pesanan'), h('a', { href: '#/karier' }, 'Karier'), h('a', { href: '#/kontak' }, 'Hubungi Kami'), h('a', { href: '#/masuk' }, 'Masuk Tim'),
        D.tombol.filter(function (t) { return t.lokasi === 'Footer'; }).map(function (t) { return h('a', { href: hrefTombol(t) }, t.label); })),
      h('div', null, h('h4', null, 'Kontak'), h('div', null, P.kontak_alamat || ''), h('div', { style: 'margin-top:6px' }, P.kontak_telepon || ''), h('div', null, P.kontak_email || ''), h('div', { style: 'margin-top:6px' }, P.kontak_jam || ''),
        wa ? h('a', { href: wa, target: '_blank', rel: 'noopener noreferrer' }, 'WhatsApp') : null)),
    h('div', { class: 'bawah' }, '© ' + new Date().getFullYear() + ' ' + (P.identitas_nama || 'PT. AGRI WANGI BERRY') + '. Seluruh hak dilindungi.')));
}
function renderTombolMelayang() {
  var lama = $('#tombol-melayang'); if (lama) lama.remove();
  var t = pubData().tombol.filter(function (x) { return x.lokasi === 'Melayang'; })[0]; if (!t) return;
  var a = tombolKustom(t, 'besar'); a.id = 'tombol-melayang'; a.style.cssText = 'position:fixed;left:16px;bottom:16px;z-index:380;box-shadow:0 10px 30px rgba(0,0,0,.3)'; $('#v-publik').appendChild(a);
}

/* ----- formulir publik: komponen kecil ----- */
function medan(label, input, o) {
  o = o || {}; var galat = h('div', { class: 'pesan-salah', hidden: true });
  var el = h('div', { class: 'medan' + (o.kelas ? ' ' + o.kelas : '') }, h('label', null, label, o.wajib ? h('span', { class: 'wajib' }, ' *') : null), input, o.bantu ? h('div', { class: 'bantu' }, o.bantu) : null, galat);
  el.salah = function (t) { galat.hidden = !t; kosongkan(galat); if (t) { galat.appendChild(ik('alert', 'kecil')); galat.appendChild(document.createTextNode(' ' + t)); } el.classList.toggle('salah', !!t); if (t) input.setAttribute('aria-invalid', 'true'); else input.removeAttribute('aria-invalid'); };
  return el;
}
function jebakanMadu() { return h('div', { 'aria-hidden': 'true', style: 'position:absolute;left:-9999px;top:auto;width:1px;height:1px;overflow:hidden' }, h('label', null, 'Jangan diisi'), h('input', { type: 'text', name: 'website', tabindex: '-1', autocomplete: 'off' })); }
function widgetCaptcha() {
  var soal = h('strong', null, '…'), jawab = h('input', { type: 'text', inputmode: 'numeric', autocomplete: 'off', 'aria-label': 'Jawaban soal keamanan', style: 'max-width:120px' }), tanda = '';
  var el = medan('Soal keamanan', h('div', { style: 'display:flex;gap:12px;align-items:center' }, soal, jawab, h('button', { type: 'button', class: 'btn btn-hantu kecil', onclick: muat, 'aria-label': 'Muat soal baru' }, ik('refresh', 'kecil'))), { wajib: true, bantu: 'Jawab penjumlahan sederhana ini untuk membuktikan Anda bukan robot.' });
  function muat() { soal.textContent = '…'; jawab.value = ''; rpc('getCaptcha').then(function (r) { soal.textContent = r.data.soal; tanda = r.data.tanda; }, function () { soal.textContent = 'gagal memuat'; }); }
  muat();
  return { el: el, jawab: function () { return jawab.value.trim(); }, tanda: function () { return tanda; }, ulang: muat, input: jawab };
}
function bersihkanAngka(el) { el.addEventListener('input', function () { el.value = el.value.replace(/[^0-9+\- ]/g, ''); }); }
function skeletonKartu(n) { var a = []; for (var i = 0; i < n; i++) a.push(h('div', { class: 'kartu' }, h('div', { class: 'skel', style: 'aspect-ratio:4/3;border-radius:0' }), h('div', { class: 'isi' }, h('div', { class: 'skel', style: 'height:18px;width:80%' }), h('div', { class: 'skel', style: 'height:18px;width:40%' })))); return a; }
function kosongPublik(ikon, judul, pesan, cta) { return h('div', { class: 'kosong-state' }, ik(ikon), h('h3', { style: 'font-family:var(--f-isi);font-weight:700;color:var(--teks)' }, judul), h('p', null, pesan), cta || null); }
function kepalaHalaman(judul, ikuti) {
  return h('div', { class: 'kepala-halaman' }, h('div', { class: 'wadah' }, h('div', { class: 'remah' }, h('a', { href: '#/' }, 'Beranda'), ' / ' + judul), h('h1', null, judul), ikuti || null));
}

/* ----- kartu produk ----- */
function kartuProduk(p) {
  var stok = stokProduk(p), habis = stok <= 0, tipis = !habis && stok <= (p.min || 0);
  var foto0 = h('div', { class: 'foto' + (Number(PP().foto_tinggi_produk) > 0 ? ' tetap' : '') }, p.foto ? h('img', { src: foto(p.foto, 600), alt: p.nama, loading: 'lazy' }) : h('div', { class: 'kosong' }, ik('image', 'xl')),
    habis ? h('span', { class: 'lencana-foto abu' }, 'Habis') : (p.unggul ? h('span', { class: 'lencana-foto' }, 'Unggulan') : null));
  var tombol = h('button', { type: 'button', class: 'btn btn-utama blok', disabled: habis, onclick: function () { tambahKeranjang(p.id, 1); } }, habis ? 'Habis' : 'Pesan');
  var stokEl = h('div', { class: 'stok ' + (habis ? 'habis' : tipis ? 'tipis' : '') }, habis ? 'Stok habis' : tipis ? 'Stok menipis (' + stok + ')' : 'Stok: ' + stok);
  var kartu = h('article', { class: 'kartu', 'data-id': p.id }, foto0, h('div', { class: 'isi' }, h('div', { class: 'nama' }, p.nama), h('div', { class: 'harga' }, rp(p.harga), p.satuan ? h('small', null, ' / ' + p.satuan) : null), stokEl, h('div', { class: 'aksi' }, tombol)));
  kartu.segarkanStok = function () {
    var s = stokProduk(p), hb = s <= 0, tp = !hb && s <= (p.min || 0); tombol.disabled = hb; tombol.textContent = hb ? 'Habis' : 'Pesan';
    stokEl.className = 'stok ' + (hb ? 'habis' : tp ? 'tipis' : ''); stokEl.textContent = hb ? 'Stok habis' : tp ? 'Stok menipis (' + s + ')' : 'Stok: ' + s;
  };
  return kartu;
}

/* ----- BERANDA (juga dipakai pratinjau admin) ----- */
function latarFoto(id, lebar, cadangan) { return id ? "linear-gradient(rgba(0,0,0,0),rgba(0,0,0,0)), url('" + foto(id, lebar || 1600) + "') center/cover no-repeat, " + cadangan : cadangan; }
function bangunBeranda(P, D, opsi) {
  opsi = opsi || {}; var wadah = h('div');
  var urutan = String(P.beranda_urutan || 'hero,tiles,unggulan,banner').split(',').map(function (x) { return x.trim(); });
  var tampil = function (k) { return P['beranda_tampil_' + k] !== 'Tidak'; };
  var tautan = function (t) { return aman(t); };
  var bagian = {
    hero: function () {
      var tombolBeranda = D.tombol.filter(function (t) { return t.lokasi === 'Beranda'; });
      return h('section', { class: 'hero', style: P.hero_gambar ? { backgroundImage: "url('" + foto(P.hero_gambar, 1800) + "')" } : { background: 'linear-gradient(120deg,#12302f,' + (P.warna_gelap || '#1D4B4B') + ' 55%,#2c6b5e)' } },
        h('div', { class: 'wadah' }, h('div', { class: 'isi' }, h('div', { class: 'emblem' }, P.identitas_logo ? h('img', { src: foto(P.identitas_logo, 200), alt: '' }) : lambangBuah(52)),
          h('h1', null, P.hero_judul || 'AGRI WANGI BERRY'), h('p', { class: 'tag' }, P.identitas_slogan || ''), h('p', { class: 'para' }, P.hero_teks || ''),
          h('div', { style: 'display:flex;gap:12px;flex-wrap:wrap' }, h('a', { class: 'btn btn-utama besar', href: '#/produk' }, 'Belanja Sekarang'), h('a', { class: 'btn btn-terang besar', href: '#/tentang' }, 'Kisah Kami'), tombolBeranda.map(function (t) { return tombolKustom(t, 'besar'); })))));
    },
    tiles: function () {
      var tl = function (n, kelas, bg) {
        return h('div', { class: 'tile ' + kelas, style: P['tile' + n + '_gambar'] ? { backgroundImage: "url('" + foto(P['tile' + n + '_gambar'], 1000) + "')" } : { background: bg } },
          P['tile' + n + '_judul'] ? h('h2', null, P['tile' + n + '_judul']) : null, P['tile' + n + '_teks'] ? h('p', null, P['tile' + n + '_teks']) : null,
          P['tile' + n + '_label'] ? h('a', { class: 'tautan-garis', href: tautan(P['tile' + n + '_tautan']) }, P['tile' + n + '_label']) : null);
      };
      var t3 = h('div', { class: 'tile polos', style: P.tile3_gambar ? { backgroundImage: "url('" + foto(P.tile3_gambar, 1000) + "')" } : { background: 'radial-gradient(circle at 50% 45%,#fff6e0,' + (P.warna_latar || '#F0E6D0') + ')' } }, P.tile3_gambar ? null : lambangBuah(180, P.warna_utama));
      return h('section', { class: 'tiles' }, tl(1, '', 'linear-gradient(135deg,#2e5c4f,#1D4B4B)'), tl(2, '', 'linear-gradient(135deg,' + (P.warna_utama || '#C8102E') + ',#7a0a1c)'), t3, tl(4, 'solid', ''));
    },
    unggulan: function () {
      var list = D.produk.filter(function (p) { return p.unggul; }); if (list.length < 4) list = list.concat(D.produk.filter(function (p) { return !p.unggul; })); list = list.slice(0, Number(P.tata_kolom_desktop) || 4);
      return h('section', { class: 'bagian krem' }, h('div', { class: 'wadah' }, h('div', { class: 'judul-bagian' }, h('h2', null, 'Produk Unggulan'), h('p', null, 'Pilihan favorit pelanggan kami, dipetik segar dari kebun.')),
        list.length ? h('div', { class: 'grid-produk' }, list.map(function (p) { return opsi.statis ? kartuStatis(p) : kartuProduk(p); })) : kosongPublik('shopping-basket', 'Belum ada produk', 'Produk akan segera hadir.'),
        h('div', { style: 'text-align:center;margin-top:32px' }, h('a', { class: 'btn btn-garis', href: '#/produk' }, 'Lihat Semua Produk'))));
    },
    banner: function () {
      return h('section', { class: 'banner', style: P.banner_gambar ? { backgroundImage: "url('" + foto(P.banner_gambar, 1800) + "')" } : { background: 'linear-gradient(120deg,' + (P.warna_kedua || '#1D4B4B') + ',#2c6b5e)' } },
        h('a', { class: 'tautan-garis', style: 'color:#fff;font-size:18px', href: tautan(P.banner_tautan) }, P.banner_label || 'PELAJARI SELENGKAPNYA'));
    }
  };
  urutan.forEach(function (k) { if (bagian[k] && tampil(k)) wadah.appendChild(bagian[k]()); });
  return wadah;
}
function kartuStatis(p) { return h('article', { class: 'kartu' }, h('div', { class: 'foto' }, p.foto ? h('img', { src: foto(p.foto, 500), alt: '' }) : h('div', { class: 'kosong' }, ik('image', 'xl'))), h('div', { class: 'isi' }, h('div', { class: 'nama' }, p.nama), h('div', { class: 'harga' }, rp(p.harga)))); }

/* ----- halaman-halaman publik ----- */
var HALAMAN = {};
HALAMAN.beranda = function (el) { el.appendChild(bangunBeranda(PP(), pubData())); };

HALAMAN.produk = function (el) {
  var D = pubData(); var cari = h('input', { type: 'text', placeholder: 'Cari produk…', 'aria-label': 'Cari produk' });
  var kat = h('select', { 'aria-label': 'Kategori' }, h('option', { value: '' }, 'Semua kategori'), D.kategori.map(function (k) { return h('option', { value: k }, k); }));
  var urut = h('select', { 'aria-label': 'Urutkan' }, h('option', { value: 'unggul' }, 'Unggulan'), h('option', { value: 'murah' }, 'Termurah'), h('option', { value: 'mahal' }, 'Termahal'), h('option', { value: 'nama' }, 'Nama A–Z'));
  var grid = h('div', { class: 'grid-produk' }), pag = h('div', { style: 'display:flex;gap:6px;justify-content:center;margin-top:28px;flex-wrap:wrap' }), halaman = 1, UKURAN = 12, kartuMap = {};
  function gambar() {
    var q = cari.value.trim().toLowerCase();
    var list = D.produk.filter(function (p) { return (!kat.value || p.kat === kat.value) && (!q || (p.nama + ' ' + p.desk + ' ' + p.kat).toLowerCase().indexOf(q) >= 0); });
    list.sort(function (a, b) { return urut.value === 'murah' ? a.harga - b.harga : urut.value === 'mahal' ? b.harga - a.harga : urut.value === 'nama' ? a.nama.localeCompare(b.nama) : (b.unggul - a.unggul) || a.nama.localeCompare(b.nama); });
    var tp = Math.max(1, Math.ceil(list.length / UKURAN)); if (halaman > tp) halaman = tp;
    kosongkan(grid); kartuMap = {};
    if (!list.length) grid.appendChild(kosongPublik('search', 'Produk tidak ditemukan', 'Coba kata kunci atau kategori lain.'));
    list.slice((halaman - 1) * UKURAN, halaman * UKURAN).forEach(function (p) { var k = kartuProduk(p); kartuMap[p.id] = k; grid.appendChild(k); });
    kosongkan(pag); if (tp > 1) for (var i = 1; i <= tp; i++) (function (n) { pag.appendChild(h('button', { class: 'btn ' + (n === halaman ? 'btn-utama' : 'btn-garis') + ' kecil', style: 'min-width:40px', onclick: function () { halaman = n; gambar(); window.scrollTo({ top: 0 }); } }, n)); })(i);
  }
  var tunda = debounce(function () { halaman = 1; gambar(); }, 250);
  cari.addEventListener('input', tunda); kat.addEventListener('change', function () { halaman = 1; gambar(); }); urut.addEventListener('change', function () { halaman = 1; gambar(); });
  el.appendChild(kepalaHalaman('Produk Kami'));
  el.appendChild(h('div', { class: 'bagian krem', style: 'padding-top:0' }, h('div', { class: 'wadah' }, h('div', { class: 'filter-bar' }, h('div', { class: 'cari' }, ik('search', 'kecil'), cari), kat, urut), grid, pag)));
  if (!D.produk.length) { kosongkan(grid); skeletonKartu(8).forEach(function (k) { grid.appendChild(k); }); } else gambar();
  segarkanStok().then(function () { Object.keys(kartuMap).forEach(function (id) { kartuMap[id].segarkanStok(); }); });
  el.segarkan = function () { D = pubData(); gambar(); };
};

HALAMAN.keranjang = function (el) {
  var P = PP(), D = pubData();
  var pembeli = { nama: h('input', { type: 'text', autocomplete: 'name', maxlength: 80 }), telepon: h('input', { type: 'tel', inputmode: 'tel', autocomplete: 'tel', maxlength: 20 }), email: h('input', { type: 'email', autocomplete: 'email', maxlength: 120 }),
    alamat: h('textarea', { rows: 3, autocomplete: 'street-address', maxlength: 400 }), kota: h('input', { type: 'text', autocomplete: 'address-level2', maxlength: 80 }), catatan: h('textarea', { rows: 2, maxlength: 300 }) };
  bersihkanAngka(pembeli.telepon);
  var draf = bacaLokal('awb_draf', {}); Object.keys(pembeli).forEach(function (k) { if (draf[k]) pembeli[k].value = draf[k]; });
  var simpanDraf = debounce(function () { var d = {}; Object.keys(pembeli).forEach(function (k) { d[k] = pembeli[k].value; }); simpanLokal('awb_draf', d); }, 400);
  Object.keys(pembeli).forEach(function (k) { pembeli[k].addEventListener('input', function () { simpanDraf(); perbaruiLangkah(); }); });
  var fm = {
    nama: medan('Nama lengkap', pembeli.nama, { wajib: true }), telepon: medan('Nomor telepon / WhatsApp', pembeli.telepon, { wajib: true }), email: medan('Email (opsional)', pembeli.email, { bantu: 'Untuk menerima tanda terima PDF lewat email.' }),
    alamat: medan('Alamat pengiriman', pembeli.alamat, { wajib: true }), kota: medan('Kota / kecamatan', pembeli.kota), catatan: medan('Catatan untuk penjual (opsional)', pembeli.catatan)
  };
  var bukti = zonaUnggah({ accept: 'image/*,application/pdf', label: 'Unggah bukti transfer', bantu: 'Foto/screenshot (JPG, PNG) atau PDF, maks. 5 MB. Foto dikompres otomatis.', maksMB: Number(P.berkas_maks_mb) || 5, saatPilih: function () { perbaruiLangkah(); } });
  var buktiMedan = medan('Bukti pembayaran', bukti.el, { wajib: true });
  var cap = widgetCaptcha(); var hp = jebakanMadu();
  var daftarEl = h('div'), ringkasEl = h('div'), tombolKirim = h('button', { type: 'button', class: 'btn btn-utama blok besar', onclick: kirim }, 'Kirim Pesanan'), langkahEl = h('div', { class: 'langkah', role: 'list' });
  function perbaruiLangkah() {
    var s1 = S.keranjang.length > 0, s2 = s1 && pembeli.nama.value.trim().length > 1 && pembeli.telepon.value.trim().length > 7 && pembeli.alamat.value.trim().length > 7, s3 = s2 && !!bukti.ambil();
    var st = [s1, s2, s3, false], skrg = st.indexOf(false); kosongkan(langkahEl);
    ['Keranjang', 'Data Pemesan', 'Pembayaran', 'Selesai'].forEach(function (n, i) { langkahEl.appendChild(h('div', { class: 'l ' + (i < skrg ? 'sel' : i === skrg ? 'skrg' : ''), role: 'listitem' }, h('div', { class: 'b' }, i < skrg ? ik('check', 'kecil') : String(i + 1)), n)); });
  }
  function gambarKeranjang() {
    kosongkan(daftarEl); kosongkan(ringkasEl);
    if (!S.keranjang.length) { daftarEl.appendChild(kosongPublik('cart', 'Keranjang masih kosong', 'Yuk pilih stroberi segar favorit Anda.', h('a', { class: 'btn btn-utama', href: '#/produk' }, 'Belanja Sekarang'))); }
    S.keranjang.forEach(function (x) {
      var p = produkById(x.id); if (!p) return;
      daftarEl.appendChild(h('div', { class: 'baris-keranjang' }, h('div', { class: 'gambar' }, p.foto ? h('img', { src: foto(p.foto, 200), alt: '' }) : null),
        h('div', null, h('div', { style: 'font-weight:700' }, p.nama), h('div', { class: 'bantu' }, rp(p.harga) + (p.satuan ? ' / ' + p.satuan : ''))),
        h('div', { class: 'stepper' }, h('button', { type: 'button', 'aria-label': 'Kurangi', onclick: function () { ubahJumlah(x.id, x.n - 1); gambarKeranjang(); perbaruiLangkah(); } }, '−'), h('span', null, x.n), h('button', { type: 'button', 'aria-label': 'Tambah', onclick: function () { ubahJumlah(x.id, x.n + 1); gambarKeranjang(); } }, '+')),
        h('div', { class: 'hapus' }, h('button', { type: 'button', class: 'btn btn-hantu kecil', 'aria-label': 'Hapus ' + p.nama, onclick: function () { ubahJumlah(x.id, 0); gambarKeranjang(); perbaruiLangkah(); } }, ik('trash', 'kecil')))));
    });
    var sub = totalKeranjang(), ongkir = Number(P.bayar_ongkir) || 0;
    ringkasEl.appendChild(h('div', null, h('div', { class: 'ringkas-baris' }, h('span', null, 'Subtotal (' + jumlahKeranjang() + ' barang)'), h('span', null, rp(sub))),
      h('div', { class: 'ringkas-baris' }, h('span', null, 'Ongkos kirim'), h('span', null, ongkir ? rp(ongkir) : 'Dihitung penjual')),
      h('hr', { style: 'border:0;border-top:1px solid var(--garis)' }), h('div', { class: 'ringkas-baris' }, h('strong', null, 'Total bayar'), h('span', { class: 'total-besar' }, rp(sub + ongkir)))));
    tombolKirim.disabled = !S.keranjang.length;
  }
  function setSalah(k, t) { fm[k].salah(t); }
  function kirim() {
    var ok = true, tel = pembeli.telepon.value.replace(/[^0-9+]/g, '');
    ['nama', 'telepon', 'email', 'alamat', 'kota', 'catatan'].forEach(function (k) { setSalah(k, ''); }); buktiMedan.salah(''); cap.el.salah('');
    if (pembeli.nama.value.trim().length < 2) { setSalah('nama', 'Nama wajib diisi.'); ok = false; }
    if (!/^(\+62|62|0)\d{8,13}$/.test(tel)) { setSalah('telepon', 'Nomor telepon tidak valid (contoh: 08123456789).'); ok = false; }
    if (pembeli.email.value.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(pembeli.email.value.trim())) { setSalah('email', 'Format email tidak valid.'); ok = false; }
    if (pembeli.alamat.value.trim().length < 8) { setSalah('alamat', 'Alamat pengiriman wajib diisi lengkap.'); ok = false; }
    if (!bukti.ambil()) { buktiMedan.salah('Unggah bukti transfer terlebih dahulu.'); ok = false; }
    if (!cap.jawab()) { cap.el.salah('Jawab soal keamanan.'); ok = false; }
    if (!S.keranjang.length) { toast('Keranjang masih kosong.', 'wr'); ok = false; }
    if (!ok) { var s = $('.salah', el); if (s) s.scrollIntoView({ behavior: 'smooth', block: 'center' }); return; }
    spinnerTombol(tombolKirim, true, 'Mengirim pesanan…');
    var b = bukti.ambil();
    rpc('buatPesanan', { nama: pembeli.nama.value, telepon: pembeli.telepon.value, email: pembeli.email.value, alamat: pembeli.alamat.value, kota: pembeli.kota.value, catatan: pembeli.catatan.value,
      items: S.keranjang.map(function (x) { return { id: x.id, jumlah: x.n }; }), bukti: { nama: b.nama, b64: b.b64 }, hp: $('input[name=website]', hp).value, jawab: cap.jawab(), tanda: cap.tanda() })
      .then(function (r) {
        S.pesananTerakhir = { kode: r.data.kode, telepon: pembeli.telepon.value, data: r.data, nama: pembeli.nama.value };
        simpanLokal('awb_terakhir', { kode: r.data.kode, telepon: pembeli.telepon.value });
        S.keranjang = []; simpanKeranjang(); hapusLokal('awb_draf'); location.hash = '#/sukses/' + r.data.kode;
      }, function (e) {
        spinnerTombol(tombolKirim, false); gagalToast(e);
        if (e.kode === 'CAPTCHA') { cap.ulang(); cap.el.salah(e.message); }
        if (e.kode === 'STOK') { segarkanPublik().then(function () { return segarkanStok(); }).then(function () { gambarKeranjang(); }); }
      });
  }
  el.appendChild(kepalaHalaman('Keranjang & Checkout'));
  el.appendChild(h('div', { class: 'bagian krem', style: 'padding-top:12px' }, h('div', { class: 'wadah' }, langkahEl,
    h('div', { class: 'checkout' },
      h('div', null,
        h('div', { class: 'panel' }, h('h3', null, '1. Keranjang'), daftarEl),
        h('div', { class: 'panel' }, h('h3', null, '2. Data Pemesan'), fm.nama, h('div', { class: 'dua-kolom' }, fm.telepon, fm.email), fm.alamat, fm.kota, fm.catatan),
        h('div', { class: 'panel' }, h('h3', null, '3. Pembayaran'),
          h('div', { class: 'kotak-info', style: 'margin-bottom:16px' }, h('div', null, 'Transfer ke ', h('strong', null, P.bayar_bank || '')), h('div', { class: 'salin-baris' }, h('span', { class: 'mono', style: 'font-size:20px;font-weight:700' }, P.bayar_rekening || ''), h('button', { type: 'button', class: 'btn btn-garis kecil', onclick: function () { salinTeks(P.bayar_rekening || ''); } }, ik('copy', 'kecil'), 'Salin')),
            h('div', null, 'a.n. ' + (P.bayar_atas_nama || '')), h('div', { class: 'bantu' }, P.bayar_catatan || '')),
          buktiMedan, cap.el, hp)),
      h('div', { class: 'sticky' }, h('div', { class: 'panel' }, h('h3', null, 'Ringkasan'), ringkasEl, h('div', { style: 'margin-top:16px' }, tombolKirim), h('p', { class: 'bantu', style: 'text-align:center' }, 'Dengan mengirim, Anda menyetujui pesanan diproses setelah pembayaran diverifikasi.')))))));
  gambarKeranjang(); perbaruiLangkah();
  segarkanStok().then(function () { gambarKeranjang(); });
};

HALAMAN.sukses = function (el, bag) {
  var kode = bag[1] || '', t = S.pesananTerakhir && S.pesananTerakhir.kode === kode ? S.pesananTerakhir : null, tombolPdf;
  var tbl = t ? h('table', { class: 'rapi', style: 'margin:12px 0' }, h('tbody', null, t.data.items.map(function (i) { return h('tr', null, h('td', null, i.nama + ' × ' + i.jumlah), h('td', { class: 'r' }, rp(i.sub))); }),
    h('tr', null, h('td', null, 'Ongkos kirim'), h('td', { class: 'r' }, rp(t.data.ongkir))), h('tr', null, h('td', null, h('strong', null, 'Total')), h('td', { class: 'r' }, h('strong', null, rp(t.data.total)))))) : null;
  tombolPdf = h('button', { type: 'button', class: 'btn btn-utama', onclick: function () {
    var tel = t ? t.telepon : (bacaLokal('awb_terakhir', {}).telepon || '');
    if (!tel) { location.hash = '#/lacak'; return; }
    spinnerTombol(tombolPdf, true, 'Menyiapkan PDF…');
    rpc('unduhTandaTerima', kode, tel).then(function (r) { spinnerTombol(tombolPdf, false); unduhB64(r.data.nama, 'application/pdf', r.data.b64); }, function (e) { spinnerTombol(tombolPdf, false); gagalToast(e); });
  } }, ik('download', 'kecil'), 'Unduh Tanda Terima (PDF)');
  el.appendChild(h('div', { class: 'bagian krem', style: 'padding-top:120px' }, h('div', { class: 'wadah' }, h('div', { class: 'sukses-kartu' },
    h('div', { class: 'lingkar-ok' }, ik('check', 'besar')), h('h2', { style: 'font-size:28px' }, 'Pesanan Berhasil!'), h('p', null, 'Terima kasih' + (t ? ', ' + t.nama : '') + '. Pesanan Anda kami terima dan akan diproses setelah pembayaran diverifikasi.'),
    h('div', { class: 'kode-kotak mono' }, kode, h('button', { class: 'btn btn-hantu kecil', 'aria-label': 'Salin kode', onclick: function () { salinTeks(kode); } }, ik('copy', 'kecil'))),
    tbl, h('p', { class: 'bantu' }, 'Simpan kode pesanan ini untuk melacak status pesanan.'),
    h('div', { style: 'display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin-top:16px' }, tombolPdf, h('a', { class: 'btn btn-garis', href: '#/lacak' }, 'Lacak Pesanan')),
    h('p', { style: 'margin-top:18px' }, h('a', { class: 'tautan-merah', href: '#/produk' }, '← Kembali ke Produk'))))));
};

HALAMAN.lacak = function (el) {
  var last = bacaLokal('awb_terakhir', {}), prm = (window.AWAL && window.AWAL.param) || {};
  var kode = h('input', { type: 'text', placeholder: 'AWB-20260101-0001', autocapitalize: 'characters', value: prm.lacak || last.kode || '' }), tel = h('input', { type: 'tel', value: last.telepon || '', placeholder: '08xxxxxxxxxx' }); bersihkanAngka(tel);
  var hasil = h('div'), tombol = h('button', { type: 'submit', class: 'btn btn-utama blok' }, 'Cek Status');
  var fk = medan('Kode pesanan', kode, { wajib: true }), ft = medan('Nomor telepon saat memesan', tel, { wajib: true });
  function cek(e) {
    if (e) e.preventDefault(); fk.salah(''); ft.salah(''); kosongkan(hasil);
    if (!kode.value.trim()) { fk.salah('Kode pesanan wajib diisi.'); return; } if (!tel.value.trim()) { ft.salah('Nomor telepon wajib diisi.'); return; }
    spinnerTombol(tombol, true, 'Mencari…');
    rpc('lacakPesanan', kode.value.trim(), tel.value.trim()).then(function (r) {
      spinnerTombol(tombol, false); var d = r.data; var urut = (d.daftarStatus || []).filter(function (s) { return s !== 'Dibatalkan'; }); var batal = d.status === 'Dibatalkan'; var idx = urut.indexOf(d.status);
      hasil.appendChild(h('div', { class: 'panel', style: 'margin-top:20px' }, h('div', { style: 'display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px' }, h('strong', { class: 'mono' }, d.kode), statusBadge(d.status)),
        h('div', { class: 'bantu' }, tglFmt(d.tanggal, true)),
        batal ? h('div', { class: 'banner-info er', style: 'margin-top:12px' }, ik('alert', 'kecil'), 'Pesanan ini dibatalkan. Hubungi kami bila ada pertanyaan.') :
          h('div', { class: 'timeline' }, urut.map(function (s, i) { return h('div', { class: 't ' + (i < idx ? 'sel' : i === idx ? 'skrg' : '') }, s.replace('Menunggu Verifikasi Pembayaran', 'Verifikasi Bayar')); })),
        h('table', { class: 'rapi' }, h('tbody', null, d.items.map(function (i) { return h('tr', null, h('td', null, i.nama + ' × ' + i.jumlah), h('td', { class: 'r' }, rp(i.sub))); }), h('tr', null, h('td', null, h('strong', null, 'Total')), h('td', { class: 'r' }, h('strong', null, rp(d.total))))))));
    }, function (e) { spinnerTombol(tombol, false); hasil.appendChild(kosongPublik('search', 'Pesanan tidak ditemukan', pesanGalat(e))); });
  }
  el.appendChild(kepalaHalaman('Lacak Pesanan'));
  el.appendChild(h('div', { class: 'bagian krem', style: 'padding-top:12px' }, h('div', { class: 'wadah', style: 'max-width:640px' }, h('form', { class: 'panel', onsubmit: cek, novalidate: true }, fk, ft, tombol), hasil)));
  if (prm.lacak && last.telepon) cek();
};

function embedPeta(t) {
  var q = t.lat && t.lng ? t.lat + ',' + t.lng : (t.alamat || t.kota || '');
  return h('iframe', { src: 'https://maps.google.com/maps?q=' + encodeURIComponent(q) + '&z=15&output=embed', loading: 'lazy', title: 'Peta ' + (t.nama || ''), referrerpolicy: 'no-referrer-when-downgrade' });
}
HALAMAN.lokasi = function (el) {
  var D = pubData(), daftar = h('div', { class: 'daftar-toko' }), peta = h('div', { class: 'peta-area' }), terpilih = '';
  function pilih(t) { terpilih = t.id; $$('.toko', daftar).forEach(function (x) { x.classList.toggle('sel', x.dataset.id === t.id); }); kosongkan(peta); peta.appendChild(embedPeta(t)); }
  D.toko.forEach(function (t) {
    var link = t.peta ? aman(t.peta) : 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(t.lat && t.lng ? t.lat + ',' + t.lng : t.alamat);
    var k = h('div', { class: 'toko', data: { id: t.id }, tabindex: '0', role: 'button', onclick: function () { pilih(t); }, onkeydown: function (e) { if (e.key === 'Enter') pilih(t); } }, h('h3', null, t.nama), h('div', { class: 'm' }, ik('map-pin', 'kecil'), t.alamat + (t.kota ? ', ' + t.kota : '')),
      t.tel ? h('div', { class: 'm' }, ik('phone', 'kecil'), t.tel) : null, t.jam ? h('div', { class: 'm' }, ik('clock', 'kecil'), t.jam) : null, h('div', { style: 'margin-top:10px' }, h('a', { class: 'btn btn-garis kecil', href: link, target: '_blank', rel: 'noopener noreferrer' }, 'Buka di Google Maps')));
    daftar.appendChild(k);
  });
  el.appendChild(kepalaHalaman('Lokasi Toko'));
  el.appendChild(h('div', { class: 'bagian krem', style: 'padding-top:12px' }, h('div', { class: 'wadah' }, D.toko.length ? h('div', { class: 'pecah' }, daftar, peta) : kosongPublik('map-pin', 'Belum ada lokasi toko', 'Informasi toko akan segera tersedia.'))));
  if (D.toko.length) pilih(D.toko[0]);
};

HALAMAN.mitra = function (el) {
  var D = pubData();
  el.appendChild(kepalaHalaman('Mitra Kami'));
  el.appendChild(h('div', { class: 'bagian krem', style: 'padding-top:12px' }, h('div', { class: 'wadah' }, D.mitra.length ? h('div', { class: 'grid-4' }, D.mitra.map(function (m) {
    var kontak = m.kontak ? (emailSimple(m.kontak) ? 'mailto:' + m.kontak : /^https?:/.test(m.kontak) ? m.kontak : /^[0-9+\s-]{6,}$/.test(m.kontak) ? 'tel:' + m.kontak.replace(/\s/g, '') : '') : '';
    return h('div', { class: 'kartu mitra-kartu' }, h('div', { class: 'logo' }, m.logo ? h('img', { src: foto(m.logo, 300), alt: m.nama, loading: 'lazy' }) : ik('handshake', 'besar')), h('h3', { style: 'font-family:var(--f-isi);font-weight:700;font-size:18px' }, m.nama), h('p', { class: 'jepit2', style: 'color:var(--redam);margin:6px 0 10px' }, m.desk), kontak ? h('a', { class: 'tautan-merah', href: kontak, target: /^https?:/.test(kontak) ? '_blank' : null, rel: 'noopener noreferrer' }, 'Hubungi') : null);
  })) : kosongPublik('handshake', 'Belum ada mitra', 'Daftar mitra akan segera tersedia.'))));
};
function emailSimple(s) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s); }

HALAMAN.berita = function (el, bag) {
  var D = pubData();
  if (bag[1]) return detailBerita(el, bag[1]);
  var kartu = function (b) { return h('a', { class: 'kartu kartu-berita', href: '#/berita/' + b.slug, style: 'text-decoration:none' }, h('div', { class: 'foto' }, b.gambar ? h('img', { src: foto(b.gambar, 600), alt: '', loading: 'lazy' }) : h('div', { class: 'kosong' }, ik('newspaper', 'xl'))), h('div', { class: 'isi' }, h('div', { class: 'tgl' }, tglFmt(b.tgl)), h('div', { class: 'nama jepit2' }, b.judul), h('p', { class: 'jepit2', style: 'margin:0;color:var(--redam)' }, b.ringkas), h('span', { class: 'tautan-merah' }, 'Baca Selengkapnya'))); };
  var f = D.berita[0];
  el.appendChild(kepalaHalaman('Berita'));
  el.appendChild(h('div', { class: 'bagian krem', style: 'padding-top:12px' }, h('div', { class: 'wadah' }, D.berita.length ? [
    h('div', { class: 'fitur-berita' }, h('div', { class: 'gambar', style: f.gambar ? { backgroundImage: "url('" + foto(f.gambar, 1000) + "')" } : null }), h('div', { class: 'isi' }, h('div', { class: 'tgl', style: 'color:inherit;opacity:.8' }, tglFmt(f.tgl)), h('h2', { style: 'font-size:28px' }, f.judul), h('p', { class: 'jepit2', style: 'margin:0' }, f.ringkas), h('a', { class: 'tautan-garis', href: '#/berita/' + f.slug }, 'Baca Selengkapnya'))),
    h('div', { class: 'grid-3' }, D.berita.slice(1).map(kartu))] : kosongPublik('newspaper', 'Belum ada berita', 'Berita terbaru akan tampil di sini.'))));
};
function detailBerita(el, slug) {
  var D = pubData(), isiEl = h('div', null, h('div', { class: 'skel', style: 'height:32px;width:70%;margin-bottom:14px' }), h('div', { class: 'skel', style: 'height:240px' }));
  el.appendChild(h('div', { class: 'bagian krem', style: 'padding-top:120px' }, h('div', { class: 'wadah' }, h('div', { class: 'baca' }, isiEl))));
  rpc('getBerita', slug).then(function (r) {
    var b = r.data; document.title = b.judul + ' — ' + (PP().identitas_nama || ''); kosongkan(isiEl);
    var lain = D.berita.filter(function (x) { return x.slug !== slug; }).slice(0, 3);
    isiEl.appendChild(h('div', { class: 'remah', style: 'color:var(--redam)' }, h('a', { href: '#/berita' }, '← Semua berita')));
    isiEl.appendChild(h('h1', { style: 'font-size:36px;margin:8px 0' }, b.judul)); isiEl.appendChild(h('div', { class: 'tgl' }, (b.penulis ? b.penulis + ' · ' : '') + tglFmt(b.tgl)));
    if (b.gambar) isiEl.appendChild(h('img', { src: foto(b.gambar, 1200), alt: '', style: 'width:100%;border-radius:var(--r-foto);margin:16px 0' }));
    isiEl.appendChild(mdKeDom(b.isi));
    isiEl.appendChild(h('div', { style: 'display:flex;gap:8px;margin:24px 0;flex-wrap:wrap' }, h('a', { class: 'btn btn-garis kecil', target: '_blank', rel: 'noopener noreferrer', href: 'https://wa.me/?text=' + encodeURIComponent(b.judul + ' ' + tautanLuar('#/berita/' + (b.slug || b.id || ''))) }, ik('message-circle', 'kecil'), 'Bagikan'), h('button', { class: 'btn btn-garis kecil', onclick: function () { salinTeks(tautanLuar('#/berita/' + (b.slug || b.id || ''))); } }, ik('link', 'kecil'), 'Salin tautan')));
    if (lain.length) el.appendChild(h('div', { class: 'wadah', style: 'padding-bottom:56px' }, h('h2', { style: 'font-size:26px;margin:0 0 16px' }, 'Berita Lainnya'), h('div', { class: 'grid-3' }, lain.map(function (x) { return h('a', { class: 'kartu', href: '#/berita/' + x.slug, style: 'text-decoration:none' }, h('div', { class: 'foto', style: 'aspect-ratio:16/9' }, x.gambar ? h('img', { src: foto(x.gambar, 500), alt: '' }) : null), h('div', { class: 'isi' }, h('div', { class: 'nama jepit2' }, x.judul))); }))));
  }, function (e) { kosongkan(isiEl); isiEl.appendChild(kosongPublik('newspaper', 'Berita tidak ditemukan', pesanGalat(e), h('a', { class: 'btn btn-utama', href: '#/berita' }, 'Ke Daftar Berita'))); });
}

HALAMAN.karier = function (el, bag) {
  var D = pubData(); if (bag[1]) return formLamaran(el, bag[1]);
  var div = h('select', { 'aria-label': 'Divisi' }, h('option', { value: '' }, 'Semua divisi')), lok = h('select', { 'aria-label': 'Lokasi' }, h('option', { value: '' }, 'Semua lokasi')), daftar = h('div');
  var uniq = function (k) { var s = {}; D.lowongan.forEach(function (l) { if (l[k]) s[l[k]] = 1; }); return Object.keys(s).sort(); };
  uniq('divisi').forEach(function (d) { div.appendChild(h('option', { value: d }, d)); }); uniq('lokasi').forEach(function (d) { lok.appendChild(h('option', { value: d }, d)); });
  function gambar() {
    kosongkan(daftar); var list = D.lowongan.filter(function (l) { return (!div.value || l.divisi === div.value) && (!lok.value || l.lokasi === lok.value); });
    if (!list.length) { daftar.appendChild(kosongPublik('briefcase', 'Belum ada lowongan saat ini', 'Kunjungi kembali halaman ini nanti, atau hubungi kami.')); return; }
    list.forEach(function (l) {
      var sisa = l.tutup ? Math.ceil((new Date(l.tutup + 'T23:59:59') - Date.now()) / 86400000) : null;
      daftar.appendChild(h('div', { class: 'kartu lowongan' }, h('div', null, h('div', { class: 'nama', style: 'font-size:20px;font-weight:700' }, l.judul), h('div', { style: 'margin:8px 0' }, l.divisi ? h('span', { class: 'chip' }, l.divisi) : null, l.lokasi ? h('span', { class: 'chip' }, l.lokasi) : null),
        l.tutup ? h('div', { class: 'bantu' + (sisa !== null && sisa < 7 ? ' merah' : '') }, 'Ditutup ' + tglFmt(l.tutup) + (sisa !== null && sisa < 7 ? ' (' + Math.max(0, sisa) + ' hari lagi)' : '')) : null), h('a', { class: 'btn btn-utama', href: '#/karier/' + l.id }, 'Lamar Sekarang')));
    });
  }
  div.addEventListener('change', gambar); lok.addEventListener('change', gambar);
  el.appendChild(kepalaHalaman('Karier')); el.appendChild(h('div', { class: 'bagian krem', style: 'padding-top:12px' }, h('div', { class: 'wadah', style: 'max-width:900px' }, h('div', { class: 'filter-bar', style: 'position:static' }, div, lok), daftar)));
  gambar();
};
function formLamaran(el, id) {
  var l = pubData().lowongan.filter(function (x) { return x.id === id; })[0];
  if (!l) { el.appendChild(h('div', { class: 'bagian krem', style: 'padding-top:120px' }, h('div', { class: 'wadah' }, kosongPublik('briefcase', 'Lowongan tidak tersedia', 'Lowongan ini mungkin sudah ditutup.', h('a', { class: 'btn btn-utama', href: '#/karier' }, 'Lihat Lowongan Lain'))))); return; }
  var f = { nama: h('input', { type: 'text', maxlength: 80, autocomplete: 'name' }), email: h('input', { type: 'email', maxlength: 120, autocomplete: 'email' }), telepon: h('input', { type: 'tel', maxlength: 20, autocomplete: 'tel' }), pesan: h('textarea', { rows: 4, maxlength: 500 }) }; bersihkanAngka(f.telepon);
  var m = { nama: medan('Nama lengkap', f.nama, { wajib: true }), email: medan('Email', f.email, { wajib: true }), telepon: medan('Nomor telepon / WhatsApp', f.telepon, { wajib: true }), pesan: medan('Pesan singkat (opsional)', f.pesan) };
  var cv = zonaUnggah({ accept: '.pdf,.doc,.docx', label: 'Unggah CV', bantu: 'PDF, DOC, atau DOCX — maks. 5 MB', maksMB: Number(PP().berkas_maks_mb) || 5 }), cvM = medan('CV', cv.el, { wajib: true });
  var cap = widgetCaptcha(), hp = jebakanMadu(), tombol = h('button', { type: 'button', class: 'btn btn-utama blok', onclick: kirim }, 'Kirim Lamaran'), kartu = h('div', { class: 'panel' });
  function kirim() {
    var ok = true; Object.keys(m).forEach(function (k) { m[k].salah(''); }); cvM.salah(''); cap.el.salah('');
    if (f.nama.value.trim().length < 2) { m.nama.salah('Nama wajib diisi.'); ok = false; } if (!emailSimple(f.email.value.trim())) { m.email.salah('Email tidak valid.'); ok = false; }
    if (!/^(\+62|62|0)\d{8,13}$/.test(f.telepon.value.replace(/[^0-9+]/g, ''))) { m.telepon.salah('Nomor telepon tidak valid.'); ok = false; } if (!cv.ambil()) { cvM.salah('Unggah CV Anda.'); ok = false; } if (!cap.jawab()) { cap.el.salah('Jawab soal keamanan.'); ok = false; }
    if (!ok) return; spinnerTombol(tombol, true, 'Mengirim…'); var b = cv.ambil();
    rpc('kirimLamaran', { lowonganId: id, nama: f.nama.value, email: f.email.value, telepon: f.telepon.value, pesan: f.pesan.value, cv: { nama: b.nama, b64: b.b64 }, hp: $('input[name=website]', hp).value, jawab: cap.jawab(), tanda: cap.tanda() }).then(function (r) {
      kosongkan(kartu); kartu.appendChild(h('div', { style: 'text-align:center' }, h('div', { class: 'lingkar-ok' }, ik('check', 'besar')), h('h2', { style: 'font-size:26px' }, 'Lamaran Terkirim!'), h('p', null, 'Terima kasih. Tim kami akan meninjau lamaran Anda.'), h('div', { class: 'kode-kotak mono' }, r.data.kode), h('a', { class: 'btn btn-garis', href: '#/karier' }, 'Kembali ke Karier')));
    }, function (e) { spinnerTombol(tombol, false); gagalToast(e); if (e.kode === 'CAPTCHA') { cap.ulang(); cap.el.salah(e.message); } });
  }
  kartu.appendChild(h('a', { class: 'tautan-merah', href: '#/karier' }, '← Kembali')); kartu.appendChild(h('h2', { style: 'font-size:28px;margin:8px 0' }, l.judul)); kartu.appendChild(h('div', { style: 'margin-bottom:14px' }, l.divisi ? h('span', { class: 'chip' }, l.divisi) : null, l.lokasi ? h('span', { class: 'chip' }, l.lokasi) : null));
  if (l.desk) kartu.appendChild(h('p', { style: 'white-space:pre-line' }, l.desk)); if (l.syarat) kartu.appendChild(h('div', { class: 'kotak-info', style: 'margin-bottom:16px;white-space:pre-line' }, h('strong', null, 'Persyaratan'), h('br'), l.syarat));
  kartu.appendChild(m.nama); kartu.appendChild(h('div', { class: 'dua-kolom' }, m.email, m.telepon)); kartu.appendChild(m.pesan); kartu.appendChild(cvM); kartu.appendChild(cap.el); kartu.appendChild(hp); kartu.appendChild(tombol);
  el.appendChild(h('div', { class: 'bagian krem', style: 'padding-top:110px' }, h('div', { class: 'wadah', style: 'max-width:720px' }, kartu)));
}

HALAMAN.kontak = function (el) {
  var P = PP(); var f = { nama: h('input', { type: 'text', maxlength: 80 }), email: h('input', { type: 'email', maxlength: 120 }), subjek: h('input', { type: 'text', maxlength: 120 }), isi: h('textarea', { rows: 5, maxlength: 2000 }) };
  var m = { nama: medan('Nama', f.nama, { wajib: true }), email: medan('Email', f.email, { wajib: true }), subjek: medan('Subjek', f.subjek), isi: medan('Pesan', f.isi, { wajib: true }) };
  var cap = widgetCaptcha(), hp = jebakanMadu(), tombol = h('button', { type: 'button', class: 'btn btn-utama blok', onclick: kirim }, 'Kirim Pesan'), kartu = h('div', { class: 'panel' });
  function kirim() {
    var ok = true; Object.keys(m).forEach(function (k) { m[k].salah(''); }); cap.el.salah('');
    if (f.nama.value.trim().length < 2) { m.nama.salah('Nama wajib diisi.'); ok = false; } if (!emailSimple(f.email.value.trim())) { m.email.salah('Email tidak valid.'); ok = false; } if (f.isi.value.trim().length < 5) { m.isi.salah('Pesan terlalu singkat.'); ok = false; } if (!cap.jawab()) { cap.el.salah('Jawab soal keamanan.'); ok = false; }
    if (!ok) return; spinnerTombol(tombol, true, 'Mengirim…');
    rpc('kirimPesanKontak', { nama: f.nama.value, email: f.email.value, subjek: f.subjek.value, isi: f.isi.value, hp: $('input[name=website]', hp).value, jawab: cap.jawab(), tanda: cap.tanda() }).then(function () {
      kosongkan(kartu); kartu.appendChild(h('div', { style: 'text-align:center' }, h('div', { class: 'lingkar-ok' }, ik('check', 'besar')), h('h3', null, 'Pesan Terkirim'), h('p', null, 'Terima kasih! Kami akan segera membalas.')));
    }, function (e) { spinnerTombol(tombol, false); gagalToast(e); if (e.kode === 'CAPTCHA') { cap.ulang(); cap.el.salah(e.message); } });
  }
  kartu.appendChild(m.nama); kartu.appendChild(m.email); kartu.appendChild(m.subjek); kartu.appendChild(m.isi); kartu.appendChild(cap.el); kartu.appendChild(hp); kartu.appendChild(tombol);
  var baris = function (ikon, t) { return t ? h('div', { style: 'display:flex;gap:12px;align-items:center;margin:12px 0' }, h('span', { style: 'width:40px;height:40px;border-radius:50%;background:var(--latar);display:grid;place-items:center;flex:none;background:#fff' }, ik(ikon, 'kecil')), h('span', null, t)) : null; };
  var wa = P.kontak_wa ? 'https://wa.me/' + String(P.kontak_wa).replace(/\D/g, '') : '';
  el.appendChild(kepalaHalaman('Hubungi Kami'));
  el.appendChild(h('div', { class: 'bagian krem', style: 'padding-top:12px' }, h('div', { class: 'wadah' }, h('div', { class: 'grid-2' }, h('div', null, baris('map-pin', P.kontak_alamat), baris('phone', P.kontak_telepon), baris('mail', P.kontak_email), baris('clock', P.kontak_jam),
    wa ? h('a', { class: 'btn besar', style: 'background:#25D366;color:#fff;margin:12px 0', href: wa, target: '_blank', rel: 'noopener noreferrer' }, ik('message-circle', 'kecil'), 'Chat WhatsApp') : null,
    h('div', { style: 'height:260px;border-radius:var(--r-kartu);overflow:hidden;margin-top:12px' }, embedPeta({ alamat: P.kontak_alamat, nama: 'Kantor' }))), kartu))));
};

function blokKeDom(b, D) {
  var t = b && b.t;
  if (t === 'judul') return h('h2', { class: 'blok' }, b.teks || '');
  if (t === 'teks') { var d = mdKeDom(b.teks); d.classList.add('blok'); return d; }
  if (t === 'gambar') return h('div', { class: 'blok blok-gambar' }, b.id ? h('img', { src: foto(b.id, 1400), alt: b.alt || '', loading: 'lazy' }) : null);
  if (t === 'galeri') return h('div', { class: 'blok blok-galeri' }, (b.ids || []).map(function (i) { return h('img', { src: foto(i, 500), alt: '', loading: 'lazy' }); }));
  if (t === 'tombol') return h('div', { class: 'blok' }, h('a', { class: 'btn btn-utama', href: aman(b.tautan) }, b.label || 'Selengkapnya'));
  if (t === 'statistik') return h('div', { class: 'blok stat-baris' }, (b.item || []).map(function (s) { return h('div', { class: 's' }, h('div', { class: 'a' }, s.angka), h('div', { style: 'color:var(--redam)' }, s.label)); }));
  if (t === 'peta') return h('div', { class: 'blok', style: 'height:340px;border-radius:var(--r-foto);overflow:hidden' }, embedPeta({ alamat: b.alamat }));
  if (t === 'video') {
    var m = /(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]{6,15})/.exec(b.url || ''); if (!m) return h('div', { class: 'blok bantu' }, 'Tautan video tidak valid.');
    return h('div', { class: 'blok blok-video' }, h('iframe', { src: 'https://www.youtube-nocookie.com/embed/' + m[1], allowfullscreen: true, loading: 'lazy', title: 'Video' }));
  }
  if (t === 'daftar_data') {
    var src = b.sumber, n = Number(b.jumlah) || 4, wadah = h('div', { class: 'blok' });
    if (src === 'produk') wadah.appendChild(h('div', { class: 'grid-produk' }, D.produk.slice(0, n).map(kartuProduk)));
    else if (src === 'berita') wadah.appendChild(h('div', { class: 'grid-3' }, D.berita.slice(0, n).map(function (x) { return h('a', { class: 'kartu', href: '#/berita/' + x.slug, style: 'text-decoration:none' }, h('div', { class: 'foto', style: 'aspect-ratio:16/9' }, x.gambar ? h('img', { src: foto(x.gambar, 500), alt: '' }) : null), h('div', { class: 'isi' }, h('div', { class: 'nama jepit2' }, x.judul))); })));
    else if (src === 'mitra') wadah.appendChild(h('div', { class: 'grid-4' }, D.mitra.slice(0, n).map(function (m) { return h('div', { class: 'kartu mitra-kartu' }, h('div', { class: 'logo' }, m.logo ? h('img', { src: foto(m.logo, 300), alt: m.nama }) : null), h('strong', null, m.nama)); })));
    else if (src === 'toko') wadah.appendChild(h('div', { class: 'grid-3' }, D.toko.slice(0, n).map(function (x) { return h('div', { class: 'kartu', style: 'padding:18px' }, h('strong', null, x.nama), h('div', { class: 'bantu' }, x.alamat)); })));
    else if (/^mk_/.test(src)) { wadah.appendChild(h('div', { class: 'skel', style: 'height:80px' })); rpc('getDataModulPublik', src).then(function (r) { kosongkan(wadah); wadah.appendChild(tabelModulPublik(r.data, n)); }, function () { kosongkan(wadah); }); }
    return wadah;
  }
  return h('div');
}
function tabelModulPublik(d, batas) {
  var kol = (d.kolom || []).filter(function (c) { return c.t !== 'berkas' && c.t !== 'gambar'; }).slice(0, 5);
  if (!d.baris.length) return kosongPublik('database', 'Belum ada data', 'Data akan tampil di sini.');
  return h('div', { class: 'panel', style: 'overflow:auto' }, h('table', { class: 'rapi' }, h('thead', null, h('tr', null, kol.map(function (c) { return h('th', null, c.l); }))),
    h('tbody', null, d.baris.slice(0, batas || 100).map(function (r) { return h('tr', null, kol.map(function (c) { return h('td', null, r[c.k] === undefined ? '' : String(r[c.k])); })); }))));
}
var cacheHalaman = {};
function halamanKustom(el, slug) {
  var isiEl = h('div', null, h('div', { class: 'skel', style: 'height:40px;width:60%;margin-bottom:14px' }), h('div', { class: 'skel', style: 'height:200px' }));
  el.appendChild(h('div', { class: 'bagian krem', style: 'padding-top:110px' }, h('div', { class: 'wadah' }, isiEl)));
  function tampil(d) { kosongkan(isiEl); document.title = d.judul + ' — ' + (PP().identitas_nama || ''); isiEl.appendChild(h('div', { class: 'remah', style: 'color:var(--redam)' }, h('a', { href: '#/' }, 'Beranda'), ' / ' + d.judul)); isiEl.appendChild(h('h1', { style: 'margin-bottom:24px' }, d.judul)); d.blok.forEach(function (b) { isiEl.appendChild(blokKeDom(b, pubData())); }); }
  if (cacheHalaman[slug] && cacheHalaman[slug].ver === (S.pub && S.pub.ver)) { tampil(cacheHalaman[slug].d); return; }
  rpc('getHalaman', slug).then(function (r) { cacheHalaman[slug] = { ver: S.pub && S.pub.ver, d: r.data }; tampil(r.data); }, function (e) { kosongkan(isiEl); isiEl.appendChild(kosongPublik('search', 'Halaman tidak ditemukan', pesanGalat(e), h('a', { class: 'btn btn-utama', href: '#/' }, 'Ke Beranda'))); });
}
HALAMAN.data = function (el, bag) {
  var slug = bag[1], mp = pubData().modulPublik.filter(function (m) { return m.slug === slug; })[0];
  var isiEl = h('div', null, h('div', { class: 'skel', style: 'height:200px' }));
  el.appendChild(kepalaHalaman(mp ? mp.nama : 'Data')); el.appendChild(h('div', { class: 'bagian krem', style: 'padding-top:12px' }, h('div', { class: 'wadah' }, isiEl)));
  rpc('getDataModulPublik', slug).then(function (r) { kosongkan(isiEl); isiEl.appendChild(tabelModulPublik(r.data)); }, function (e) { kosongkan(isiEl); isiEl.appendChild(kosongPublik('database', 'Data tidak tersedia', pesanGalat(e))); });
};
function halaman404(el) { el.appendChild(h('div', { class: 'bagian krem', style: 'padding-top:140px' }, h('div', { class: 'wadah' }, kosongPublik('search', 'Halaman tidak ditemukan', 'Alamat yang Anda buka tidak tersedia.', h('a', { class: 'btn btn-utama', href: '#/' }, 'Kembali ke Beranda'))))); }

function layarPemeliharaan() {
  var P = PP(); var el = $('#halaman'); kosongkan(el);
  el.appendChild(h('div', { class: 'pemeliharaan' }, h('div', { style: 'max-width:520px' }, lambangBuah(110, '#F0E6D0'), h('h2', { style: 'margin:18px 0 10px' }, 'Sedang Dalam Pemeliharaan'), h('p', { style: 'opacity:.85' }, P.pemeliharaan_pesan || ''), h('p', { style: 'opacity:.7' }, [P.kontak_email, P.kontak_telepon].filter(Boolean).join(' · ')), h('a', { class: 'tautan-garis', href: '#/masuk', style: 'color:#F0E6D0;margin-top:12px' }, 'Masuk Tim'))));
}


/* =====================================================================
   LOGIN TIM
   ===================================================================== */
function tampilLogin() {
  var v = $('#v-login'); kosongkan(v);
  var P = PP();
  var email = h('input', { type: 'email', autocomplete: 'username', placeholder: 'nama@email.com', maxlength: 120 });
  var sandi = h('input', { type: 'password', autocomplete: 'current-password', maxlength: 100 });
  var mata = h('button', { type: 'button', class: 'mata', 'aria-label': 'Tampilkan kata sandi', onclick: function () { sandi.type = sandi.type === 'password' ? 'text' : 'password'; } }, ik('eye'));
  var galat = h('div', { class: 'pesan-salah', hidden: true, role: 'alert' });
  var tombol = h('button', { type: 'submit', class: 'btn-a utama blok' }, 'Masuk');
  var ingat = h('input', { type: 'checkbox', checked: true });
  var f = h('form', { novalidate: true, onsubmit: function (e) {
    e.preventDefault(); galat.hidden = true;
    if (!email.value.trim() || !sandi.value) { galat.textContent = 'Email dan kata sandi wajib diisi.'; galat.hidden = false; return; }
    spinnerTombol(tombol, true, 'Memeriksa…');
    rpc('login', email.value.trim(), sandi.value).then(function (r) {
      simpanSesi(r.data.token, r.data.exp); S.sandiSementara = r.data.wajibGanti; location.hash = '#/admin';
    }, function (er) { spinnerTombol(tombol, false); galat.textContent = pesanGalat(er); galat.hidden = false; sandi.value = ''; sandi.focus(); });
  } },
    h('div', { class: 'medan' }, h('label', null, 'Email'), email),
    h('div', { class: 'medan' }, h('label', null, 'Kata sandi'), h('div', { class: 'sandi-bungkus' }, sandi, mata)),
    galat, tombol);
  v.appendChild(h('div', { class: 'kartu-login' },
    h('div', { style: 'text-align:center;margin-bottom:18px' }, lambangBuah(56, P.warna_utama), h('h1', { style: 'font-size:22px;margin:10px 0 2px;font-family:var(--f-isi)' }, P.identitas_nama || 'PT. AGRI WANGI BERRY'), h('div', { class: 'bantu' }, 'Masuk Tim')),
    f, h('p', { style: 'text-align:center;margin:16px 0 0' }, h('a', { class: 'tautan-merah', href: '#/' }, '← Kembali ke situs')),
    h('p', { class: 'bantu', style: 'text-align:center' }, 'Lupa kata sandi? Hubungi Super Admin untuk mengatur ulang.')));
  setTimeout(function () { email.focus(); }, 50);
}

function dialogGantiSandi(wajib) {
  var lama = h('input', { type: 'password', autocomplete: 'current-password' }), baru = h('input', { type: 'password', autocomplete: 'new-password' }), ulang = h('input', { type: 'password', autocomplete: 'new-password' });
  var galat = h('div', { class: 'pesan-salah', hidden: true });
  var simpan = tombolA('Simpan Kata Sandi', 'utama', function () {
    galat.hidden = true;
    if (baru.value.length < 10) { galat.textContent = 'Kata sandi baru minimal 10 karakter.'; galat.hidden = false; return; }
    if (baru.value !== ulang.value) { galat.textContent = 'Konfirmasi kata sandi tidak sama.'; galat.hidden = false; return; }
    spinnerTombol(simpan, true, 'Menyimpan…');
    rpcA('gantiSandi', lama.value, baru.value).then(function () { m.tutup(true); toast('Kata sandi diperbarui.', 'ok'); S.sandiSementara = false; if (wajib) { S.admin = null; ruteSekarang(); } }, function (e) { spinnerTombol(simpan, false); galat.textContent = pesanGalat(e); galat.hidden = false; });
  });
  var m = modal({ judul: wajib ? 'Ganti Kata Sandi Sementara' : 'Ganti Kata Sandi', ukuran: 'sempit', tahan: wajib,
    isi: h('div', null, wajib ? h('div', { class: 'banner-info', style: 'margin-bottom:12px' }, ik('lock', 'kecil'), 'Demi keamanan, ganti kata sandi sementara Anda sebelum melanjutkan.') : null,
      h('div', { class: 'medan' }, h('label', null, wajib ? 'Kata sandi sementara' : 'Kata sandi saat ini'), lama),
      h('div', { class: 'medan' }, h('label', null, 'Kata sandi baru'), baru, h('div', { class: 'bantu' }, 'Minimal 10 karakter, kombinasi huruf besar, kecil, angka.')),
      h('div', { class: 'medan' }, h('label', null, 'Ulangi kata sandi baru'), ulang), galat),
    tombol: wajib ? [simpan] : [tombolA('Batal', 'hantu', function () { m.tutup(); }), simpan] });
  return m;
}

/* =====================================================================
   KERANGKA ADMIN
   ===================================================================== */
var ADMIN = {};
function boleh(modul, aksi) { var iz = S.admin && S.admin.izin[modul]; if (!iz) return false; return !!iz[{ Lihat: 0, Tambah: 1, Ubah: 2, Hapus: 3 }[aksi]]; }
function targetRuteAdmin(m) { return m.tipe === 'Tautan' ? aman(m.target) : '#/admin/' + (m.target || m.slug); }

function bangunKerangkaAdmin() {
  var A = S.admin, P = A.pengaturan || {};
  terapkanTemaAdmin(P);
  var logo = $('#logo-admin'); kosongkan(logo);
  logo.appendChild(lambangBuah(30, '#fff')); logo.appendChild(h('span', null, ' ' + String(P.identitas_nama || 'AGRI WANGI BERRY').replace(/^PT\.?\s*/i, '')));
  var nav = $('#nav-admin'); kosongkan(nav);
  var atas = A.menu.filter(function (m) { return !m.induk; });
  atas.forEach(function (m) {
    var anak = A.menu.filter(function (x) { return x.induk === m.slug; });
    var a = h('a', { class: 'nav-i', href: targetRuteAdmin(m), 'data-t': m.target || m.slug, target: m.tipe === 'Tautan' ? '_blank' : null, rel: m.tipe === 'Tautan' ? 'noopener noreferrer' : null, onclick: tutupSidebarMobile }, ik(m.ikon || 'circle'), h('span', null, m.label), m.target === 'pesanan' ? h('span', { class: 'titik-belum', id: 'titik-pesanan', hidden: true }) : null);
    nav.appendChild(a);
    anak.forEach(function (c) { nav.appendChild(h('a', { class: 'nav-i', style: 'padding-left:44px', href: targetRuteAdmin(c), 'data-t': c.target || c.slug, onclick: tutupSidebarMobile }, h('span', null, c.label))); });
  });
  bangunTopbar();
}
function tutupSidebarMobile() { $('#sidebar').classList.remove('buka'); $('#bg-mobile').hidden = true; }
function bangunTopbar() {
  var A = S.admin, u = A.user, tb = $('#topbar'); kosongkan(tb);
  var pop = h('div', { class: 'menu-pop', hidden: true },
    h('div', { style: 'padding:10px 14px' }, h('strong', null, u.nama), h('div', { class: 'bantu' }, u.email), h('div', null, h('span', { class: 'badge in' }, u.peran))),
    h('hr', { style: 'border:0;border-top:1px solid var(--a-garis,#eee);margin:0' }),
    h('button', { class: 'nav-i', type: 'button', onclick: function () { pop.hidden = true; dialogGantiSandi(false); } }, ik('key', 'kecil'), 'Ganti Kata Sandi'),
    h('a', { class: 'nav-i', href: '#/' }, ik('external-link', 'kecil'), 'Lihat Situs'),
    h('button', { class: 'nav-i', type: 'button', onclick: keluar }, ik('log-out', 'kecil'), 'Keluar'));
  var avatar = h('button', { class: 'avatar', type: 'button', 'aria-label': 'Menu akun', style: 'background:' + warnaAvatar(u.nama), onclick: function (e) { e.stopPropagation(); pop.hidden = !pop.hidden; } }, inisial(u.nama));
  document.addEventListener('click', function () { pop.hidden = true; });
  tb.appendChild(h('button', { class: 'ikon-btn-a hamburger-a', type: 'button', 'aria-label': 'Buka menu', onclick: function () { $('#sidebar').classList.add('buka'); $('#bg-mobile').hidden = false; } }, ik('menu')));
  tb.appendChild(h('div', { id: 'judul-topbar', style: 'font-weight:700;font-size:17px;flex:1' }, ''));
  tb.appendChild(h('span', { class: 'bantu', id: 'simpan-status' }, ''));
  tb.appendChild(h('div', { style: 'position:relative' }, avatar, pop));
  $('#bg-mobile').onclick = tutupSidebarMobile;
}
function keluar() {
  var t = S.token; hapusSesi(); rpc('logout', t).then(function () { }, function () { });
  location.hash = '#/masuk';
}
function judulAdmin(t) { var e = $('#judul-topbar'); if (e) e.textContent = t; document.title = t + ' — Admin'; }
function tandaiNavAdmin(t) { $$('#nav-admin .nav-i').forEach(function (a) { a.classList.toggle('aktif', a.getAttribute('data-t') === t); }); }
function kepalaAdmin(judul, sub, aksi) { return h('div', { class: 'kepala' }, h('div', null, h('h1', null, judul), sub ? h('div', { class: 'bantu' }, sub) : null), h('div', { class: 'aksi-kepala' }, aksi || null)); }
function tanpaIzin(el) { el.appendChild(h('div', { class: 'kosong-a' }, ik('lock'), h('h4', null, 'Akses dibatasi'), h('div', null, 'Anda tidak memiliki izin untuk membuka halaman ini. Hubungi Super Admin.'))); }

function halamanAdmin(bag) {
  var el = $('#admin-isi'); kosongkan(el); window.scrollTo(0, 0);
  var tujuan = bag[1] || 'dasbor';
  var def = S.admin.defModul[tujuan];
  var mk = S.admin.modulKustom.filter(function (m) { return m.kunci === tujuan; })[0];
  var info = S.admin.menu.filter(function (m) { return (m.target || m.slug) === tujuan; })[0];
  tandaiNavAdmin(tujuan);
  var judul = (info && info.label) || (def && def.label) || (mk && mk.nama) || 'Admin';
  judulAdmin(judul);
  var modulIzin = def ? def.izin : mk ? mk.kunci : tujuan;
  if (!boleh(modulIzin, 'Lihat') && tujuan !== 'dasbor') { tanpaIzin(el); return; }
  var khusus = ADMIN[tujuan];
  try {
    if (khusus) khusus(el, judul);
    else if (def) halamanModul(el, tujuan, def, judul);
    else if (mk) halamanModul(el, mk.kunci, modulKustomKeDef(mk), judul, mk);
    else el.appendChild(h('div', { class: 'kosong-a' }, ik('search'), h('h4', null, 'Halaman tidak ditemukan'), h('div', { style: 'margin-top:12px' }, h('a', { class: 'btn-a utama', href: '#/admin' }, 'Ke Dasbor'))));
  } catch (e) { el.appendChild(h('div', { class: 'kosong-a' }, ik('alert'), h('h4', null, 'Terjadi kesalahan menampilkan halaman'), h('div', null, String(e && e.message || e)))); if (window.console) console.error(e); }
}
function modulKustomKeDef(mk) {
  var kol = mk.kolom.map(function (c) { return c; });
  return { label: mk.nama, id: 'RekamID', izin: mk.kunci, kolom: kol, tabel: kol.filter(function (c) { return c.t !== 'area' && c.t !== 'md' && c.t !== 'json'; }).slice(0, 5).map(function (c) { return c.k; }), cari: kol.filter(function (c) { return /teks|area|email|tel|url/.test(c.t); }).map(function (c) { return c.k; }), filter: kol.filter(function (c) { return c.t === 'pilihan'; }).map(function (c) { return c.k; }), noTambah: false, kustom: true };
}

/* =====================================================================
   FORM GENERIK DARI DEFINISI KOLOM
   ===================================================================== */
function bangunForm(kolom, nilai, o) {
  o = o || {}; nilai = nilai || {}; var ctl = {}, wrap = h('div', { class: 'bentuk-form' }), medanEl = {};
  var batasKolom = o.hanya || null;
  kolom.forEach(function (c) {
    if (batasKolom && batasKolom.indexOf(c.k) < 0) return;
    var v = nilai[c.k] === undefined || nilai[c.k] === null ? '' : nilai[c.k], inp, ro = !!c.nol && !!nilai.id;
    var t = c.t;
    if (t === 'area' || t === 'md' || t === 'json' || t === 'blok') {
      inp = h('textarea', { rows: t === 'md' ? 10 : t === 'area' ? 3 : 5, maxlength: t === 'md' || t === 'json' || t === 'blok' ? 20000 : 1500, disabled: ro, class: t === 'md' || t === 'json' || t === 'blok' ? 'mono-area' : '' }); inp.value = (t === 'json' || t === 'blok') && v && typeof v !== 'string' ? JSON.stringify(v, null, 2) : v;
    } else if (t === 'pilihan' || t === 'kategori' || t === 'peran') {
      var opsi = t === 'kategori' ? (o.kategori || []) : t === 'peran' ? (S.admin.daftarPeran || []) : (c.o || []);
      inp = h('select', { disabled: ro }, t === 'kategori' || t === 'peran' || !c.w ? h('option', { value: '' }, '— pilih —') : null, opsi.map(function (x) { return h('option', { value: x }, x); }));
      if (v && opsi.indexOf(v) < 0) inp.appendChild(h('option', { value: v }, v)); inp.value = v !== '' ? v : (c.w && opsi.length ? opsi[0] : '');
    } else if (t === 'yn') {
      inp = h('input', { type: 'checkbox', disabled: ro }); inp.checked = v === 'Ya' || v === true;
    } else if (t === 'tanggal') {
      inp = h('input', { type: 'date', disabled: ro }); inp.value = String(v).slice(0, 10);
    } else if (t === 'gambar' || t === 'berkas') {
      inp = zonaUnggah({ accept: t === 'gambar' ? 'image/*' : '.pdf,.doc,.docx,.xls,.xlsx,.csv,.png,.jpg,.jpeg', label: t === 'gambar' ? 'Unggah gambar' : 'Unggah berkas', bantu: t === 'gambar' ? 'JPG/PNG/WebP. Dikompres otomatis.' : 'Maks. ' + (Number(S.admin.pengaturan.berkas_maks_mb) || 5) + ' MB', maksMB: Number(S.admin.pengaturan.berkas_maks_mb) || 5, sisi: t === 'gambar' ? 1600 : undefined });
      if (v && t === 'gambar') inp.setAda(foto(v, 400)); else if (v) inp.setAda('');
      inp.ada = v;
    } else {
      inp = h('input', { type: t === 'angka' || t === 'uang' ? 'number' : t === 'email' ? 'email' : t === 'tel' ? 'tel' : t === 'url' ? 'url' : 'text', inputmode: t === 'angka' || t === 'uang' ? 'numeric' : null, min: t === 'angka' || t === 'uang' ? '0' : null, step: t === 'uang' ? '100' : t === 'angka' ? '1' : null, maxlength: 300, disabled: ro });
      inp.value = v;
    }
    ctl[c.k] = inp;
    var kontrol = inp.el || inp;
    var m = medan(c.l, t === 'yn' ? h('label', { class: 'cek' }, kontrol, ' Ya') : kontrol, { wajib: !!c.w, bantu: c.h });
    if (t === 'md') {
      var pr = h('div', { class: 'md', hidden: true, style: 'border:1px solid var(--a-garis,#ddd);border-radius:8px;padding:12px;margin-top:8px' });
      var tg = tombolA('Pratinjau', 'hantu kecil', function () { pr.hidden = !pr.hidden; kosongkan(pr); if (!pr.hidden) pr.appendChild(mdKeDom(inp.value)); tg.textContent = pr.hidden ? 'Pratinjau' : 'Sembunyikan Pratinjau'; });
      m.appendChild(tg); m.appendChild(pr);
    }
    if (t === 'berkas' && v && nilai.id && o.modul) {
      var unduhBtn = tombolA('Unduh berkas', 'garis kecil', function () {
        spinnerTombol(unduhBtn, true, 'Mengunduh…');
        rpcA('unduhBerkas', o.modul === 'lamaran' ? 'cv' : 'modul', v, o.modul).then(function (r) { spinnerTombol(unduhBtn, false); unduhB64(r.data.nama, r.data.mime, r.data.b64); }, function (e) { spinnerTombol(unduhBtn, false); gagalToast(e); });
      }, 'download');
      m.insertBefore(unduhBtn, m.firstChild.nextSibling);
    }
    medanEl[c.k] = m; wrap.appendChild(m);
  });
  function nilaiDari(c) {
    var inp = ctl[c.k]; if (!inp) return undefined;
    if (c.t === 'yn') return inp.checked ? 'Ya' : 'Tidak';
    if (c.t === 'gambar' || c.t === 'berkas') return inp.ambil() ? { _baru: inp.ambil() } : inp.ada || '';
    if (c.t === 'json' || c.t === 'blok') return inp.value;
    return inp.value;
  }
  return {
    el: wrap,
    medan: medanEl,
    validasi: function () {
      var ok = true, pertama = null;
      kolom.forEach(function (c) {
        var m = medanEl[c.k]; if (!m) return; m.salah('');
        var v = nilaiDari(c), kosong = v === '' || v === undefined || (v && v._baru === undefined && typeof v === 'object');
        var pesan = '';
        if (c.w && (v === '' || v === undefined) && c.t !== 'yn') pesan = c.l + ' wajib diisi.';
        else if (v !== '' && v !== undefined) {
          if (c.t === 'email' && !emailSimple(String(v))) pesan = 'Format email tidak valid.';
          else if ((c.t === 'angka' || c.t === 'uang') && (isNaN(Number(v)) || Number(v) < 0)) pesan = 'Isi dengan angka 0 atau lebih.';
          else if (c.t === 'url' && !/^https?:\/\//i.test(String(v))) pesan = 'Tautan harus diawali http:// atau https://';
          else if (c.t === 'json' || c.t === 'blok') { try { JSON.parse(String(v)); } catch (e) { pesan = 'Format JSON tidak valid.'; } }
        }
        if (pesan) { m.salah(pesan); ok = false; if (!pertama) pertama = m; }
      });
      if (pertama) pertama.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return ok;
    },
    /** Mengunggah berkas baru lebih dulu (paralel) lalu mengembalikan objek nilai siap kirim. */
    kumpulkan: function (modul) {
      var out = {}, janji = [];
      kolom.forEach(function (c) {
        if (batasKolom && batasKolom.indexOf(c.k) < 0) return;
        var v = nilaiDari(c); if (v === undefined) return;
        if (v && typeof v === 'object' && v._baru) {
          var b = v._baru, jenis = c.t === 'gambar' ? (c.f || 'foto_berita') : 'modul';
          janji.push(rpcA('unggahBerkas', jenis, { nama: b.nama, b64: b.b64 }, jenis === 'modul' ? modul : '').then(function (r) { out[c.k] = r.data.id; }));
        } else out[c.k] = v;
      });
      return Promise.all(janji).then(function () { return out; });
    }
  };
}

/* =====================================================================
   HALAMAN MODUL GENERIK (tabel + cari + filter + form di laci)
   ===================================================================== */
var cacheKategori = null;
function ambilKategori() {
  if (cacheKategori) return Promise.resolve(cacheKategori);
  return rpcA('apiList', 'kategori', { ukuran: 100 }).then(function (r) { cacheKategori = r.data.baris.map(function (x) { return x.Nama; }); return cacheKategori; }, function () { return []; });
}
function sel(c, v, b) {
  if (v === undefined || v === null || v === '') return '';
  if (c.t === 'uang') return rp(v);
  if (c.t === 'yn') return v === 'Ya' ? h('span', { class: 'badge ok' }, 'Ya') : h('span', { class: 'badge' }, 'Tidak');
  if (c.t === 'gambar') return h('img', { class: 'thumb', src: foto(v, 96), alt: '', loading: 'lazy' });
  if (c.t === 'berkas') return ik('file', 'kecil');
  if (c.t === 'tanggal') return tglFmt(v);
  if (c.k === 'Status' || c.k === 'Prioritas') return statusBadge(String(v));
  if (c.t === 'md' || c.t === 'area') { var s = String(v); return s.length > 70 ? s.slice(0, 70) + '…' : s; }
  if (c.t === 'angka') return angkaFmt(v);
  return String(v);
}
function halamanModul(el, kunci, def, judul, mk) {
  var tambah = boleh(def.izin, 'Tambah') && !def.noTambah, ubah = boleh(def.izin, 'Ubah') || (kunci === 'produk' && boleh('produk_stok', 'Ubah')), hapus = boleh(def.izin, 'Hapus');
  var kolomPeta = {}; def.kolom.forEach(function (c) { kolomPeta[c.k] = c; });
  var cari = h('input', { type: 'search', placeholder: 'Cari…', 'aria-label': 'Cari', maxlength: 80 });
  var filterEl = h('div', { style: 'display:contents' }), filterNilai = {};
  var tabel = tabelBerhalaman({
    urut: def.urut, arah: def.arah, opsiAwal: { denganFilter: true },
    ambil: function (o) { return rpcA('apiList', kunci, o); },
    kolom: def.tabel.map(function (k) { var c = kolomPeta[k] || { k: k, l: k, t: 'teks' }; return { k: k, l: c.l, urut: c.t !== 'gambar' && c.t !== 'berkas', r: c.t === 'uang' || c.t === 'angka', fmt: function (v, b) { var x = sel(c, v, b); if (kunci === 'produk' && k === 'Stok') return h('span', { class: b.menipis ? 'badge wr' : '' }, angkaFmt(v) + (b.menipis ? ' · menipis' : '')); return x; } }; }),
    klik: ubah || tambah ? function (b) { bukaForm(b.id); } : null,
    massal: hapus ? [{ label: 'Hapus terpilih', ikon: 'trash', bahaya: true, fn: function (ids, selesai) { konfirmasi({ judul: 'Hapus ' + ids.length + ' data?', pesan: 'Data terpilih dipindah ke Tong Sampah dan bisa dipulihkan.', ya: 'Hapus', bahaya: true }).then(function (ya) { if (!ya) return; rpcA('apiHapus', kunci, ids).then(function () { toast(ids.length + ' data dipindah ke Tong Sampah.', 'ok', { label: 'Urungkan', fn: function () { rpcA('urungkanHapus', kunci, ids).then(function () { tabel.muat(true); toast('Penghapusan diurungkan.', 'ok'); }, gagalToast); } }, 6000); if (def.publik || kunci === 'produk') { S.pub = null; hapusLokal('awb_pub'); } selesai(); }, gagalToast); }); } }] : null,
    aksi: function (b) {
      var a = [];
      if (ubah) a.push(h('button', { type: 'button', class: 'ikon-btn-a', 'aria-label': 'Ubah ' + (b[def.tabel[0]] || ''), onclick: function () { bukaForm(b.id); } }, ik('pencil')));
      if (hapus) a.push(h('button', { type: 'button', class: 'ikon-btn-a bahaya', 'aria-label': 'Hapus', onclick: function () { hapusSatu(b); } }, ik('trash')));
      return a;
    },
    kosong: { ikon: 'inbox', judul: 'Belum ada ' + String(def.label).toLowerCase(), pesan: tambah ? 'Mulai dengan menambahkan data pertama.' : '', cta: tambah ? tombolA('Tambah ' + def.label, 'utama', function () { bukaForm(); }, 'plus') : null },
    saatMuat: function (d) {
      kosongkan(filterEl);
      Object.keys(d.opsiFilter || {}).forEach(function (k) {
        var s = h('select', { 'aria-label': 'Filter ' + (kolomPeta[k] ? kolomPeta[k].l : k) }, h('option', { value: '' }, (kolomPeta[k] ? kolomPeta[k].l : k) + ': semua'), d.opsiFilter[k].map(function (x) { return h('option', { value: x }, x); }));
        s.value = filterNilai[k] || ''; s.addEventListener('change', function () { filterNilai[k] = s.value; tabel.set({ filter: Object.assign({}, filterNilai) }); }); filterEl.appendChild(s);
      });
      judulTotal.textContent = d.total + ' data';
    }
  });
  var judulTotal = h('span', { class: 'bantu' }, '');
  cari.addEventListener('input', debounce(function () { tabel.set({ cari: cari.value.trim() }); }, 300));
  function ekspor() {
    rpcA('apiEkspor', kunci, { cari: tabel.opsi.cari, filter: tabel.opsi.filter }).then(function (r) { unduhTeks(r.data.nama, r.data.csv, 'text/csv;charset=utf-8'); toast(r.data.jumlah + ' baris diekspor (CSV, bisa dibuka di Excel).', 'ok'); }, gagalToast);
  }
  function hapusSatu(b) {
    var nama = b[def.tabel[0]] || 'data ini';
    konfirmasi({ judul: 'Hapus data?', pesan: '"' + nama + '" akan dipindah ke Tong Sampah dan bisa dipulihkan.', ya: 'Hapus', bahaya: true }).then(function (ya) {
      if (!ya) return;
      rpcA('apiHapus', kunci, [b.id]).then(function () {
        tabel.muat(true);
        toast('Dipindah ke Tong Sampah.', 'ok', { label: 'Urungkan', fn: function () { rpcA('urungkanHapus', kunci, [b.id]).then(function () { tabel.muat(true); toast('Penghapusan diurungkan.', 'ok'); }, gagalToast); } }, 6000);
      }, gagalToast);
    });
  }
  function bukaForm(id) {
    var simpanBtn = tombolA('Simpan', 'utama', function () { simpan(); }), baru = !id, m, form;
    var isiEl = h('div', null, h('div', { class: 'skel', style: 'height:40px;margin-bottom:12px' }), h('div', { class: 'skel', style: 'height:120px' }));
    m = laciSamping({ judul: (baru ? 'Tambah ' : 'Ubah ') + def.label, isi: isiEl, tombol: [tombolA('Batal', 'hantu', function () { m.tutup(); }), simpanBtn] });
    simpanBtn.disabled = true;
    Promise.all([baru ? Promise.resolve({ data: {} }) : rpcA('apiGet', kunci, id), def.kolom.some(function (c) { return c.t === 'kategori'; }) ? ambilKategori() : Promise.resolve([])]).then(function (hs) {
      var hanyaStok = !boleh(def.izin, 'Ubah') && kunci === 'produk' ? ['Stok', 'StokMinimum'] : null;
      var nilai = Object.assign({}, hs[0].data, { id: id || '' });
      if (baru) def.kolom.forEach(function (c) { if (c.t === 'pilihan' && c.o && c.w) nilai[c.k] = c.o[0]; if (c.t === 'yn') nilai[c.k] = 'Tidak'; });
      form = bangunForm(def.kolom, nilai, { kategori: hs[1], hanya: hanyaStok, modul: kunci });
      kosongkan(isiEl); isiEl.appendChild(form.el); simpanBtn.disabled = false;
    }, function (e) { kosongkan(isiEl); isiEl.appendChild(h('div', { class: 'kosong-a' }, ik('alert'), h('h4', null, 'Gagal memuat'), h('div', null, pesanGalat(e)))); });
    function simpan() {
      if (!form || !form.validasi()) return;
      spinnerTombol(simpanBtn, true, 'Menyimpan…');
      form.kumpulkan(kunci).then(function (nilai) { nilai.id = id || ''; return rpcA('apiSave', kunci, nilai); }).then(function () {
        m.tutup(); toast(baru ? def.label + ' ditambahkan.' : 'Perubahan disimpan.', 'ok');
        if (kunci === 'kategori') cacheKategori = null; if (def.publik || kunci === 'produk') { S.pub = null; hapusLokal('awb_pub'); }
        tabel.muat(true);
      }, function (e) { spinnerTombol(simpanBtn, false); gagalToast(e); });
    }
  }
  el.appendChild(kepalaAdmin(judul || def.label, null, [judulTotal, tombolA('Ekspor CSV', 'garis', ekspor, 'download'), tambah ? tombolA('Tambah', 'utama', function () { bukaForm(); }, 'plus') : null]));
  el.appendChild(h('div', { class: 'bar-filter' }, h('div', { class: 'cari' }, ik('search', 'kecil'), cari), filterEl));
  el.appendChild(tabel.el); tabel.muat();
}

/* =====================================================================
   DASBOR
   ===================================================================== */
var grafikAktif = [];
function bersihkanGrafik() { grafikAktif.forEach(function (g) { try { g.destroy(); } catch (e) { /* abaikan */ } }); grafikAktif = []; }
function gambarGrafik(wadah, jenis, labels, data, o) {
  o = o || {}; kosongkan(wadah);
  wadah.style.overflow = 'auto';
  if (!labels || !labels.length || !data.some(function (x) { return x > 0; })) { wadah.appendChild(h('div', { class: 'kosong-a', style: 'padding:24px' }, ik('chart-column'), h('div', null, 'Belum ada data untuk ditampilkan.'))); return; }
  var warna = ['#C8102E', '#1D4B4B', '#5B8C3A', '#E2A93B', '#7C3AED', '#0369A1', '#BE185D', '#6B7280'];
  if (typeof Chart === 'undefined') { // cadangan tanpa pustaka grafik: batang sederhana
    var mx = Math.max.apply(null, data) || 1;
    labels.forEach(function (l, i) { wadah.appendChild(h('div', { style: 'display:flex;align-items:center;gap:8px;margin:5px 0;font-size:12px' }, h('span', { style: 'width:90px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap' }, l), h('div', { style: 'flex:1;background:#eee;border-radius:4px' }, h('div', { style: 'height:12px;border-radius:4px;background:' + warna[i % 8] + ';width:' + Math.round(data[i] / mx * 100) + '%' })), h('span', null, o.rp ? rp(data[i]) : angkaFmt(data[i])))); });
    return;
  }
  var cv = h('canvas', { role: 'img', 'aria-label': o.judul || 'Grafik' }); wadah.appendChild(cv);
  var bulat = jenis === 'lingkaran';
  var g = new Chart(cv.getContext('2d'), { type: bulat ? 'doughnut' : jenis === 'garis' ? 'line' : 'bar', data: { labels: labels, datasets: [{ label: o.satuan || '', data: data, backgroundColor: bulat ? warna : jenis === 'garis' ? 'rgba(200,16,46,.12)' : '#C8102E', borderColor: bulat ? '#fff' : '#C8102E', borderWidth: bulat ? 2 : 2, fill: jenis === 'garis', tension: .3, pointRadius: jenis === 'garis' ? 2 : 0, borderRadius: 4 }] },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: bulat, position: 'bottom' }, tooltip: { callbacks: { label: function (c) { var v = c.parsed.y !== undefined ? c.parsed.y : c.parsed; return (c.label || '') + ': ' + (o.rp ? rp(v) : angkaFmt(v)); } } } }, scales: bulat ? {} : { y: { beginAtZero: true, ticks: { callback: function (v) { return o.rp ? (v >= 1e6 ? (v / 1e6) + ' jt' : v >= 1e3 ? (v / 1e3) + ' rb' : v) : v; } } }, x: { ticks: { maxRotation: 0, autoSkip: true } } } } });
  grafikAktif.push(g);
}
function kartuStat(ikon, label, nilai, delta, warna, href) {
  return h(href ? 'a' : 'div', { class: 'stat', href: href || null, style: href ? 'text-decoration:none;color:inherit;display:block' : null },
    h('div', { class: 'ic', style: warna ? 'background:' + warna + '22;color:' + warna : '' }, ik(ikon)), h('div', { class: 'cap' }, label), h('div', { class: 'angka' }, nilai),
    delta ? h('div', { class: 'delta ' + delta.kelas }, delta.teks) : null);
}
function deltaPersen(skrg, lalu) { if (!lalu) return skrg ? { kelas: 'naik', teks: 'baru' } : null; var p = Math.round((skrg - lalu) / lalu * 100); return { kelas: p >= 0 ? 'naik' : 'turun', teks: (p >= 0 ? '▲ ' : '▼ ') + Math.abs(p) + '% vs sebelumnya' }; }
ADMIN.dasbor = function (el) {
  bersihkanGrafik();
  var u = S.admin.user, jam = new Date().getHours(), sapa = jam < 11 ? 'Selamat pagi' : jam < 15 ? 'Selamat siang' : jam < 19 ? 'Selamat sore' : 'Selamat malam';
  var kartuWadah = h('div', { style: 'display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:14px;margin-bottom:16px' }, [1, 2, 3, 4].map(function () { return h('div', { class: 'skel', style: 'height:92px' }); })), badan = h('div'), stempel = h('span', { class: 'bantu' }, '');
  var muatUlang = tombolA('Segarkan', 'garis', function () { muat(true); }, 'refresh');
  el.appendChild(kepalaAdmin(sapa + ', ' + String(u.nama).split(' ')[0], 'Ringkasan operasional terkini.', [stempel, muatUlang])); el.appendChild(kartuWadah); el.appendChild(badan);
  function muat(segar) {
    if (segar) spinnerTombol(muatUlang, true, 'Memuat…');
    rpcA('getDasbor', !!segar).then(function (r) {
      spinnerTombol(muatUlang, false); var d = r.data, k = d.kartu; stempel.textContent = 'Diperbarui ' + (d.diperbarui || ''); kosongkan(kartuWadah); kosongkan(badan); bersihkanGrafik();
      if (k.pesananHariIni !== undefined) kartuWadah.appendChild(kartuStat('receipt', 'Pesanan hari ini', angkaFmt(k.pesananHariIni), deltaPersen(k.pesananHariIni, k.pesananKemarin), '#C8102E', '#/admin/pesanan'));
      if (k.penjualanBulan !== undefined) kartuWadah.appendChild(kartuStat('chart-column', 'Penjualan bulan ini', rp(k.penjualanBulan), deltaPersen(k.penjualanBulan, k.penjualanBulanLalu), '#1D4B4B'));
      if (k.menunggu !== undefined) kartuWadah.appendChild(kartuStat('clock', 'Perlu diproses', angkaFmt(k.menunggu), null, '#E2A93B', '#/admin/pesanan'));
      if (k.stokMenipis !== undefined) kartuWadah.appendChild(kartuStat('package', 'Stok menipis', angkaFmt(k.stokMenipis), null, k.stokMenipis ? '#C8102E' : '#5B8C3A', '#/admin/produk'));
      if (k.lamaranBaru !== undefined) kartuWadah.appendChild(kartuStat('users', 'Lamaran baru', angkaFmt(k.lamaranBaru), null, '#7C3AED', '#/admin/lamaran'));
      if (k.pesanBaru !== undefined) kartuWadah.appendChild(kartuStat('inbox', 'Pesan belum dibaca', angkaFmt(k.pesanBaru), null, '#0369A1', '#/admin/pesan'));
      var titik = $('#titik-pesanan'); if (titik) titik.hidden = !(k.menunggu > 0);
      var baris1 = h('div', { class: 'grid-modul' });
      if (d.harian) { var c1 = h('div', { class: 'grafik-wadah' }); baris1.appendChild(h('div', { class: 'kartu-a', style: 'padding:16px;grid-column:span 2' }, h('h3', { style: 'margin:0 0 10px;font-size:15px' }, 'Penjualan 30 hari terakhir'), c1)); setTimeout(function () { gambarGrafik(c1, 'garis', d.harian.label, d.harian.data, { rp: true, judul: 'Penjualan harian' }); }, 0); }
      if (d.status) { var c2 = h('div', { class: 'grafik-wadah' }); var kl = Object.keys(d.status); baris1.appendChild(h('div', { class: 'kartu-a', style: 'padding:16px' }, h('h3', { style: 'margin:0 0 10px;font-size:15px' }, 'Status pesanan (60 hari)'), c2)); setTimeout(function () { gambarGrafik(c2, 'lingkaran', kl, kl.map(function (x) { return d.status[x]; }), { judul: 'Status pesanan' }); }, 0); }
      if (d.bulanan) { var c3 = h('div', { class: 'grafik-wadah' }); baris1.appendChild(h('div', { class: 'kartu-a', style: 'padding:16px;grid-column:span 2' }, h('h3', { style: 'margin:0 0 10px;font-size:15px' }, 'Penjualan 12 bulan'), c3)); setTimeout(function () { gambarGrafik(c3, 'batang', d.bulanan.label, d.bulanan.data, { rp: true, judul: 'Penjualan bulanan' }); }, 0); }
      if (baris1.children.length) badan.appendChild(baris1);
      var baris2 = h('div', { class: 'grid-modul', style: 'margin-top:16px' });
      if (d.tabelPesanan) baris2.appendChild(h('div', { class: 'kartu-a', style: 'padding:16px' }, h('h3', { style: 'margin:0 0 8px;font-size:15px' }, 'Pesanan terbaru'),
        d.tabelPesanan.length ? h('table', { class: 'tbl kartu-hp' }, h('tbody', null, d.tabelPesanan.map(function (p) { return h('tr', { class: 'klik', onclick: function () { location.hash = '#/admin/pesanan/' + p.kode; } }, h('td', { class: 'mono' }, p.kode.slice(-13)), h('td', null, p.nama), h('td', null, statusBadge(p.status)), h('td', { class: 'r' }, rp(p.total))); }))) : h('div', { class: 'bantu' }, 'Belum ada pesanan.')));
      if (d.tabelStok) baris2.appendChild(h('div', { class: 'kartu-a', style: 'padding:16px' }, h('h3', { style: 'margin:0 0 8px;font-size:15px' }, 'Stok menipis'),
        d.tabelStok.length ? h('table', { class: 'tbl kartu-hp' }, h('tbody', null, d.tabelStok.map(function (p) { return h('tr', null, h('td', null, p.nama), h('td', { class: 'r' }, h('span', { class: 'badge wr' }, p.stok + ' / min ' + p.min))); }))) : h('div', { class: 'bantu' }, 'Semua stok aman.')));
      if (d.tabelLamaran) baris2.appendChild(h('div', { class: 'kartu-a', style: 'padding:16px' }, h('h3', { style: 'margin:0 0 8px;font-size:15px' }, 'Lamaran baru'),
        d.tabelLamaran.length ? h('table', { class: 'tbl kartu-hp' }, h('tbody', null, d.tabelLamaran.map(function (l) { return h('tr', { class: 'klik', onclick: function () { location.hash = '#/admin/lamaran'; } }, h('td', null, l.nama), h('td', null, l.posisi), h('td', { class: 'r bantu' }, relWaktu(l.tanggal))); }))) : h('div', { class: 'bantu' }, 'Tidak ada lamaran baru.')));
      if (baris2.children.length) badan.appendChild(baris2);
      if (!kartuWadah.children.length) badan.appendChild(h('div', { class: 'kosong-a' }, ik('layout-dashboard'), h('h4', null, 'Dasbor Anda masih kosong'), h('div', null, 'Gunakan menu di samping untuk mulai bekerja.')));
    }, function (e) { spinnerTombol(muatUlang, false); kosongkan(kartuWadah); kosongkan(badan); badan.appendChild(h('div', { class: 'kosong-a' }, ik('alert'), h('h4', null, 'Gagal memuat dasbor'), h('div', null, pesanGalat(e)), h('div', { style: 'margin-top:12px' }, tombolA('Coba Lagi', 'garis', function () { muat(); }, 'refresh')))); });
  }
  muat();
};


/* =====================================================================
   PESANAN
   ===================================================================== */
ADMIN.pesanan = function (el, judul) {
  var tambah = boleh('pesanan', 'Tambah'), statusAktif = '', periode = '';
  var cari = h('input', { type: 'search', placeholder: 'Cari kode, nama, telepon…', 'aria-label': 'Cari pesanan', maxlength: 60 });
  var tabsEl = h('div', { class: 'tab-garis', role: 'tablist' }), periodeSel = h('select', { 'aria-label': 'Periode' });
  var tabel = tabelBerhalaman({
    urut: 'tanggal', arah: 'desc',
    ambil: function (o) { return rpcA('daftarPesanan', { periode: periode, status: statusAktif, cari: o.cari, halaman: o.halaman }); },
    kolom: [{ k: 'kode', l: 'Kode', fmt: function (v) { return h('span', { class: 'mono' }, v); } }, { k: 'tanggal', l: 'Tanggal', fmt: function (v) { return tglFmt(v, true); } }, { k: 'nama', l: 'Pembeli' }, { k: 'telepon', l: 'Telepon' },
      { k: 'status', l: 'Status', fmt: function (v) { return statusBadge(v); } }, { k: 'total', l: 'Total', r: true, fmt: function (v) { return rp(v); } }],
    klik: function (b) { detailPesananDialog(b.kode); },
    aksi: function (b) { return h('button', { type: 'button', class: 'ikon-btn-a', 'aria-label': 'Lihat ' + b.kode, onclick: function () { detailPesananDialog(b.kode); } }, ik('eye')); },
    kosong: { ikon: 'receipt', judul: 'Belum ada pesanan', pesan: 'Pesanan dari situs akan muncul di sini secara otomatis.' },
    saatMuat: function (d) {
      if (!periodeSel.children.length || periodeSel.dataset.n !== String(d.periodeAda.length)) {
        kosongkan(periodeSel); d.periodeAda.forEach(function (p) { periodeSel.appendChild(h('option', { value: p }, p)); }); periodeSel.dataset.n = String(d.periodeAda.length);
      }
      periodeSel.value = d.periode; periode = d.periode;
      kosongkan(tabsEl);
      [''].concat(S.admin.statusPesanan).forEach(function (s) {
        var n = s ? (d.hitung[s] || 0) : d.semua;
        tabsEl.appendChild(h('button', { type: 'button', role: 'tab', class: statusAktif === s ? 'aktif' : '', 'aria-selected': statusAktif === s ? 'true' : 'false', onclick: function () { statusAktif = s; tabel.set({}); } }, s || 'Semua', ' ', h('span', { class: 'bantu' }, '(' + n + ')')));
      });
    }
  });
  cari.addEventListener('input', debounce(function () { tabel.set({ cari: cari.value.trim() }); }, 300));
  periodeSel.addEventListener('change', function () { periode = periodeSel.value; statusAktif = ''; tabel.set({}); });
  el.appendChild(kepalaAdmin(judul, 'Pesanan masuk dari situs dan input manual.', [tambah ? tombolA('Pesanan Manual', 'utama', pesananManual, 'plus') : null]));
  el.appendChild(h('div', { class: 'bar-filter' }, h('div', { class: 'cari' }, ik('search', 'kecil'), cari), periodeSel));
  el.appendChild(tabsEl); el.appendChild(tabel.el); tabel.muat();
  var langsung = location.hash.split('/')[3]; if (langsung) detailPesananDialog(decodeURIComponent(langsung));

  function detailPesananDialog(kode) {
    var isiEl = h('div', null, h('div', { class: 'skel', style: 'height:30px;margin-bottom:12px' }), h('div', { class: 'skel', style: 'height:160px' }));
    var m = laciSamping({ judul: 'Pesanan ' + kode, ukuran: 'lebar', isi: isiEl });
    rpcA('detailPesanan', kode).then(function (r) { gambar(r.data); }, function (e) { kosongkan(isiEl); isiEl.appendChild(h('div', { class: 'kosong-a' }, ik('alert'), h('h4', null, 'Gagal memuat'), h('div', null, pesanGalat(e)))); });
    function gambar(d) {
      kosongkan(isiEl); var bolehUbah = boleh('pesanan', 'Ubah'), batal = d.status === 'Dibatalkan';
      var pilih = h('select', { 'aria-label': 'Status baru', disabled: !bolehUbah || batal }, d.daftarStatus.map(function (s) { return h('option', { value: s }, s); })); pilih.value = d.status;
      var catatan = h('textarea', { rows: 2, maxlength: 500, disabled: !bolehUbah, placeholder: 'Catatan internal (tidak terlihat pembeli)' }); catatan.value = d.catatanInternal || '';
      var alasan = h('input', { type: 'text', maxlength: 300, placeholder: 'Alasan pembatalan (wajib)', hidden: true });
      pilih.addEventListener('change', function () { alasan.hidden = pilih.value !== 'Dibatalkan' || d.status === 'Dibatalkan'; });
      var simpan = tombolA('Simpan Perubahan', 'utama', function () {
        if (pilih.value === 'Dibatalkan' && d.status !== 'Dibatalkan' && !alasan.value.trim()) { toast('Isi alasan pembatalan terlebih dahulu.', 'wr'); alasan.focus(); return; }
        var lanjut = function () {
          spinnerTombol(simpan, true, 'Menyimpan…');
          rpcA('ubahStatusPesanan', d.kode, pilih.value, catatan.value, alasan.value).then(function () { toast('Pesanan diperbarui.', 'ok'); m.tutup(); tabel.muat(true); }, function (e) { spinnerTombol(simpan, false); gagalToast(e); });
        };
        if (pilih.value === 'Dibatalkan' && d.status !== 'Dibatalkan') konfirmasi({ judul: 'Batalkan pesanan?', pesan: 'Stok barang akan dikembalikan dan pesanan tidak dapat dibuka kembali.', ya: 'Ya, batalkan', bahaya: true }).then(function (y) { if (y) lanjut(); });
        else lanjut();
      });
      var buktiEl = h('div');
      if (d.buktiId) {
        var lihat = tombolA('Lihat Bukti Transfer', 'garis', function () {
          spinnerTombol(lihat, true, 'Memuat…');
          rpcA('unduhBerkas', 'bukti', d.buktiId).then(function (r) {
            spinnerTombol(lihat, false);
            if (/^image\//.test(r.data.mime)) { var mm = modal({ judul: 'Bukti Transfer', isi: h('img', { src: 'data:' + r.data.mime + ';base64,' + r.data.b64, alt: 'Bukti transfer', style: 'max-width:100%;border-radius:8px' }), tombol: [tombolA('Unduh', 'garis', function () { unduhB64(r.data.nama, r.data.mime, r.data.b64); }, 'download'), tombolA('Tutup', 'hantu', function () { mm.tutup(); })] }); }
            else unduhB64(r.data.nama, r.data.mime, r.data.b64);
          }, function (e) { spinnerTombol(lihat, false); gagalToast(e); });
        }, 'image');
        buktiEl.appendChild(lihat);
      } else buktiEl.appendChild(h('span', { class: 'bantu' }, 'Belum ada bukti transfer.'));
      var pdf = tombolA('Tanda Terima PDF', 'garis', function () {
        spinnerTombol(pdf, true, 'Menyiapkan…');
        rpcA('unduhTandaTerimaAdmin', d.kode, false).then(function (r) { spinnerTombol(pdf, false); unduhB64(r.data.nama, 'application/pdf', r.data.b64); }, function (e) { spinnerTombol(pdf, false); gagalToast(e); });
      }, 'download');
      var baris = function (l, v) { return v ? h('div', { style: 'display:flex;gap:12px;padding:6px 0;border-bottom:1px solid var(--a-garis,#eee)' }, h('div', { class: 'bantu', style: 'width:110px;flex:none' }, l), h('div', { style: 'flex:1;white-space:pre-line' }, v)) : null; };
      isiEl.appendChild(h('div', null,
        h('div', { style: 'display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:12px' }, statusBadge(d.status), h('span', { class: 'bantu' }, tglFmt(d.tanggal, true))),
        h('div', { class: 'kartu-a', style: 'padding:14px;margin-bottom:14px' }, baris('Pembeli', d.nama), baris('Telepon', d.telepon), baris('Email', d.email), baris('Alamat', d.alamat + (d.kota ? ', ' + d.kota : '')), baris('Catatan pembeli', d.catatan), baris('Ditangani', d.oleh)),
        h('table', { class: 'tbl' }, h('thead', null, h('tr', null, h('th', null, 'Produk'), h('th', { class: 'r' }, 'Harga'), h('th', { class: 'r' }, 'Jml'), h('th', { class: 'r' }, 'Subtotal'))),
          h('tbody', null, d.items.map(function (i) { return h('tr', null, h('td', null, i.nama), h('td', { class: 'r' }, rp(i.harga)), h('td', { class: 'r' }, i.jumlah), h('td', { class: 'r' }, rp(i.sub))); }),
            h('tr', null, h('td', { colspan: 3 }, 'Ongkos kirim'), h('td', { class: 'r' }, rp(d.ongkir))), h('tr', null, h('td', { colspan: 3 }, h('strong', null, 'Total')), h('td', { class: 'r' }, h('strong', null, rp(d.total)))))),
        h('div', { style: 'display:flex;gap:8px;flex-wrap:wrap;margin:14px 0' }, buktiEl, pdf),
        bolehUbah ? h('div', { class: 'kartu-a', style: 'padding:14px' }, h('div', { class: 'medan' }, h('label', null, 'Ubah status'), pilih), alasan, h('div', { class: 'medan', style: 'margin-top:8px' }, h('label', null, 'Catatan internal'), catatan),
          batal ? h('div', { class: 'bantu' }, 'Pesanan yang dibatalkan tidak dapat dibuka kembali.') : null, h('div', { style: 'margin-top:10px' }, simpan)) : null));
    }
  }

  function pesananManual() {
    ambilProdukUntukManual().then(function (produk) {
      var f = { nama: h('input', { type: 'text', maxlength: 80 }), telepon: h('input', { type: 'tel', maxlength: 20 }), email: h('input', { type: 'email', maxlength: 120 }), alamat: h('textarea', { rows: 2, maxlength: 400 }), kota: h('input', { type: 'text', maxlength: 80 }), catatan: h('textarea', { rows: 2, maxlength: 300 }) };
      var md = { nama: medan('Nama pembeli', f.nama, { wajib: true }), telepon: medan('Telepon', f.telepon, { wajib: true }), email: medan('Email', f.email), alamat: medan('Alamat', f.alamat, { wajib: true }), kota: medan('Kota', f.kota), catatan: medan('Catatan', f.catatan) };
      var baris = [], listEl = h('div');
      function tambahBaris() {
        var sp = h('select', { 'aria-label': 'Produk' }, h('option', { value: '' }, '— pilih produk —'), produk.map(function (p) { return h('option', { value: p.id }, p.nama + ' (stok ' + p.stok + ') — ' + rp(p.harga)); }));
        var jm = h('input', { type: 'number', min: '1', value: '1', 'aria-label': 'Jumlah', style: 'max-width:90px' });
        var b = { sp: sp, jm: jm, el: h('div', { style: 'display:flex;gap:8px;margin-bottom:8px' }, sp, jm, h('button', { type: 'button', class: 'ikon-btn-a bahaya', 'aria-label': 'Hapus baris', onclick: function () { baris = baris.filter(function (x) { return x !== b; }); b.el.remove(); } }, ik('trash'))) };
        baris.push(b); listEl.appendChild(b.el);
      }
      tambahBaris();
      var kirim = tombolA('Buat Pesanan', 'utama', function () {
        Object.keys(md).forEach(function (k) { md[k].salah(''); }); var ok = true;
        if (f.nama.value.trim().length < 2) { md.nama.salah('Nama wajib diisi.'); ok = false; } if (f.telepon.value.replace(/\D/g, '').length < 8) { md.telepon.salah('Telepon tidak valid.'); ok = false; } if (f.alamat.value.trim().length < 5) { md.alamat.salah('Alamat wajib diisi.'); ok = false; }
        var items = baris.filter(function (b) { return b.sp.value; }).map(function (b) { return { id: b.sp.value, jumlah: Math.max(1, parseInt(b.jm.value, 10) || 1) }; });
        if (!items.length) { toast('Pilih minimal satu produk.', 'wr'); ok = false; } if (!ok) return;
        spinnerTombol(kirim, true, 'Membuat…');
        rpcA('buatPesananAdmin', { nama: f.nama.value, telepon: f.telepon.value, email: f.email.value, alamat: f.alamat.value, kota: f.kota.value, catatan: f.catatan.value, items: items }).then(function (r) { m.tutup(); toast('Pesanan ' + r.data.kode + ' dibuat.', 'ok'); S.stokProdukAdmin = null; tabel.muat(true); }, function (e) { spinnerTombol(kirim, false); gagalToast(e); });
      });
      var m = laciSamping({ judul: 'Pesanan Manual', isi: h('div', null, md.nama, h('div', { class: 'dua-kolom' }, md.telepon, md.email), md.alamat, md.kota, h('h4', null, 'Produk'), listEl, tombolA('Tambah baris', 'hantu kecil', tambahBaris, 'plus'), md.catatan), tombol: [tombolA('Batal', 'hantu', function () { m.tutup(); }), kirim] });
    }, gagalToast);
  }
  function ambilProdukUntukManual() {
    return rpcA('apiList', 'produk', { ukuran: 100, filter: { Status: 'Aktif' } }).then(function (r) { return r.data.baris.map(function (p) { return { id: p.id, nama: p.Nama, harga: Number(p.Harga) || 0, stok: Number(p.Stok) || 0 }; }); });
  }
};

/* =====================================================================
   LAPORAN
   ===================================================================== */
ADMIN.laporan = function (el, judul) {
  bersihkanGrafik();
  var grid = h('div', { class: 'grid-modul' }, [1, 2, 3].map(function () { return h('div', { class: 'skel', style: 'height:260px' }); })), info = null, kelolaMode = false, tombolKelola = null;
  el.appendChild(kepalaAdmin(judul, 'Laporan interaktif. Tambah, sembunyikan, atau hapus sesuai kebutuhan.', [h('span', { id: 'aksi-laporan' })])); el.appendChild(grid);
  function muat() {
    rpcA('daftarLaporan', kelolaMode).then(function (r) { info = r.data; gambar(); }, function (e) { kosongkan(grid); grid.appendChild(h('div', { class: 'kosong-a' }, ik('alert'), h('h4', null, 'Gagal memuat laporan'), h('div', null, pesanGalat(e)))); });
  }
  function gambar() {
    bersihkanGrafik(); kosongkan(grid);
    var aksi = $('#aksi-laporan'); kosongkan(aksi);
    if (info.bolehKelola || boleh('laporan', 'Tambah') || boleh('laporan', 'Ubah')) {
      aksi.appendChild(tombolA(kelolaMode ? 'Selesai Mengelola' : 'Kelola Laporan', 'garis', function () { kelolaMode = !kelolaMode; muat(); }, 'settings'));
      if (kelolaMode && boleh('laporan', 'Tambah')) aksi.appendChild(tombolA('Laporan Baru', 'utama', function () { formLaporan(null); }, 'plus'));
    }
    if (!info.laporan.length) { grid.appendChild(h('div', { class: 'kosong-a' }, ik('chart-column'), h('h4', null, 'Belum ada laporan'), h('div', null, 'Aktifkan "Kelola Laporan" untuk menambah.'))); return; }
    info.laporan.forEach(function (l) {
      var badan = h('div', { class: 'grafik-wadah' }, h('div', { class: 'skel', style: 'height:100%' }));
      var ctl = kelolaMode ? h('div', { style: 'display:flex;gap:4px' },
        h('button', { class: 'ikon-btn-a', type: 'button', 'aria-label': l.tampil ? 'Sembunyikan' : 'Tampilkan', onclick: function () { rpcA('aturTampilLaporan', l.id, !l.tampil).then(muat, gagalToast); } }, ik(l.tampil ? 'eye' : 'eye-off')),
        boleh('laporan', 'Ubah') ? h('button', { class: 'ikon-btn-a', type: 'button', 'aria-label': 'Ubah', onclick: function () { formLaporan(l); } }, ik('pencil')) : null,
        boleh('laporan', 'Ubah') ? h('button', { class: 'ikon-btn-a', type: 'button', 'aria-label': 'Naik', onclick: function () { geser(l, -1); } }, ik('chevron-up')) : null,
        boleh('laporan', 'Ubah') ? h('button', { class: 'ikon-btn-a', type: 'button', 'aria-label': 'Turun', onclick: function () { geser(l, 1); } }, ik('chevron-down')) : null,
        boleh('laporan', 'Hapus') ? h('button', { class: 'ikon-btn-a bahaya', type: 'button', 'aria-label': 'Hapus', onclick: function () { konfirmasi({ judul: 'Hapus laporan?', pesan: '"' + l.judul + '" akan dihapus.', ya: 'Hapus', bahaya: true }).then(function (y) { if (y) rpcA('hapusLaporan', l.id).then(function () { toast('Laporan dihapus.', 'ok'); muat(); }, gagalToast); }); } }, ik('trash')) : null) : null;
      grid.appendChild(h('div', { class: 'kartu-a', style: 'padding:16px;' + (l.tampil ? '' : 'opacity:.55') }, h('div', { style: 'display:flex;justify-content:space-between;align-items:center;margin-bottom:8px' }, h('h3', { style: 'margin:0;font-size:15px' }, l.judul, l.tampil ? '' : ' (tersembunyi)'), ctl), badan));
      rpcA('jalankanLaporan', l.id).then(function (r) { isiLaporan(badan, r.data); }, function (e) { kosongkan(badan); badan.appendChild(h('div', { class: 'bantu' }, pesanGalat(e))); });
    });
  }
  function geser(l, arah) {
    var ids = info.laporan.map(function (x) { return x.id; }), i = ids.indexOf(l.id), j = i + arah; if (j < 0 || j >= ids.length) return;
    var t = ids[i]; ids[i] = ids[j]; ids[j] = t; rpcA('urutLaporan', ids).then(muat, gagalToast);
  }
  function isiLaporan(badan, d) {
    kosongkan(badan);
    if (d.jenis === 'angka') { badan.appendChild(h('div', { style: 'font-size:44px;font-weight:800;padding:24px 0;text-align:center' }, d.format === 'rp' ? rp(d.angka) : angkaFmt(d.angka))); badan.style.height = 'auto'; return; }
    if (d.jenis === 'tabel' || d.baris) {
      badan.style.height = 'auto'; badan.style.maxHeight = '300px'; badan.style.overflow = 'auto';
      badan.appendChild(d.baris && d.baris.length ? h('table', { class: 'tbl' }, h('thead', null, h('tr', null, d.kolom.map(function (c) { return h('th', null, c); }))), h('tbody', null, d.baris.map(function (r) { return h('tr', null, r.map(function (x) { return h('td', null, x === null || x === undefined ? '' : String(x)); })); }))) : h('div', { class: 'bantu' }, 'Tidak ada data.'));
      return;
    }
    gambarGrafik(badan, d.jenis === 'lingkaran' || d.jenis === 'garis' ? d.jenis : 'batang', d.labels || [], d.data || [], { rp: d.format === 'rp', satuan: d.satuan, judul: d.judul });
  }
  function formLaporan(l) {
    var sumber = info.sumber, baru = !l;
    var judulI = h('input', { type: 'text', maxlength: 80 }); judulI.value = l ? l.judul : '';
    var sumberS = h('select', null, sumber.map(function (s) { return h('option', { value: s.kunci }, s.label); })), jenisS = h('select', null, [['batang', 'Batang'], ['garis', 'Garis'], ['lingkaran', 'Lingkaran'], ['angka', 'Angka tunggal'], ['tabel', 'Tabel']].map(function (x) { return h('option', { value: x[0] }, x[1]); }));
    var kolomWrap = h('div'), agS = h('select', null, [['hitung', 'Hitung jumlah data'], ['jumlah', 'Jumlahkan kolom angka'], ['rata', 'Rata-rata kolom angka']].map(function (x) { return h('option', { value: x[0] }, x[1]); })), kolAngka = h('select'), kolGrup = h('select'), kolTabel = [];
    var peranWrap = h('div', { style: 'display:flex;gap:10px;flex-wrap:wrap' }), peranCek = {};
    (S.admin.daftarPeran || []).forEach(function (p) { var c = h('input', { type: 'checkbox' }); peranCek[p] = c; peranWrap.appendChild(h('label', { class: 'cek' }, c, ' ' + p)); });
    var tampilCek = h('input', { type: 'checkbox', checked: true });
    function isiKolom() {
      var s = sumber.filter(function (x) { return x.kunci === sumberS.value; })[0]; if (!s) return;
      kosongkan(kolGrup); kosongkan(kolAngka); s.kolom.forEach(function (c) { kolGrup.appendChild(h('option', { value: c.k }, c.l)); if (c.t === 'angka' || c.t === 'uang') kolAngka.appendChild(h('option', { value: c.k }, c.l)); });
      kosongkan(kolomWrap); kolTabel = [];
      if (jenisS.value === 'tabel') s.kolom.slice(0, 12).forEach(function (c) { var cb = h('input', { type: 'checkbox' }); cb.value = c.k; cb.checked = kolTabel.length < 4; kolTabel.push(cb); kolomWrap.appendChild(h('label', { class: 'cek', style: 'margin-right:12px' }, cb, ' ' + c.l)); });
      else if (jenisS.value !== 'angka') kolomWrap.appendChild(h('div', { class: 'medan' }, h('label', null, 'Kelompokkan berdasarkan'), kolGrup));
      if (jenisS.value !== 'tabel') kolomWrap.appendChild(h('div', { class: 'medan' }, h('label', null, 'Cara menghitung'), agS, kolAngka.children.length ? h('div', { style: 'margin-top:6px' }, kolAngka) : null));
    }
    sumberS.addEventListener('change', isiKolom); jenisS.addEventListener('change', isiKolom);
    if (l) { sumberS.value = l.sumber; jenisS.value = l.jenis; }
    isiKolom();
    if (l) { var ag = String(l.agregasi || 'hitung').split(':'); agS.value = ag[0] || 'hitung'; if (ag[1]) kolAngka.value = ag[1]; kolGrup.value = String(l.kolom).split(',')[0]; kolTabel.forEach(function (cb) { cb.checked = String(l.kolom).split(',').indexOf(cb.value) >= 0; }); tampilCek.checked = l.tampil; String(l.peran || '').split(',').forEach(function (p) { if (peranCek[p.trim()]) peranCek[p.trim()].checked = true; }); }
    var simpan = tombolA('Simpan', 'utama', function () {
      if (!judulI.value.trim()) { toast('Judul laporan wajib diisi.', 'wr'); judulI.focus(); return; }
      var kolom = jenisS.value === 'tabel' ? kolTabel.filter(function (c) { return c.checked; }).map(function (c) { return c.value; }).join(',') : kolGrup.value;
      if (jenisS.value === 'tabel' && !kolom) { toast('Pilih minimal satu kolom.', 'wr'); return; }
      var agg = agS.value === 'hitung' || jenisS.value === 'tabel' ? 'hitung' : agS.value + ':' + kolAngka.value;
      spinnerTombol(simpan, true, 'Menyimpan…');
      rpcA('simpanLaporan', { id: l ? l.id : '', judul: judulI.value, sumber: sumberS.value, jenis: jenisS.value, kolom: kolom, agregasi: agg, tampil: tampilCek.checked ? 'Ya' : 'Tidak', peran: Object.keys(peranCek).filter(function (p) { return peranCek[p].checked; }).join(',') })
        .then(function () { m.tutup(); toast('Laporan disimpan.', 'ok'); muat(); }, function (e) { spinnerTombol(simpan, false); gagalToast(e); });
    });
    var m = modal({ judul: baru ? 'Laporan Baru' : 'Ubah Laporan', isi: h('div', null, l && l.bawaan ? h('div', { class: 'banner-info', style: 'margin-bottom:10px' }, 'Laporan bawaan: hanya judul, tampilan, dan peran yang berlaku.') : null,
      h('div', { class: 'medan' }, h('label', null, 'Judul'), judulI), h('div', { class: 'dua-kolom' }, h('div', { class: 'medan' }, h('label', null, 'Sumber data'), sumberS), h('div', { class: 'medan' }, h('label', null, 'Jenis'), jenisS)), kolomWrap,
      h('div', { class: 'medan' }, h('label', null, 'Boleh dilihat peran (kosong = semua)'), peranWrap), h('label', { class: 'cek' }, tampilCek, ' Tampilkan di halaman laporan')), tombol: [tombolA('Batal', 'hantu', function () { m.tutup(); }), simpan] });
  }
  muat();
};


/* =====================================================================
   PENGATURAN TAMPILAN (dengan pratinjau langsung)
   ===================================================================== */
function kelompokKunci(k) {
  if (/^(identitas_|hero_)/.test(k)) return 'identitas';
  if (/^(warna_|mode_gelap)/.test(k)) return 'warna';
  if (/^huruf_/.test(k)) return 'huruf';
  if (/^foto_/.test(k)) return 'foto';
  if (/^tata_/.test(k)) return 'tata';
  if (/^(beranda_|tile\d|banner_)/.test(k)) return 'beranda';
  if (/^menu_/.test(k)) return 'menu';
  if (/^tombol_/.test(k)) return 'tombol';
  if (/^admin_/.test(k)) return 'admin';
  return 'lain';
}
function parseTipe(tipe) {
  var p = String(tipe).split(':'), jenis = p[0], arg = p.slice(1).join(':');
  if (jenis === 'angka') { var m = /^(-?[\d.]+)-(-?[\d.]+)$/.exec(arg) || []; return { jenis: jenis, min: m[1] !== undefined ? Number(m[1]) : 0, maks: m[2] !== undefined ? Number(m[2]) : 100000 }; }
  if (jenis === 'pilihan' || jenis === 'urutan') return { jenis: jenis, opsi: arg.split('|') };
  return { jenis: jenis };
}
/** Satu kontrol pengaturan. Mengembalikan {el, nilai(), set(v), ubah(fn)}. */
function kontrolPengaturan(s, nilaiAwal, saatUbah) {
  var t = parseTipe(s.tipe), v = nilaiAwal === undefined || nilaiAwal === null ? '' : String(nilaiAwal), kontrol, baca, tulis;
  var ubah = function () { if (saatUbah) saatUbah(); };
  if (t.jenis === 'warna') {
    var w = h('input', { type: 'color', 'aria-label': s.ket }), tx = h('input', { type: 'text', maxlength: 9, placeholder: '#RRGGBB', style: 'max-width:110px' });
    w.value = /^#[0-9a-f]{6}$/i.test(v) ? v : '#000000'; tx.value = v;
    w.addEventListener('input', function () { tx.value = w.value; ubah(); }); tx.addEventListener('input', function () { if (/^#[0-9a-f]{6}$/i.test(tx.value)) w.value = tx.value; ubah(); });
    kontrol = h('div', { style: 'display:flex;gap:8px;align-items:center' }, w, tx); baca = function () { return tx.value.trim(); }; tulis = function (x) { tx.value = x; if (/^#[0-9a-f]{6}$/i.test(x)) w.value = x; };
  } else if (t.jenis === 'ya_tidak') {
    var cb = h('input', { type: 'checkbox' }); cb.checked = v === 'Ya'; cb.addEventListener('change', ubah); kontrol = h('label', { class: 'cek' }, cb, ' Ya'); baca = function () { return cb.checked ? 'Ya' : 'Tidak'; }; tulis = function (x) { cb.checked = x === 'Ya'; };
  } else if (t.jenis === 'pilihan') {
    var sl = h('select', { 'aria-label': s.ket }, t.opsi.map(function (o) { return h('option', { value: o }, o); })); if (v && t.opsi.indexOf(v) < 0) sl.appendChild(h('option', { value: v }, v)); sl.value = v; sl.addEventListener('change', ubah);
    kontrol = sl; baca = function () { return sl.value; }; tulis = function (x) { sl.value = x; };
  } else if (t.jenis === 'angka') {
    var rg = h('input', { type: 'range', min: t.min, max: t.maks, step: (t.maks - t.min) <= 10 ? 0.1 : 1, 'aria-label': s.ket }), nm = h('input', { type: 'number', min: t.min, max: t.maks, step: 'any', style: 'max-width:90px' });
    rg.value = v; nm.value = v; rg.addEventListener('input', function () { nm.value = rg.value; ubah(); }); nm.addEventListener('input', function () { rg.value = nm.value; ubah(); });
    kontrol = h('div', { style: 'display:flex;gap:10px;align-items:center' }, rg, nm); baca = function () { return nm.value; }; tulis = function (x) { nm.value = x; rg.value = x; };
  } else if (t.jenis === 'teks_panjang') {
    var ta = h('textarea', { rows: 3, maxlength: 1000, 'aria-label': s.ket }); ta.value = v; ta.addEventListener('input', ubah); kontrol = ta; baca = function () { return ta.value; }; tulis = function (x) { ta.value = x; };
  } else if (t.jenis === 'gambar') {
    var zu = zonaUnggah({ accept: 'image/*', label: 'Unggah gambar', bantu: 'Kosongkan untuk memakai bawaan.', sisi: 1800, maksMB: 5, saatPilih: ubah }), hapusBtn = tombolA('Hapus gambar', 'hantu kecil', function () { cur = ''; zu.reset(); kosongkan(info); ubah(); }), cur = v, info = h('div');
    if (v) { zu.setAda(foto(v, 400)); }
    kontrol = h('div', null, zu.el, v ? hapusBtn : null);
    baca = function () { var b = zu.ambil(); return b ? { _baru: b } : cur; }; tulis = function (x) { cur = x; };
  } else if (t.jenis === 'urutan') {
    var daftar = (v ? v.split(',') : t.opsi).map(function (x) { return x.trim(); }), box = h('div');
    var gambar = function () {
      kosongkan(box); daftar.forEach(function (x, i) {
        box.appendChild(h('div', { class: 'urut-item' }, h('span', null, x), h('span', null, h('button', { type: 'button', class: 'ikon-btn-a', disabled: i === 0, 'aria-label': 'Naik', onclick: function () { daftar.splice(i - 1, 0, daftar.splice(i, 1)[0]); gambar(); ubah(); } }, ik('chevron-up')),
          h('button', { type: 'button', class: 'ikon-btn-a', disabled: i === daftar.length - 1, 'aria-label': 'Turun', onclick: function () { daftar.splice(i + 1, 0, daftar.splice(i, 1)[0]); gambar(); ubah(); } }, ik('chevron-down')))));
      });
    }; gambar(); kontrol = box; baca = function () { return daftar.join(','); }; tulis = function (x) { daftar = String(x).split(',').map(function (y) { return y.trim(); }); gambar(); };
  } else {
    var inp = h('input', { type: 'text', maxlength: 400, 'aria-label': s.ket }); inp.value = v; inp.addEventListener('input', ubah); kontrol = inp; baca = function () { return inp.value; }; tulis = function (x) { inp.value = x; };
  }
  return { el: kontrol, nilai: baca, set: tulis, jenis: t.jenis };
}
function unggahGambarPengaturan(kontrolMap, kunciList) {
  var janji = [], out = {};
  kunciList.forEach(function (k) {
    var v = kontrolMap[k].nilai();
    if (v && typeof v === 'object' && v._baru) janji.push(rpcA('unggahBerkas', 'foto_berita', { nama: v._baru.nama, b64: v._baru.b64 }).then(function (r) { out[k] = r.data.id; }));
    else out[k] = v;
  });
  return Promise.all(janji).then(function () { return out; });
}
function setelahPengaturanTersimpan(perubahan) {
  Object.keys(perubahan).forEach(function (k) { S.admin.pengaturan[k] = perubahan[k]; S.admin.pengaturanSkema.forEach(function (s) { if (s.kunci === k) s.nilai = perubahan[k]; }); });
  terapkanTemaAdmin(S.admin.pengaturan); S.pub = null; hapusLokal('awb_pub'); segarkanPublik().then(function () { terapkanTema(PP(), $('#v-publik')); renderNav(); renderFooter(); }, function () { });
}

ADMIN.tampilan = function (el, judul) {
  var bolehUbah = boleh('tampilan', 'Ubah');
  var skema = S.admin.pengaturanSkema.filter(function (s) { return s.grup === 'Tampilan'; });
  var asal = {}, kontrol = {}, aktif = 'identitas', adaUbah = false;
  skema.forEach(function (s) { asal[s.kunci] = s.nilai === undefined || s.nilai === null ? '' : String(s.nilai); });
  var panel = h('div'), tabs = h('div', { class: 'tab-garis', role: 'tablist' }), pratinjau = h('div', { class: 'tema kanvas-pratinjau', style: 'min-height:300px' }), bar = h('div', { class: 'bar-bawah', hidden: true });
  var mode = 'desktop';
  var simpanBtn = tombolA('Simpan Perubahan', 'utama', simpan, 'save'), batalBtn = tombolA('Batalkan', 'hantu', function () { skema.forEach(function (s) { kontrol[s.kunci].set(asal[s.kunci]); }); tandai(false); gambarPratinjau(); }), jumlahUbah = h('span', { class: 'bantu' });
  bar.appendChild(jumlahUbah); bar.appendChild(h('span', { style: 'flex:1' })); bar.appendChild(batalBtn); bar.appendChild(simpanBtn);
  skema.forEach(function (s) { kontrol[s.kunci] = kontrolPengaturan(s, asal[s.kunci], function () { tandai(true); tundaPratinjau(); }); });
  function nilaiSekarang() { var P = {}; skema.forEach(function (s) { var v = kontrol[s.kunci].nilai(); P[s.kunci] = v && typeof v === 'object' ? (v._baru ? '' : '') : v; if (v && typeof v === 'object' && v._baru) P[s.kunci] = asal[s.kunci]; }); return Object.assign({}, S.admin.pengaturan, P); }
  function terubah() { return skema.filter(function (s) { var v = kontrol[s.kunci].nilai(); return typeof v === 'object' ? !!(v && v._baru) : String(v) !== asal[s.kunci]; }); }
  function tandai() { var n = terubah().length; bar.hidden = n === 0; jumlahUbah.textContent = n + ' pengaturan diubah (belum disimpan)'; adaUbah = n > 0; }
  var tundaPratinjau = debounce(function () { gambarPratinjau(); }, 150);
  function gambarPratinjau() {
    var P = nilaiSekarang(); terapkanTema(P, pratinjau); kosongkan(pratinjau);
    try { pratinjau.appendChild(bangunBeranda(P, pubData(), { statis: true })); } catch (e) { pratinjau.appendChild(h('div', { class: 'bantu' }, 'Pratinjau tidak tersedia: ' + e.message)); }
  }
  function gambarPanel() {
    kosongkan(panel); kosongkan(tabs);
    S.admin.kelompokTampilan.forEach(function (k) { tabs.appendChild(h('button', { type: 'button', role: 'tab', class: aktif === k.id ? 'aktif' : '', 'aria-selected': aktif === k.id ? 'true' : 'false', onclick: function () { aktif = k.id; gambarPanel(); } }, k.label)); });
    var daftar = skema.filter(function (s) { return kelompokKunci(s.kunci) === aktif; });
    if (!daftar.length) panel.appendChild(h('div', { class: 'bantu' }, 'Tidak ada pengaturan di kelompok ini.'));
    daftar.forEach(function (s) {
      var kt = kontrol[s.kunci];
      panel.appendChild(h('div', { class: 'medan' }, h('label', null, s.ket), kt.el, bolehUbah ? h('button', { type: 'button', class: 'tautan-merah', style: 'background:none;border:0;padding:4px 0;font-size:12px;cursor:pointer', onclick: function () { resetSatu(s.kunci); } }, 'Kembalikan ke bawaan') : null));
    });
    if (!bolehUbah) $$('input,select,textarea,button', panel).forEach(function (x) { x.disabled = true; });
  }
  var bawaan = null;
  function resetSatu(k) {
    konfirmasi({ judul: 'Kembalikan ke bawaan?', pesan: 'Pengaturan ini akan dikembalikan ke nilai awal dan langsung disimpan.', ya: 'Kembalikan' }).then(function (y) {
      if (!y) return; rpcA('resetPengaturan', [k]).then(function (r) { toast('Dikembalikan ke bawaan.', 'ok'); muatUlangPengaturan(); }, gagalToast);
    });
  }
  function muatUlangPengaturan() { rpcA('getPengaturan').then(function (r) { S.admin.pengaturanSkema = r.data.skema; var p = {}; r.data.skema.forEach(function (s) { p[s.kunci] = s.nilai; }); setelahPengaturanTersimpan(p); halamanAdmin(['admin', 'tampilan']); }, gagalToast); }
  function simpan() {
    var ubah = terubah(); if (!ubah.length) return;
    spinnerTombol(simpanBtn, true, 'Menyimpan…');
    unggahGambarPengaturan(kontrol, ubah.map(function (s) { return s.kunci; })).then(function (nilai) {
      return rpcA('simpanPengaturan', nilai, 'Perubahan tampilan').then(function (r) { return nilai; });
    }).then(function (nilai) {
      spinnerTombol(simpanBtn, false); Object.keys(nilai).forEach(function (k) { asal[k] = String(nilai[k]); });
      setelahPengaturanTersimpan(nilai); tandai(); toast('Pengaturan tampilan disimpan. Situs publik sudah diperbarui.', 'ok');
    }, function (e) { spinnerTombol(simpanBtn, false); gagalToast(e); });
  }
  function riwayat() {
    var t = tabelBerhalaman({ ambil: function (o) { return rpcA('riwayatPengaturan', { halaman: o.halaman }); },
      kolom: [{ k: 'waktu', l: 'Waktu', fmt: function (v) { return tglFmt(v, true); } }, { k: 'label', l: 'Pengaturan' }, { k: 'lama', l: 'Sebelum' }, { k: 'baru', l: 'Sesudah' }, { k: 'uid', l: 'Oleh' }], kosong: { ikon: 'history', judul: 'Belum ada riwayat' } });
    var m = laciSamping({ judul: 'Riwayat Perubahan', ukuran: 'lebar', isi: t.el }); t.muat();
  }
  function resetSemua() {
    konfirmasi({ judul: 'Kembalikan semua tampilan?', pesan: 'Seluruh pengaturan tampilan kembali ke bawaan. Ketik RESET untuk melanjutkan.', ketik: 'RESET', ya: 'Kembalikan semua', bahaya: true }).then(function (y) {
      if (!y) return; rpcA('resetPengaturan', skema.map(function (s) { return s.kunci; })).then(function () { toast('Semua tampilan dikembalikan ke bawaan.', 'ok'); muatUlangPengaturan(); }, gagalToast);
    });
  }
  var pilMode = h('div', { class: 'seg-kecil' }, [['desktop', 'Desktop', 'monitor'], ['hp', 'HP', 'smartphone']].map(function (x) { return h('button', { type: 'button', class: x[0] === mode ? 'aktif' : '', onclick: function () { mode = x[0]; $$('button', pilMode).forEach(function (b, i) { b.classList.toggle('aktif', ['desktop', 'hp'][i] === mode); }); pratinjau.style.maxWidth = mode === 'hp' ? '390px' : 'none'; pratinjau.style.margin = mode === 'hp' ? '0 auto' : '0'; } }, x[1]); }));
  el.appendChild(kepalaAdmin(judul, 'Ubah huruf, warna, ukuran foto, dan tata letak. Pratinjau berubah langsung; klik Simpan agar tampil di situs.', [tombolA('Riwayat', 'garis', riwayat, 'history'), bolehUbah ? tombolA('Kembalikan Semua', 'garis', resetSemua, 'refresh') : null]));
  if (!bolehUbah) el.appendChild(h('div', { class: 'banner-info', style: 'margin-bottom:12px' }, ik('info', 'kecil'), 'Anda hanya dapat melihat pengaturan ini.'));
  el.appendChild(h('div', { class: 'pecah-set' }, h('div', { class: 'kartu-a', style: 'padding:16px' }, tabs, panel),
    h('div', null, h('div', { style: 'display:flex;justify-content:space-between;align-items:center;margin-bottom:8px' }, h('strong', null, 'Pratinjau langsung'), pilMode), h('div', { class: 'kanvas-bingkai', style: 'border:1px solid var(--a-garis,#ddd);border-radius:12px;overflow:hidden;max-height:70vh;overflow-y:auto' }, pratinjau))));
  el.appendChild(bar); gambarPanel();
  (S.pub ? Promise.resolve() : segarkanPublik()).then(gambarPratinjau, gambarPratinjau);
};

/* =====================================================================
   MENU, HALAMAN & TOMBOL (satu halaman, tiga tab)
   ===================================================================== */
ADMIN.menu = function (el, judul) {
  var tab = 'menu', isiEl = h('div'), tabs = h('div', { class: 'tab-garis', role: 'tablist' });
  function gambarTab() {
    kosongkan(tabs); [['menu', 'Menu'], ['halaman', 'Halaman Kustom'], ['tombol', 'Tombol Kustom']].forEach(function (t) { tabs.appendChild(h('button', { type: 'button', role: 'tab', class: tab === t[0] ? 'aktif' : '', 'aria-selected': tab === t[0] ? 'true' : 'false', onclick: function () { tab = t[0]; gambarTab(); } }, t[1])); });
    kosongkan(isiEl);
    if (tab === 'menu') panelMenu(isiEl); else if (tab === 'halaman') panelHalaman(isiEl); else halamanModul(isiEl, 'tombol', S.admin.defModul.tombol, 'Tombol Kustom');
  }
  el.appendChild(kepalaAdmin(judul, 'Atur menu situs & panel, buat halaman baru, dan tambah tombol tanpa menyentuh kode.')); el.appendChild(tabs); el.appendChild(isiEl); gambarTab();
};
function panelMenu(wadah) {
  var area = 'publik', data = null, pohon = h('div'), dirty = false, simpanBtn = tombolA('Simpan Urutan', 'utama', simpanUrutan, 'save'), bolehUbah = boleh('menu', 'Ubah');
  var segArea = h('div', { class: 'seg-kecil' }, [['publik', 'Menu Situs'], ['admin', 'Menu Panel Admin']].map(function (x) { return h('button', { type: 'button', class: x[0] === area ? 'aktif' : '', onclick: function () { area = x[0]; $$('button', segArea).forEach(function (b, i) { b.classList.toggle('aktif', ['publik', 'admin'][i] === area); }); gambar(); } }, x[1]); }));
  function muat() { rpcA('daftarMenu').then(function (r) { data = r.data; gambar(); }, function (e) { kosongkan(pohon); pohon.appendChild(h('div', { class: 'kosong-a' }, ik('alert'), h('h4', null, 'Gagal memuat'), h('div', null, pesanGalat(e)))); }); }
  var daftar = [];
  function gambar() {
    kosongkan(pohon); daftar = data.menu.filter(function (m) { return (m.peran === undefined) || true; }); 
    var semua = data.menu.filter(function (m) { return areaMenu(m) === area; }).sort(function (a, b) { return a.urutan - b.urutan; });
    daftar = semua;
    if (!semua.length) { pohon.appendChild(h('div', { class: 'kosong-a' }, ik('menu'), h('h4', null, 'Belum ada menu'))); return; }
    semua.filter(function (m) { return !m.induk; }).forEach(function (m) { pohon.appendChild(barisMenu(m, 0)); semua.filter(function (c) { return c.induk === m.slug; }).forEach(function (c) { pohon.appendChild(barisMenu(c, 1)); }); });
  }
  function areaMenu(m) { return m.area || (m.tipe === 'Bawaan' && S.admin.defModul[m.target] ? 'admin' : (m._area || 'publik')); }
  function barisMenu(m, lvl) {
    return h('div', { class: 'menu-baris', style: 'padding-left:' + (12 + lvl * 28) + 'px;' + (m.tampil ? '' : 'opacity:.55') },
      h('span', { style: 'flex:1' }, ik(m.ikon || 'circle', 'kecil'), ' ', h('strong', null, m.label), ' ', h('span', { class: 'bantu' }, m.tipe + (m.inti ? ' · inti' : '')), m.tampil ? '' : h('span', { class: 'badge' }, 'disembunyikan')),
      bolehUbah ? [h('button', { type: 'button', class: 'ikon-btn-a', 'aria-label': 'Naik', onclick: function () { geser(m, -1); } }, ik('chevron-up')), h('button', { type: 'button', class: 'ikon-btn-a', 'aria-label': 'Turun', onclick: function () { geser(m, 1); } }, ik('chevron-down')),
        h('button', { type: 'button', class: 'ikon-btn-a', 'aria-label': m.tampil ? 'Sembunyikan' : 'Tampilkan', onclick: function () { rpcA('apiToggle', 'menu', m.id, 'Tampil', m.tampil ? 'Tidak' : 'Ya').then(function () { m.tampil = !m.tampil; segarkanSetelahMenu(); gambar(); }, gagalToast); } }, ik(m.tampil ? 'eye' : 'eye-off')),
        h('button', { type: 'button', class: 'ikon-btn-a', 'aria-label': 'Ubah', onclick: function () { formMenu(m.id); } }, ik('pencil'))] : null,
      boleh('menu', 'Hapus') && !m.inti ? h('button', { type: 'button', class: 'ikon-btn-a bahaya', 'aria-label': 'Hapus', onclick: function () { konfirmasi({ judul: 'Hapus menu?', pesan: '"' + m.label + '" dipindah ke Tong Sampah.', ya: 'Hapus', bahaya: true }).then(function (y) { if (y) rpcA('apiHapus', 'menu', [m.id]).then(function () { toast('Menu dihapus.', 'ok'); segarkanSetelahMenu(); muat(); }, gagalToast); }); } }, ik('trash')) : null);
  }
  function geser(m, arah) {
    var saudara = daftar.filter(function (x) { return (x.induk || '') === (m.induk || ''); }).sort(function (a, b) { return a.urutan - b.urutan; });
    var i = saudara.indexOf(m), j = i + arah; if (j < 0 || j >= saudara.length) return;
    var t = saudara[i].urutan; saudara[i].urutan = saudara[j].urutan; saudara[j].urutan = t; if (saudara[i].urutan === saudara[j].urutan) { saudara[i].urutan = j * 10; saudara[j].urutan = i * 10; }
    rpcA('simpanUrutanMenu', [{ id: saudara[i].id, urutan: saudara[i].urutan, induk: saudara[i].induk }, { id: saudara[j].id, urutan: saudara[j].urutan, induk: saudara[j].induk }]).then(function () { segarkanSetelahMenu(); gambar(); }, gagalToast);
    gambar();
  }
  function segarkanSetelahMenu() { S.pub = null; hapusLokal('awb_pub'); rpcA('bootAdmin').then(function (r) { S.admin.menu = r.data.menu; bangunKerangkaAdmin(); tandaiNavAdmin('menu'); }, function () { }); }
  function simpanUrutan() { }
  function formMenu(id) {
    var def = S.admin.defModul.menu, baru = !id, m, form, simpanB = tombolA('Simpan', 'utama', function () {
      if (!form.validasi()) return; spinnerTombol(simpanB, true, 'Menyimpan…');
      form.kumpulkan('menu').then(function (n) { n.id = id || ''; return rpcA('apiSave', 'menu', n); }).then(function () { m.tutup(); toast('Menu disimpan.', 'ok'); segarkanSetelahMenu(); muat(); }, function (e) { spinnerTombol(simpanB, false); gagalToast(e); });
    });
    m = laciSamping({ judul: baru ? 'Tambah Menu' : 'Ubah Menu', isi: h('div', { class: 'skel', style: 'height:200px' }), tombol: [tombolA('Batal', 'hantu', function () { m.tutup(); }), simpanB] });
    (baru ? Promise.resolve({ data: { Area: area, Tipe: 'Halaman Kustom', Tampil: 'Ya', Urutan: 90 } }) : rpcA('apiGet', 'menu', id)).then(function (r) {
      var nilai = Object.assign({}, r.data, { id: id || '' }); form = bangunForm(def.kolom, nilai); kosongkan(m.badan); m.badan.appendChild(form.el);
      m.badan.insertBefore(h('div', { class: 'banner-info', style: 'margin-bottom:12px' }, ik('info', 'kecil'), 'Jenis "Halaman Kustom": isi Tujuan dengan alamat halaman (slug). "Tautan": isi URL penuh.'), m.badan.firstChild);
    }, gagalToast);
  }
  wadah.appendChild(h('div', { class: 'bar-filter' }, segArea, h('span', { style: 'flex:1' }), bolehUbah || boleh('menu', 'Tambah') ? tombolA('Tambah Menu', 'utama', function () { formMenu(); }, 'plus') : null));
  wadah.appendChild(h('div', { class: 'kartu-a' }, pohon)); muat();
}

/* ----- editor halaman kustom (blok) ----- */
var JENIS_BLOK = [['judul', 'Judul', 'type'], ['teks', 'Teks', 'file'], ['gambar', 'Gambar', 'image'], ['galeri', 'Galeri', 'grid'], ['tombol', 'Tombol', 'square'], ['statistik', 'Angka Statistik', 'chart-column'], ['peta', 'Peta', 'map-pin'], ['video', 'Video YouTube', 'smartphone'], ['daftar_data', 'Daftar Data', 'database']];
function panelHalaman(wadah) {
  var def = S.admin.defModul.halaman, tab = h('div');
  var tabel = tabelBerhalaman({ urut: 'Urutan', ambil: function (o) { return rpcA('apiList', 'halaman', o); },
    kolom: [{ k: 'Judul', l: 'Judul', urut: true }, { k: 'Slug', l: 'Alamat', fmt: function (v) { return h('span', { class: 'mono' }, '#/' + v); } }, { k: 'Tampil', l: 'Terbit', fmt: function (v) { return v === 'Ya' ? h('span', { class: 'badge ok' }, 'Terbit') : h('span', { class: 'badge' }, 'Draf'); } }],
    klik: function (b) { editor(b.id); },
    aksi: function (b) { return [boleh('menu', 'Ubah') ? h('button', { type: 'button', class: 'ikon-btn-a', 'aria-label': 'Ubah', onclick: function () { editor(b.id); } }, ik('pencil')) : null, boleh('menu', 'Hapus') ? h('button', { type: 'button', class: 'ikon-btn-a bahaya', 'aria-label': 'Hapus', onclick: function () { konfirmasi({ judul: 'Hapus halaman?', pesan: '"' + b.Judul + '" dipindah ke Tong Sampah.', ya: 'Hapus', bahaya: true }).then(function (y) { if (y) rpcA('apiHapus', 'halaman', [b.id]).then(function () { S.pub = null; hapusLokal('awb_pub'); tabel.muat(true); toast('Halaman dihapus.', 'ok'); }, gagalToast); }); } }, ik('trash')) : null]; },
    kosong: { ikon: 'file', judul: 'Belum ada halaman kustom', pesan: 'Buat halaman baru, lalu tautkan lewat tab Menu.', cta: boleh('menu', 'Tambah') ? tombolA('Halaman Baru', 'utama', function () { editor(); }, 'plus') : null } });
  wadah.appendChild(h('div', { class: 'bar-filter' }, h('span', { style: 'flex:1' }), boleh('menu', 'Tambah') ? tombolA('Halaman Baru', 'utama', function () { editor(); }, 'plus') : null)); wadah.appendChild(tabel.el); tabel.muat();

  function editor(id) {
    var baru = !id, blok = [], judulI = h('input', { type: 'text', maxlength: 100 }), slugI = h('input', { type: 'text', maxlength: 60 }), tampilCb = h('input', { type: 'checkbox' }), daftarEl = h('div', { class: 'kanvas-blok' }), pratEl = h('div', { class: 'tema kanvas-pratinjau', style: 'padding:16px;min-height:200px' });
    var fJudul = medan('Judul halaman', judulI, { wajib: true }), fSlug = medan('Alamat (slug)', slugI, { wajib: true, bantu: 'Huruf kecil tanpa spasi, contoh: resep. Alamat: #/resep' });
    function render() {
      kosongkan(daftarEl);
      blok.forEach(function (b, i) { daftarEl.appendChild(editorBlok(b, i)); });
      if (!blok.length) daftarEl.appendChild(h('div', { class: 'bantu', style: 'padding:16px;text-align:center' }, 'Belum ada blok. Tambahkan dari tombol di bawah.'));
      prat();
    }
    var prat = debounce(function () { terapkanTema(PP(), pratEl); kosongkan(pratEl); blok.forEach(function (b) { try { pratEl.appendChild(blokKeDom(b, pubData())); } catch (e) { } }); }, 200);
    function editorBlok(b, i) {
      var jenis = JENIS_BLOK.filter(function (x) { return x[0] === b.t; })[0] || [b.t, b.t], isi = h('div'), ubah = function () { prat(); };
      if (b.t === 'judul') { var a = h('input', { type: 'text', maxlength: 150 }); a.value = b.teks || ''; a.addEventListener('input', function () { b.teks = a.value; ubah(); }); isi.appendChild(a); }
      else if (b.t === 'teks') { var ta = h('textarea', { rows: 5, maxlength: 5000 }); ta.value = b.teks || ''; ta.addEventListener('input', function () { b.teks = ta.value; ubah(); }); isi.appendChild(ta); isi.appendChild(h('div', { class: 'bantu' }, 'Mendukung **tebal**, *miring*, daftar "- item", judul "## Judul", dan [teks](tautan).')); }
      else if (b.t === 'gambar') { var zu = zonaUnggah({ accept: 'image/*', label: 'Unggah gambar', sisi: 1600, saatPilih: function (f) { rpcA('unggahBerkas', 'foto_berita', { nama: f.nama, b64: f.b64 }).then(function (r) { b.id = r.data.id; ubah(); toast('Gambar terunggah.', 'ok'); }, gagalToast); } }); if (b.id) zu.setAda(foto(b.id, 400)); var alt = h('input', { type: 'text', placeholder: 'Deskripsi gambar (untuk aksesibilitas)', maxlength: 120 }); alt.value = b.alt || ''; alt.addEventListener('input', function () { b.alt = alt.value; }); isi.appendChild(zu.el); isi.appendChild(alt); }
      else if (b.t === 'galeri') { b.ids = b.ids || []; var gw = h('div', { style: 'display:flex;gap:6px;flex-wrap:wrap;margin-bottom:6px' }); var gg = function () { kosongkan(gw); b.ids.forEach(function (x, k) { gw.appendChild(h('div', { style: 'position:relative' }, h('img', { class: 'thumb', src: foto(x, 120), alt: '' }), h('button', { type: 'button', class: 'ikon-btn-a bahaya', style: 'position:absolute;top:-6px;right:-6px;background:#fff', 'aria-label': 'Hapus foto', onclick: function () { b.ids.splice(k, 1); gg(); ubah(); } }, ik('x', 'kecil')))); }); }; gg(); var zg = zonaUnggah({ accept: 'image/*', label: 'Tambah foto', sisi: 1400, saatPilih: function (f) { rpcA('unggahBerkas', 'foto_berita', { nama: f.nama, b64: f.b64 }).then(function (r) { b.ids.push(r.data.id); gg(); ubah(); zg.reset(); }, gagalToast); } }); isi.appendChild(gw); isi.appendChild(zg.el); }
      else if (b.t === 'tombol') { var l1 = h('input', { type: 'text', placeholder: 'Teks tombol', maxlength: 40 }), l2 = h('input', { type: 'text', placeholder: 'Tujuan: #/produk atau https://…', maxlength: 200 }); l1.value = b.label || ''; l2.value = b.tautan || ''; l1.addEventListener('input', function () { b.label = l1.value; ubah(); }); l2.addEventListener('input', function () { b.tautan = l2.value; ubah(); }); isi.appendChild(h('div', { class: 'dua-kolom' }, l1, l2)); }
      else if (b.t === 'statistik') { b.item = b.item || [{ angka: '', label: '' }]; var sw = h('div'); var sg = function () { kosongkan(sw); b.item.forEach(function (s, k) { var an = h('input', { type: 'text', placeholder: 'Angka (mis. 25+)', maxlength: 20 }), lb = h('input', { type: 'text', placeholder: 'Keterangan', maxlength: 40 }); an.value = s.angka; lb.value = s.label; an.addEventListener('input', function () { s.angka = an.value; ubah(); }); lb.addEventListener('input', function () { s.label = lb.value; ubah(); }); sw.appendChild(h('div', { style: 'display:flex;gap:8px;margin-bottom:6px' }, an, lb, h('button', { type: 'button', class: 'ikon-btn-a bahaya', 'aria-label': 'Hapus', onclick: function () { b.item.splice(k, 1); sg(); ubah(); } }, ik('trash')))); }); }; sg(); isi.appendChild(sw); isi.appendChild(tombolA('Tambah angka', 'hantu kecil', function () { if (b.item.length < 6) { b.item.push({ angka: '', label: '' }); sg(); } }, 'plus')); }
      else if (b.t === 'peta') { var pa = h('input', { type: 'text', placeholder: 'Alamat yang ditampilkan di peta', maxlength: 200 }); pa.value = b.alamat || ''; pa.addEventListener('input', function () { b.alamat = pa.value; ubah(); }); isi.appendChild(pa); }
      else if (b.t === 'video') { var vu = h('input', { type: 'url', placeholder: 'https://www.youtube.com/watch?v=…', maxlength: 200 }); vu.value = b.url || ''; vu.addEventListener('input', function () { b.url = vu.value; ubah(); }); isi.appendChild(vu); }
      else if (b.t === 'daftar_data') { var ss = h('select', null, [['produk', 'Produk'], ['berita', 'Berita'], ['mitra', 'Mitra'], ['toko', 'Lokasi Toko']].concat(S.admin.modulKustom.filter(function (m) { return m.publik; }).map(function (m) { return [m.kunci, m.nama]; })).map(function (x) { return h('option', { value: x[0] }, x[1]); })), jn = h('input', { type: 'number', min: '1', max: '24', style: 'max-width:90px' }); ss.value = b.sumber || 'produk'; b.sumber = ss.value; jn.value = b.jumlah || 4; b.jumlah = Number(jn.value); ss.addEventListener('change', function () { b.sumber = ss.value; ubah(); }); jn.addEventListener('input', function () { b.jumlah = Math.min(24, Math.max(1, Number(jn.value) || 4)); ubah(); }); isi.appendChild(h('div', { style: 'display:flex;gap:8px;align-items:center' }, ss, h('span', null, 'tampilkan'), jn, h('span', null, 'item'))); }
      return h('div', { class: 'blok-edit', style: 'border:1px solid var(--a-garis,#ddd);border-radius:10px;padding:10px;margin-bottom:10px;background:#fff' },
        h('div', { style: 'display:flex;align-items:center;gap:6px;margin-bottom:8px' }, ik(jenis[2] || 'square', 'kecil'), h('strong', { style: 'flex:1' }, jenis[1]),
          h('button', { type: 'button', class: 'ikon-btn-a', disabled: i === 0, 'aria-label': 'Naik', onclick: function () { blok.splice(i - 1, 0, blok.splice(i, 1)[0]); render(); } }, ik('chevron-up')),
          h('button', { type: 'button', class: 'ikon-btn-a', disabled: i === blok.length - 1, 'aria-label': 'Turun', onclick: function () { blok.splice(i + 1, 0, blok.splice(i, 1)[0]); render(); } }, ik('chevron-down')),
          h('button', { type: 'button', class: 'ikon-btn-a bahaya', 'aria-label': 'Hapus blok', onclick: function () { blok.splice(i, 1); render(); } }, ik('trash'))), isi);
    }
    var tambahMenu = h('div', { style: 'display:flex;gap:6px;flex-wrap:wrap;margin:8px 0' }, JENIS_BLOK.map(function (j) { return tombolA(j[1], 'garis kecil', function () { if (blok.length >= 40) { toast('Maksimal 40 blok per halaman.', 'wr'); return; } var b = { t: j[0] }; blok.push(b); render(); }, 'plus'); }));
    var simpanB = tombolA('Simpan Halaman', 'utama', function () {
      fJudul.salah(''); fSlug.salah(''); var ok = true; if (!judulI.value.trim()) { fJudul.salah('Judul wajib diisi.'); ok = false; } if (!/^[a-z0-9][a-z0-9-]{1,59}$/.test(slugI.value.trim())) { fSlug.salah('Gunakan huruf kecil, angka, dan tanda hubung (min. 2 karakter).'); ok = false; } if (!ok) return;
      spinnerTombol(simpanB, true, 'Menyimpan…');
      rpcA('apiSave', 'halaman', { id: id || '', Judul: judulI.value, Slug: slugI.value.trim(), KontenBlok: JSON.stringify(blok), Tampil: tampilCb.checked ? 'Ya' : 'Tidak', Urutan: 0 }).then(function () { m.tutup(); S.pub = null; hapusLokal('awb_pub'); cacheHalaman = {}; toast('Halaman disimpan.', 'ok'); tabel.muat(true); }, function (e) { spinnerTombol(simpanB, false); gagalToast(e); });
    });
    var m = modal({ judul: baru ? 'Halaman Baru' : 'Ubah Halaman', ukuran: 'lebar', tahan: true, isi: h('div', null, h('div', { class: 'skel', style: 'height:100px' })), tombol: [tombolA('Batal', 'hantu', function () { m.tutup(); }), simpanB] });
    (baru ? Promise.resolve({ data: { Tampil: 'Tidak' } }) : rpcA('apiGet', 'halaman', id)).then(function (r) {
      var d = r.data; judulI.value = d.Judul || ''; slugI.value = d.Slug || ''; tampilCb.checked = d.Tampil === 'Ya'; try { blok = typeof d.KontenBlok === 'string' && d.KontenBlok ? JSON.parse(d.KontenBlok) : (Array.isArray(d.KontenBlok) ? d.KontenBlok : []); } catch (e) { blok = []; } if (!Array.isArray(blok)) blok = [];
      kosongkan(m.badan); m.badan.appendChild(h('div', { class: 'editor-halaman' }, h('div', null, fJudul, fSlug, h('label', { class: 'cek', style: 'margin-bottom:10px' }, tampilCb, ' Terbitkan halaman ini'), h('h4', { style: 'margin:12px 0 4px' }, 'Isi halaman'), daftarEl, h('div', { class: 'bantu' }, 'Tambah blok:'), tambahMenu), h('div', null, h('strong', null, 'Pratinjau'), h('div', { style: 'border:1px solid var(--a-garis,#ddd);border-radius:10px;overflow:auto;max-height:60vh;margin-top:6px' }, pratEl)))); render();
    }, gagalToast);
  }
}

/* =====================================================================
   MODUL DATA KUSTOM (pembuat modul)
   ===================================================================== */
ADMIN.modul_kustom = function (el, judul) {
  var wadah = h('div', { class: 'grid-modul' }), tambah = boleh('modul_kustom', 'Tambah');
  function muat() { rpcA('daftarModulKustom').then(function (r) { gambar(r.data); }, function (e) { kosongkan(wadah); wadah.appendChild(h('div', { class: 'kosong-a' }, ik('alert'), h('h4', null, 'Gagal memuat'), h('div', null, pesanGalat(e)))); }); }
  function gambar(list) {
    kosongkan(wadah);
    if (!list.length) { wadah.appendChild(h('div', { class: 'kosong-a', style: 'grid-column:1/-1' }, ik('database'), h('h4', null, 'Belum ada modul data kustom'), h('div', null, 'Buat modul untuk mencatat data apa pun: stok kemasan, pelanggan, kegiatan kebun, dan lainnya.'), tambah ? h('div', { style: 'margin-top:12px' }, tombolA('Buat Modul', 'utama', function () { formModul(); }, 'plus')) : null)); return; }
    list.forEach(function (m) {
      wadah.appendChild(h('div', { class: 'kartu-a', style: 'padding:16px' }, h('div', { style: 'display:flex;gap:10px;align-items:center' }, ik(m.ikon || 'database'), h('div', { style: 'flex:1' }, h('strong', null, m.nama), h('div', { class: 'bantu' }, m.kolom.length + ' kolom' + (m.publik ? ' · tampil di situs' : ''))), statusBadge(m.status === 'Aktif' ? 'Aktif' : 'Nonaktif')),
        h('div', { style: 'display:flex;gap:6px;margin-top:12px;flex-wrap:wrap' }, h('a', { class: 'btn-a garis kecil', href: '#/admin/' + m.kunci }, 'Buka Data'),
          boleh('modul_kustom', 'Ubah') ? tombolA('Ubah Struktur', 'garis kecil', function () { formModul(m); }) : null,
          boleh('modul_kustom', 'Ubah') ? tombolA(m.status === 'Aktif' ? 'Nonaktifkan' : 'Aktifkan', 'hantu kecil', function () { rpcA('aturStatusModulKustom', m.id, m.status === 'Aktif' ? 'Nonaktif' : 'Aktif').then(function () { refreshBoot(); muat(); toast('Status diubah.', 'ok'); }, gagalToast); }) : null,
          boleh('modul_kustom', 'Hapus') ? tombolA('Hapus', 'hantu kecil bahaya', function () { konfirmasi({ judul: 'Hapus modul?', pesan: 'Modul "' + m.nama + '" dipindah ke Tong Sampah. Sheet datanya tetap tersimpan. Ketik nama modul untuk melanjutkan.', ketik: m.nama, ya: 'Hapus modul', bahaya: true }).then(function (y) { if (y) rpcA('hapusModulKustom', m.id).then(function () { refreshBoot(); muat(); toast('Modul dihapus.', 'ok'); }, gagalToast); }); }) : null)));
    });
  }
  function refreshBoot() { rpcA('bootAdmin').then(function (r) { S.admin.menu = r.data.menu; S.admin.modulKustom = r.data.modulKustom; S.admin.izin = r.data.izin; bangunKerangkaAdmin(); tandaiNavAdmin('modul_kustom'); }, function () { }); }
  function formModul(m) {
    var baru = !m, nama = h('input', { type: 'text', maxlength: 60 }), ikon = h('input', { type: 'text', maxlength: 30, placeholder: 'database' }), publik = h('input', { type: 'checkbox' });
    nama.value = m ? m.nama : ''; ikon.value = m ? m.ikon : 'database'; publik.checked = m ? m.publik : false;
    var kolom = m ? m.kolom.map(function (c) { return Object.assign({}, c); }) : [{ l: '', t: 'teks', w: 0 }], daftarEl = h('div'), fN = medan('Nama modul', nama, { wajib: true, bantu: 'Contoh: Catatan Panen, Pelanggan, Peralatan' });
    var TIPE = [['teks', 'Teks pendek'], ['area', 'Teks panjang'], ['angka', 'Angka'], ['uang', 'Rupiah'], ['tanggal', 'Tanggal'], ['pilihan', 'Pilihan (dropdown)'], ['yn', 'Ya / Tidak'], ['email', 'Email'], ['tel', 'Telepon'], ['url', 'Tautan'], ['gambar', 'Gambar'], ['berkas', 'Berkas']];
    function gambarKolom() {
      kosongkan(daftarEl);
      kolom.forEach(function (c, i) {
        var l = h('input', { type: 'text', placeholder: 'Nama kolom', maxlength: 60, 'aria-label': 'Nama kolom ' + (i + 1) }); l.value = c.l || ''; l.addEventListener('input', function () { c.l = l.value; });
        var t = h('select', { 'aria-label': 'Jenis kolom', disabled: !!c.k && !baru && !!m }, TIPE.map(function (x) { return h('option', { value: x[0] }, x[1]); })); t.value = c.t || 'teks'; t.addEventListener('change', function () { c.t = t.value; gambarKolom(); });
        var w = h('input', { type: 'checkbox' }); w.checked = !!c.w; w.addEventListener('change', function () { c.w = w.checked ? 1 : 0; });
        var o = c.t === 'pilihan' ? h('input', { type: 'text', placeholder: 'Opsi dipisah |  contoh: Baik|Rusak', maxlength: 300, style: 'margin-top:6px' }) : null; if (o) { o.value = Array.isArray(c.o) ? c.o.join('|') : (c.o || ''); o.addEventListener('input', function () { c.o = o.value; }); }
        daftarEl.appendChild(h('div', { style: 'border:1px solid var(--a-garis,#ddd);border-radius:8px;padding:8px;margin-bottom:8px' }, h('div', { style: 'display:flex;gap:6px;align-items:center;flex-wrap:wrap' }, l, t, h('label', { class: 'cek' }, w, ' Wajib'),
          h('button', { type: 'button', class: 'ikon-btn-a', disabled: i === 0, 'aria-label': 'Naik', onclick: function () { kolom.splice(i - 1, 0, kolom.splice(i, 1)[0]); gambarKolom(); } }, ik('chevron-up')), h('button', { type: 'button', class: 'ikon-btn-a', disabled: i === kolom.length - 1, 'aria-label': 'Turun', onclick: function () { kolom.splice(i + 1, 0, kolom.splice(i, 1)[0]); gambarKolom(); } }, ik('chevron-down')),
          baru || !c.k ? h('button', { type: 'button', class: 'ikon-btn-a bahaya', 'aria-label': 'Hapus kolom', onclick: function () { kolom.splice(i, 1); gambarKolom(); } }, ik('trash')) : null), o));
      });
    }
    gambarKolom();
    var simpanB = tombolA('Simpan Modul', 'utama', function () {
      fN.salah(''); if (nama.value.trim().length < 2) { fN.salah('Nama modul wajib diisi.'); return; } if (!kolom.length || kolom.some(function (c) { return !String(c.l || '').trim(); })) { toast('Setiap kolom harus punya nama.', 'wr'); return; }
      spinnerTombol(simpanB, true, 'Menyimpan…');
      rpcA('simpanModulKustom', { id: m ? m.id : '', nama: nama.value, ikon: ikon.value, publik: publik.checked, kolom: kolom }).then(function (r) { mm.tutup(); toast(r.message || 'Modul disimpan.', 'ok'); refreshBoot(); muat(); }, function (e) { spinnerTombol(simpanB, false); gagalToast(e); });
    });
    var mm = modal({ judul: baru ? 'Buat Modul Data' : 'Ubah Struktur: ' + m.nama, ukuran: 'lebar', tahan: true, isi: h('div', null, fN, h('div', { class: 'dua-kolom' }, medan('Ikon', ikon, { bantu: 'Nama ikon, contoh: database, users, package' }), h('div', { class: 'medan' }, h('label', null, 'Tampil di situs publik'), h('label', { class: 'cek' }, publik, ' Tampilkan tabel data di situs'))), h('h4', { style: 'margin:12px 0 6px' }, 'Kolom'), baru ? null : h('div', { class: 'bantu' }, 'Kolom lama tidak dapat dihapus agar data tetap aman; Anda bisa menambah kolom baru.'), daftarEl, tombolA('Tambah kolom', 'garis kecil', function () { if (kolom.length < 30) { kolom.push({ l: '', t: 'teks', w: 0 }); gambarKolom(); } }, 'plus')), tombol: [tombolA('Batal', 'hantu', function () { mm.tutup(); }), simpanB] });
  }
  el.appendChild(kepalaAdmin(judul, 'Buat tabel data baru lengkap dengan form, tabel, hak akses, dan menu otomatis.', [tambah ? tombolA('Modul Baru', 'utama', function () { formModul(); }, 'plus') : null])); el.appendChild(wadah); muat();
};

/* =====================================================================
   AKUN TIM
   ===================================================================== */
function tampilkanSandiSementara(nama, sandi) {
  var sembunyi = true, tampil = h('span', { class: 'mono', style: 'font-size:22px;font-weight:700;letter-spacing:1px' }, '••••••••••••');
  var m = modal({ judul: 'Kata Sandi Sementara', ukuran: 'sempit', tahan: true, isi: h('div', { class: 'sandi-kartu' }, h('p', null, 'Berikan kata sandi ini kepada ', h('strong', null, nama), '. Kata sandi ', h('strong', null, 'hanya ditampilkan sekali'), ' dan wajib diganti saat masuk pertama.'), h('div', { class: 'kode-kotak' }, tampil),
    h('div', { style: 'display:flex;gap:8px;justify-content:center;margin-top:10px' }, tombolA('Tampilkan', 'garis kecil', function (e) { sembunyi = !sembunyi; tampil.textContent = sembunyi ? '••••••••••••' : sandi; e.currentTarget.textContent = sembunyi ? 'Tampilkan' : 'Sembunyikan'; }), tombolA('Salin', 'garis kecil', function () { salinTeks(sandi); }, 'copy'))), tombol: [tombolA('Sudah saya catat', 'utama', function () { m.tutup(); })] });
}
ADMIN.akun = function (el, judul) {
  var tambah = boleh('akun', 'Tambah'), ubah = boleh('akun', 'Ubah'), hapus = boleh('akun', 'Hapus'), def = S.admin.defModul.pengguna, cari = h('input', { type: 'search', placeholder: 'Cari nama atau email…', maxlength: 80, 'aria-label': 'Cari' });
  var tabel = tabelBerhalaman({ urut: 'Nama', ambil: function (o) { return rpcA('apiList', 'pengguna', o); },
    kolom: [{ k: 'Nama', l: 'Nama', urut: true, fmt: function (v, b) { return h('span', { style: 'display:flex;align-items:center;gap:8px' }, h('span', { class: 'avatar', style: 'background:' + warnaAvatar(v) + ';width:28px;height:28px;font-size:11px' }, inisial(v)), v, b.Terkunci ? h('span', { class: 'badge er' }, 'Terkunci') : null); } }, { k: 'Email', l: 'Email' }, { k: 'Peran', l: 'Peran', fmt: function (v) { return h('span', { class: 'badge in' }, v); } }, { k: 'Status', l: 'Status', fmt: function (v) { return statusBadge(v); } }, { k: 'LoginTerakhir', l: 'Login terakhir', fmt: function (v) { return v ? relWaktu(v) : 'Belum pernah'; } }],
    klik: ubah ? function (b) { form(b.id); } : null,
    aksi: function (b) { return [ubah ? h('button', { type: 'button', class: 'ikon-btn-a', 'aria-label': 'Ubah', onclick: function () { form(b.id); } }, ik('pencil')) : null, ubah ? h('button', { type: 'button', class: 'ikon-btn-a', 'aria-label': 'Atur ulang kata sandi', onclick: function () { konfirmasi({ judul: 'Atur ulang kata sandi?', pesan: 'Kata sandi sementara baru dibuat untuk ' + b.Nama + ' dan semua sesinya dikeluarkan.', ya: 'Atur ulang' }).then(function (y) { if (y) rpcA('aturUlangSandi', b.id).then(function (r) { tampilkanSandiSementara(b.Nama, r.data.sandiSementara); }, gagalToast); }); } }, ik('key')) : null, ubah && b.Terkunci ? h('button', { type: 'button', class: 'ikon-btn-a', 'aria-label': 'Buka kunci', onclick: function () { rpcA('bukaKunciAkun', b.id).then(function () { toast('Akun dibuka.', 'ok'); tabel.muat(true); }, gagalToast); } }, ik('lock')) : null, hapus ? h('button', { type: 'button', class: 'ikon-btn-a bahaya', 'aria-label': 'Hapus akun', onclick: function () { konfirmasi({ judul: 'Hapus akun?', pesan: 'Akun ' + b.Nama + ' akan dinonaktifkan dan dipindah ke Tong Sampah.', ya: 'Hapus', bahaya: true }).then(function (y) { if (y) rpcA('hapusAkun', b.id).then(function () { toast('Akun dihapus.', 'ok'); tabel.muat(true); }, gagalToast); }); } }, ik('trash')) : null]; },
    kosong: { ikon: 'users', judul: 'Belum ada akun tim' } });
  cari.addEventListener('input', debounce(function () { tabel.set({ cari: cari.value.trim() }); }, 300));
  function form(id) {
    var baru = !id, m, f, simpanB = tombolA('Simpan', 'utama', function () {
      if (!f.validasi()) return; spinnerTombol(simpanB, true, 'Menyimpan…');
      f.kumpulkan('pengguna').then(function (n) { n.id = id || ''; return rpcA('simpanAkun', n); }).then(function (r) { m.tutup(); tabel.muat(true); if (r.data && r.data.sandiSementara) tampilkanSandiSementara(f.nama || 'akun baru', r.data.sandiSementara); else toast('Akun diperbarui.', 'ok'); }, function (e) { spinnerTombol(simpanB, false); gagalToast(e); });
    });
    m = laciSamping({ judul: baru ? 'Tambah Akun Tim' : 'Ubah Akun', isi: h('div', { class: 'skel', style: 'height:160px' }), tombol: [tombolA('Batal', 'hantu', function () { m.tutup(); }), simpanB] });
    (baru ? Promise.resolve({ data: { Status: 'Aktif' } }) : rpcA('apiGet', 'pengguna', id)).then(function (r) { f = bangunForm(def.kolom, Object.assign({}, r.data, { id: id || '' })); f.nama = r.data.Nama; kosongkan(m.badan); if (baru) m.badan.appendChild(h('div', { class: 'banner-info', style: 'margin-bottom:12px' }, ik('info', 'kecil'), 'Kata sandi sementara dibuat otomatis dan ditampilkan sekali setelah disimpan.')); m.badan.appendChild(f.el); }, gagalToast);
  }
  el.appendChild(kepalaAdmin(judul, 'Kelola akun tim. Peran menentukan akses; atur rinciannya di menu Hak Akses.', [tambah ? tombolA('Tambah Akun', 'utama', function () { form(); }, 'plus') : null]));
  el.appendChild(h('div', { class: 'bar-filter' }, h('div', { class: 'cari' }, ik('search', 'kecil'), cari))); el.appendChild(tabel.el); tabel.muat();
};

/* =====================================================================
   HAK AKSES (matriks peran × modul × aksi)
   ===================================================================== */
ADMIN.akses = function (el, judul) {
  var ubah = boleh('akses', 'Ubah'), info = null, peranAktif = '', izinKerja = null, adaUbah = false, isiEl = h('div'), tabsEl = h('div', { class: 'tab-garis', role: 'tablist' });
  var simpanB = tombolA('Simpan Hak Akses', 'utama', simpan, 'save');
  function muat() { rpcA('getMatriksIzin').then(function (r) { info = r.data; if (!peranAktif || !info.peran.some(function (p) { return p.peran === peranAktif; })) peranAktif = info.peran[0].peran; gambar(); }, function (e) { kosongkan(isiEl); isiEl.appendChild(h('div', { class: 'kosong-a' }, ik('alert'), h('h4', null, 'Gagal memuat'), h('div', null, pesanGalat(e)))); }); }
  function gambar() {
    kosongkan(tabsEl); info.peran.forEach(function (p) { tabsEl.appendChild(h('button', { type: 'button', role: 'tab', class: p.peran === peranAktif ? 'aktif' : '', 'aria-selected': p.peran === peranAktif ? 'true' : 'false', onclick: function () { if (adaUbah) { toast('Simpan atau batalkan perubahan peran ini terlebih dahulu.', 'wr'); return; } peranAktif = p.peran; gambar(); } }, p.peran)); });
    if (ubah) tabsEl.appendChild(h('button', { type: 'button', class: 'tambah-peran', onclick: peranBaru }, ik('plus', 'kecil'), ' Peran'));
    kosongkan(isiEl); var sa = peranAktif === 'Super Admin', p = info.peran.filter(function (x) { return x.peran === peranAktif; })[0];
    izinKerja = JSON.parse(JSON.stringify(info.izin[peranAktif] || {})); adaUbah = false; simpanB.disabled = true;
    isiEl.appendChild(h('div', { style: 'display:flex;justify-content:space-between;align-items:center;margin:10px 0;gap:8px;flex-wrap:wrap' }, h('div', null, h('strong', null, peranAktif), ' ', h('span', { class: 'bantu' }, p && p.ket || '')), h('div', { style: 'display:flex;gap:8px' }, ubah && !sa ? simpanB : null, ubah && p && !p.bawaan ? tombolA('Hapus Peran', 'hantu bahaya', hapusPeranIni, 'trash') : null)));
    if (sa) isiEl.appendChild(h('div', { class: 'banner-info', style: 'margin-bottom:10px' }, ik('shield', 'kecil'), 'Super Admin selalu memiliki akses penuh ke seluruh modul dan tidak dapat dikurangi.'));
    var grup = {}; info.modul.forEach(function (m) { (grup[m.grup] = grup[m.grup] || []).push(m); });
    var tbody = h('tbody'); Object.keys(grup).forEach(function (g) {
      tbody.appendChild(h('tr', { class: 'grup' }, h('td', { colspan: 5, style: 'font-weight:700;background:var(--a-latar,#f7f7f7)' }, g)));
      grup[g].forEach(function (m) {
        var v = izinKerja[m.kunci] || [false, false, false, false];
        var cell = function (i) { var c = h('input', { type: 'checkbox', disabled: sa || !ubah, 'aria-label': m.label + ' — ' + ['Lihat', 'Tambah', 'Ubah', 'Hapus'][i] }); c.checked = sa || v[i]; c.addEventListener('change', function () { var arr = izinKerja[m.kunci] || (izinKerja[m.kunci] = [false, false, false, false]); arr[i] = c.checked; if (i > 0 && c.checked) { arr[0] = true; } if (i === 0 && !c.checked) { arr[1] = arr[2] = arr[3] = false; } adaUbah = true; simpanB.disabled = false; ulangBaris(); }); return h('td', { class: 'c' }, c); };
        tbody.appendChild(h('tr', { 'data-m': m.kunci }, h('td', null, m.label), cell(0), cell(1), cell(2), cell(3)));
      });
    });
    function ulangBaris() { $$('tr[data-m]', tbody).forEach(function (tr) { var v = izinKerja[tr.dataset.m] || [false, false, false, false]; $$('input', tr).forEach(function (c, i) { c.checked = !!v[i]; }); }); }
    isiEl.appendChild(h('div', { class: 'kartu-a tbl-wrap' }, h('table', { class: 'tbl matriks' }, h('thead', null, h('tr', null, h('th', null, 'Modul'), ['Lihat', 'Tambah', 'Ubah', 'Hapus'].map(function (x) { return h('th', { class: 'c' }, x); }))), tbody)));
  }
  function simpan() { spinnerTombol(simpanB, true, 'Menyimpan…'); rpcA('simpanIzin', peranAktif, izinKerja).then(function () { spinnerTombol(simpanB, false); info.izin[peranAktif] = JSON.parse(JSON.stringify(izinKerja)); adaUbah = false; simpanB.disabled = true; toast('Hak akses disimpan. Berlaku pada akses berikutnya pengguna.', 'ok'); }, function (e) { spinnerTombol(simpanB, false); gagalToast(e); }); }
  function hapusPeranIni() { konfirmasi({ judul: 'Hapus peran?', pesan: 'Peran "' + peranAktif + '" dihapus. Peran yang masih dipakai akun tidak dapat dihapus.', ya: 'Hapus', bahaya: true }).then(function (y) { if (y) rpcA('hapusPeran', peranAktif).then(function () { toast('Peran dihapus.', 'ok'); peranAktif = ''; muat(); }, gagalToast); }); }
  function peranBaru() {
    var nama = h('input', { type: 'text', maxlength: 40 }), ket = h('input', { type: 'text', maxlength: 120 }), salin = h('select', null, h('option', { value: '' }, '— mulai dari kosong —'), info.peran.map(function (p) { return h('option', { value: p.peran }, p.peran); }));
    var s = tombolA('Buat Peran', 'utama', function () { if (nama.value.trim().length < 2) { toast('Nama peran wajib diisi.', 'wr'); return; } spinnerTombol(s, true, 'Membuat…'); rpcA('tambahPeran', nama.value, ket.value, salin.value).then(function () { m.tutup(); peranAktif = nama.value.trim(); toast('Peran dibuat.', 'ok'); S.admin.daftarPeran.push(peranAktif); muat(); }, function (e) { spinnerTombol(s, false); gagalToast(e); }); });
    var m = modal({ judul: 'Peran Baru', ukuran: 'sempit', isi: h('div', null, medan('Nama peran', nama, { wajib: true }), medan('Keterangan', ket), medan('Salin hak akses dari', salin)), tombol: [tombolA('Batal', 'hantu', function () { m.tutup(); }), s] });
  }
  el.appendChild(kepalaAdmin(judul, 'Tentukan siapa boleh melihat, menambah, mengubah, dan menghapus di tiap modul.')); el.appendChild(tabsEl); el.appendChild(isiEl); muat();
};

/* =====================================================================
   SISTEM (kontak & pembayaran, akses & keamanan, email, cadangan)
   ===================================================================== */
ADMIN.sistem = function (el, judul) {
  var bolehUbah = boleh('sistem', 'Ubah'), tab = 'umum', isiEl = h('div'), tabsEl = h('div', { class: 'tab-garis', role: 'tablist' }), skemaSis = S.admin.pengaturanSkema.filter(function (s) { return s.grup !== 'Tampilan'; });
  var TAB = [['umum', 'Kontak & Pembayaran'], ['keamanan', 'Keamanan & Unggahan'], ['email', 'Email Otomatis'], ['cadangan', 'Cadangan & Info']];
  function gambarTab() { kosongkan(tabsEl); TAB.forEach(function (t) { tabsEl.appendChild(h('button', { type: 'button', role: 'tab', class: tab === t[0] ? 'aktif' : '', 'aria-selected': tab === t[0] ? 'true' : 'false', onclick: function () { tab = t[0]; gambarTab(); } }, t[1])); }); kosongkan(isiEl); if (tab === 'email') panelEmail(isiEl); else if (tab === 'cadangan') panelCadangan(isiEl); else panelPengaturan(isiEl, tab === 'umum' ? ['Sistem', 'Pembayaran'] : ['Akses', 'Email']); }
  function panelPengaturan(wadah, grups) {
    var daftar = skemaSis.filter(function (s) { return grups.indexOf(s.grup) >= 0 && s.kunci !== 'status_pesanan' && s.kunci !== 'email_status_pesanan' || (grups.indexOf('Email') >= 0 && s.kunci === 'email_status_pesanan'); });
    var ctl = {}, asal = {}; var simpanB = tombolA('Simpan', 'utama', function () {
      var ubah = daftar.filter(function (s) { var v = ctl[s.kunci].nilai(); return String(v) !== asal[s.kunci]; }); if (!ubah.length) { toast('Tidak ada perubahan.', 'wr'); return; }
      spinnerTombol(simpanB, true, 'Menyimpan…'); var p = {}; ubah.forEach(function (s) { p[s.kunci] = ctl[s.kunci].nilai(); });
      rpcA('simpanPengaturan', p, 'Pengaturan sistem').then(function () { spinnerTombol(simpanB, false); ubah.forEach(function (s) { asal[s.kunci] = String(p[s.kunci]); }); setelahPengaturanTersimpan(p); toast('Pengaturan disimpan.', 'ok'); }, function (e) { spinnerTombol(simpanB, false); gagalToast(e); });
    });
    var grupLabel = {}; daftar.forEach(function (s) { (grupLabel[s.grup] = grupLabel[s.grup] || []).push(s); });
    Object.keys(grupLabel).forEach(function (g) {
      var kartu = h('div', { class: 'kartu-a', style: 'padding:16px;margin-bottom:14px' }, h('h3', { style: 'margin:0 0 10px;font-size:15px' }, g));
      grupLabel[g].forEach(function (s) { asal[s.kunci] = s.nilai === undefined || s.nilai === null ? '' : String(s.nilai); ctl[s.kunci] = kontrolPengaturan(s, asal[s.kunci]); if (!bolehUbah) setTimeout(function () { $$('input,select,textarea', ctl[s.kunci].el).forEach(function (x) { x.disabled = true; }); }, 0); kartu.appendChild(h('div', { class: 'medan' }, h('label', null, s.ket), ctl[s.kunci].el)); });
      wadah.appendChild(kartu);
    });
    if (grups.indexOf('Pembayaran') >= 0) wadah.appendChild(h('div', { class: 'banner-info', style: 'margin-bottom:12px' }, ik('info', 'kecil'), 'Isi rekening bank di sini agar pembeli tahu ke mana harus transfer. Perubahan langsung tampil di halaman checkout.'));
    if (bolehUbah) wadah.appendChild(simpanB);
  }
  function panelEmail(wadah) {
    var tabelEl = h('div', null, h('div', { class: 'skel', style: 'height:120px' }));
    wadah.appendChild(h('div', { class: 'bantu', style: 'margin-bottom:10px' }, 'Template di bawah dikirim otomatis saat kejadian terjadi. Gunakan {{kode}}, {{nama}}, {{total}} dan variabel lain sesuai template.')); wadah.appendChild(tabelEl);
    function muat() {
      rpcA('daftarTemplate').then(function (r) {
        kosongkan(tabelEl); var d = r.data;
        tabelEl.appendChild(h('div', { style: 'display:flex;justify-content:flex-end;margin-bottom:8px' }, bolehUbah ? tombolA('Template Baru', 'utama kecil', function () { form(null, d); }, 'plus') : null));
        tabelEl.appendChild(h('div', { class: 'kartu-a tbl-wrap' }, h('table', { class: 'tbl kartu-hp' }, h('thead', null, h('tr', null, h('th', null, 'Nama'), h('th', null, 'Pemicu'), h('th', null, 'Penerima'), h('th', null, 'Frekuensi'), h('th', null, 'Aktif'), h('th'))), h('tbody', null, d.template.map(function (t) {
          return h('tr', null, h('td', { 'data-l': 'Nama' }, t.nama), h('td', { 'data-l': 'Pemicu', class: 'mono' }, t.pemicu), h('td', { 'data-l': 'Penerima' }, t.peran || '—'), h('td', { 'data-l': 'Frekuensi' }, t.frekuensi || 'Langsung'), h('td', { 'data-l': 'Aktif' }, t.aktif ? h('span', { class: 'badge ok' }, 'Aktif') : h('span', { class: 'badge' }, 'Mati')),
            h('td', { class: 'aksi' }, bolehUbah ? h('button', { type: 'button', class: 'ikon-btn-a', 'aria-label': 'Ubah', onclick: function () { form(t, d); } }, ik('pencil')) : null, bolehUbah ? h('button', { type: 'button', class: 'ikon-btn-a', 'aria-label': 'Kirim email uji', onclick: function () { rpcA('kirimUjiEmail', t.id).then(function (r) { toast(r.message || 'Email uji dikirim ke akun Anda.', 'ok'); }, gagalToast); } }, ik('send')) : null, bolehUbah ? h('button', { type: 'button', class: 'ikon-btn-a bahaya', 'aria-label': 'Hapus', onclick: function () { konfirmasi({ judul: 'Hapus template?', pesan: '"' + t.nama + '" dihapus permanen.', ya: 'Hapus', bahaya: true }).then(function (y) { if (y) rpcA('hapusTemplate', t.id).then(muat, gagalToast); }); } }, ik('trash')) : null));
        })))));
      }, function (e) { kosongkan(tabelEl); tabelEl.appendChild(h('div', { class: 'kosong-a' }, ik('alert'), h('h4', null, 'Gagal memuat'), h('div', null, pesanGalat(e)))); });
    }
    function form(t, d) {
      var nama = h('input', { type: 'text', maxlength: 80 }), pemicu = h('input', { type: 'text', maxlength: 60, placeholder: 'contoh: pesanan_baru', disabled: !!t }), subjek = h('input', { type: 'text', maxlength: 200 }), isiT = h('textarea', { rows: 8, maxlength: 4000 }), aktif = h('input', { type: 'checkbox' }), frek = h('select', null, ['Langsung', 'Berkala', 'Harian'].map(function (x) { return h('option', { value: x }, x); })), peran = {};
      nama.value = t ? t.nama : ''; pemicu.value = t ? t.pemicu : ''; subjek.value = t ? t.subjek : ''; isiT.value = t ? t.isi : ''; aktif.checked = t ? t.aktif : true; frek.value = t ? (t.frekuensi || 'Langsung') : 'Langsung';
      var pw = h('div', { style: 'display:flex;gap:10px;flex-wrap:wrap' }, d.peran.map(function (p) { var c = h('input', { type: 'checkbox' }); c.checked = t ? String(t.peran || '').split(',').map(function (x) { return x.trim(); }).indexOf(p) >= 0 : false; peran[p] = c; return h('label', { class: 'cek' }, c, ' ' + p); }));
      var s = tombolA('Simpan', 'utama', function () {
        if (!nama.value.trim() || !subjek.value.trim() || !isiT.value.trim()) { toast('Nama, subjek, dan isi wajib diisi.', 'wr'); return; } if (!t && !/^[a-z0-9_]+$/.test(pemicu.value.trim())) { toast('Pemicu hanya huruf kecil, angka, dan _.', 'wr'); return; }
        spinnerTombol(s, true, 'Menyimpan…'); rpcA('simpanTemplate', { id: t ? t.id : '', nama: nama.value, pemicu: pemicu.value.trim(), peran: Object.keys(peran).filter(function (p) { return peran[p].checked; }).join(','), subjek: subjek.value, isi: isiT.value, aktif: aktif.checked, frekuensi: frek.value }).then(function () { m.tutup(); toast('Template disimpan.', 'ok'); muat(); }, function (e) { spinnerTombol(s, false); gagalToast(e); });
      });
      var m = modal({ judul: t ? 'Ubah Template' : 'Template Baru', ukuran: 'lebar', tahan: true, isi: h('div', null, medan('Nama', nama, { wajib: true }), medan('Pemicu', pemicu, { bantu: d.pemicuKustom.length ? 'Pemicu modul kustom: ' + d.pemicuKustom.join(', ') : '' }), medan('Subjek', subjek, { wajib: true }), medan('Isi email', isiT, { wajib: true }), h('div', { class: 'medan' }, h('label', null, 'Kirim ke peran'), pw), h('div', { class: 'dua-kolom' }, medan('Frekuensi', frek, { bantu: 'Berkala/Harian digabung agar hemat kuota email.' }), h('div', { class: 'medan' }, h('label', null, 'Status'), h('label', { class: 'cek' }, aktif, ' Aktif')))), tombol: [tombolA('Batal', 'hantu', function () { m.tutup(); }), s] });
    }
    muat();
  }
  function panelCadangan(wadah) {
    var inf = h('div', { class: 'kartu-a', style: 'padding:16px;margin-bottom:14px' }, h('div', { class: 'skel', style: 'height:70px' })), cad = h('div', { class: 'kartu-a', style: 'padding:16px' }, h('div', { class: 'skel', style: 'height:70px' }));
    wadah.appendChild(inf); wadah.appendChild(cad);
    rpcA('infoSistem').then(function (r) { var d = r.data; kosongkan(inf); inf.appendChild(h('h3', { style: 'margin:0 0 10px;font-size:15px' }, 'Info Sistem')); [['Versi aplikasi', d.versi], ['Sisa kuota email hari ini', d.kuotaSisa + ' dari ' + d.kuotaTotal], ['Email menunggu', d.menunggu], ['Email gagal', d.gagal]].forEach(function (x) { inf.appendChild(h('div', { style: 'display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--a-garis,#eee)' }, h('span', { class: 'bantu' }, x[0]), h('strong', null, String(x[1])))); }); if (d.urlSheet) inf.appendChild(h('div', { style: 'margin-top:10px' }, h('a', { class: 'btn-a garis kecil', href: d.urlSheet, target: '_blank', rel: 'noopener noreferrer' }, ik('external-link', 'kecil'), 'Buka Database (Google Sheets)'))); }, function (e) { kosongkan(inf); inf.appendChild(h('div', { class: 'bantu' }, pesanGalat(e))); });
    function muatCad() { rpcA('daftarCadangan').then(function (r) { kosongkan(cad); cad.appendChild(h('div', { style: 'display:flex;justify-content:space-between;align-items:center;margin-bottom:8px' }, h('h3', { style: 'margin:0;font-size:15px' }, 'Cadangan di Google Drive'), bolehUbah ? tombolA('Cadangkan Sekarang', 'utama kecil', function (e) { var b = e.currentTarget; spinnerTombol(b, true, 'Mencadangkan…'); rpcA('cadangkanSekarang').then(function (rr) { spinnerTombol(b, false); toast(rr.message || 'Cadangan dibuat.', 'ok'); muatCad(); }, function (er) { spinnerTombol(b, false); gagalToast(er); }); }, 'database') : null));
      cad.appendChild(r.data.length ? h('table', { class: 'tbl kartu-hp' }, h('tbody', null, r.data.map(function (c) { return h('tr', null, h('td', null, c.nama), h('td', { class: 'bantu' }, c.waktu), h('td', { class: 'aksi' }, h('a', { class: 'btn-a hantu kecil', href: c.url, target: '_blank', rel: 'noopener noreferrer' }, 'Buka'))); }))) : h('div', { class: 'bantu' }, 'Belum ada cadangan. Cadangan otomatis dibuat setiap minggu (8 terakhir disimpan).')); }, function (e) { kosongkan(cad); cad.appendChild(h('div', { class: 'bantu' }, pesanGalat(e))); }); }
    muatCad();
  }
  el.appendChild(kepalaAdmin(judul, 'Kontak, rekening pembayaran, keamanan, email otomatis, dan cadangan.')); el.appendChild(tabsEl); el.appendChild(isiEl); gambarTab();
};

/* =====================================================================
   LOG AKTIVITAS & TONG SAMPAH
   ===================================================================== */
ADMIN.log = function (el, judul) {
  var tab = boleh('log', 'Lihat') ? 'log' : 'sampah', tabsEl = h('div', { class: 'tab-garis', role: 'tablist' }), isiEl = h('div');
  function gambarTab() { kosongkan(tabsEl); [['log', 'Log Aktivitas', boleh('log', 'Lihat')], ['sampah', 'Tong Sampah', boleh('sampah', 'Lihat')]].forEach(function (t) { if (!t[2]) return; tabsEl.appendChild(h('button', { type: 'button', role: 'tab', class: tab === t[0] ? 'aktif' : '', 'aria-selected': tab === t[0] ? 'true' : 'false', onclick: function () { tab = t[0]; gambarTab(); } }, t[1])); }); kosongkan(isiEl); if (tab === 'log') panelLog(isiEl); else panelSampah(isiEl); }
  function panelLog(w) {
    var cari = h('input', { type: 'search', placeholder: 'Cari keterangan, ID…', maxlength: 60, 'aria-label': 'Cari log' }), aksiS = h('select', { 'aria-label': 'Aksi' }, h('option', { value: '' }, 'Semua aksi'), ['LOGIN', 'LOGOUT', 'TAMBAH', 'UBAH', 'HAPUS', 'PULIHKAN', 'UBAH_STATUS', 'UBAH_IZIN', 'EKSPOR', 'UNGGAH', 'UNDUH', 'CADANGAN'].map(function (a) { return h('option', { value: a }, a); }));
    var t = tabelBerhalaman({ ambil: function (o) { return rpcA('daftarLog', { halaman: o.halaman, cari: o.cari, aksi: aksiS.value }); }, kolom: [{ k: 'waktu', l: 'Waktu', fmt: function (v) { return tglFmt(v, true); } }, { k: 'uid', l: 'Pengguna' }, { k: 'peran', l: 'Peran' }, { k: 'aksi', l: 'Aksi', fmt: function (v) { return h('span', { class: 'badge' }, v); } }, { k: 'modul', l: 'Modul' }, { k: 'ket', l: 'Keterangan' }], kosong: { ikon: 'history', judul: 'Belum ada aktivitas' } });
    cari.addEventListener('input', debounce(function () { t.set({ cari: cari.value.trim() }); }, 300)); aksiS.addEventListener('change', function () { t.set({}); });
    w.appendChild(h('div', { class: 'bar-filter' }, h('div', { class: 'cari' }, ik('search', 'kecil'), cari), aksiS)); w.appendChild(t.el); t.muat();
  }
  function panelSampah(w) {
    var cont = h('div'); w.appendChild(cont);
    function muat() {
      kosongkan(cont); cont.appendChild(h('div', { class: 'skel', style: 'height:120px' }));
      rpcA('daftarSampah').then(function (r) {
        kosongkan(cont); if (!r.data.length) { cont.appendChild(h('div', { class: 'kosong-a' }, ik('trash'), h('h4', null, 'Tong sampah kosong'), h('div', null, 'Data yang dihapus muncul di sini dan bisa dipulihkan.'))); return; }
        cont.appendChild(h('div', { class: 'kartu-a tbl-wrap' }, h('table', { class: 'tbl kartu-hp' }, h('thead', null, h('tr', null, h('th', null, 'Jenis'), h('th', null, 'Nama'), h('th', null, 'Dihapus'), h('th'))), h('tbody', null, r.data.map(function (x) {
          return h('tr', null, h('td', { 'data-l': 'Jenis' }, x.jenis), h('td', { 'data-l': 'Nama' }, x.nama), h('td', { 'data-l': 'Dihapus', class: 'bantu' }, x.waktu ? relWaktu(x.waktu) : ''), h('td', { class: 'aksi' }, boleh('sampah', 'Ubah') ? tombolA('Pulihkan', 'garis kecil', function () { rpcA('pulihkanData', x.modul, x.id).then(function () { toast('Data dipulihkan.', 'ok'); S.pub = null; hapusLokal('awb_pub'); muat(); }, gagalToast); }, 'refresh') : null,
            boleh('sampah', 'Hapus') ? tombolA('Hapus Permanen', 'hantu kecil bahaya', function () { konfirmasi({ judul: 'Hapus permanen?', pesan: '"' + x.nama + '" akan dihapus selamanya dan tidak bisa dipulihkan. Ketik HAPUS untuk melanjutkan.', ketik: 'HAPUS', ya: 'Hapus permanen', bahaya: true }).then(function (y) { if (y) rpcA('hapusPermanenData', x.modul, x.id, 'HAPUS').then(function () { toast('Dihapus permanen.', 'ok'); muat(); }, gagalToast); }); }) : null));
        })))));
      }, function (e) { kosongkan(cont); cont.appendChild(h('div', { class: 'kosong-a' }, ik('alert'), h('h4', null, 'Gagal memuat'), h('div', null, pesanGalat(e)))); });
    }
    muat();
  }
  el.appendChild(kepalaAdmin(judul, 'Jejak aktivitas tim dan data yang dihapus.')); el.appendChild(tabsEl); el.appendChild(isiEl); gambarTab();
};


/* =====================================================================
   ROUTER & BOOT
   ===================================================================== */
function tampilkanView(nama) {
  S.aktif = nama;
  $('#v-publik').hidden = nama !== 'publik'; $('#v-login').hidden = nama !== 'login'; $('#v-admin').hidden = nama !== 'admin';
  document.body.classList.toggle('mode-admin', nama === 'admin');
}
function renderPublikPenuh() { var P = PP(); terapkanTema(P, $('#v-publik')); renderNav(); renderFooter(); renderTombolMelayang(); perbaruiLencanaKeranjang(); }
function perbaruiNavSolid() {
  var nav = $('#nav'); if (!nav) return; var beranda = S.rute === '/' || S.rute === '' || S.rute === '/#';
  nav.classList.toggle('solid', !beranda || window.scrollY > 40);
  $('#btn-naik').classList.toggle('tampil', window.scrollY > 500);
}
function skeletonHalaman() {
  var el = $('#halaman'); kosongkan(el);
  el.appendChild(h('div', { class: 'bagian krem', style: 'padding-top:120px' }, h('div', { class: 'wadah' }, h('div', { class: 'skel', style: 'height:44px;width:40%;margin-bottom:20px' }), h('div', { class: 'grid-produk' }, skeletonKartu(4)))));
}
function halamanGalatMuat(pesan) {
  var el = $('#halaman'); kosongkan(el);
  el.appendChild(h('div', { class: 'bagian krem', style: 'padding-top:140px' }, h('div', { class: 'wadah' }, kosongPublik('alert', 'Situs belum dapat dimuat', pesan || 'Periksa koneksi internet Anda.', h('button', { class: 'btn btn-utama', onclick: function () { mulaiPublik(); } }, 'Coba Lagi')))));
}
function renderHalamanPublik(bag) {
  var el = $('#halaman'); kosongkan(el); var D = pubData();
  var kunci = bag[0] || 'beranda', P = PP();
  if (P.pemeliharaan === 'Ya' && !S.token) { layarPemeliharaan(); return; }
  document.title = P.identitas_nama || 'PT. AGRI WANGI BERRY';
  var terpasang = S.pub ? D.halaman.some(function (x) { return x.slug === kunci; }) : false;
  if (HALAMAN[kunci] && !terpasang) HALAMAN[kunci](el, bag);
  else if (terpasang) halamanKustom(el, kunci);
  else if (S.pub) halaman404(el);
  perbaruiMiniKeranjang(); renderNav();
}
function ruteSekarang() {
  var hash = location.hash.replace(/^#/, '') || '/'; S.rute = hash;
  var bag = hash.replace(/^\//, '').split('/').map(function (x) { return decodeURIComponent(x); });
  if (bag[0] === 'admin') { if (!S.token) { location.replace('#/masuk'); return; } tampilkanView('admin'); masukAdmin(bag); return; }
  if (bag[0] === 'masuk') {
    if (S.token) { location.replace('#/admin'); return; }
    tampilkanView('login'); tampilLogin(); return;
  }
  bersihkanGrafik();
  tampilkanView('publik'); perbaruiNavSolid(); window.scrollTo(0, 0);
  if (!S.pub) { renderPublikPenuh(); skeletonHalaman(); if (!S.memuatPub) { S.memuatPub = true; mulaiPublik(); } return; }
  renderHalamanPublik(bag); perbaruiNavSolid(); $('#halaman').focus({ preventScroll: true });
}
function masukAdmin(bag) {
  if (S.admin) { halamanAdmin(bag); return; }
  var el = $('#admin-isi'); kosongkan(el); el.appendChild(h('div', { class: 'skel', style: 'height:44px;width:40%;margin-bottom:16px' })); el.appendChild(h('div', { class: 'skel', style: 'height:200px' }));
  var tok = S.token;
  rpc('bootAdmin', tok).then(function (r) {
    if (tok !== S.token) return; S.admin = r.data; S.user = r.data.user; bangunKerangkaAdmin();
    if (!window.location.hash.startsWith('#/admin')) return;
    if (r.data.sandiSementara) { dialogGantiSandi(true); }
    halamanAdmin(S.rute.replace(/^\//, '').split('/'));
  }, function (e) { if (e && e.kode === 'SESI_HABIS') return; kosongkan(el); el.appendChild(h('div', { class: 'kosong-a' }, ik('alert'), h('h4', null, 'Gagal membuka panel'), h('div', null, pesanGalat(e)), h('div', { style: 'margin-top:12px;display:flex;gap:8px;justify-content:center' }, tombolA('Coba Lagi', 'utama', function () { masukAdmin(bag); }), tombolA('Keluar', 'garis', keluar)))); });
}
function mulaiPublik() {
  segarkanPublik().then(function (berubah) {
    S.memuatPub = false;
    renderPublikPenuh(); if (S.aktif === 'publik' && (berubah || !$('#halaman').children.length || $('#halaman .skel'))) ruteSekarang();
  }, function (e) { S.memuatPub = false; if (!S.pub) { renderPublikPenuh(); halamanGalatMuat(pesanGalat(e)); } });
}

function inisialisasi() {
  $('#ik-keranjang').replaceWith(ik('cart')); $('#ik-hamburger').replaceWith(ik('menu')); $('#ik-tutup-laci').replaceWith(ik('x')); $('#ik-naik').replaceWith(ik('chevron-up'));
  muatKeranjang(); muatPublikLokal(); muatSesi();
  $('#btn-hamburger').addEventListener('click', function () { $('#laci').classList.add('buka'); });
  $('#btn-tutup-laci').addEventListener('click', function () { $('#laci').classList.remove('buka'); });
  $('#btn-naik').addEventListener('click', function () { window.scrollTo({ top: 0, behavior: 'smooth' }); });
  window.addEventListener('scroll', debounce(function () { if (S.aktif === 'publik') perbaruiNavSolid(); }, 40), { passive: true });
  window.addEventListener('hashchange', ruteSekarang);
  /* Tautan internal (#/...) ditangani di dalam bingkai: tidak boleh membuka/mengarahkan jendela induk */
  document.addEventListener('click', function (e) {
    var a = e.target && e.target.closest ? e.target.closest('a[href]') : null;
    if (!a || e.defaultPrevented || e.button || e.ctrlKey || e.metaKey || e.shiftKey) return;
    var href = a.getAttribute('href') || '';
    if (href.charAt(0) !== '#') return;
    e.preventDefault();
    if (href === '#' || href === '') return;
    if (location.hash === href) ruteSekarang(); else location.hash = href;
  });
  window.addEventListener('storage', function (e) { if (e.key === 'awb_keranjang') { muatKeranjang(); perbaruiLencanaKeranjang(); perbaruiMiniKeranjang(); } if (e.key === 'awb_sesi' && !e.newValue && S.token) { hapusSesi(); location.hash = '#/masuk'; } });
  var prm = (window.AWAL && window.AWAL.param) || {};
  if (prm.rute && !location.hash) location.hash = '#/' + prm.rute.replace(/^#?\/?/, '');
  else if (prm.lacak && !location.hash) location.hash = '#/lacak';
  if (S.pub) renderPublikPenuh();
  ruteSekarang();
  mulaiPublik();
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', inisialisasi); else inisialisasi();
})();
