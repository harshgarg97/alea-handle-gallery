'use strict';
/**
 * Importer: turns a folder of handle images into a product record.
 *
 *  - First image (natural sort)            -> cover / main image
 *  - Remaining images                      -> gallery
 *  - Product Name                          -> folder name (tidied)
 *  - Model number / finish / category etc. -> parsed from folder name,
 *                                             enriched from handles.json when available.
 *
 * Used both by the one-time seed script and the live ZIP upload route.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const sharp = require('sharp');
const config = require('../config');
const { db, getOrCreateCategory } = require('./db');

/* ------------------------------------------------------------------ */
/*  handles.json metadata index (optional enrichment)                 */
/* ------------------------------------------------------------------ */
let META_INDEX = null;

function normCode(s) {
  return String(s || '')
    .toUpperCase()
    .replace(/\.(png|jpe?g|webp|gif)$/i, '')
    .replace(/[_]+/g, ' ')
    .replace(/\s*-\s*/g, '-') // "AL -1026" -> "AL-1026"
    .replace(/\s+/g, ' ')
    .trim();
}

function loadMetaIndex(metaPath) {
  META_INDEX = new Map();
  if (!metaPath || !fs.existsSync(metaPath)) return META_INDEX;
  try {
    const data = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
    const handles = Array.isArray(data) ? data : data.handles || [];
    for (const h of handles) {
      const keys = new Set();
      if (h.full_code) keys.add(normCode(h.full_code));
      if (h.display_name) keys.add(normCode(h.display_name));
      if (h.parent) keys.add(normCode(h.parent));
      if (h.parent && h.finish) keys.add(normCode(`${h.parent} ${h.finish.replace(/-/g, ' ')}`));
      for (const k of keys) if (k && !META_INDEX.has(k)) META_INDEX.set(k, h);
    }
  } catch (e) {
    console.warn('  ! could not parse meta file:', e.message);
  }
  return META_INDEX;
}

function lookupMeta(folderName) {
  if (!META_INDEX || META_INDEX.size === 0) return null;
  const key = normCode(folderName);
  if (META_INDEX.has(key)) return META_INDEX.get(key);
  // try progressively shorter prefixes (drop trailing finish words)
  const parts = key.split(' ');
  for (let i = parts.length - 1; i >= 1; i--) {
    const sub = parts.slice(0, i).join(' ');
    if (META_INDEX.has(sub)) return META_INDEX.get(sub);
  }
  return null;
}

/* ------------------------------------------------------------------ */
/*  Folder-name parsing (fallback when no metadata match)             */
/* ------------------------------------------------------------------ */
const KNOWN_FINISHES = [
  'graphite black', 'matt rosse gold brush', 'matt black', 'antique brass', 'antique brown',
  'antique', 'silver antique', 'broch brown', 'rose gold', 'champagne', 'carbon grey',
  'titanium brown', 'brushed brass', 'black gold', 'black+gold', 'black + golden', 'gold brush',
  'matt gold', 'butterfly cream', 'greaystone', 'grey stone', 'golden', 'silver', 'black',
  'brown', 'carbon', 'gold', 'brass', 'bronze', 'chrome', 'white', 'pink', 'blue', 'coffee',
  'cream', 'eab', 'cp',
];

function titleCase(s) {
  return s.replace(/\w\S*/g, (t) => t.charAt(0).toUpperCase() + t.slice(1).toLowerCase());
}

function parseFolderName(folderName) {
  let name = folderName.replace(/[_]+/g, ' ').replace(/\s+/g, ' ').trim();
  const normalized = name.replace(/\s*-\s*/g, '-'); // tidy "AL -1026"

  // Model number: a token containing digits, often with a letter prefix & dash
  let model = '';
  const modelMatch =
    normalized.match(/\b([A-Z]{1,4}-?\d{2,5}(?:-\d{2,5})?)\b/i) ||
    normalized.match(/\b(\d{3,5}(?:-\d{2,5})?)\b/);
  if (modelMatch) model = modelMatch[1].toUpperCase().replace(/\s+/g, '');

  // Finish: search known finishes (longest first)
  let finish = '';
  const lower = ' ' + name.toLowerCase() + ' ';
  for (const f of KNOWN_FINISHES) {
    if (lower.includes(' ' + f + ' ') || lower.includes(' ' + f)) {
      finish = titleCase(f);
      break;
    }
  }

  return {
    model_number: model,
    name: titleCase(name),
    finish,
    category: 'Handle',
    size: '',
    material: '',
    description: '',
  };
}

/* ------------------------------------------------------------------ */
/*  Image helpers                                                     */
/* ------------------------------------------------------------------ */
function isImage(file) {
  return config.images.allowedExt.includes(path.extname(file).toLowerCase());
}

// natural sort so "PIC 2" < "PIC 10"
function naturalSort(a, b) {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
}

