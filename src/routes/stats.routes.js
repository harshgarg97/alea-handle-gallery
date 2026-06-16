'use strict';
const express = require('express');
const { db } = require('../db');
const router = express.Router();

router.get('/', (req, res) => {
  const totalProducts = db.prepare('SELECT COUNT(*) AS n FROM products').get().n;
  const totalCategories = db.prepare('SELECT COUNT(*) AS n FROM categories').get().n;
  const totalImages = db.prepare('SELECT COUNT(*) AS n FROM product_images').get().n;
  const totalFinishes = db.prepare(
    "SELECT COUNT(DISTINCT finish) AS n FROM products WHERE finish IS NOT NULL AND finish != ''"
  ).get().n;

  const recent = db.prepare(`
    SELECT p.id, p.model_number, p.name, p.finish, p.main_thumb, p.upload_date,
           c.name AS category
    FROM products p LEFT JOIN categories c ON c.id = p.category_id
    ORDER BY p.id DESC LIMIT 8
  `).all();

  const byCategory = db.prepare(`
    SELECT c.name AS category, COUNT(p.id) AS count
    FROM categories c LEFT JOIN products p ON p.category_id = c.id
    GROUP BY c.id ORDER BY count DESC
  `).all();

  const uploads = db.prepare(
    'SELECT id, filename, products_created, images_added, status, created_at FROM upload_history ORDER BY id DESC LIMIT 10'
  ).all();

  res.json({
    totals: { products: totalProducts, categories: totalCategories, images: totalImages, finishes: totalFinishes },
    recent,
    byCategory,
    uploads,
  });
});

module.exports = router;
