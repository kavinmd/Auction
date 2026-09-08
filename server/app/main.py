from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import settings

# ── Import all models so SQLAlchemy metadata is fully populated ───────────────
# This is required for Alembic autogenerate to detect all tables
from app.models.user import User  # noqa: F401
from app.models.auction import Auction  # noqa: F401
from app.models.bid import Bid  # noqa: F401
from app.models.payment import Payment  # noqa: F401
from app.models.watchlist import Watchlist  # noqa: F401
from app.models.notification import Notification  # noqa: F401


from app.jobs.auction_scheduler import start_scheduler, stop_scheduler
from app.middleware.security_headers import SecurityHeadersMiddleware

# ── Lifespan (startup / shutdown) ─────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Application startup and shutdown lifecycle.
    Scheduler and other background services registered here.
    """
    # ── Startup ──────────────────────────────────────────────────────────────
    print("[AuctionSphere] API starting up...", flush=True)
    start_scheduler()

    yield  # ← application runs here

    # ── Shutdown ─────────────────────────────────────────────────────────────
    print("[AuctionSphere] API shutting down...", flush=True)
    stop_scheduler()


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

# ── Security Headers ──────────────────────────────────────────────────────────
app.add_middleware(SecurityHeadersMiddleware)


# ── Global Exception Handlers (14.1 — structured error responses) ─────────────
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(
    request: Request, exc: RequestValidationError
) -> JSONResponse:
    """
    Convert Pydantic validation errors into a consistent, human-readable format.
    Returns HTTP 422 with { detail: [ { field, message } ] }.
    """
    errors = [
        {
            "field": " → ".join(str(loc) for loc in err["loc"] if loc != "body"),
            "message": err["msg"],
        }
        for err in exc.errors()
    ]
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={"detail": errors},
    )


@app.exception_handler(Exception)
async def unhandled_exception_handler(
    request: Request, exc: Exception
) -> JSONResponse:
    """
    Catch-all for unexpected server errors.
    Logs the error but returns a safe generic message — no stack trace to the client.
    """
    import logging
    logging.getLogger("auctionsphere").error(
        "Unhandled exception on %s %s: %s",
        request.method,
        request.url.path,
        exc,
        exc_info=True,
    )
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "An unexpected server error occurred. Please try again later."},
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
from app.routes import notifications  # noqa: E402
from app.routes import payments   # noqa: E402
from app.routes import watchlist  # noqa: E402
from app.routes import admin      # noqa: E402
from app.websocket import auction_socket  # noqa: E402

app.include_router(auth.router,           prefix="/api/auth",     tags=["Auth"])
app.include_router(auctions.router,       prefix="/api/auctions", tags=["Auctions"])
app.include_router(bids.router,           prefix="/api",          tags=["Bids"])
app.include_router(notifications.router,  prefix="/api",          tags=["Notifications"])
app.include_router(payments.router,       prefix="/api",          tags=["Payments"])
app.include_router(watchlist.router,      prefix="/api",          tags=["Watchlist"])
app.include_router(admin.router,          prefix="/api/admin",    tags=["Admin"])
app.include_router(auction_socket.router, tags=["WebSocket"])


# ── Health check ──────────────────────────────────────────────────────────────
@app.get("/health", tags=["Health"])
async def health_check():
    return {"status": "ok", "service": "AuctionSphere API"}
