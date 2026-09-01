"""
Auction service — all business logic for auction CRUD.

Key design decisions:
- image_urls are stored as a JSON string in the Text column (avoids
  PostgreSQL ARRAY type so the code stays DB-agnostic).
- list_auctions() uses SQLAlchemy core filters and a sub-query COUNT
  for bid_count so we avoid N+1 queries.
- delete_auction() is guarded: you cannot delete an auction that already
  has bids placed on it.
"""

import json
from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.auction import Auction, AuctionStatus
from app.models.bid import Bid
from app.models.user import User
from app.schemas.auction import AuctionCreate, AuctionListOut, AuctionOut, AuctionUpdate, PaginatedAuctions


# ── Helpers ────────────────────────────────────────────────────────────────────

def _encode_images(urls: list[str]) -> str:
    """Serialise list of URL strings to a JSON string for DB storage."""
    return json.dumps(urls)


def _decode_images(raw: str) -> list[str]:
    """Deserialise JSON string from DB back to a Python list."""
    try:
        return json.loads(raw)
    except (json.JSONDecodeError, TypeError):
        return []


def _build_auction_out(auction: Auction, bid_count: int = 0, seller: Optional[User] = None) -> AuctionOut:
    """Convert an ORM Auction row → AuctionOut, handling the image JSON."""
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


def _build_list_out(auction: Auction, bid_count: int = 0) -> AuctionListOut:
    """Convert an ORM Auction row → AuctionListOut (compact card)."""
    data = {
        "id": auction.id,
        "seller_id": auction.seller_id,
        "title": auction.title,
        "category": auction.category,
        "image_urls": _decode_images(auction.image_urls),
        "current_price": auction.current_price,
        "starting_price": auction.starting_price,
        "end_time": auction.end_time,
        "status": auction.status.value if hasattr(auction.status, "value") else auction.status,
        "created_at": auction.created_at,
        "bid_count": bid_count,
    }
    return AuctionListOut(**data)


# ── Service functions ──────────────────────────────────────────────────────────

async def create_auction(
    payload: AuctionCreate,
    seller_id: str,
    image_urls: list[str],
    db: AsyncSession,
) -> AuctionOut:
    """
    Insert a new auction row.

    Args:
        payload:    Validated AuctionCreate schema.
        seller_id:  ID of the authenticated seller.
        image_urls: List of Cloudinary URLs already uploaded by the route.
        db:         Async DB session.

    Returns:
        AuctionOut with the newly created auction data.
    """
    auction = Auction(
        seller_id=seller_id,
        title=payload.title,
        description=payload.description,
        category=payload.category,
        image_urls=_encode_images(image_urls),
        starting_price=payload.starting_price,
        current_price=payload.starting_price,   # starts at starting price
        end_time=payload.end_time,
        status=AuctionStatus.open,
    )
    db.add(auction)
    await db.commit()
    await db.refresh(auction)

    # Fetch seller info for the response
    result = await db.execute(select(User).where(User.id == seller_id))
    seller = result.scalar_one_or_none()

    return _build_auction_out(auction, bid_count=0, seller=seller)


async def get_auction(auction_id: str, db: AsyncSession) -> AuctionOut:
    """
    Return a single auction by ID with seller info and bid count.

    Raises:
        HTTPException 404: If the auction does not exist.
    """
    # Auction row
    result = await db.execute(select(Auction).where(Auction.id == auction_id))
    auction = result.scalar_one_or_none()
    if auction is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Auction not found.")

    # Bid count
    count_result = await db.execute(
        select(func.count()).where(Bid.auction_id == auction_id)
    )
    bid_count = count_result.scalar() or 0

    # Seller info
    seller_result = await db.execute(select(User).where(User.id == auction.seller_id))
    seller = seller_result.scalar_one_or_none()

    return _build_auction_out(auction, bid_count=bid_count, seller=seller)


