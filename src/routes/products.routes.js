'use strict';
const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { db, getOrCreateCategory } = require('../db');
const { requireApiAuth } = require('../auth');
const { processImage } = require('../importer');
const config = require('../../config');

const router = express.Router();
const upload = multer({ dest: config.paths.tmp, limits: { fileSize: 50 * 1024 * 1024 } });

/* ---------- helpers ---------- */
function deleteImageFiles(image, thumb) {
  for (const rel of [image, thumb]) {
    if (!rel) continue;
    const abs = path.join(config.paths.uploads, rel);
    fs.promises.unlink(abs).catch(() => {});
  }
}

function rowToProduct(p) {
  return {
    id: p.id,
    model_number: p.model_number,
    name: p.name,
    category: p.category_name,
    category_id: p.category_id,
    finish: p.finish,
    size: p.size,
    material: p.material,
    description: p.description,
    main_image: p.main_image,
    main_thumb: p.main_thumb,
    source_folder: p.source_folder,
    upload_date: p.upload_date,
    image_count: p.image_count,
  };
}

/* ---------- GET /api/products  (list + search + filter + pagination) ---------- */
router.get('/', (req, res) => {
  const {
    search = '', model = '', category = '', finish = '', size = '',
    sort = 'newest',
  } = req.query;
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 24));
  const offset = (page - 1) * limit;

  const where = [];
  const params = {};
  if (search) {
    where.push('(p.name LIKE @s OR p.model_number LIKE @s OR p.finish LIKE @s OR p.description LIKE @s)');
    params.s = `%${search}%`;
  }
  if (model) { where.push('p.model_number LIKE @model'); params.model = `%${model}%`; }
  if (category) { where.push('c.name = @category'); params.category = category; }
  if (finish) { where.push('p.finish LIKE @finish'); params.finish = `%${finish}%`; }
  if (size) { where.push('p.size LIKE @size'); params.size = `%${size}%`; }
  const whereSql = where.length ? 'WHERE ' + where.join(' AND ') : '';

  const orderMap = {
    newest: 'p.id DESC',
    oldest: 'p.id ASC',
    name_asc: 'p.name COLLATE NOCASE ASC',
    name_desc: 'p.name COLLATE NOCASE DESC',
    model_asc: 'p.model_number COLLATE NOCASE ASC',
  };
  const orderSql = orderMap[sort] || orderMap.newest;

  const base = `
    FROM products p
    LEFT JOIN categories c ON c.id = p.category_id
    ${whereSql}
  `;
  const total = db.prepare(`SELECT COUNT(*) AS n ${base}`).get(params).n;

  const rows = db.prepare(`
    SELECT p.*, c.name AS category_name,
      (SELECT COUNT(*) FROM product_images pi WHERE pi.product_id = p.id) AS image_count
    ${base}
    ORDER BY ${orderSql}
    LIMIT @limit OFFSET @offset
  `).all({ ...params, limit, offset });

  res.json({
    products: rows.map(rowToProduct),
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  });
});

/* ---------- GET /api/products/filters  (distinct filter options) ---------- */
router.get('/filters', (req, res) => {
  const categories = db.prepare('SELECT name FROM categories ORDER BY name').all().map((r) => r.name);
  const finishes = db.prepare(
    "SELECT DISTINCT finish FROM products WHERE finish IS NOT NULL AND finish != '' ORDER BY finish"
  ).all().map((r) => r.finish);
  const sizes = db.prepare(
    "SELECT DISTINCT size FROM products WHERE size IS NOT NULL AND size != '' ORDER BY size"
  ).all().map((r) => r.size);
  const models = db.prepare(
    "SELECT DISTINCT model_number FROM products WHERE model_number IS NOT NULL AND model_number != '' ORDER BY model_number"
  ).all().map((r) => r.model_number);
  res.json({ categories, finishes, sizes, models });
});

