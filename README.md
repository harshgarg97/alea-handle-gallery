# ALEA Handle Gallery Pro

A professional product database & gallery system for kitchen handles — built for the ALEA Modular catalogue. Upload folders or ZIP files of handle images and get a searchable, filterable, mobile-friendly product catalogue with a luxury furniture-industry look (white background, black text, metallic-gold accents).

Runs on a regular PC and is fully responsive for Android phones and tablets.

---

## Highlights

- **Admin login** with secure server-side sessions.
- **Dashboard** — totals (products, categories, images, finishes), recent uploads, category breakdown, import history and a quick product search.
- **Bulk ZIP upload** — drop a ZIP of handle folders; products, cover image, gallery and thumbnails are all created automatically.
- **Product gallery** — modern responsive grid, live search, filters (model number, category, finish, size), pagination, lazy loading.
- **Fullscreen image viewer** with zoom and keyboard navigation.
- **Product detail page** — large viewer, multi-image gallery, specifications table, download-image and copy-info buttons.
- **Image management** (admin) — add, replace, set cover, rename and delete images; edit product details; delete products.
- **Export** the catalogue to **Excel** and **CSV**.
- **Dark / light mode** with the choice remembered per device.
- **Performance** — optimised web images + thumbnails (via `sharp`), lazy loading, HTTP caching, SEO-friendly meta tags.

---

## Tech stack

Node.js · Express.js · SQLite (Node built-in node:sqlite) · Multer · adm-zip · sharp · ExcelJS · vanilla HTML/CSS/JS (no build step).

---

## Quick start

```bash
# 1. Install dependencies
npm install

# 2. (Optional) configure — copy and edit the environment file
cp .env.example .env        # Windows: copy .env.example .env

# 3. Start the server
npm start
```

Then open **http://localhost:3000**.

- Public gallery: `/`
- Admin login: `/login` — default **admin / changeme123** (change it in `.env`)
- Dashboard: `/dashboard`
- Bulk upload: `/upload`

> This package may already include the ALEA catalogue (68 products, 444 photos) pre-loaded in `data/gallery.db` with images under `uploads/`. If so, you can browse immediately after `npm start`.

---

## Re-seeding from a folder

To (re)build the database from a folder of product subfolders:

```bash
node scripts/seed-from-zip.js "C:\path\to\harsh" "C:\path\to\handles.json"
```

- First argument: a directory containing one subfolder per product.
- Second argument (optional): a `handles.json` metadata file used to enrich model numbers, finishes, sizes, etc. Falls back to folder-name parsing when omitted or unmatched.

To wipe everything and start clean: `npm run reset-db`.

---

## Folder structure

```
ALEA-Handle-Gallery-Pro/
├── server.js               # Express app entry point
├── config.js               # central configuration (reads .env)
├── package.json
├── .env / .env.example     # settings & admin credentials
├── src/
│   ├── db.js               # SQLite schema + connection
│   ├── auth.js             # session guards & credential check
│   ├── importer.js         # folder -> product logic (shared)
│   └── routes/             # auth, products, upload, export, stats
├── scripts/
│   ├── seed-from-zip.js    # one-time catalogue seed
│   └── reset-db.js         # wipe db + images
├── public/                 # frontend (HTML/CSS/JS)
│   ├── index.html          # gallery
│   ├── product.html        # detail page
│   ├── dashboard.html
│   ├── upload.html
│   ├── login.html
│   ├── css/styles.css
│   └── js/                 # common, gallery, product, dashboard, upload, lightbox
├── data/                   # SQLite database (gallery.db) + sessions
└── uploads/
    ├── products/           # optimised display images
    └── thumbnails/         # grid thumbnails
```

See **INSTALL.md** for detailed setup and deployment notes.

---

## Notes on stored images

To keep storage practical for a large photo set, imported images are stored as high-quality web-optimised JPEGs (max width configurable via `PRODUCT_IMAGE_MAX_WIDTH`, default 1600px) plus square thumbnails. Your original camera files remain untouched in your source folders/ZIP. Adjust quality/size in `.env`.

© ALEA Modular — Handle Gallery Pro.
