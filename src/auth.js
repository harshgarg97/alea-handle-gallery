'use strict';
const config = require('../config');

// API guard -> 401 JSON
function requireApiAuth(req, res, next) {
  if (req.session && req.session.user) return next();
  return res.status(401).json({ error: 'Not authenticated' });
}

// Page guard -> redirect to /login
function requirePage(req, res, next) {
  if (req.session && req.session.user) return next();
  return res.redirect('/login');
}

function checkCredentials(user, password) {
  return user === config.admin.user && password === config.admin.password;
}

module.exports = { requireApiAuth, requirePage, checkCredentials };
