"""
Payment routes — Stripe Checkout and webhook.

Endpoints:
    POST /api/payments/checkout/{auction_id}  — Winner creates checkout session
    POST /api/payments/webhook                — Stripe webhook (raw body, no auth)
    GET  /api/payments/auction/{auction_id}   — Fetch payment record (winner/seller)
"""

from fastapi import APIRouter, Depends, Header, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user
from app.database import get_db
from app.models.user import User
from app.schemas.payment import CheckoutResponse, PaymentOut
from app.services.payment_service import (
    create_checkout_session,
    get_payment_by_auction,
    handle_webhook_event,
)

router = APIRouter()


# ── POST /api/payments/checkout/{auction_id} ──────────────────────────────────
@router.post(
    "/payments/checkout/{auction_id}",
    response_model=CheckoutResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create Stripe Checkout session (winner only)",
)
async def checkout(
    auction_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Create a Stripe-hosted Checkout session for the won auction.
    Only the auction winner can call this endpoint.
    Returns { checkout_url, payment } — redirect the browser to checkout_url.
    """
    return await create_checkout_session(
        db=db,
        auction_id=auction_id,
        requesting_user_id=current_user.id,
    )


# ── POST /api/payments/webhook ────────────────────────────────────────────────
@router.post(
    "/payments/webhook",
    status_code=status.HTTP_200_OK,
    summary="Stripe webhook receiver",
    include_in_schema=False,  # hide from Swagger; Stripe posts here directly
)
async def stripe_webhook(
    request: Request,
    db: AsyncSession = Depends(get_db),
    stripe_signature: str = Header(None, alias="stripe-signature"),
):
    """
    Receive and process Stripe webhook events.
    Stripe-Signature header is verified before any DB changes are made.
    """
    if not stripe_signature:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Missing Stripe-Signature header.",
        )

    # Read raw bytes — MUST NOT parse body before this point
    payload = await request.body()

    result = await handle_webhook_event(
        db=db,
        payload=payload,
        sig_header=stripe_signature,
    )
    return result


# ── GET /api/payments/auction/{auction_id} ────────────────────────────────────
@router.get(
    "/payments/auction/{auction_id}",
    response_model=PaymentOut,
    status_code=status.HTTP_200_OK,
    summary="Get payment record for an auction (winner or seller)",
)
async def get_payment(
    auction_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Fetch the payment record associated with a given auction.
    Only accessible by the auction winner or the seller.
    """
    payment = await get_payment_by_auction(
        db=db,
        auction_id=auction_id,
        requesting_user_id=current_user.id,
    )
    return payment