function uniqueName(prefix, ext) {
  const rnd = crypto.randomBytes(4).toString('hex');
  return `${prefix}-${Date.now().toString(36)}-${rnd}${ext}`;
}

/**
 * Process one source image:
 *   - writes an optimised "display" JPEG into uploads/products
 *   - writes a square-ish thumbnail into uploads/thumbnails
 * Returns { image, thumb } relative paths (forward slashes).
 */
async function processImage(srcPath, baseName) {
  const outImageName = uniqueName(baseName, '.jpg');
  const outThumbName = uniqueName(baseName + '-t', '.jpg');
  const outImagePath = path.join(config.paths.products, outImageName);
  const outThumbPath = path.join(config.paths.thumbnails, outThumbName);

  const input = sharp(srcPath, { failOn: 'none' }).rotate(); // respect EXIF orientation

  await input
    .clone()
    .resize({ width: config.images.productMaxWidth, withoutEnlargement: true })
    .jpeg({ quality: config.images.quality, mozjpeg: true })
    .toFile(outImagePath);

  await input
    .clone()
    .resize({
      width: config.images.thumbnailWidth,
      height: config.images.thumbnailWidth,
      fit: 'cover',
      position: 'centre',
      withoutEnlargement: false,
    })
    .jpeg({ quality: 78, mozjpeg: true })
    .toFile(outThumbPath);

  return { image: `products/${outImageName}`, thumb: `thumbnails/${outThumbName}` };
}

/* ------------------------------------------------------------------ */
/*  DB inserts                                                        */
/* ------------------------------------------------------------------ */
const insProduct = db.prepare(`
  INSERT INTO products
    (model_number, name, category_id, finish, size, material, description,
     main_image, main_thumb, source_folder, upload_date)
  VALUES
    (@model_number, @name, @category_id, @finish, @size, @material, @description,
     @main_image, @main_thumb, @source_folder, datetime('now'))
`);
const insImage = db.prepare(`
  INSERT INTO product_images (product_id, image, thumb, original_name, is_main, sort_order)
  VALUES (?, ?, ?, ?, ?, ?)
`);

/**
 * Import a single product folder.
 * @param {string} folderPath absolute path to the folder
 * @param {string} folderName display name of the folder
 * @returns {Promise<{productId:number, images:number} | null>}
 */
async function importFolder(folderPath, folderName) {
  let files = fs
    .readdirSync(folderPath)
    .filter((f) => isImage(f) && !f.startsWith('.'))
    .sort(naturalSort);

  if (files.length === 0) return null;

  // Build metadata
  const parsed = parseFolderName(folderName);
  const meta = lookupMeta(folderName);
  let record = { ...parsed };
  if (meta) {
    record.model_number = meta.full_code || meta.parent || parsed.model_number;
    record.name = meta.display_name || parsed.name;
    record.finish = (meta.finish_colour || parsed.finish || '').replace(/^"|"$/g, '').trim();
    record.category = meta.category || 'Handle';
    record.size = meta.size || '';
    record.material = meta.material || '';
    const noteBits = [];
    if (meta.usage_area) noteBits.push(`Usage: ${meta.usage_area}`);
    if (meta.supplier) noteBits.push(`Supplier: ${meta.supplier}`);
    if (meta.notes) noteBits.push(meta.notes);
    record.description = noteBits.join('. ');
  }
  if (!record.description) {
    record.description =
      `${record.name}` +
      (record.finish ? ` in ${record.finish} finish` : '') +
      (record.size ? `, available in ${record.size}` : '') + '.';
  }

  const categoryId = getOrCreateCategory(record.category);

  // Process images: first = cover
  const processed = [];
  for (let i = 0; i < files.length; i++) {
    const base = (record.model_number || folderName)
      .replace(/[^a-z0-9]+/gi, '-')
      .replace(/^-+|-+$/g, '')
      .toLowerCase() || 'img';
    try {
      const out = await processImage(path.join(folderPath, files[i]), base);
      processed.push({ ...out, original_name: files[i] });
    } catch (e) {
      console.warn(`    ! skipped image ${files[i]}: ${e.message}`);
    }
  }
  if (processed.length === 0) return null;

  const cover = processed[0];
  const tx = db.transaction(() => {
    const pid = insProduct.run({
      model_number: record.model_number || null,
      name: record.name,
      category_id: categoryId,
      finish: record.finish || null,
      size: record.size || null,
      material: record.material || null,
      description: record.description || null,
      main_image: cover.image,
      main_thumb: cover.thumb,
      source_folder: folderName,
    }).lastInsertRowid;

    processed.forEach((p, idx) => {
      insImage.run(pid, p.image, p.thumb, p.original_name, idx === 0 ? 1 : 0, idx);
    });
    return pid;
  });

  const productId = tx();
  return { productId, images: processed.length };
}

module.exports = {
  importFolder,
  processImage,
  parseFolderName,
  loadMetaIndex,
  lookupMeta,
  isImage,
  naturalSort,
};
