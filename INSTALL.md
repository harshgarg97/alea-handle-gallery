# Installation & Run Guide — ALEA Handle Gallery Pro

This guide covers a fresh install on **Windows** (your main PC) and how to reach it from an **Android phone/tablet** on the same Wi-Fi.

---

## 1. Prerequisites

Install **Node.js 22.5 LTS or newer** (the app uses Node's built-in SQLite, so no C++ build tools are required) (includes `npm`): https://nodejs.org

Verify in a terminal / PowerShell:

```powershell
node -v
npm -v
```

---

## 2. Install

Open PowerShell in the project folder (`ALEA-Handle-Gallery-Pro`) and run:

```powershell
npm install
```

This downloads Express, better-sqlite3, sharp, etc. The first install may take a couple of minutes because `sharp` and `better-sqlite3` fetch prebuilt native binaries.

> **If `npm install` fails on native modules:** install the build tools once with
> `npm install --global windows-build-tools` (older Node) or ensure you are on Node 18/20 LTS where prebuilt binaries are available, then re-run `npm install`.

---

## 3. Configure (optional but recommended)

Copy the example environment file and edit it:

```powershell
copy .env.example .env
notepad .env
```

Important values:

| Setting | Meaning |
|---|---|
| `PORT` | Port the server listens on (default `3000`). |
| `ADMIN_USER` / `ADMIN_PASSWORD` | Admin login. **Change the password.** |
| `SESSION_SECRET` | Long random string for signing sessions. |
| `PRODUCT_IMAGE_MAX_WIDTH` | Max width (px) for stored images (default 1600). |
| `THUMBNAIL_WIDTH` | Thumbnail size (default 420). |
| `IMAGE_QUALITY` | JPEG quality 1–100 (default 82). |

---

## 4. Run

```powershell
npm start
```

You should see:

```
  ALEA Handle Gallery Pro
  ----------------------------------------
  Running:   http://localhost:3000
```

Open **http://localhost:3000** in your browser.

- Sign in at `/login` with your admin credentials.
- If the package shipped with the catalogue pre-loaded, products appear immediately.

To keep it running in the background you can use a process manager such as **pm2**:

```powershell
npm install --global pm2
pm2 start server.js --name alea-gallery
pm2 save
```

---

## 5. Loading your catalogue

### Option A — Bulk ZIP upload (in the app)
1. Sign in → **Upload**.
2. Drag in a ZIP that contains **one folder per product** (each folder full of that handle's photos).
3. Click **Import Catalogue**. Products, cover images, galleries and thumbnails are created automatically.

### Option B — Seed from a folder (command line)
```powershell
node scripts/seed-from-zip.js "C:\path\to\harsh" "C:\path\to\handles.json"
```
The optional `handles.json` enriches model numbers, finishes and sizes.

Reset everything: `npm run reset-db`.

---

## 6. View on an Android phone (same Wi-Fi)

1. Find your PC's local IP address:
   ```powershell
   ipconfig
   ```
   Look for the `IPv4 Address`, e.g. `192.168.1.42`.
2. Allow Node through the Windows Firewall the first time it asks (Private networks).
3. On your phone's browser, visit `http://192.168.1.42:3000`.

The interface is fully responsive and works as a mobile-app-style catalogue. Add it to your home screen for quick access.

---

## 7. Backups

Everything lives in two places — back these up together:

- `data/gallery.db` — the database.
- `uploads/` — product images and thumbnails.

Copying these to another machine (with the code) reproduces the catalogue exactly.

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| `EADDRINUSE` | Port already in use — change `PORT` in `.env`. |
| Images not showing | Confirm the `uploads/` folder exists and was copied with the project. |
| Can't log in | Check `ADMIN_USER` / `ADMIN_PASSWORD` in `.env`; restart the server after edits. |
| Phone can't connect | Same Wi-Fi? Firewall allowing Node on private network? Correct IPv4 + `:3000`? |
| npm install errors | Use Node 22 LTS or newer and re-run. The app needs no native compiler. |

© ALEA Modular — Handle Gallery Pro.
