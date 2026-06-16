/* Bulk ZIP upload logic with progress + result summary */
(function () {
  'use strict';
  const { fetchMe, mountHeader, toast, esc } = window.ALEA;
  document.getElementById('yr').textContent = new Date().getFullYear();

  const dz = document.getElementById('dropzone');
  const input = document.getElementById('fileInput');
  const info = document.getElementById('fileInfo');
  const nameEl = document.getElementById('fileName');
  const sizeEl = document.getElementById('fileSize');
  const uploadBtn = document.getElementById('uploadBtn');
  const progress = document.getElementById('progress');
  const fill = document.getElementById('progressFill');
  const resultBox = document.getElementById('resultBox');
  let file = null;

  const fmtSize = (b) => b > 1e9 ? (b / 1e9).toFixed(2) + ' GB' : b > 1e6 ? (b / 1e6).toFixed(1) + ' MB' : (b / 1e3).toFixed(0) + ' KB';

  function setFile(f) {
    if (!f) return;
    if (!/\.zip$/i.test(f.name)) { toast('Please choose a .zip file', 'error'); return; }
    file = f;
    nameEl.textContent = f.name;
    sizeEl.textContent = fmtSize(f.size);
    info.classList.remove('hide');
    uploadBtn.disabled = false;
    resultBox.innerHTML = '';
  }

  dz.addEventListener('click', () => input.click());
  input.addEventListener('change', (e) => setFile(e.target.files[0]));
  ['dragover', 'dragenter'].forEach((ev) => dz.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.add('drag'); }));
  ['dragleave', 'drop'].forEach((ev) => dz.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.remove('drag'); }));
  dz.addEventListener('drop', (e) => setFile(e.dataTransfer.files[0]));
  document.getElementById('clearFile').addEventListener('click', () => {
    file = null; input.value = ''; info.classList.add('hide'); uploadBtn.disabled = true;
  });

  uploadBtn.addEventListener('click', () => {
    if (!file) return;
    const fd = new FormData();
    fd.append('zipfile', file);
    uploadBtn.disabled = true; uploadBtn.textContent = 'Importing…';
    progress.classList.add('show'); fill.style.width = '0%';
    resultBox.innerHTML = '';

    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/upload/zip');
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) fill.style.width = Math.round(e.loaded / e.total * 90) + '%'; };
    xhr.onload = () => {
      fill.style.width = '100%';
      uploadBtn.disabled = false; uploadBtn.textContent = 'Import Catalogue';
      let data = {};
      try { data = JSON.parse(xhr.responseText); } catch {}
      if (xhr.status >= 200 && xhr.status < 300) {
        resultBox.innerHTML = `
          <div class="panel"><div class="panel-body">
            <h3 class="gold" style="font-family:var(--serif)">✓ Import complete</h3>
            <p class="mt-1"><b>${data.productsCreated}</b> products created · <b>${data.imagesAdded}</b> images processed.</p>
            ${(data.products || []).length ? `<div class="mt-2 flex gap wrap">${data.products.slice(0, 30).map((p) => `<a class="chip" href="/product/${p.id}">${esc(p.name)}</a>`).join('')}</div>` : ''}
            <div class="mt-2 flex gap"><a class="btn btn-gold btn-sm" href="/">View gallery</a><a class="btn btn-ghost btn-sm" href="/dashboard">Dashboard</a></div>
          </div></div>`;
        toast('Import complete');
      } else {
        resultBox.innerHTML = `<div class="panel"><div class="panel-body"><h3 style="color:#8c1d1d">Import failed</h3><p>${esc(data.error || 'Server error')}</p></div></div>`;
        toast('Import failed', 'error');
      }
      setTimeout(() => progress.classList.remove('show'), 1200);
    };
    xhr.onerror = () => { uploadBtn.disabled = false; uploadBtn.textContent = 'Import Catalogue'; toast('Network error', 'error'); };
    xhr.send(fd);
  });

  (async () => {
    const me = await fetchMe();
    if (!me) { location.href = '/login'; return; }
    mountHeader('upload');
  })();
})();