/* ---------- GET /api/products/:id ---------- */
router.get('/:id', (req, res) => {
  const p = db.prepare(`
    SELECT p.*, c.name AS category_name
    FROM products p LEFT JOIN categories c ON c.id = p.category_id
    WHERE p.id = ?
  `).get(req.params.id);
  if (!p) return res.status(404).json({ error: 'Not found' });

  const images = db.prepare(
    'SELECT id, image, thumb, original_name, is_main, sort_order FROM product_images WHERE product_id = ? ORDER BY sort_order, id'
  ).all(p.id);

  res.json({ ...rowToProduct({ ...p, image_count: images.length }), images });
});

/* ===================================================================
 *  Authenticated mutations below
 * =================================================================== */

/* ---------- PUT /api/products/:id  (edit fields) ---------- */
router.put('/:id', requireApiAuth, (req, res) => {
  const p = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
  if (!p) return res.status(404).json({ error: 'Not found' });

  const b = req.body || {};
  const categoryId = b.category ? getOrCreateCategory(b.category) : p.category_id;
  db.prepare(`
    UPDATE products SET
      model_number = @model_number, name = @name, category_id = @category_id,
      finish = @finish, size = @size, material = @material, description = @description,
      updated_at = datetime('now')
    WHERE id = @id
  `).run({
    id: p.id,
    model_number: b.model_number ?? p.model_number,
    name: b.name ?? p.name,
    category_id: categoryId,
    finish: b.finish ?? p.finish,
    size: b.size ?? p.size,
    material: b.material ?? p.material,
    description: b.description ?? p.description,
  });
  res.json({ ok: true });
});

/* ---------- DELETE /api/products/:id ---------- */
router.delete('/:id', requireApiAuth, (req, res) => {
  const imgs = db.prepare('SELECT image, thumb FROM product_images WHERE product_id = ?').all(req.params.id);
  const info = db.prepare('DELETE FROM products WHERE id = ?').run(req.params.id);
  imgs.forEach((i) => deleteImageFiles(i.image, i.thumb));
  res.json({ ok: true, deleted: info.changes });
});

/* ---------- POST /api/products/bulk-delete ---------- */
router.post('/bulk-delete', requireApiAuth, (req, res) => {
  const ids = (req.body && req.body.ids) || [];
  if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: 'No ids' });
  const placeholders = ids.map(() => '?').join(',');
  const imgs = db.prepare(`SELECT image, thumb FROM product_images WHERE product_id IN (${placeholders})`).all(...ids);
  const info = db.prepare(`DELETE FROM products WHERE id IN (${placeholders})`).run(...ids);
  imgs.forEach((i) => deleteImageFiles(i.image, i.thumb));
  res.json({ ok: true, deleted: info.changes });
});

/* ---------- POST /api/products/:id/images  (add images) ---------- */
router.post('/:id/images', requireApiAuth, upload.array('images', 30), async (req, res) => {
  const p = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
  if (!p) return res.status(404).json({ error: 'Not found' });
  if (!req.files || req.files.length === 0) return res.status(400).json({ error: 'No files' });

  const maxOrder = db.prepare('SELECT COALESCE(MAX(sort_order), -1) AS m FROM product_images WHERE product_id = ?').get(p.id).m;
  const insImage = db.prepare(
    'INSERT INTO product_images (product_id, image, thumb, original_name, is_main, sort_order) VALUES (?,?,?,?,?,?)'
  );
  const added = [];
  let order = maxOrder + 1;
  for (const f of req.files) {
    try {
      const out = await processImage(f.path, `p${p.id}`);
      const isMain = !p.main_image && added.length === 0 ? 1 : 0;
      const id = insImage.run(p.id, out.image, out.thumb, f.originalname, isMain, order++).lastInsertRowid;
      if (isMain) {
        db.prepare('UPDATE products SET main_image = ?, main_thumb = ? WHERE id = ?').run(out.image, out.thumb, p.id);
      }
      added.push({ id, ...out });
    } catch (e) {
      console.warn('add image failed:', e.message);
    } finally {
      fs.promises.unlink(f.path).catch(() => {});
    }
  }
  res.json({ ok: true, added });
});

