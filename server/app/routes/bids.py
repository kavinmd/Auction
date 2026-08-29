"""
Bid routes — placing bids with rate limiting, fetching auction bid history, and personal bid history.

Endpoints:
    POST /api/auctions/{id}/bids   — Place bid (auth required, rate-limited)
    GET  /api/auctions/{id}/bids   — Public bid history for an auction
    GET  /api/users/me/bids        — Personal bid history for authenticated user
"""

from fastapi import APIRouter, Depends, Request, status
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user
from app.database import get_db
from app.models.user import User
from app.schemas.bid import BidCreate, BidOut, UserBidOut
from app.services.bid_service import (
    get_auction_bids,
    get_user_bids,
    place_bid,
)

limiter = Limiter(key_func=get_remote_address)
router = APIRouter()


# ── POST /api/auctions/{id}/bids ───────────────────────────────────────────────
@router.post(
    "/auctions/{auction_id}/bids",
    response_model=BidOut,
    status_code=status.HTTP_201_CREATED,
    summary="Place a concurrency-safe bid on an auction",
)
@limiter.limit("10/minute")
async def place_bid_route(
    request: Request,
    auction_id: str,
    payload: BidCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> BidOut:
    """
    Place a new bid on an open auction listing.

    - Uses PostgreSQL row-level locking (`SELECT ... FOR UPDATE`) to eliminate race conditions.
    - Validates that the bid is strictly higher than the current price.
    - Anti-sniping: Automatically extends end time by 2 minutes if placed in the final 60 seconds.
    - Rate limited to 10 bids/minute per client IP to prevent spam attacks.
    """
    return await place_bid(
        db=db,
        auction_id=auction_id,
        bidder_id=str(current_user.id),
        amount=payload.amount,
    )


# ── GET /api/auctions/{id}/bids ────────────────────────────────────────────────
@router.get(
    "/auctions/{auction_id}/bids",
    response_model=list[BidOut],
    summary="Get public bid history for an auction",
)
async def get_auction_bids_route(
    auction_id: str,
    db: AsyncSession = Depends(get_db),
) -> list[BidOut]:
    """
    Public endpoint — returns the list of all bids placed on this auction, ordered from newest to oldest.
    """
    return await get_auction_bids(db=db, auction_id=auction_id)


# ── GET /api/users/me/bids ────────────────────────────────────────────────────
@router.get(
    "/users/me/bids",
    response_model=list[UserBidOut],
    summary="Get personal bid history for the current user",
)
async def get_user_bids_route(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[UserBidOut]:
    """
    Authenticated endpoint — returns all bids placed by the current user with live status and winning flags.
    """
    return await get_user_bids(db=db, user_id=str(current_user.id))
