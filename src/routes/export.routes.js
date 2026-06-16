'use strict';
const express = require('express');
const ExcelJS = require('exceljs');
const { db } = require('../db');
const router = express.Router();

const COLUMNS = [
  { header: 'Product ID', key: 'id', width: 12 },
  { header: 'Model Number', key: 'model_number', width: 18 },
  { header: 'Product Name', key: 'name', width: 32 },
  { header: 'Category', key: 'category', width: 14 },
  { header: 'Finish / Colour', key: 'finish', width: 22 },
  { header: 'Size', key: 'size', width: 24 },
  { header: 'Material', key: 'material', width: 16 },
  { header: 'Images', key: 'image_count', width: 9 },
  { header: 'Description', key: 'description', width: 50 },
  { header: 'Upload Date', key: 'upload_date', width: 20 },
];

function fetchRows() {
  return db.prepare(`
    SELECT p.id, p.model_number, p.name, c.name AS category, p.finish, p.size,
           p.material, p.description, p.upload_date,
           (SELECT COUNT(*) FROM product_images pi WHERE pi.product_id = p.id) AS image_count
    FROM products p LEFT JOIN categories c ON c.id = p.category_id
    ORDER BY p.id
  `).all();
}

function csvCell(v) {
  const s = v === null || v === undefined ? '' : String(v);
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

/* ---------- CSV ---------- */
router.get('/csv', (req, res) => {
  const rows = fetchRows();
  const head = COLUMNS.map((c) => csvCell(c.header)).join(',');
  const body = rows.map((r) => COLUMNS.map((c) => csvCell(r[c.key])).join(',')).join('\n');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="alea-handles.csv"');
  res.send('﻿' + head + '\n' + body);
});

/* ---------- Excel ---------- */
router.get('/excel', async (req, res) => {
  const rows = fetchRows();
  const wb = new ExcelJS.Workbook();
  wb.creator = 'ALEA Handle Gallery Pro';
  const ws = wb.addWorksheet('Handles');
  ws.columns = COLUMNS;

  ws.getRow(1).eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FF000000' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD4AF37' } };
    cell.alignment = { vertical: 'middle' };
    cell.border = { bottom: { style: 'thin', color: { argb: 'FF000000' } } };
  });
  rows.forEach((r) => ws.addRow(r));
  ws.autoFilter = { from: 'A1', to: { row: 1, column: COLUMNS.length } };
  ws.views = [{ state: 'frozen', ySplit: 1 }];

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename="alea-handles.xlsx"');
  await wb.xlsx.write(res);
  res.end();
});

module.exports = router;