/* ---------- PUT /api/products/:id/images/:imageId/main  (set as cover) ---------- */
router.put('/:id/images/:imageId/main', requireApiAuth, (req, res) => {
  const img = db.prepare('SELECT * FROM product_images WHERE id = ? AND product_id = ?').get(req.params.imageId, req.params.id);
  if (!img) return res.status(404).json({ error: 'Not found' });
  db.prepare('UPDATE product_images SET is_main = 0 WHERE product_id = ?').run(req.params.id);
  db.prepare('UPDATE product_images SET is_main = 1 WHERE id = ?').run(img.id);
  db.prepare('UPDATE products SET main_image = ?, main_thumb = ?, updated_at = datetime(\'now\') WHERE id = ?')
    .run(img.image, img.thumb, req.params.id);
  res.json({ ok: true });
});

/* ---------- POST /api/products/:id/images/:imageId/replace  (replace one image) ---------- */
router.post('/:id/images/:imageId/replace', requireApiAuth, upload.single('image'), async (req, res) => {
  const img = db.prepare('SELECT * FROM product_images WHERE id = ? AND product_id = ?').get(req.params.imageId, req.params.id);
  if (!img) return res.status(404).json({ error: 'Not found' });
  if (!req.file) return res.status(400).json({ error: 'No file' });
  try {
    const out = await processImage(req.file.path, `p${req.params.id}`);
    deleteImageFiles(img.image, img.thumb);
    db.prepare('UPDATE product_images SET image = ?, thumb = ?, original_name = ? WHERE id = ?')
      .run(out.image, out.thumb, req.file.originalname, img.id);
    if (img.is_main) {
      db.prepare('UPDATE products SET main_image = ?, main_thumb = ? WHERE id = ?').run(out.image, out.thumb, req.params.id);
    }
    res.json({ ok: true, image: out.image, thumb: out.thumb });
  } catch (e) {
    res.status(500).json({ error: e.message });
  } finally {
    fs.promises.unlink(req.file.path).catch(() => {});
  }
});

/* ---------- PUT /api/products/:id/images/:imageId/rename ---------- */
router.put('/:id/images/:imageId/rename', requireApiAuth, (req, res) => {
  const name = (req.body && req.body.name || '').trim();
  if (!name) return res.status(400).json({ error: 'Name required' });
  const info = db.prepare('UPDATE product_images SET original_name = ? WHERE id = ? AND product_id = ?')
    .run(name, req.params.imageId, req.params.id);
  res.json({ ok: info.changes > 0 });
});

/* ---------- DELETE /api/products/:id/images/:imageId ---------- */
router.delete('/:id/images/:imageId', requireApiAuth, (req, res) => {
  const img = db.prepare('SELECT * FROM product_images WHERE id = ? AND product_id = ?').get(req.params.imageId, req.params.id);
  if (!img) return res.status(404).json({ error: 'Not found' });
  db.prepare('DELETE FROM product_images WHERE id = ?').run(img.id);
  deleteImageFiles(img.image, img.thumb);
  // if it was the main image, promote another
  if (img.is_main) {
    const next = db.prepare('SELECT * FROM product_images WHERE product_id = ? ORDER BY sort_order, id LIMIT 1').get(req.params.id);
    if (next) {
      db.prepare('UPDATE product_images SET is_main = 1 WHERE id = ?').run(next.id);
      db.prepare('UPDATE products SET main_image = ?, main_thumb = ? WHERE id = ?').run(next.image, next.thumb, req.params.id);
    } else {
      db.prepare('UPDATE products SET main_image = NULL, main_thumb = NULL WHERE id = ?').run(req.params.id);
    }
  }
  res.json({ ok: true });
});

module.exports = router;
