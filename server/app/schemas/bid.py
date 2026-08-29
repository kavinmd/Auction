"""
Pydantic schemas for bid request/response payloads.
"""

from datetime import datetime
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, Field


class BidCreate(BaseModel):
    """Payload for POST /api/auctions/{id}/bids."""

    amount: Decimal = Field(..., gt=0, examples=[1500.00], description="Bid amount in currency units")


class BidderInfo(BaseModel):
    """Public bidder information."""

    id: str
    name: str
    email: Optional[str] = None

    model_config = {"from_attributes": True}


class BidOut(BaseModel):
    """Single bid response returned by bid endpoints."""

    id: str
    auction_id: str
    bidder_id: str
    bidder: Optional[BidderInfo] = None
    amount: Decimal
    created_at: datetime

    model_config = {"from_attributes": True}


class UserBidOut(BaseModel):
    """Bid summary for GET /api/users/me/bids."""

    id: str
    auction_id: str
    amount: Decimal
    created_at: datetime
    auction_title: Optional[str] = None
    auction_status: Optional[str] = None
    auction_end_time: Optional[datetime] = None
    auction_current_price: Optional[Decimal] = None
    is_winning: bool = False

    model_config = {"from_attributes": True}


class BidHistoryList(BaseModel):
    """List of bids with total count."""

    items: list[BidOut]
    total: int