async def list_auctions(
    db: AsyncSession,
    *,
    page: int = 1,
    limit: int = 12,
    category: Optional[str] = None,
    keyword: Optional[str] = None,
    min_price: Optional[Decimal] = None,
    max_price: Optional[Decimal] = None,
    ending_soon: bool = False,
    seller_id: Optional[str] = None,
    status_filter: Optional[str] = None,
) -> PaginatedAuctions:
    """
    Return a paginated list of auctions with optional filters.

    Filters:
        category:     Exact category match (case-insensitive).
        keyword:      Partial match on title or description.
        min_price:    Minimum current_price.
        max_price:    Maximum current_price.
        ending_soon:  Only auctions ending within the next 60 minutes.
        seller_id:    Only auctions from a specific seller.
        status_filter: Filter by status string (e.g. "open").
    """
    # ── Sub-query: bid count per auction ─────────────────────────────────────
    bid_count_subq = (
        select(Bid.auction_id, func.count(Bid.id).label("bid_count"))
        .group_by(Bid.auction_id)
        .subquery()
    )

    # ── Base query ────────────────────────────────────────────────────────────
    stmt = (
        select(Auction, func.coalesce(bid_count_subq.c.bid_count, 0).label("bid_count"))
        .outerjoin(bid_count_subq, Auction.id == bid_count_subq.c.auction_id)
    )

    # ── Apply filters ─────────────────────────────────────────────────────────
    if category:
        stmt = stmt.where(func.lower(Auction.category) == category.lower())

    if keyword:
        pattern = f"%{keyword}%"
        stmt = stmt.where(
            Auction.title.ilike(pattern) | Auction.description.ilike(pattern)
        )

    if min_price is not None:
        stmt = stmt.where(Auction.current_price >= min_price)

    if max_price is not None:
        stmt = stmt.where(Auction.current_price <= max_price)

    if ending_soon:
        from datetime import timedelta
        cutoff = datetime.now(timezone.utc) + timedelta(hours=1)
        stmt = stmt.where(
            Auction.end_time <= cutoff,
            Auction.status == AuctionStatus.open,
        )

    if seller_id:
        stmt = stmt.where(Auction.seller_id == seller_id)

    if status_filter:
        try:
            s = AuctionStatus(status_filter)
            stmt = stmt.where(Auction.status == s)
        except ValueError:
            pass  # ignore invalid status strings
    else:
        # Default: only show open auctions on the public list
        stmt = stmt.where(Auction.status == AuctionStatus.open)

    # ── Total count (before pagination) ───────────────────────────────────────
    count_stmt = select(func.count()).select_from(stmt.subquery())
    total_result = await db.execute(count_stmt)
    total = total_result.scalar() or 0

    # ── Order + paginate ──────────────────────────────────────────────────────
    stmt = stmt.order_by(Auction.end_time.asc()).offset((page - 1) * limit).limit(limit)
    rows = await db.execute(stmt)
    results = rows.all()

    items = [_build_list_out(row.Auction, row.bid_count) for row in results]

    return PaginatedAuctions(
        items=items,
        total=total,
        page=page,
        limit=limit,
        has_more=(page * limit) < total,
    )


async def update_auction(
    auction_id: str,
    payload: AuctionUpdate,
    seller_id: str,
    db: AsyncSession,
) -> AuctionOut:
    """
    Update an existing auction.

    Only the seller can edit their own auction.
    Raises:
        HTTPException 404: Auction not found.
        HTTPException 403: Caller is not the seller.
        HTTPException 400: Auction is no longer open (can't edit closed/paid).
    """
    result = await db.execute(select(Auction).where(Auction.id == auction_id))
    auction = result.scalar_one_or_none()

    if auction is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Auction not found.")

    if auction.seller_id != seller_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You can only edit your own auctions.")

    if auction.status != AuctionStatus.open:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot edit an auction with status '{auction.status.value}'."
        )

    # Apply partial updates
    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(auction, field, value)

    await db.commit()
    await db.refresh(auction)

    # Fetch bid count and seller for response
    count_result = await db.execute(select(func.count()).where(Bid.auction_id == auction_id))
    bid_count = count_result.scalar() or 0

    seller_result = await db.execute(select(User).where(User.id == auction.seller_id))
    seller = seller_result.scalar_one_or_none()

    return _build_auction_out(auction, bid_count=bid_count, seller=seller)


async def delete_auction(
    auction_id: str,
    seller_id: str,
    db: AsyncSession,
) -> None:
    """
    Delete an auction.

    Guards:
    - Only the seller (or an admin handled at route level) can delete.
    - Cannot delete if any bids have been placed.

    Raises:
        HTTPException 404: Auction not found.
        HTTPException 403: Not the seller.
        HTTPException 400: Bids have been placed — cannot delete.
    """
    result = await db.execute(select(Auction).where(Auction.id == auction_id))
    auction = result.scalar_one_or_none()

    if auction is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Auction not found.")

    if auction.seller_id != seller_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You can only delete your own auctions.")

    # Guard: no bids placed
    count_result = await db.execute(select(func.count()).where(Bid.auction_id == auction_id))
    bid_count = count_result.scalar() or 0

    if bid_count > 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete an auction that already has bids.",
        )

    await db.delete(auction)
    await db.commit()


async def mark_shipped(
    auction_id: str,
    seller_id: str,
    db: AsyncSession,
) -> AuctionOut:
    """
    Mark a paid auction as shipped by the seller.

    Raises:
        HTTPException 404: Auction not found.
        HTTPException 403: Caller is not the seller.
        HTTPException 400: Auction is not in 'paid' status.
    """
    result = await db.execute(select(Auction).where(Auction.id == auction_id))
    auction = result.scalar_one_or_none()

    if auction is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Auction not found.")

    if auction.seller_id != seller_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only the seller can mark an item as shipped.")

    if auction.status != AuctionStatus.paid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only paid auctions can be marked as shipped.",
        )

    if auction.is_shipped:
        # Already shipped — idempotent, just return current state
        count_result = await db.execute(select(func.count()).where(Bid.auction_id == auction_id))
        bid_count = count_result.scalar() or 0
        seller_result = await db.execute(select(User).where(User.id == auction.seller_id))
        seller = seller_result.scalar_one_or_none()
        return _build_auction_out(auction, bid_count=bid_count, seller=seller)

    auction.is_shipped = True
    await db.commit()
    await db.refresh(auction)

    count_result = await db.execute(select(func.count()).where(Bid.auction_id == auction_id))
    bid_count = count_result.scalar() or 0
    seller_result = await db.execute(select(User).where(User.id == auction.seller_id))
    seller = seller_result.scalar_one_or_none()

    return _build_auction_out(auction, bid_count=bid_count, seller=seller)
