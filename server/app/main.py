from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings


# ── Lifespan (startup / shutdown) ─────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Application startup and shutdown lifecycle.
    Scheduler and other background services will be registered here (Day 9).
    """
    # ── Startup ──────────────────────────────────────────────────────────────
    print("[AuctionSphere] API starting up...", flush=True)

    yield  # ← application runs here

    # ── Shutdown ─────────────────────────────────────────────────────────────
    print("[AuctionSphere] API shutting down...", flush=True)


# ── FastAPI app ───────────────────────────────────────────────────────────────
app = FastAPI(
    title="AuctionSphere API",
    description="Real-time online auction platform — FastAPI backend",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)


# ── CORS ──────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_url],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Routers (will be added as each phase is built) ────────────────────────────
# from app.routes import auth, auctions, bids, watchlist, payments, notifications
# app.include_router(auth.router, prefix="/api/auth", tags=["Auth"])
# app.include_router(auctions.router, prefix="/api/auctions", tags=["Auctions"])
# app.include_router(bids.router, prefix="/api", tags=["Bids"])
# app.include_router(watchlist.router, prefix="/api/watchlist", tags=["Watchlist"])
# app.include_router(payments.router, prefix="/api/payments", tags=["Payments"])
# app.include_router(notifications.router, prefix="/api", tags=["Notifications"])


# ── Health check ──────────────────────────────────────────────────────────────
@app.get("/health", tags=["Health"])
async def health_check():
    return {"status": "ok", "service": "AuctionSphere API"}
