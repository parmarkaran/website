@echo off
title CharacterVerse — Local AI Chat
color 0A
cls

echo.
echo  ╔══════════════════════════════════════════╗
echo  ║        CharacterVerse Launcher           ║
echo  ║    Local AI Chat — Runs on YOUR PC       ║
echo  ╚══════════════════════════════════════════╝
echo.

:: ── Check if Python is available ──────────────────────────
python --version >nul 2>&1
if %errorlevel% neq 0 (
  echo  [ERROR] Python is not installed or not in PATH.
  echo.
  echo  Download Python from: https://www.python.org/downloads/
  echo  Make sure to check "Add Python to PATH" during install.
  echo.
  pause
  exit /b 1
)

:: ── Allow Ollama to accept LAN requests (phone support) ──
set OLLAMA_HOST=0.0.0.0:11434
set OLLAMA_ORIGINS=*

:: ── Restart Ollama so env vars take effect ─────────────────
echo  Restarting Ollama with LAN support...
taskkill /IM ollama.exe /F >nul 2>&1
timeout /t 2 /nobreak >nul
start "" /B "C:\Users\Karan\AppData\Local\Programs\Ollama\ollama.exe" serve >nul 2>&1
timeout /t 3 /nobreak >nul

:: ── Kill anything already on port 8080 ────────────────────
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":3000 " 2^>nul') do (
  taskkill /PID %%a /F >nul 2>&1
)

echo  [1/2] Starting local web server on http://localhost:3000 ...
echo.
echo  ┌─────────────────────────────────────────────────────┐
echo  │  IMPORTANT: Make sure Ollama desktop app is running  │
echo  │  Download: https://ollama.com  (free, one-time)      │
echo  │                                                       │
echo  │  First time? Run this in a NEW terminal window:      │
echo  │    ollama pull llama3.2                               │
echo  │  (downloads the AI model, ~2GB, only once)           │
echo  └─────────────────────────────────────────────────────┘
echo.

:: ── Open browser after short delay ────────────────────────
echo  [2/2] Opening browser...
start "" "http://localhost:3000"

:: ── Start server (blocks until Ctrl+C) ────────────────────
echo.
echo  Server running at http://localhost:3000
echo.
echo  ┌─────────────────────────────────────────────────────┐
echo  │  PHONE / TABLET ACCESS (same Wi-Fi network)          │
echo  │                                                       │

:: ── Detect local Wi-Fi / LAN IP ───────────────────────────
set LAN_IP=
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /i "IPv4"') do (
  for /f "tokens=1" %%b in ("%%a") do (
    if not defined LAN_IP set LAN_IP=%%b
  )
)
if defined LAN_IP (
  echo  │  Open this on your phone:                             │
  echo  │  http://%LAN_IP%:3000                     │
) else (
  echo  │  Could not detect local IP automatically.            │
  echo  │  Run 'ipconfig' and look for IPv4 address.           │
)
echo  │                                                       │
echo  │  (Both devices must be on the same Wi-Fi)             │
echo  └─────────────────────────────────────────────────────┘
echo.
echo  Press Ctrl+C to stop.
echo.
python -m http.server 3000 --bind 0.0.0.0 --directory "%~dp0"

pause
