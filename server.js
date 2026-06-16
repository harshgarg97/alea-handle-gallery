'use strict';
const path = require('path');
const express = require('express');
const session = require('express-session');
const config = require('./config');
const { requirePage } = require('./src/auth');

require('./src/db'); // initialise schema

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);

app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

// In-memory session store (no native dependency). Sessions reset when the
// server restarts, which is fine for a single-admin local catalogue app.
app.use(session({
  secret: config.sessionSecret,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
    secure: false, // set true behind HTTPS
  },
}));

/* ---------- static assets ---------- */
// long cache for processed images (immutable filenames)
app.use('/uploads', express.static(config.paths.uploads, {
  maxAge: '30d',
  immutable: true,
}));
app.use('/static', express.static(config.paths.public, { maxAge: '1d' }));

/* ---------- API routes ---------- */
app.use('/api/auth', require('./src/routes/auth.routes'));
app.use('/api/stats', require('./src/routes/stats.routes'));
app.use('/api/products', require('./src/routes/products.routes'));
app.use('/api/upload', require('./src/routes/upload.routes'));
app.use('/api/export', require('./src/routes/export.routes'));

app.get('/api/health', (req, res) => res.json({ ok: true, ts: Date.now() }));

/* ---------- pages ---------- */
const pub = config.paths.public;
app.get('/login', (req, res) => res.sendFile(path.join(pub, 'login.html')));
app.get('/', (req, res) => res.sendFile(path.join(pub, 'index.html')));        // gallery (public view)
app.get('/product/:id', (req, res) => res.sendFile(path.join(pub, 'product.html')));
app.get('/dashboard', requirePage, (req, res) => res.sendFile(path.join(pub, 'dashboard.html')));
app.get('/upload', requirePage, (req, res) => res.sendFile(path.join(pub, 'upload.html')));

/* ---------- 404 ---------- */
app.use((req, res) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'Not found' });
  res.status(404).sendFile(path.join(pub, 'index.html'));
});

/* ---------- error handler ---------- */
app.use((err, req, res, next) => {
  console.error(err);
  if (res.headersSent) return next(err);
  res.status(500).json({ error: err.message || 'Server error' });
});

app.listen(config.port, () => {
  console.log(`\n  ALEA Handle Gallery Pro`);
  console.log(`  ----------------------------------------`);
  console.log(`  Running:   http://localhost:${config.port}`);
  console.log(`  Login:     http://localhost:${config.port}/login`);
  console.log(`  Admin user: ${config.admin.user}`);
  console.log(`  Environment: ${config.env}\n`);
});
