/* Gallery page logic: live search, filters, pagination, lazy loading */
(function () {
  'use strict';
  const { api, fetchMe, mountHeader, debounce, esc, imgUrl, ICONS } = window.ALEA;

  const els = {
    grid: document.getElementById('grid'),
    empty: document.getElementById('emptyState'),
    count: document.getElementById('count'),
    pagination: document.getElementById('pagination'),
    search: document.getElementById('search'),
    fCategory: document.getElementById('f-category'),
    fFinish: document.getElementById('f-finish'),
    fSize: document.getElementById('f-size'),
    fSort: document.getElementById('f-sort'),
    clearBtn: document.getElementById('clearBtn'),
  };
  document.getElementById('searchIcon').innerHTML = ICONS.search;
  document.getElementById('yr').textContent = new Date().getFullYear();

  const state = { page: 1, limit: 24 };

  function fillSelect(sel, items, label) {
    const cur = sel.value;
    sel.innerHTML = `<option value="">${label}</option>` +
      items.map((i) => `<option value="${esc(i)}">${esc(i)}</option>`).join('');
    sel.value = cur;
  }

  async function loadFilters() {
    try {
      const f = await api('/api/products/filters');
      fillSelect(els.fCategory, f.categories, 'All Categories');
      fillSelect(els.fFinish, f.finishes, 'All Finishes');
      fillSelect(els.fSize, f.sizes, 'All Sizes');
    } catch (e) { /* ignore */ }
  }

  function queryString() {
    const p = new URLSearchParams();
    if (els.search.value.trim()) p.set('search', els.search.value.trim());
    if (els.fCategory.value) p.set('category', els.fCategory.value);
    if (els.fFinish.value) p.set('finish', els.fFinish.value);
    if (els.fSize.value) p.set('size', els.fSize.value);
    if (els.fSort.value) p.set('sort', els.fSort.value);
    p.set('page', state.page);
    p.set('limit', state.limit);
    return p.toString();
  }

  function cardHTML(p) {
    return `
      <a class="card" href="/product/${p.id}">
        <div class="card-media">
          ${p.model_number ? `<span class="card-badge">${esc(p.model_number)}</span>` : ''}
          <img loading="lazy" src="${imgUrl(p.main_thumb || p.main_image)}" alt="${esc(p.name)}"
               onerror="this.src='/static/img/placeholder.svg'"/>
          ${p.image_count > 1 ? `<span class="card-imgcount">${ICONS.images} ${p.image_count}</span>` : ''}
        </div>
        <div class="card-body">
          ${p.model_number ? `<span class="card-model">${esc(p.model_number)}</span>` : ''}
          <span class="card-name">${esc(p.name)}</span>
          <div class="card-meta">
            ${p.finish ? `<span class="chip">${esc(p.finish)}</span>` : ''}
            ${p.size ? `<span class="chip">${esc(p.size)}</span>` : ''}
          </div>
        </div>
      </a>`;
  }

  function renderPagination(pg) {
    if (pg.pages <= 1) { els.pagination.innerHTML = ''; return; }
    const cur = pg.page;
    let html = `<button ${cur === 1 ? 'disabled' : ''} data-page="${cur - 1}">‹ Prev</button>`;
    const windowSize = 2;
    const pages = [];
    for (let i = 1; i <= pg.pages; i++) {
      if (i === 1 || i === pg.pages || (i >= cur - windowSize && i <= cur + windowSize)) pages.push(i);
      else if (pages[pages.length - 1] !== '…') pages.push('…');
    }
    html += pages.map((i) => i === '…'
      ? `<button disabled>…</button>`
      : `<button class="${i === cur ? 'active' : ''}" data-page="${i}">${i}</button>`).join('');
    html += `<button ${cur === pg.pages ? 'disabled' : ''} data-page="${cur + 1}">Next ›</button>`;
    els.pagination.innerHTML = html;
    els.pagination.querySelectorAll('button[data-page]').forEach((b) =>
      b.addEventListener('click', () => { state.page = parseInt(b.dataset.page, 10); load(); window.scrollTo({ top: 0, behavior: 'smooth' }); }));
  }

  function showSkeletons() {
    els.grid.innerHTML = Array.from({ length: 8 }).map(() =>
      `<div class="card"><div class="card-media skeleton"></div><div class="card-body"><div class="skeleton" style="height:12px;width:40%;border-radius:4px"></div><div class="skeleton" style="height:16px;width:80%;border-radius:4px;margin-top:6px"></div></div></div>`).join('');
  }

  async function load() {
    const anyFilter = els.search.value || els.fCategory.value || els.fFinish.value || els.fSize.value;
    els.clearBtn.style.display = anyFilter ? '' : 'none';
    if (state.page === 1) showSkeletons();
    try {
      const data = await api('/api/products?' + queryString());
      const { products, pagination } = data;
      els.count.textContent = pagination.total === 0
        ? 'No products found' : `${pagination.total} product${pagination.total === 1 ? '' : 's'}`;
      if (products.length === 0) {
        els.grid.innerHTML = '';
        els.empty.innerHTML = `<div class="state"><h3>No matching handles</h3><p>Try a different search term or clear the filters.</p></div>`;
      } else {
        els.empty.innerHTML = '';
        els.grid.innerHTML = products.map(cardHTML).join('');
      }
      renderPagination(pagination);
    } catch (e) {
      els.grid.innerHTML = '';
      els.empty.innerHTML = `<div class="state"><h3>Could not load catalogue</h3><p>${esc(e.message)}</p></div>`;
    }
  }

  const reload = () => { state.page = 1; load(); };
  els.search.addEventListener('input', debounce(reload, 250));
  [els.fCategory, els.fFinish, els.fSize, els.fSort].forEach((s) => s.addEventListener('change', reload));
  els.clearBtn.addEventListener('click', () => {
    els.search.value = ''; els.fCategory.value = ''; els.fFinish.value = ''; els.fSize.value = ''; els.fSort.value = 'newest';
    reload();
  });

  (async () => {
    await fetchMe();
    mountHeader('gallery');
    await loadFilters();
    await load();
  })();
})();
