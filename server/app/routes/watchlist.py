"""
Watchlist routes — add, remove, and list auctions on a user's watchlist.

Endpoints:
    POST   /api/watchlist/{auction_id}        — Add auction to watchlist (auth)
    DELETE /api/watchlist/{auction_id}        — Remove auction from watchlist (auth)
    GET    /api/users/me/watchlist            — Get user's watchlist (auth)
"""

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user
from app.database import get_db
from app.models.user import User
from app.schemas.auction import AuctionOut
from app.services.watchlist_service import (
    add_to_watchlist,
    remove_from_watchlist,
    get_user_watchlist,
)

router = APIRouter()


# ── POST /api/watchlist/{auction_id} ──────────────────────────────────────────
@router.post(
    "/watchlist/{auction_id}",
    status_code=status.HTTP_200_OK,
    summary="Add an auction to the current user's watchlist",
)
async def add_watchlist_route(
    auction_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Add an auction to the authenticated user's watchlist.
    If already on watchlist, returns 200 (not 409).
    """
    result = await add_to_watchlist(
        db=db,
        user_id=str(current_user.id),
        auction_id=auction_id,
    )
    return result


# ── DELETE /api/watchlist/{auction_id} ────────────────────────────────────────
@router.delete(
    "/watchlist/{auction_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Remove an auction from the current user's watchlist",
)
async def remove_watchlist_route(
    auction_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    """
    Remove an auction from the authenticated user's watchlist.
    Idempotent — silently succeeds if the entry doesn't exist.
    """
    await remove_from_watchlist(
        db=db,
        user_id=str(current_user.id),
        auction_id=auction_id,
    )


# ── GET /api/users/me/watchlist ────────────────────────────────────────────────
@router.get(
    "/users/me/watchlist",
    response_model=list[AuctionOut],
    status_code=status.HTTP_200_OK,
    summary="Get the current user's watchlist",
)
async def get_watchlist_route(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[AuctionOut]:
    """
    Return all auctions on the authenticated user's watchlist.
    Auctions are ordered by soonest ending first.
    """
    return await get_user_watchlist(
        db=db,
        user_id=str(current_user.id),
    )
