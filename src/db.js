'use strict';
/**
 * Database layer using Node's built-in `node:sqlite` (DatabaseSync).
 * This avoids any native compilation (no better-sqlite3 / node-gyp),
 * so the app installs cleanly on machines without C++ build tools.
 * Requires Node.js >= 22.5 (node:sqlite). On Node 24 it works with no flag.
 */
const fs = require('fs');
const { DatabaseSync } = require('node:sqlite');
const config = require('../config');

// Ensure folders exist
for (const p of [config.paths.data, config.paths.products, config.paths.thumbnails, config.paths.tmp]) {
  fs.mkdirSync(p, { recursive: true });
}

const db = new DatabaseSync(config.paths.db);
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');

db.exec(`
  CREATE TABLE IF NOT EXISTS categories (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT NOT NULL UNIQUE,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS products (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    model_number  TEXT,
    name          TEXT NOT NULL,
    category_id   INTEGER REFERENCES categories(id) ON DELETE SET NULL,
    finish        TEXT,
    size          TEXT,
    material      TEXT,
    description   TEXT,
    main_image    TEXT,
    main_thumb    TEXT,
    source_folder TEXT,
    upload_date   TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS product_images (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id    INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    image         TEXT NOT NULL,
    thumb         TEXT,
    original_name TEXT,
    is_main       INTEGER NOT NULL DEFAULT 0,
    sort_order    INTEGER NOT NULL DEFAULT 0,
    created_at    TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS upload_history (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    filename      TEXT,
    products_created INTEGER NOT NULL DEFAULT 0,
    images_added  INTEGER NOT NULL DEFAULT 0,
    status        TEXT NOT NULL DEFAULT 'completed',
    message       TEXT,
    created_at    TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_products_model   ON products(model_number);
  CREATE INDEX IF NOT EXISTS idx_products_finish  ON products(finish);
  CREATE INDEX IF NOT EXISTS idx_products_cat     ON products(category_id);
  CREATE INDEX IF NOT EXISTS idx_images_product   ON product_images(product_id);
`);

/* ---------- category helpers ---------- */
const _findCat = db.prepare('SELECT id FROM categories WHERE name = ? COLLATE NOCASE');
const _insCat = db.prepare('INSERT INTO categories (name) VALUES (?)');

function getOrCreateCategory(name) {
  const clean = (name || 'Uncategorised').trim() || 'Uncategorised';
  const row = _findCat.get(clean);
  if (row) return Number(row.id);
  return Number(_insCat.run(clean).lastInsertRowid);
}

module.exports = { db, getOrCreateCategory };
