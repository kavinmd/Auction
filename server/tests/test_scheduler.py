"""
Tests for Day 9: Scheduler & Notifications.
Verifies outbid notifications, auction auto-closing background job, and notification API routes.
"""

import uuid
from datetime import datetime, timedelta, timezone
from decimal import Decimal

import bcrypt
import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import select

from app.auth.jwt_handler import create_access_token
from app.database import AsyncSessionLocal
from app.jobs.auction_scheduler import check_and_close_auctions
from app.main import app
from app.models.auction import Auction, AuctionStatus
from app.models.bid import Bid
from app.models.notification import Notification
from app.models.user import User
from app.services.bid_service import place_bid
from tests.conftest import TestAsyncSessionLocal


async def create_test_user(email: str = None, name: str = "Test User") -> User:
    """Helper to create a test user in DB."""
    async with TestAsyncSessionLocal() as db:
        unique_email = email or f"user_{uuid.uuid4().hex[:8]}@example.com"
        user = User(
            id=str(uuid.uuid4()),
            name=name,
            email=unique_email,
            password_hash=bcrypt.hashpw(b"Secret@123", bcrypt.gensalt()).decode("utf-8"),
            is_admin=False,
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)
        return user


async def create_test_auction(
    seller_id: str,
    title: str = "Vintage Watch",
    starting_price: Decimal = Decimal("1000.00"),
    duration_seconds: int = 3600,
) -> Auction:
    """Helper to create a test auction."""
    async with TestAsyncSessionLocal() as db:
        end_time = datetime.now(timezone.utc) + timedelta(seconds=duration_seconds)
        auction = Auction(
            id=str(uuid.uuid4()),
            seller_id=seller_id,
            title=title,
            description="A rare collectable vintage watch.",
            category="Watches",
            starting_price=starting_price,
            current_price=starting_price,
            end_time=end_time,
            status=AuctionStatus.open,
        )
        db.add(auction)
        await db.commit()
        await db.refresh(auction)
        return auction


@pytest.mark.asyncio
async def test_outbid_notification():
    """Test that placing a bid notifies the previous highest bidder."""
    seller = await create_test_user(name="Seller")
    bidder1 = await create_test_user(name="Bidder One")
    bidder2 = await create_test_user(name="Bidder Two")

    auction = await create_test_auction(seller_id=seller.id, title="Rolex Submariner")

    # Bidder 1 places initial bid
    async with TestAsyncSessionLocal() as db:
        await place_bid(db=db, auction_id=auction.id, bidder_id=bidder1.id, amount=Decimal("1100.00"))

    # Bidder 2 outbids Bidder 1
    async with TestAsyncSessionLocal() as db:
        await place_bid(db=db, auction_id=auction.id, bidder_id=bidder2.id, amount=Decimal("1200.00"))

    # Check that Bidder 1 received an outbid notification
    async with TestAsyncSessionLocal() as db:
        stmt = select(Notification).where(Notification.user_id == bidder1.id)
        res = await db.execute(stmt)
        notes = res.scalars().all()
        assert len(notes) == 1
        assert "outbid" in notes[0].message
        assert "Rolex Submariner" in notes[0].message


@pytest.mark.asyncio
async def test_auction_scheduler_auto_close():
    """Test that check_and_close_auctions closes expired auctions and notifies winner and seller."""
    seller = await create_test_user(name="Seller AutoClose")
    bidder = await create_test_user(name="Winner AutoClose")

    # Create auction that expired 10 seconds ago
    auction = await create_test_auction(seller_id=seller.id, title="Expired Camera", duration_seconds=-10)

    # Place bid directly on expired auction for test setup
    async with TestAsyncSessionLocal() as db:
        bid = Bid(
            auction_id=auction.id,
            bidder_id=bidder.id,
            amount=Decimal("1500.00"),
            created_at=datetime.now(timezone.utc),
        )
        db.add(bid)

        # Update auction current_price
        auction_db = await db.get(Auction, auction.id)
        auction_db.current_price = Decimal("1500.00")
        await db.commit()

    # Execute scheduler check
    await check_and_close_auctions()

    # Verify auction is closed
    async with TestAsyncSessionLocal() as db:
        closed_auction = await db.get(Auction, auction.id)
        assert closed_auction.status == AuctionStatus.closed

        # Check notifications for winner and seller
        winner_notes_res = await db.execute(select(Notification).where(Notification.user_id == bidder.id))
        winner_notes = winner_notes_res.scalars().all()
        assert len(winner_notes) == 1
        assert "won the auction" in winner_notes[0].message

        seller_notes_res = await db.execute(select(Notification).where(Notification.user_id == seller.id))
        seller_notes = seller_notes_res.scalars().all()
        assert len(seller_notes) == 1
        assert "closed and sold" in seller_notes[0].message


@pytest.mark.asyncio
async def test_notification_api_routes(client: AsyncClient):
    """Test GET /api/users/me/notifications and PUT /api/notifications/{id}/read."""
    user = await create_test_user(name="Notification API User")

    # Insert notification for user
    async with TestAsyncSessionLocal() as db:
        note = Notification(user_id=user.id, message="Test API notification message")
        db.add(note)
        await db.commit()
        await db.refresh(note)
        note_id = note.id

    token = create_access_token(user.id)
    headers = {"Authorization": f"Bearer {token}"}

    # 1. GET notifications
    get_res = await client.get("/api/users/me/notifications", headers=headers)
    assert get_res.status_code == 200
    data = get_res.json()
    assert len(data) == 1
    assert data[0]["id"] == note_id
    assert data[0]["is_read"] is False

    # 2. PUT mark notification as read
    read_res = await client.put(f"/api/notifications/{note_id}/read", headers=headers)
    assert read_res.status_code == 200
    read_data = read_res.json()
    assert read_data["id"] == note_id
    assert read_data["is_read"] is True
