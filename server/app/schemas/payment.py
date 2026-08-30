"""
Pydantic schemas for payment payloads.
"""

from datetime import datetime
from pydantic import BaseModel

from app.models.payment import PaymentStatus


class PaymentOut(BaseModel):
    """Payment response schema."""

    id: str
    auction_id: str
    winner_id: str
    stripe_payment_id: str | None
    amount: float
    status: PaymentStatus
    created_at: datetime

    model_config = {"from_attributes": True}


class CheckoutResponse(BaseModel):
    """Response returned after creating a Stripe Checkout session."""

    checkout_url: str
    payment: PaymentOut
