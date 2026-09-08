"""
Admin routes — platform oversight endpoints.

All routes require `require_admin` dependency (authenticated + is_admin=True).

Endpoints:
    GET    /api/admin/users            — list all registered users
    GET    /api/admin/auctions         — list all auctions (any status)
    DELETE /api/admin/auctions/{id}    — hard-delete any auction listing
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional

from app.auth.admin_dependency import require_admin
from app.database import get_db
from app.models.auction import Auction
from app.models.bid import Bid
from app.models.user import User
from app.schemas.auction import AuctionOut, PaginatedAuctions
from app.schemas.user import UserOut

router = APIRouter()


# ── GET /api/admin/users ──────────────────────────────────────────────────────
@router.get(
    "/users",
    response_model=list[UserOut],
    summary="[Admin] List all registered users",
)
async def admin_list_users(
    _admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> list[UserOut]:
    """
    Returns every user account in the system ordered by registration date
    (newest first). Only accessible by admin users.
    """
    result = await db.execute(select(User).order_by(User.created_at.desc()))
    users = result.scalars().all()
    return [UserOut.model_validate(u) for u in users]


# ── GET /api/admin/auctions ───────────────────────────────────────────────────
@router.get(
    "/auctions",
    response_model=PaginatedAuctions,
    summary="[Admin] List all auctions (any status)",
)
async def admin_list_auctions(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    status_filter: Optional[str] = Query(None, alias="status"),
    keyword: Optional[str] = Query(None),
    _admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> PaginatedAuctions:
    """
    Returns paginated auctions regardless of status.
    Supports optional keyword search and status filter.
    """
    query = select(Auction)

    if status_filter:
        query = query.where(Auction.status == status_filter)
    if keyword:
        ilike = f"%{keyword}%"
        query = query.where(
            Auction.title.ilike(ilike) | Auction.description.ilike(ilike)
        )

    # Count total
    count_q = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_q)
    total = total_result.scalar_one()

    # Paginate
    offset = (page - 1) * limit
    result = await db.execute(
        query.order_by(Auction.created_at.desc()).offset(offset).limit(limit)
    )
    auctions = result.scalars().all()

    # Attach bid counts
    auction_ids = [str(a.id) for a in auctions]
    bid_counts: dict[str, int] = {}
    if auction_ids:
        bc_result = await db.execute(
            select(Bid.auction_id, func.count(Bid.id).label("cnt"))
            .where(Bid.auction_id.in_(auction_ids))
            .group_by(Bid.auction_id)
        )
        for row in bc_result.all():
            bid_counts[str(row.auction_id)] = row.cnt

    items = []
    for a in auctions:
        out = AuctionOut.model_validate(a)
        out.bid_count = bid_counts.get(str(a.id), 0)
        items.append(out)

    return PaginatedAuctions(
        items=items,
        total=total,
        page=page,
        limit=limit,
        has_more=(offset + len(items)) < total,
    )


# ── DELETE /api/admin/auctions/{id} ──────────────────────────────────────────
@router.delete(
    "/auctions/{auction_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="[Admin] Hard-delete any auction listing",
)
async def admin_delete_auction(
    auction_id: str,
    _admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> None:
    """
    Permanently removes an auction regardless of its status or bid history.
    Cascades to associated bids (handled by DB FK cascade or manual delete).
    """
    result = await db.execute(select(Auction).where(Auction.id == auction_id))
    auction = result.scalar_one_or_none()

    if not auction:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Auction {auction_id} not found.",
        )

    # Delete associated bids first (if no cascade defined at DB level)
    await db.execute(
        Bid.__table__.delete().where(Bid.auction_id == auction_id)  # type: ignore[attr-defined]
    )
    await db.delete(auction)
    await db.commit()
