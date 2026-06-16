/* Product detail logic: viewer, specs, download, copy, admin image management */
(function () {
  'use strict';
  const { api, fetchMe, mountHeader, toast, esc, imgUrl, fmtDate, ICONS } = window.ALEA;

  const id = location.pathname.split('/').pop();
  const content = document.getElementById('content');
  document.getElementById('yr').textContent = new Date().getFullYear();
  let product = null;
  let activeIdx = 0;

  function specRow(label, value) {
    if (!value) return '';
    return `<tr><th>${esc(label)}</th><td>${esc(value)}</td></tr>`;
  }

  function render() {
    const imgs = product.images.length ? product.images : [{ image: product.main_image, thumb: product.main_thumb }];
    const fullList = imgs.map((i) => imgUrl(i.image));
    const admin = !!window.__ALEA_USER__;

    content.innerHTML = `
      <div class="detail-grid">
        <div>
          <div class="gallery-main" id="mainView">
            <img id="mainImg" src="${imgUrl(imgs[0].image)}" alt="${esc(product.name)}" onerror="this.src='/static/img/placeholder.svg'"/>
            <span class="zoom-hint">${ICONS.zoom} Click to zoom</span>
          </div>
          <div class="thumbs" id="thumbs">
            ${imgs.map((im, i) => `<img data-i="${i}" class="${i === 0 ? 'active' : ''}" src="${imgUrl(im.thumb || im.image)}" alt="view ${i + 1}" onerror="this.src='/static/img/placeholder.svg'"/>`).join('')}
          </div>
        </div>

        <div class="detail-info">
          <span class="eyebrow">${esc(product.category || 'Handle')}</span>
          ${product.model_number ? `<div class="card-model" style="margin-top:8px">Model ${esc(product.model_number)}</div>` : ''}
          <h1>${esc(product.name)}</h1>
          ${product.description ? `<p class="desc">${esc(product.description)}</p>` : ''}

          <table class="spec-table">
            ${specRow('Model Number', product.model_number)}
            ${specRow('Category', product.category)}
            ${specRow('Finish / Colour', product.finish)}
            ${specRow('Size', product.size)}
            ${specRow('Material', product.material)}
            ${specRow('Images', product.images.length)}
            ${specRow('Added', fmtDate(product.upload_date))}
          </table>

          <div class="detail-actions">
            <a class="btn btn-gold" id="downloadBtn" href="${imgUrl(imgs[0].image)}" download>⬇ Download Image</a>
            <button class="btn btn-ghost" id="copyBtn">⧉ Copy Product Info</button>
            ${admin ? `<a class="btn btn-dark" href="#" id="manageBtn">⚙ Manage</a>` : ''}
          </div>
          ${admin ? `<div id="adminPanel" class="hide" style="margin-top:22px"></div>` : ''}
        </div>
      </div>`;

    // Thumbnail switching
    const mainImg = document.getElementById('mainImg');
    document.getElementById('thumbs').querySelectorAll('img').forEach((t) => {
      t.addEventListener('click', () => {
        activeIdx = parseInt(t.dataset.i, 10);
        mainImg.src = imgUrl(imgs[activeIdx].image);
        document.getElementById('downloadBtn').href = imgUrl(imgs[activeIdx].image);
        document.querySelectorAll('#thumbs img').forEach((x) => x.classList.remove('active'));
        t.classList.add('active');
      });
    });
    document.getElementById('mainView').addEventListener('click', () => window.Lightbox.open(fullList, activeIdx));

    // Copy product info
    document.getElementById('copyBtn').addEventListener('click', () => {
      const info = [
        `Product: ${product.name}`,
        product.model_number ? `Model Number: ${product.model_number}` : '',
        product.category ? `Category: ${product.category}` : '',
        product.finish ? `Finish: ${product.finish}` : '',
        product.size ? `Size: ${product.size}` : '',
        product.material ? `Material: ${product.material}` : '',
        product.description ? `Description: ${product.description}` : '',
        `Link: ${location.href}`,
      ].filter(Boolean).join('\n');
      navigator.clipboard.writeText(info).then(() => toast('Product info copied to clipboard'))
        .catch(() => toast('Could not copy', 'error'));
    });

    if (admin) setupAdmin();
  }

  /* ---------- Admin image management ---------- */
  function setupAdmin() {
    const panel = document.getElementById('adminPanel');
    document.getElementById('manageBtn').addEventListener('click', (e) => {
      e.preventDefault();
      panel.classList.toggle('hide');
      if (!panel.dataset.built) { buildAdmin(panel); panel.dataset.built = '1'; }
    });
  }

  function buildAdmin(panel) {
    panel.innerHTML = `
      <div class="panel">
        <div class="panel-head"><h3>Image management</h3></div>
        <div class="panel-body">
          <div class="thumbs" id="adminThumbs"></div>
          <div class="flex gap wrap mt-2">
            <label class="btn btn-ghost btn-sm">➕ Add images<input id="addInput" type="file" accept="image/*" multiple hidden></label>
            <button class="btn btn-ghost btn-sm" id="editFieldsBtn">✎ Edit details</button>
            <button class="btn btn-ghost btn-sm" id="delProductBtn" style="color:#8c1d1d">🗑 Delete product</button>
          </div>
        </div>
      </div>`;
    renderAdminThumbs();

    document.getElementById('addInput').addEventListener('change', async (e) => {
      const fd = new FormData();
      [...e.target.files].forEach((f) => fd.append('images', f));
      if (!fd.has('images')) return;
      toast('Uploading images…');
      try { await api(`/api/products/${id}/images`, { method: 'POST', body: fd }); await reload(); toast('Images added'); }
      catch (ex) { toast(ex.message, 'error'); }
    });
    document.getElementById('delProductBtn').addEventListener('click', async () => {
      if (!confirm('Delete this product and all its images?')) return;
      try { await api(`/api/products/${id}`, { method: 'DELETE' }); toast('Product deleted'); setTimeout(() => location.href = '/', 600); }
      catch (ex) { toast(ex.message, 'error'); }
    });
    document.getElementById('editFieldsBtn').addEventListener('click', openEditModal);
  }

  function renderAdminThumbs() {
    const wrap = document.getElementById('adminThumbs');
    if (!wrap) return;
    wrap.innerHTML = product.images.map((im) => `
      <div style="text-align:center">
        <img src="${imgUrl(im.thumb || im.image)}" style="width:84px;height:84px;border:2px solid ${im.is_main ? 'var(--gold)' : 'transparent'}" alt=""/>
        <div class="flex gap" style="justify-content:center;margin-top:5px">
          ${im.is_main ? '<span class="tag ok">Cover</span>' : `<button class="btn btn-sm btn-ghost" data-main="${im.id}" title="Set as cover">★</button>`}
          <button class="btn btn-sm btn-ghost" data-del="${im.id}" title="Delete" style="color:#8c1d1d">🗑</button>
        </div>
      </div>`).join('');
    wrap.querySelectorAll('[data-main]').forEach((b) => b.addEventListener('click', async () => {
      try { await api(`/api/products/${id}/images/${b.dataset.main}/main`, { method: 'PUT' }); await reload(); toast('Cover updated'); }
      catch (ex) { toast(ex.message, 'error'); }
    }));
    wrap.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', async () => {
      if (!confirm('Delete this image?')) return;
      try { await api(`/api/products/${id}/images/${b.dataset.del}`, { method: 'DELETE' }); await reload(); toast('Image deleted'); }
      catch (ex) { toast(ex.message, 'error'); }
    }));
  }

  function openEditModal() {
    const p = product;
    const back = document.createElement('div');
    back.className = 'modal-back open';
    back.innerHTML = `
      <div class="modal">
        <div class="modal-head"><h3>Edit product</h3><button class="icon-btn" data-x>×</button></div>
        <div class="modal-body">
          ${field('Product Name', 'name', p.name)}
          ${field('Model Number', 'model_number', p.model_number)}
          ${field('Category', 'category', p.category)}
          ${field('Finish / Colour', 'finish', p.finish)}
          ${field('Size', 'size', p.size)}
          ${field('Material', 'material', p.material)}
          <div class="field"><label>Description</label><textarea name="description" rows="3" style="width:100%;padding:10px;border-radius:10px;border:1px solid var(--line-strong);background:var(--bg-card);color:var(--ink);font-family:var(--sans)">${esc(p.description || '')}</textarea></div>
        </div>
        <div class="modal-foot"><button class="btn btn-ghost" data-x>Cancel</button><button class="btn btn-gold" data-save>Save changes</button></div>
      </div>`;
    document.body.appendChild(back);
    const close = () => back.remove();
    back.querySelectorAll('[data-x]').forEach((b) => b.addEventListener('click', close));
    back.addEventListener('click', (e) => { if (e.target === back) close(); });
    back.querySelector('[data-save]').addEventListener('click', async () => {
      const body = {};
      back.querySelectorAll('[name]').forEach((i) => { body[i.name] = i.value; });
      try { await api(`/api/products/${id}`, { method: 'PUT', body: JSON.stringify(body) }); close(); await reload(); toast('Saved'); }
      catch (ex) { toast(ex.message, 'error'); }
    });
  }
  function field(label, name, val) {
    return `<div class="field"><label>${esc(label)}</label><input name="${name}" value="${esc(val || '')}"/></div>`;
  }

  async function reload() {
    product = await api('/api/products/' + id);
    render();
    if (document.getElementById('adminPanel')) {
      const panel = document.getElementById('adminPanel');
      panel.classList.remove('hide'); panel.dataset.built = '';
      buildAdmin(panel); panel.dataset.built = '1';
    }
  }

  (async () => {
    await fetchMe();
    mountHeader('');
    try {
      product = await api('/api/products/' + id);
      document.title = `${product.name} · ALEA Handle Gallery Pro`;
      render();
    } catch (e) {
      content.innerHTML = `<div class="state"><h3>Product not found</h3><p>${esc(e.message)}</p><a class="btn btn-gold mt-2" href="/">Back to gallery</a></div>`;
    }
  })();
})();
