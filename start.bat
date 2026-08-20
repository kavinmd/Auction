@echo off
title AuctionSphere - Starting Project...
color 0A

echo.
echo  ==========================================
echo    AuctionSphere - Project Launcher
echo  ==========================================
echo.

:: ── Step 1: Database (Docker - optional) ──────────────────────────────────
echo [1/3] Checking Database (Docker)...
where docker >nul 2>&1
if %errorlevel% neq 0 (
    color 0E
    echo  [SKIP] Docker not found - skipping database startup.
    echo  The backend will run but DB-dependent routes won't work.
    echo  Install Docker Desktop to enable the database:
    echo  https://www.docker.com/products/docker-desktop/
    color 0A
) else (
    docker info >nul 2>&1
    if %errorlevel% neq 0 (
        echo  [SKIP] Docker is installed but not running. Start Docker Desktop first.
        color 0A
    ) else (
        echo  Starting PostgreSQL + pgAdmin containers...
        docker compose up -d
        echo  Database started on localhost:5432
    )
)
echo.

:: ── Step 2: Start Backend (FastAPI) in a new window ───────────────────────
echo [2/3] Starting Backend (FastAPI on http://localhost:8000)...
start "AuctionSphere - Backend" cmd /k "cd /d d:\Projects\Auction\server && call venv\Scripts\activate && uvicorn app.main:app --reload --host 0.0.0.0 --port 8000"
echo  Backend window opened.
echo.

:: ── Small delay to let backend initialize ─────────────────────────────────
timeout /t 3 /nobreak >nul

:: ── Step 3: Start Frontend (Vite) in a new window ─────────────────────────
echo [3/3] Starting Frontend (Vite on http://localhost:5173)...
start "AuctionSphere - Frontend" cmd /k "cd /d d:\Projects\Auction\client && npm run dev"
echo  Frontend window opened.
echo.

:: ── Summary ───────────────────────────────────────────────────────────────
echo  ==========================================
echo    Services are starting up!
echo  ==========================================
echo.
echo   Frontend      --^>  http://localhost:5173
echo   Backend API   --^>  http://localhost:8000
echo   API Docs      --^>  http://localhost:8000/docs
echo.
echo  Press any key to open the app in your browser...
pause >nul

start http://localhost:5173
start http://localhost:8000/docs
