"""
Bid service — concurrency-safe bid placement with PostgreSQL row-level locking and anti-sniping.

Key Design Decisions:
1. Concurrency Control: Every bid is processed inside a transaction using `SELECT ... FOR UPDATE`
   to acquire a row-level exclusive lock on the auction record. This eliminates race conditions
   where two concurrent requests evaluate against a stale current price.
2. Anti-Sniping Protection: If a bid is accepted within 60 seconds of the auction's end time,
   the deadline is automatically extended by 2 minutes.
3. Strict Validation: Checks auction status, expiration, seller isolation, and minimum price increment.
"""

from datetime import datetime, timedelta, timezone
from decimal import Decimal

from fastapi import HTTPException, status
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.auction import Auction, AuctionStatus
from app.models.bid import Bid
from app.models.user import User
from app.schemas.bid import BidderInfo, BidOut, UserBidOut


async def place_bid(
    db: AsyncSession,
    auction_id: str,
    bidder_id: str,
    amount: Decimal,
) -> BidOut:
    """
    Place a concurrency-safe bid on an auction.

    Uses `SELECT ... FOR UPDATE` to lock the auction row during validation and update.
    """
    # ── 1. Acquire exclusive row-level lock on auction ─────────────────────────
    stmt = (
        select(Auction)
        .where(Auction.id == auction_id)
        .with_for_update()
    )
    result = await db.execute(stmt)
    auction = result.scalar_one_or_none()

    if auction is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Auction not found.",
        )

    # ── 2. Validation inside locked critical section ───────────────────────────
    # Status check
    if auction.status != AuctionStatus.open:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot bid on an auction with status '{auction.status.value if hasattr(auction.status, 'value') else auction.status}'.",
        )

    # Expiration check
    now = datetime.now(timezone.utc)
    auction_end = auction.end_time
    if auction_end.tzinfo is None:
        auction_end = auction_end.replace(tzinfo=timezone.utc)

    if now >= auction_end:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This auction has already ended.",
        )

    # Seller isolation: seller cannot bid on their own auction
    if auction.seller_id == bidder_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Sellers cannot place bids on their own auctions.",
        )

    # Bid amount must strictly exceed current highest price
    if amount <= auction.current_price:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Bid amount of {amount} must be strictly greater than the current price of {auction.current_price}.",
        )

    # ── 3. Anti-sniping: extend end_time if bid placed in last 60 seconds ──────
    time_remaining_seconds = (auction_end - now).total_seconds()
    if 0 < time_remaining_seconds < 60:
        auction.end_time = auction_end + timedelta(minutes=2)

    # ── 4. Insert new bid & update auction current_price ──────────────────────
    bid = Bid(
        auction_id=auction_id,
        bidder_id=bidder_id,
        amount=amount,
        created_at=now,
    )
    db.add(bid)
    auction.current_price = amount

    await db.commit()
    await db.refresh(bid)

    # Fetch bidder information for response
    bidder_stmt = select(User).where(User.id == bidder_id)
    bidder_res = await db.execute(bidder_stmt)
    bidder = bidder_res.scalar_one_or_none()

    bidder_info = (
        BidderInfo(id=str(bidder.id), name=bidder.name, email=bidder.email)
        if bidder
        else None
    )

    # ── 5. Broadcast WebSocket real-time updates ─────────────────────────────
    from app.websocket.connection_manager import manager

    if 0 < time_remaining_seconds < 60:
        await manager.broadcast(
            auction_id,
            {
                "type": "time_extended",
                "auction_id": auction_id,
                "new_end_time": auction.end_time.isoformat(),
            },
        )

    await manager.broadcast(
        auction_id,
        {
            "type": "new_bid",
            "id": str(bid.id),
            "auction_id": auction_id,
            "bidder_id": bidder_id,
            "bidder_name": bidder.name if bidder else "Anonymous",
            "amount": float(bid.amount),
            "current_price": float(auction.current_price),
            "end_time": auction.end_time.isoformat(),
            "created_at": bid.created_at.isoformat(),
        },
    )

    return BidOut(
        id=str(bid.id),
        auction_id=str(bid.auction_id),
        bidder_id=str(bid.bidder_id),
        amount=bid.amount,
        created_at=bid.created_at,
        bidder=bidder_info,
    )


async def get_auction_bids(
    db: AsyncSession,
    auction_id: str,
) -> list[BidOut]:
    """
    Fetch all bids placed on a specific auction, ordered from newest to oldest.
    """
    stmt = (
        select(Bid, User)
        .outerjoin(User, Bid.bidder_id == User.id)
        .where(Bid.auction_id == auction_id)
        .order_by(desc(Bid.created_at))
    )
    rows = await db.execute(stmt)
    results = rows.all()

    bids_out: list[BidOut] = []
    for bid, user in results:
        bidder_info = (
            BidderInfo(id=str(user.id), name=user.name, email=user.email)
            if user
            else None
        )
        bids_out.append(
            BidOut(
                id=str(bid.id),
                auction_id=str(bid.auction_id),
                bidder_id=str(bid.bidder_id),
                amount=bid.amount,
                created_at=bid.created_at,
                bidder=bidder_info,
            )
        )

    return bids_out


async def get_user_bids(
    db: AsyncSession,
    user_id: str,
) -> list[UserBidOut]:
    """
    Fetch all bids placed by the authenticated user across all auctions.
    """
    stmt = (
        select(Bid, Auction)
        .outerjoin(Auction, Bid.auction_id == Auction.id)
        .where(Bid.bidder_id == user_id)
        .order_by(desc(Bid.created_at))
    )
    rows = await db.execute(stmt)
    results = rows.all()

    user_bids: list[UserBidOut] = []
    for bid, auction in results:
        is_winning = False
        if auction:
            is_winning = (
                auction.current_price == bid.amount
                and auction.status == AuctionStatus.open
            )

        user_bids.append(
            UserBidOut(
                id=str(bid.id),
                auction_id=str(bid.auction_id),
                amount=bid.amount,
                created_at=bid.created_at,
                auction_title=auction.title if auction else None,
                auction_status=(
                    auction.status.value
                    if auction and hasattr(auction.status, "value")
                    else str(auction.status) if auction else None
                ),
                auction_end_time=auction.end_time if auction else None,
                auction_current_price=auction.current_price if auction else None,
                is_winning=is_winning,
            )
        )

    return user_bids
