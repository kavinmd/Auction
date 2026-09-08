"""
Day 13 — Payment Webhook Tests (Task 13.5)

Covers:
  - Mock stripe.Webhook.construct_event() to return a fake checkout.session.completed event
    → assert payment.status == 'succeeded' and auction.status == 'paid'
  - Mock a payment_intent.payment_failed event
    → assert payment.status == 'failed'
  - Missing Stripe-Signature header → 400
"""

import json
import uuid
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from unittest.mock import MagicMock, patch

import bcrypt
import pytest
from httpx import AsyncClient
from sqlalchemy import select

from app.models.auction import Auction, AuctionStatus
from app.models.bid import Bid
from app.models.payment import Payment, PaymentStatus
from app.models.user import User
from tests.conftest import TestAsyncSessionLocal


# ── helpers ──────────────────────────────────────────────────────────────────

async def _create_user(name: str = "User") -> User:
    async with TestAsyncSessionLocal() as db:
        user = User(
            id=str(uuid.uuid4()),
            name=name,
            email=f"user_{uuid.uuid4().hex[:8]}@example.com",
            password_hash=bcrypt.hashpw(b"Secret@123", bcrypt.gensalt()).decode(),
            is_admin=False,
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)
        return user


async def _create_closed_auction(seller_id: str) -> Auction:
    async with TestAsyncSessionLocal() as db:
        auction = Auction(
            id=str(uuid.uuid4()),
            seller_id=seller_id,
            title="Webhook Test Camera",
            description="Testing webhook flow.",
            category="Electronics",
            image_urls="[]",
            starting_price=Decimal("500.00"),
            current_price=Decimal("800.00"),
            end_time=datetime.now(timezone.utc) - timedelta(hours=1),
            status=AuctionStatus.closed,
        )
        db.add(auction)
        await db.commit()
        await db.refresh(auction)
        return auction


async def _create_bid(auction_id: str, bidder_id: str, amount: Decimal) -> Bid:
    async with TestAsyncSessionLocal() as db:
        bid = Bid(
            id=str(uuid.uuid4()),
            auction_id=auction_id,
            bidder_id=bidder_id,
            amount=amount,
        )
        db.add(bid)
        await db.commit()
        await db.refresh(bid)
        return bid


async def _create_pending_payment(
    auction_id: str,
    winner_id: str,
    stripe_session_id: str,
    amount: Decimal,
) -> Payment:
    async with TestAsyncSessionLocal() as db:
        payment = Payment(
            auction_id=auction_id,
            winner_id=winner_id,
            stripe_payment_id=stripe_session_id,
            amount=amount,
            status=PaymentStatus.pending,
        )
        db.add(payment)
        await db.commit()
        await db.refresh(payment)
        return payment


def _fake_checkout_completed_event(stripe_session_id: str, auction_id: str) -> MagicMock:
    """Build a mock Stripe event object for checkout.session.completed."""
    event = MagicMock()
    event.__getitem__ = lambda self, key: {
        "type": "checkout.session.completed",
        "data": {
            "object": {
                "id": stripe_session_id,
                "metadata": {"auction_id": auction_id, "winner_id": "any"},
            }
        },
    }[key]
    return event


def _fake_payment_failed_event(payment_intent_id: str) -> MagicMock:
    """Build a mock Stripe event object for payment_intent.payment_failed."""
    event = MagicMock()
    event.__getitem__ = lambda self, key: {
        "type": "payment_intent.payment_failed",
        "data": {
            "object": {"id": payment_intent_id}
        },
    }[key]
    return event


# ── Tests ─────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_webhook_checkout_completed_updates_payment_and_auction(client: AsyncClient):
    """
    POST /api/payments/webhook with a mocked checkout.session.completed event
    → payment.status == 'succeeded', auction.status == 'paid'.
    """
    seller = await _create_user("Webhook Seller")
    winner = await _create_user("Webhook Winner")
    auction = await _create_closed_auction(seller_id=seller.id)
    await _create_bid(auction.id, winner.id, Decimal("800.00"))

    fake_session_id = f"cs_test_{uuid.uuid4().hex}"
    payment = await _create_pending_payment(auction.id, winner.id, fake_session_id, Decimal("800.00"))

    fake_event = _fake_checkout_completed_event(fake_session_id, auction.id)

    with patch("stripe.Webhook.construct_event", return_value=fake_event):
        res = await client.post(
            "/api/payments/webhook",
            content=b'{"fake": "payload"}',
            headers={
                "stripe-signature": "t=1,v1=fakesig",
                "content-type": "application/json",
            },
        )

    assert res.status_code == 200, res.text

    # Verify payment is succeeded
    async with TestAsyncSessionLocal() as db:
        updated_payment = await db.get(Payment, payment.id)
        assert updated_payment.status == PaymentStatus.succeeded

    # Verify auction is paid
    async with TestAsyncSessionLocal() as db:
        updated_auction = await db.get(Auction, auction.id)
        assert updated_auction.status == AuctionStatus.paid


@pytest.mark.asyncio
async def test_webhook_payment_failed_marks_payment_failed(client: AsyncClient):
    """
    POST /api/payments/webhook with a mocked payment_intent.payment_failed event
    → payment.status == 'failed'.
    """
    seller = await _create_user("Fail Seller")
    winner = await _create_user("Fail Winner")
    auction = await _create_closed_auction(seller_id=seller.id)

    # Use the payment_intent_id as the stripe_payment_id (partial match lookup)
    fake_intent_id = f"pi_test_{uuid.uuid4().hex}"
    payment = await _create_pending_payment(auction.id, winner.id, fake_intent_id, Decimal("600.00"))

    fake_event = _fake_payment_failed_event(fake_intent_id)

    with patch("stripe.Webhook.construct_event", return_value=fake_event):
        res = await client.post(
            "/api/payments/webhook",
            content=b'{"fake": "payload"}',
            headers={
                "stripe-signature": "t=1,v1=fakesig",
                "content-type": "application/json",
            },
        )

    assert res.status_code == 200, res.text

    async with TestAsyncSessionLocal() as db:
        updated_payment = await db.get(Payment, payment.id)
        assert updated_payment.status == PaymentStatus.failed


@pytest.mark.asyncio
async def test_webhook_missing_signature_returns_400(client: AsyncClient):
    """
    POST /api/payments/webhook with no Stripe-Signature header → 400.
    """
    res = await client.post(
        "/api/payments/webhook",
        content=b'{"type": "checkout.session.completed"}',
        headers={"content-type": "application/json"},
    )
    assert res.status_code == 400, res.text
