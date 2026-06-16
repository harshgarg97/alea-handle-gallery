'use strict';
/**
 * Bulk ZIP upload.
 *  - Accepts a .zip of handle folders (each subfolder = one product).
 *  - Extracts, walks every folder that directly contains images,
 *    and creates a product via importer.importFolder().
 *  - Also supports a flat zip of loose images -> single product named after the zip.
 */
const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const AdmZip = require('adm-zip');
const config = require('../../config');
const { db } = require('../db');
const { requireApiAuth } = require('../auth');
const { importFolder, isImage } = require('../importer');

const router = express.Router();
const upload = multer({
  dest: config.paths.tmp,
  limits: { fileSize: 2 * 1024 * 1024 * 1024 }, // up to 2 GB zip
});

function folderHasImages(dir) {
  return fs.readdirSync(dir).some((f) => {
    const full = path.join(dir, f);
    return fs.statSync(full).isFile() && isImage(f) && !f.startsWith('.');
  });
}

// Recursively collect every directory that directly contains image files.
function collectImageFolders(root) {
  const out = [];
  function walk(dir) {
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    const dirs = entries.filter((e) => e.isDirectory() && !e.name.startsWith('_') && !e.name.startsWith('.') && e.name !== '__MACOSX');
    if (folderHasImages(dir)) out.push(dir);
    for (const d of dirs) walk(path.join(dir, d.name));
  }
  walk(root);
  return out;
}

router.post('/zip', requireApiAuth, upload.single('zipfile'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No zip uploaded' });

  const workDir = path.join(config.paths.tmp, 'zip-' + crypto.randomBytes(5).toString('hex'));
  let productsCreated = 0;
  let imagesAdded = 0;
  const created = [];

  try {
    fs.mkdirSync(workDir, { recursive: true });
    new AdmZip(req.file.path).extractAllTo(workDir, true);

    let folders = collectImageFolders(workDir);

    // Flat zip of loose images -> treat the zip as one product folder.
    if (folders.length === 0 && folderHasImages(workDir)) {
      folders = [workDir];
    }

    for (const folder of folders) {
      const name = folder === workDir
        ? path.basename(req.file.originalname, path.extname(req.file.originalname))
        : path.basename(folder);
      const result = await importFolder(folder, name);
      if (result) {
        productsCreated += 1;
        imagesAdded += result.images;
        created.push({ id: result.productId, name });
      }
    }

    db.prepare(
      'INSERT INTO upload_history (filename, products_created, images_added, status, message) VALUES (?,?,?,?,?)'
    ).run(req.file.originalname, productsCreated, imagesAdded, 'completed',
      `${productsCreated} products / ${imagesAdded} images`);

    res.json({ ok: true, productsCreated, imagesAdded, products: created });
  } catch (e) {
    db.prepare(
      'INSERT INTO upload_history (filename, products_created, images_added, status, message) VALUES (?,?,?,?,?)'
    ).run(req.file ? req.file.originalname : 'unknown', productsCreated, imagesAdded, 'error', e.message);
    console.error('ZIP import error:', e);
    res.status(500).json({ error: e.message, productsCreated, imagesAdded });
  } finally {
    fs.promises.unlink(req.file.path).catch(() => {});
    fs.promises.rm(workDir, { recursive: true, force: true }).catch(() => {});
  }
});

module.exports = router;
