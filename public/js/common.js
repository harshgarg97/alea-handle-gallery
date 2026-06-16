/* ALEA Handle Gallery Pro — shared client helpers */
(function () {
  'use strict';

  /* ---------- Theme ---------- */
  const THEME_KEY = 'alea-theme';
  function applyTheme(t) {
    document.documentElement.setAttribute('data-theme', t);
    const btns = document.querySelectorAll('[data-theme-toggle]');
    btns.forEach((b) => { b.innerHTML = t === 'dark' ? ICONS.sun : ICONS.moon; });
  }
  function initTheme() {
    let t = localStorage.getItem(THEME_KEY);
    if (!t) t = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    applyTheme(t);
  }
  function toggleTheme() {
    const cur = document.documentElement.getAttribute('data-theme') || 'light';
    const next = cur === 'dark' ? 'light' : 'dark';
    localStorage.setItem(THEME_KEY, next);
    applyTheme(next);
  }

  /* ---------- Icons ---------- */
  const ICONS = {
    moon: '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>',
    sun: '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>',
    search: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>',
    images: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>',
    zoom: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>',
  };

  /* ---------- Header ---------- */
  function buildHeader(active) {
    const authed = window.__ALEA_USER__;
    const adminLinks = authed
      ? `<a href="/dashboard" class="${active === 'dashboard' ? 'active' : ''}">Dashboard</a>
         <a href="/upload" class="${active === 'upload' ? 'active' : ''}">Upload</a>
         <button class="linkish" data-logout>Logout</button>`
      : `<a href="/login" class="${active === 'login' ? 'active' : ''}">Admin</a>`;
    return `
    <header class="site-header">
      <div class="container">
        <a href="/" class="brand">
          <div class="brand-mark">A</div>
          <div class="brand-text"><b>ALEA</b><span>Handle Gallery</span></div>
        </a>
        <nav class="nav">
          <a href="/" class="${active === 'gallery' ? 'active' : ''}">Gallery</a>
          ${adminLinks}
          <button class="icon-btn" data-theme-toggle title="Toggle theme"></button>
        </nav>
      </div>
    </header>`;
  }

  function mountHeader(active) {
    const slot = document.getElementById('header-slot');
    if (slot) slot.innerHTML = buildHeader(active);
    applyTheme(document.documentElement.getAttribute('data-theme') || 'light');
    document.querySelectorAll('[data-theme-toggle]').forEach((b) => b.addEventListener('click', toggleTheme));
    document.querySelectorAll('[data-logout]').forEach((b) =>
      b.addEventListener('click', async () => { await api('/api/auth/logout', { method: 'POST' }); location.href = '/'; })
    );
  }

  /* ---------- API ---------- */
  async function api(url, opts = {}) {
    const res = await fetch(url, {
      headers: opts.body && !(opts.body instanceof FormData) ? { 'Content-Type': 'application/json' } : {},
      ...opts,
    });
    let data = null;
    const ct = res.headers.get('content-type') || '';
    if (ct.includes('application/json')) data = await res.json();
    if (!res.ok) throw Object.assign(new Error((data && data.error) || res.statusText), { status: res.status, data });
    return data;
  }

  async function fetchMe() {
    try { const r = await api('/api/auth/me'); window.__ALEA_USER__ = r.user; return r.user; }
    catch { window.__ALEA_USER__ = null; return null; }
  }

  /* ---------- Toast ---------- */
  function toast(msg, type = 'success') {
    let wrap = document.querySelector('.toast-wrap');
    if (!wrap) { wrap = document.createElement('div'); wrap.className = 'toast-wrap'; document.body.appendChild(wrap); }
    const el = document.createElement('div');
    el.className = 'toast ' + type;
    el.textContent = msg;
    wrap.appendChild(el);
    setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity .3s'; setTimeout(() => el.remove(), 320); }, 2800);
  }

  /* ---------- utils ---------- */
  const debounce = (fn, ms = 280) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const imgUrl = (rel) => rel ? '/uploads/' + rel : '/static/img/placeholder.svg';
  function fmtDate(s) { if (!s) return ''; const d = new Date(s.replace(' ', 'T') + 'Z'); return isNaN(d) ? s : d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }); }

  initTheme();
  window.ALEA = { api, fetchMe, mountHeader, toast, debounce, esc, imgUrl, fmtDate, ICONS, toggleTheme };
})();
