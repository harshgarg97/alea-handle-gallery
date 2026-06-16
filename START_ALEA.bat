@echo off
title ALEA Handle Gallery Pro
cd /d "%~dp0"
set NODE_NO_WARNINGS=1
color 0E
echo ============================================================
echo            ALEA Handle Gallery Pro - Launcher
echo ============================================================
echo.

REM --- Check Node.js ---
where node >nul 2>nul
if errorlevel 1 (
  color 0C
  echo [ERROR] Node.js is not installed or not on PATH.
  echo Please install Node.js 22 LTS or newer from https://nodejs.org
  echo then run this file again.
  pause
  start "" https://nodejs.org
  exit /b 1
)
for /f "tokens=*" %%v in ('node -v') do set NODEV=%%v
echo Node.js detected: %NODEV%
echo.

REM --- Remove sandbox build leftovers if present ---
if exist ".nm_old" rmdir /s /q ".nm_old" >nul 2>nul
if exist "install.log" del /q "install.log" >nul 2>nul
if exist "data\gallery.db-journal" del /q "data\gallery.db-journal" >nul 2>nul

REM --- Install dependencies (clean) if not already done ---
if exist ".deps_ok" if exist "node_modules\sharp\package.json" goto run

echo Preparing a clean install of dependencies...
if exist "node_modules" rmdir /s /q "node_modules"
if exist "package-lock.json" del /q "package-lock.json"
echo Installing (first run, this can take a few minutes)...
echo.
call npm install --no-audit --no-fund
if errorlevel 1 (
  color 0C
  echo.
  echo [ERROR] npm install failed. See messages above.
  pause
  exit /b 1
)
echo installed> ".deps_ok"
echo.
echo Dependencies installed.
echo.

:run
echo Starting the server...
echo Opening http://localhost:3000 in your browser...
echo.
echo Keep this window OPEN while you use the catalogue.
echo Close this window (or press Ctrl+C) to stop the server.
echo ------------------------------------------------------------
echo.
start "" http://localhost:3000
node server.js
pause
