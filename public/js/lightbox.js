/* Reusable fullscreen lightbox with zoom + keyboard nav */
(function () {
  'use strict';
  const lb = document.getElementById('lightbox');
  if (!lb) return;
  const img = document.getElementById('lbImg');
  const counter = document.getElementById('lbCounter');
  let list = [];
  let idx = 0;

  function show(i) {
    idx = (i + list.length) % list.length;
    img.classList.remove('zoomed');
    img.src = list[idx];
    counter.textContent = list.length > 1 ? `${idx + 1} / ${list.length}` : '';
  }
  function open(images, start = 0) {
    list = images.filter(Boolean);
    if (!list.length) return;
    lb.classList.add('open');
    document.body.style.overflow = 'hidden';
    show(start);
  }
  function close() { lb.classList.remove('open'); document.body.style.overflow = ''; }

  document.getElementById('lbClose').addEventListener('click', close);
  document.getElementById('lbPrev').addEventListener('click', (e) => { e.stopPropagation(); show(idx - 1); });
  document.getElementById('lbNext').addEventListener('click', (e) => { e.stopPropagation(); show(idx + 1); });
  lb.addEventListener('click', (e) => { if (e.target === lb) close(); });
  img.addEventListener('click', (e) => { e.stopPropagation(); img.classList.toggle('zoomed'); img.style.transform = img.classList.contains('zoomed') ? 'scale(1.8)' : ''; });
  document.addEventListener('keydown', (e) => {
    if (!lb.classList.contains('open')) return;
    if (e.key === 'Escape') close();
    else if (e.key === 'ArrowLeft') show(idx - 1);
    else if (e.key === 'ArrowRight') show(idx + 1);
  });

  window.Lightbox = { open, close };
})();
