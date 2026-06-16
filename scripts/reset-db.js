'use strict';
/* Wipes the database and all processed images. Use with care. */
const fs = require('fs');
const path = require('path');
const config = require('../config');

function rmContents(dir) {
  if (!fs.existsSync(dir)) return;
  for (const f of fs.readdirSync(dir)) {
    if (f === '.gitkeep') continue;
    fs.rmSync(path.join(dir, f), { recursive: true, force: true });
  }
}

for (const f of ['gallery.db', 'gallery.db-wal', 'gallery.db-shm', 'sessions.sqlite']) {
  const p = path.join(config.paths.data, f);
  if (fs.existsSync(p)) fs.rmSync(p, { force: true });
}
rmContents(config.paths.products);
rmContents(config.paths.thumbnails);
console.log('Database and images reset.');
