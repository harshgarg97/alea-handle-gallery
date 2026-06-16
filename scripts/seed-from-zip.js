'use strict';
/**
 * One-time seed: imports product folders from a source directory (or extracted ZIP)
 * into the database, enriching from a handles.json metadata file when present.
 *
 * Usage:
 *   node scripts/seed-from-zip.js <sourceDir> [handles.json]
 *
 * <sourceDir> should contain one subfolder per product, each holding images.
 */
const fs = require('fs');
const path = require('path');
const { importFolder, isImage, loadMetaIndex } = require('../src/importer');
const { db } = require('../src/db');

async function main() {
  const sourceDir = process.argv[2];
  const metaPath = process.argv[3];
  if (!sourceDir || !fs.existsSync(sourceDir)) {
    console.error('Usage: node scripts/seed-from-zip.js <sourceDir> [handles.json]');
    process.exit(1);
  }

  if (metaPath && fs.existsSync(metaPath)) {
    const idx = loadMetaIndex(metaPath);
    console.log(`Loaded metadata index: ${idx.size} keys from ${path.basename(metaPath)}`);
  } else {
    console.log('No metadata file — using folder-name parsing only.');
  }

  const entries = fs.readdirSync(sourceDir, { withFileTypes: true })
    .filter((e) => e.isDirectory() && !e.name.startsWith('_') && !e.name.startsWith('.') && e.name !== '__MACOSX')
    .map((e) => e.name)
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

  let products = 0, images = 0, skipped = 0;
  const t0 = Date.now();

  for (const name of entries) {
    const folder = path.join(sourceDir, name);
    const hasImg = fs.readdirSync(folder).some((f) => isImage(f) && !f.startsWith('.'));
    if (!hasImg) { skipped++; continue; }
    process.stdout.write(`  • ${name} ... `);
    try {
      const r = await importFolder(folder, name);
      if (r) { products++; images += r.images; console.log(`ok (${r.images} img)`); }
      else { skipped++; console.log('skipped (no usable images)'); }
    } catch (e) {
      skipped++; console.log('ERROR ' + e.message);
    }
  }

  db.prepare(
    'INSERT INTO upload_history (filename, products_created, images_added, status, message) VALUES (?,?,?,?,?)'
  ).run('seed-from-zip', products, images, 'completed', 'Initial catalogue seed');

  const secs = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`\nDone in ${secs}s — ${products} products, ${images} images, ${skipped} skipped.`);
}

main();
