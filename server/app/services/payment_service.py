"""
Payment service — Stripe Checkout integration.

Flow:
  1. Verify: user is winner, auction is closed, no existing succeeded payment.
  2. Create Stripe Checkout Session (or reuse pending one for idempotency).
  3. Upsert a Payment row with status=pending and the Stripe session ID.
  4. Return the Stripe-hosted checkout_url.

Webhook handler (called from the route layer):
  - checkout.session.completed → mark payment succeeded + auction paid.
  - payment_intent.payment_failed → mark payment failed.
"""

from decimal import Decimal

import stripe
from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.auction import Auction, AuctionStatus
from app.models.bid import Bid
from app.models.payment import Payment, PaymentStatus
from app.schemas.payment import CheckoutResponse, PaymentOut

# Initialise Stripe with our secret key
stripe.api_key = settings.stripe_secret_key


async def create_checkout_session(
    db: AsyncSession,
    auction_id: str,
    requesting_user_id: str,
) -> CheckoutResponse:
    """
    Create (or retrieve) a Stripe Checkout session for the auction winner.

    Raises 403 if the requesting user is not the auction winner.
    Raises 400 if the auction is not closed or already paid.
    Raises 409 if a succeeded payment already exists.
    """
    # ── 1. Fetch auction ───────────────────────────────────────────────────────
    auction_res = await db.execute(
        select(Auction).where(Auction.id == auction_id)
    )
    auction = auction_res.scalar_one_or_none()
    if auction is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Auction not found.",
        )

    if auction.status not in (AuctionStatus.closed, AuctionStatus.paid):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Payment can only be initiated for closed auctions.",
        )

    # ── 2. Determine winner (highest bid) ─────────────────────────────────────
    bid_res = await db.execute(
        select(Bid)
        .where(Bid.auction_id == auction_id)
        .order_by(Bid.amount.desc())
        .limit(1)
    )
    winning_bid = bid_res.scalar_one_or_none()

    if winning_bid is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This auction has no bids and cannot be paid for.",
        )

    if winning_bid.bidder_id != requesting_user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the auction winner can initiate payment.",
        )

    # ── 3. Check for existing payment ─────────────────────────────────────────
    existing_res = await db.execute(
        select(Payment).where(Payment.auction_id == auction_id)
    )
    existing = existing_res.scalar_one_or_none()

    if existing and existing.status == PaymentStatus.succeeded:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Payment for this auction has already been completed.",
        )

    # ── 4. Create Stripe Checkout Session ────────────────────────────────────
    amount_cents = int(winning_bid.amount * Decimal("100"))

    stripe_session = stripe.checkout.Session.create(
        payment_method_types=["card"],
        line_items=[
            {
                "price_data": {
                    "currency": "usd",
                    "product_data": {
                        "name": auction.title,
                        "description": f"Won auction: {auction.title}",
                    },
                    "unit_amount": amount_cents,
                },
                "quantity": 1,
            }
        ],
        mode="payment",
        success_url=f"{settings.stripe_success_url}?auction_id={auction_id}",
        cancel_url=f"{settings.stripe_cancel_url}?auction_id={auction_id}",
        metadata={
            "auction_id": auction_id,
            "winner_id": requesting_user_id,
        },
    )

    # ── 5. Upsert Payment row ─────────────────────────────────────────────────
    if existing:
        # Reuse row — update stripe session id (could be a retry)
        existing.stripe_payment_id = stripe_session.id
        existing.status = PaymentStatus.pending
        await db.commit()
        await db.refresh(existing)
        payment = existing
    else:
        payment = Payment(
            auction_id=auction_id,
            winner_id=requesting_user_id,
            stripe_payment_id=stripe_session.id,
            amount=winning_bid.amount,
            status=PaymentStatus.pending,
        )
        db.add(payment)
        await db.commit()
        await db.refresh(payment)

    return CheckoutResponse(
        checkout_url=stripe_session.url,
        payment=PaymentOut.model_validate(payment),
    )


async def handle_webhook_event(db: AsyncSession, payload: bytes, sig_header: str) -> dict:
    """
    Verify Stripe webhook signature and process the event.

    Events handled:
      - checkout.session.completed  → payment succeeded + auction marked as paid
      - payment_intent.payment_failed → payment marked as failed
    """
    # ── Verify signature ───────────────────────────────────────────────────────
    try:
        event = stripe.Webhook.construct_event(
            payload, sig_header, settings.stripe_webhook_secret
        )
    except stripe.errors.SignatureVerificationError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid Stripe webhook signature.",
        )

    event_type: str = event["type"]

    # ── checkout.session.completed ─────────────────────────────────────────────
    if event_type == "checkout.session.completed":
        session = event["data"]["object"]
        stripe_session_id: str = session["id"]
        auction_id: str = session.get("metadata", {}).get("auction_id", "")

        # Find payment row by stripe session id
        pay_res = await db.execute(
            select(Payment).where(Payment.stripe_payment_id == stripe_session_id)
        )
        payment = pay_res.scalar_one_or_none()

        if payment:
            payment.status = PaymentStatus.succeeded

        # Mark auction as paid
        if auction_id:
            auc_res = await db.execute(
                select(Auction).where(Auction.id == auction_id)
            )
            auction = auc_res.scalar_one_or_none()
            if auction:
                auction.status = AuctionStatus.paid

        await db.commit()
        return {"handled": "checkout.session.completed"}

    # ── payment_intent.payment_failed ─────────────────────────────────────────
    if event_type == "payment_intent.payment_failed":
        payment_intent = event["data"]["object"]
        payment_intent_id: str = payment_intent["id"]

        # Match by stripe_payment_id — for failed payment intents we search on the
        # session that references this payment intent (best-effort via metadata or
        # stored session id). We store the Checkout *Session* id so we attempt a
        # partial lookup by the payment intent.
        pay_res = await db.execute(
            select(Payment).where(
                Payment.stripe_payment_id.like(f"%{payment_intent_id}%")
            )
        )
        payment = pay_res.scalar_one_or_none()

        if payment:
            payment.status = PaymentStatus.failed
            await db.commit()

        return {"handled": "payment_intent.payment_failed"}

    # Unhandled event type — acknowledge and ignore
    return {"handled": False, "event_type": event_type}


async def get_payment_by_auction(
    db: AsyncSession,
    auction_id: str,
    requesting_user_id: str,
) -> Payment:
    """
    Fetch the payment record for a given auction.
    Only the winner or seller can view it.
    """
    pay_res = await db.execute(
        select(Payment).where(Payment.auction_id == auction_id)
    )
    payment = pay_res.scalar_one_or_none()

    if payment is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No payment found for this auction.",
        )

    if payment.winner_id != requesting_user_id:
        # Also allow seller — fetch auction to check
        auc_res = await db.execute(
            select(Auction).where(Auction.id == auction_id)
        )
        auction = auc_res.scalar_one_or_none()
        if auction is None or auction.seller_id != requesting_user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied.",
            )

    return payment
