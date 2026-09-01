"""
Auction routes — full CRUD + multi-image upload.

Endpoints:
    POST   /api/auctions              — create auction (auth required)
    GET    /api/auctions              — list with filters + pagination (public)
    GET    /api/auctions/{id}         — get single auction (public)
    PUT    /api/auctions/{id}         — update auction (seller only)
    DELETE /api/auctions/{id}         — delete auction (seller only, no bids)
"""

from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, Query, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user
from app.database import get_db
from app.models.user import User
from app.schemas.auction import AuctionOut, AuctionUpdate, PaginatedAuctions
from app.services.auction_service import (
    create_auction,
    delete_auction,
    get_auction,
    list_auctions,
    mark_shipped,
    update_auction,
)
from app.services.cloudinary_service import upload_image

router = APIRouter()


# ── POST /api/auctions ─────────────────────────────────────────────────────────
@router.post(
    "",
    response_model=AuctionOut,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new auction listing",
)
async def create_auction_route(
    # Form fields (multipart/form-data because we accept images)
    title: str = Form(..., min_length=3, max_length=255),
    description: str = Form(..., min_length=10),
    category: str = Form(..., min_length=1, max_length=100),
    starting_price: Decimal = Form(..., gt=0),
    end_time: str = Form(..., description="ISO 8601 datetime string, e.g. 2025-12-31T23:59:00Z"),
    images: list[UploadFile] = File(default=[], description="Up to 5 images"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> AuctionOut:
    """
    Create a new auction. Accepts multipart/form-data so images can be
    uploaded in the same request. Up to 5 images are allowed.
    """
    from datetime import datetime
    from app.schemas.auction import AuctionCreate

    # Parse end_time string to datetime
    try:
        from datetime import timezone
        parsed_end_time = datetime.fromisoformat(end_time.replace("Z", "+00:00"))
    except ValueError:
        from fastapi import HTTPException
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Invalid end_time format. Use ISO 8601, e.g. 2025-12-31T23:59:00Z",
        )

    # Validate with schema (runs field_validators including future end_time check)
    payload = AuctionCreate(
        title=title,
        description=description,
        category=category,
        starting_price=starting_price,
        end_time=parsed_end_time,
    )

    # Upload images to Cloudinary (max 5)
    image_urls: list[str] = []
    for img in images[:5]:
        file_bytes = await img.read()
        if file_bytes:
            url = await upload_image(file_bytes, filename=img.filename or "image")
            image_urls.append(url)

    return await create_auction(payload, seller_id=str(current_user.id), image_urls=image_urls, db=db)


# ── GET /api/auctions ──────────────────────────────────────────────────────────
@router.get(
    "",
    response_model=PaginatedAuctions,
    summary="List auctions with optional filters and pagination",
)
async def list_auctions_route(
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(12, ge=1, le=50, description="Items per page"),
    category: Optional[str] = Query(None, description="Filter by category"),
    keyword: Optional[str] = Query(None, description="Search in title/description"),
    min_price: Optional[Decimal] = Query(None, ge=0, description="Minimum current price"),
    max_price: Optional[Decimal] = Query(None, ge=0, description="Maximum current price"),
    ending_soon: bool = Query(False, description="Only show auctions ending within 1 hour"),
    status: Optional[str] = Query(None, description="Filter by status (open/closed/paid/cancelled)"),
    seller_id: Optional[str] = Query(None, description="Filter by seller user ID"),
    db: AsyncSession = Depends(get_db),
) -> PaginatedAuctions:
    """
    Public endpoint — no authentication required.
    Returns paginated auctions, filtered by the given query parameters.
    Default: only open auctions, sorted by soonest-ending first.
    """
    return await list_auctions(
        db,
        page=page,
        limit=limit,
        category=category,
        keyword=keyword,
        min_price=min_price,
        max_price=max_price,
        ending_soon=ending_soon,
        status_filter=status,
        seller_id=seller_id,
    )


# ── GET /api/auctions/{id} ─────────────────────────────────────────────────────
@router.get(
    "/{auction_id}",
    response_model=AuctionOut,
    summary="Get a single auction by ID",
)
async def get_auction_route(
    auction_id: str,
    db: AsyncSession = Depends(get_db),
) -> AuctionOut:
    """
    Public endpoint — returns full auction detail including seller info
    and bid count.
    """
    return await get_auction(auction_id, db)


# ── PUT /api/auctions/{id} ─────────────────────────────────────────────────────
@router.put(
    "/{auction_id}",
    response_model=AuctionOut,
    summary="Update an auction (seller only)",
)
async def update_auction_route(
    auction_id: str,
    payload: AuctionUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> AuctionOut:
    """
    Update title, description, category, or end_time of an auction.
    Only the original seller can update. Auction must still be open.
    """
    return await update_auction(auction_id, payload, seller_id=str(current_user.id), db=db)


# ── DELETE /api/auctions/{id} ──────────────────────────────────────────────────
@router.delete(
    "/{auction_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete an auction (seller only, no bids)",
)
async def delete_auction_route(
    auction_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    """
    Permanently delete an auction. Will fail if any bids have been placed.
    Only the original seller can delete.
    """
    await delete_auction(auction_id, seller_id=str(current_user.id), db=db)


# ── PUT /api/auctions/{id}/shipped ────────────────────────────────────────────────
@router.put(
    "/{auction_id}/shipped",
    response_model=AuctionOut,
    status_code=status.HTTP_200_OK,
    summary="Mark a paid auction as shipped (seller only)",
)
async def mark_shipped_route(
    auction_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> AuctionOut:
    """
    Seller marks a paid auction's item as shipped.
    Auction must have status 'paid'. Idempotent — re-marking as shipped is safe.
    """
    return await mark_shipped(auction_id, seller_id=str(current_user.id), db=db)
