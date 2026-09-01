"""
Watchlist service — add/remove auctions to/from a user's watchlist.

Design:
- add_to_watchlist(): upsert guard — if the entry already exists, return 200 (not 409).
- remove_from_watchlist(): silently succeeds if entry doesn't exist (idempotent).
- get_user_watchlist(): returns list of AuctionOut objects on the user's watchlist.
"""

import json
from typing import Any

from fastapi import HTTPException, status
from sqlalchemy import select, func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.watchlist import Watchlist
from app.models.auction import Auction
from app.models.bid import Bid
from app.models.user import User
from app.schemas.auction import AuctionOut


# ── Helpers ────────────────────────────────────────────────────────────────────

def _decode_images(raw: str) -> list[str]:
    """Deserialise JSON-encoded image URLs from DB."""
    try:
        return json.loads(raw)
    except (json.JSONDecodeError, TypeError):
        return []


def _build_auction_out(auction: Auction, bid_count: int = 0, seller: Any = None) -> AuctionOut:
    """Convert ORM Auction row → AuctionOut schema."""
    data = {
        "id": auction.id,
        "seller_id": auction.seller_id,
        "title": auction.title,
        "description": auction.description,
        "category": auction.category,
        "image_urls": _decode_images(auction.image_urls),
        "starting_price": auction.starting_price,
        "current_price": auction.current_price,
        "end_time": auction.end_time,
        "status": auction.status.value if hasattr(auction.status, "value") else auction.status,
        "is_shipped": auction.is_shipped,
        "created_at": auction.created_at,
        "bid_count": bid_count,
        "seller": seller,
    }
    return AuctionOut(**data)


# ── Service functions ──────────────────────────────────────────────────────────

async def add_to_watchlist(
    db: AsyncSession,
    user_id: str,
    auction_id: str,
) -> dict:
    """
    Add an auction to the user's watchlist.

    Upsert guard: if already exists, returns existing entry (200, no error).
    Raises:
        HTTPException 404: Auction not found.
    """
    # Verify auction exists
    result = await db.execute(select(Auction).where(Auction.id == auction_id))
    auction = result.scalar_one_or_none()
    if auction is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Auction not found.",
        )

    # Check if already on watchlist (upsert guard)
    existing = await db.execute(
        select(Watchlist).where(
            Watchlist.user_id == user_id,
            Watchlist.auction_id == auction_id,
        )
    )
    if existing.scalar_one_or_none():
        return {"user_id": user_id, "auction_id": auction_id, "already_exists": True}

    # Insert new watchlist entry
    try:
        entry = Watchlist(user_id=user_id, auction_id=auction_id)
        db.add(entry)
        await db.commit()
    except IntegrityError:
        await db.rollback()
        # Race condition: another request added it first — still a success
        pass

    return {"user_id": user_id, "auction_id": auction_id, "already_exists": False}


async def remove_from_watchlist(
    db: AsyncSession,
    user_id: str,
    auction_id: str,
) -> None:
    """
    Remove an auction from the user's watchlist.

    Idempotent: silently succeeds if entry doesn't exist.
    """
    result = await db.execute(
        select(Watchlist).where(
            Watchlist.user_id == user_id,
            Watchlist.auction_id == auction_id,
        )
    )
    entry = result.scalar_one_or_none()
    if entry:
        await db.delete(entry)
        await db.commit()


async def get_user_watchlist(
    db: AsyncSession,
    user_id: str,
) -> list[AuctionOut]:
    """
    Return the full list of auctions on the user's watchlist.

    Returns enriched AuctionOut objects (with bid_count).
    """
    # Fetch all watchlist auction IDs for this user
    wl_result = await db.execute(
        select(Watchlist.auction_id).where(Watchlist.user_id == user_id)
    )
    auction_ids = [row[0] for row in wl_result.all()]

    if not auction_ids:
        return []

    # Bid count subquery
    bid_count_subq = (
        select(Bid.auction_id, func.count(Bid.id).label("bid_count"))
        .group_by(Bid.auction_id)
        .subquery()
    )

    # Fetch auctions with bid counts
    stmt = (
        select(Auction, func.coalesce(bid_count_subq.c.bid_count, 0).label("bid_count"))
        .outerjoin(bid_count_subq, Auction.id == bid_count_subq.c.auction_id)
        .where(Auction.id.in_(auction_ids))
        .order_by(Auction.end_time.asc())
    )
    rows = await db.execute(stmt)
    results = rows.all()

    return [_build_auction_out(row.Auction, row.bid_count) for row in results]


async def is_on_watchlist(
    db: AsyncSession,
    user_id: str,
    auction_id: str,
) -> bool:
    """Check if a specific auction is on the user's watchlist."""
    result = await db.execute(
        select(Watchlist).where(
            Watchlist.user_id == user_id,
            Watchlist.auction_id == auction_id,
        )
    )
    return result.scalar_one_or_none() is not None
