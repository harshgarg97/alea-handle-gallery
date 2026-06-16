'use strict';
const express = require('express');
const { checkCredentials } = require('../auth');
const router = express.Router();

router.post('/login', (req, res) => {
  const { username, password } = req.body || {};
  if (checkCredentials(username, password)) {
    req.session.user = { name: username, role: 'admin' };
    return res.json({ ok: true, user: req.session.user });
  }
  return res.status(401).json({ ok: false, error: 'Invalid username or password' });
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

router.get('/me', (req, res) => {
  if (req.session && req.session.user) return res.json({ user: req.session.user });
  return res.status(401).json({ user: null });
});

module.exports = router;
