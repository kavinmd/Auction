from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings

# ── Import all models so SQLAlchemy metadata is fully populated ───────────────
# This is required for Alembic autogenerate to detect all tables
from app.models.user import User  # noqa: F401
from app.models.auction import Auction  # noqa: F401
from app.models.bid import Bid  # noqa: F401
from app.models.payment import Payment  # noqa: F401
from app.models.watchlist import Watchlist  # noqa: F401
from app.models.notification import Notification  # noqa: F401


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


# ─── Rate Limiter (SlowAPI) ───────────────────────────────────────────────────
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)


# ─── Static files (Local uploads fallback) ────────────────────────────────────
import os
from fastapi.staticfiles import StaticFiles
os.makedirs("uploads", exist_ok=True)
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")


# ─── Routers ──────────────────────────────────────────────────────────────────
from app.routes import auth       # noqa: E402
from app.routes import auctions   # noqa: E402
from app.routes import bids       # noqa: E402
from app.websocket import auction_socket  # noqa: E402

app.include_router(auth.router,           prefix="/api/auth",     tags=["Auth"])
app.include_router(auctions.router,       prefix="/api/auctions", tags=["Auctions"])
app.include_router(bids.router,           prefix="/api",          tags=["Bids"])
app.include_router(auction_socket.router, tags=["WebSocket"])
# app.include_router(watchlist.router, prefix="/api/watchlist", tags=["Watchlist"])
# app.include_router(payments.router, prefix="/api/payments", tags=["Payments"])
# app.include_router(notifications.router, prefix="/api", tags=["Notifications"])


# ── Health check ──────────────────────────────────────────────────────────────
@app.get("/health", tags=["Health"])
async def health_check():
    return {"status": "ok", "service": "AuctionSphere API"}
