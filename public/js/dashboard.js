/* Dashboard logic: stats, recent uploads, category breakdown, quick search */
(function () {
  'use strict';
  const { api, fetchMe, mountHeader, debounce, esc, imgUrl, fmtDate, ICONS } = window.ALEA;
  document.getElementById('yr').textContent = new Date().getFullYear();
  document.getElementById('searchIcon').innerHTML = ICONS.search;

  const statIco = '<svg class="ico" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="18" height="18" rx="3"/></svg>';

  function renderStats(t) {
    const cards = [
      { label: 'Total Products', value: t.products },
      { label: 'Categories', value: t.categories },
      { label: 'Total Images', value: t.images },
      { label: 'Distinct Finishes', value: t.finishes },
    ];
    document.getElementById('stats').innerHTML = cards.map((c) =>
      `<div class="stat-card">${statIco}<div class="label">${c.label}</div><div class="value">${c.value}</div></div>`).join('');
  }

  function renderRecent(items) {
    const el = document.getElementById('recent');
    if (!items.length) { el.innerHTML = '<p class="muted">No products yet. Upload a ZIP to begin.</p>'; return; }
    el.innerHTML = items.map((p) => `
      <a class="recent-item" href="/product/${p.id}">
        <img src="${imgUrl(p.main_thumb)}" alt="" onerror="this.src='/static/img/placeholder.svg'"/>
        <div class="info">
          <b>${esc(p.name)}</b>
          <small>${p.model_number ? esc(p.model_number) + ' · ' : ''}${esc(p.finish || p.category || '')} · ${fmtDate(p.upload_date)}</small>
        </div>
      </a>`).join('');
  }

  function renderByCategory(rows) {
    const el = document.getElementById('byCategory');
    const max = Math.max(1, ...rows.map((r) => r.count));
    el.innerHTML = rows.length ? rows.map((r) => `
      <div class="bar-row">
        <span class="name" title="${esc(r.category)}">${esc(r.category)}</span>
        <span class="bar-track"><span class="bar-fill" style="width:${(r.count / max * 100).toFixed(0)}%"></span></span>
        <span class="num">${r.count}</span>
      </div>`).join('') : '<p class="muted">No categories.</p>';
  }

  function renderHistory(rows) {
    const el = document.getElementById('history');
    if (!rows.length) { el.innerHTML = '<tr><td class="muted">No imports yet.</td></tr>'; return; }
    el.innerHTML = `<thead><tr><th>File</th><th>Products</th><th>Images</th><th>Status</th><th>When</th></tr></thead><tbody>` +
      rows.map((r) => `<tr>
        <td>${esc(r.filename || '—')}</td>
        <td>${r.products_created}</td>
        <td>${r.images_added}</td>
        <td><span class="tag ${r.status === 'completed' ? 'ok' : 'err'}">${esc(r.status)}</span></td>
        <td>${fmtDate(r.created_at)}</td>
      </tr>`).join('') + `</tbody>`;
  }

  async function loadStats() {
    const s = await api('/api/stats');
    renderStats(s.totals);
    renderRecent(s.recent);
    renderByCategory(s.byCategory);
    renderHistory(s.uploads);
  }

  const sr = document.getElementById('searchResults');
  const doSearch = debounce(async (q) => {
    if (!q.trim()) { sr.innerHTML = ''; return; }
    const data = await api('/api/products?limit=8&search=' + encodeURIComponent(q));
    sr.innerHTML = data.products.map((p) => `
      <a class="card" href="/product/${p.id}">
        <div class="card-media"><img loading="lazy" src="${imgUrl(p.main_thumb)}" alt="" onerror="this.src='/static/img/placeholder.svg'"/></div>
        <div class="card-body"><span class="card-model">${esc(p.model_number || '')}</span><span class="card-name">${esc(p.name)}</span></div>
      </a>`).join('') || '<p class="muted">No matches.</p>';
  }, 250);
  document.getElementById('quickSearch').addEventListener('input', (e) => doSearch(e.target.value));

  (async () => {
    const me = await fetchMe();
    if (!me) { location.href = '/login'; return; }
    mountHeader('dashboard');
    await loadStats();
  })();
})();
