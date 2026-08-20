@echo off
title AuctionSphere - Stopping Project...
color 0C

echo.
echo  ==========================================
echo    AuctionSphere - Stopping All Services
echo  ==========================================
echo.

:: ── Stop Docker containers ─────────────────────────────────────────────────
echo [1/3] Stopping Database (Docker)...
where docker >nul 2>&1
if %errorlevel% equ 0 (
    cd /d d:\Projects\Auction
    docker compose down
    echo  Database stopped.
) else (
    echo  Docker not found, skipping.
)
echo.

:: ── Kill uvicorn (backend) ─────────────────────────────────────────────────
echo [2/3] Stopping Backend (uvicorn)...
taskkill /f /im uvicorn.exe >nul 2>&1
echo  Backend stopped.
echo.

:: ── Kill node (frontend vite) ──────────────────────────────────────────────
echo [3/3] Stopping Frontend (Vite/Node)...
taskkill /f /fi "WINDOWTITLE eq AuctionSphere - Frontend" >nul 2>&1
echo  Frontend stopped.
echo.

echo  All services stopped. Goodbye!
echo.
pause
