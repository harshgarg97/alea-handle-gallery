'use strict';
require('dotenv').config();
const path = require('path');

const ROOT = __dirname;

module.exports = {
  root: ROOT,
  port: parseInt(process.env.PORT, 10) || 3000,
  env: process.env.NODE_ENV || 'development',

  admin: {
    user: process.env.ADMIN_USER || 'admin',
    password: process.env.ADMIN_PASSWORD || 'changeme123',
  },

  sessionSecret: process.env.SESSION_SECRET || 'alea-dev-secret',

  paths: {
    data: path.join(ROOT, 'data'),
    db: path.join(ROOT, 'data', 'gallery.db'),
    uploads: path.join(ROOT, 'uploads'),
    products: path.join(ROOT, 'uploads', 'products'),
    thumbnails: path.join(ROOT, 'uploads', 'thumbnails'),
    tmp: path.join(ROOT, 'data', 'tmp'),
    public: path.join(ROOT, 'public'),
  },

  images: {
    productMaxWidth: parseInt(process.env.PRODUCT_IMAGE_MAX_WIDTH, 10) || 1600,
    thumbnailWidth: parseInt(process.env.THUMBNAIL_WIDTH, 10) || 420,
    quality: parseInt(process.env.IMAGE_QUALITY, 10) || 82,
    allowedExt: ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp', '.tif', '.tiff'],
  },
};
