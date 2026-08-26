"""
Pydantic schemas for auction request/response payloads.
"""

from datetime import datetime
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, Field, field_validator


# ── Request schemas ────────────────────────────────────────────────────────────

class AuctionCreate(BaseModel):
    """Payload for POST /api/auctions."""

    title: str = Field(..., min_length=3, max_length=255, examples=["Vintage Rolex Watch"])
    description: str = Field(..., min_length=10, examples=["A rare 1965 Rolex Submariner in excellent condition."])
    category: str = Field(..., min_length=1, max_length=100, examples=["Watches"])
    starting_price: Decimal = Field(..., gt=0, examples=[500.00])
    end_time: datetime = Field(..., examples=["2025-12-31T23:59:00Z"])

    @field_validator("end_time")
    @classmethod
    def end_time_must_be_future(cls, v: datetime) -> datetime:
        from datetime import timezone
        now = datetime.now(timezone.utc)
        # Make naive datetimes timezone-aware for comparison
        if v.tzinfo is None:
            from datetime import timezone as tz
            v = v.replace(tzinfo=tz.utc)
        if v <= now:
            raise ValueError("end_time must be in the future")
        return v


class AuctionUpdate(BaseModel):
    """Payload for PUT /api/auctions/{id} — all fields optional."""

    title: Optional[str] = Field(None, min_length=3, max_length=255)
    description: Optional[str] = Field(None, min_length=10)
    category: Optional[str] = Field(None, min_length=1, max_length=100)
    end_time: Optional[datetime] = None

    @field_validator("end_time")
    @classmethod
    def end_time_must_be_future(cls, v: Optional[datetime]) -> Optional[datetime]:
        if v is None:
            return v
        from datetime import timezone
        now = datetime.now(timezone.utc)
        if v.tzinfo is None:
            v = v.replace(tzinfo=timezone.utc)
        if v <= now:
            raise ValueError("end_time must be in the future")
        return v


# ── Response schemas ───────────────────────────────────────────────────────────

class SellerInfo(BaseModel):
    """Minimal seller info embedded in auction responses."""
    id: str
    name: str
    email: str

    model_config = {"from_attributes": True}


class AuctionOut(BaseModel):
    """Full auction detail returned by GET /api/auctions/{id}."""

    id: str
    seller_id: str
    seller: Optional[SellerInfo] = None
    title: str
    description: str
    category: str
    image_urls: list[str]       # serialised from JSON string in DB
    starting_price: Decimal
    current_price: Decimal
    end_time: datetime
    status: str
    is_shipped: bool
    created_at: datetime
    bid_count: int = 0          # injected by the service layer

    model_config = {"from_attributes": True}


class AuctionListOut(BaseModel):
    """Compact card representation for GET /api/auctions list."""

    id: str
    seller_id: str
    title: str
    category: str
    image_urls: list[str]
    current_price: Decimal
    starting_price: Decimal
    end_time: datetime
    status: str
    created_at: datetime
    bid_count: int = 0

    model_config = {"from_attributes": True}


class PaginatedAuctions(BaseModel):
    """Paginated wrapper returned by GET /api/auctions."""

    items: list[AuctionListOut]
    total: int
    page: int
    limit: int
    has_more: bool
