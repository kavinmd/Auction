"""
Tests for bidding logic, concurrency safety (SELECT ... FOR UPDATE), and anti-sniping.
"""

import asyncio
import uuid
from datetime import datetime, timedelta, timezone
from decimal import Decimal

import bcrypt
import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import select

from app.auth.jwt_handler import create_access_token
from app.main import app
from app.models.auction import Auction, AuctionStatus
from app.models.bid import Bid
from app.models.user import User
from tests.conftest import TestAsyncSessionLocal


async def create_test_user(email: str = None, name: str = "Test User") -> User:
    """Helper to insert a test user."""
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
    starting_price: Decimal = Decimal("1000.00"),
    duration_hours: int = 24,
    status: AuctionStatus = AuctionStatus.open,
) -> Auction:
    """Helper to insert a test auction."""
    async with TestAsyncSessionLocal() as db:
        end_time = datetime.now(timezone.utc) + timedelta(hours=duration_hours)
        auction = Auction(
            id=str(uuid.uuid4()),
            seller_id=seller_id,
            title="Vintage Rolex Submariner",
            description="Rare collectors watch in mint condition.",
            category="Watches",
            image_urls="[]",
            starting_price=starting_price,
            current_price=starting_price,
            end_time=end_time,
            status=status,
        )
        db.add(auction)
        await db.commit()
        await db.refresh(auction)
        return auction


@pytest.mark.asyncio
async def test_place_bid_success(client: AsyncClient):
    """Verify that a valid bid updates auction price and creates a bid record."""
    seller = await create_test_user()
    bidder = await create_test_user()
    auction = await create_test_auction(seller_id=str(seller.id), starting_price=Decimal("1000.00"))

    token = create_access_token(str(bidder.id))
    headers = {"Authorization": f"Bearer {token}"}

    response = await client.post(
        f"/api/auctions/{auction.id}/bids",
        json={"amount": 1200.00},
        headers=headers,
    )

    assert response.status_code == 201, response.text
    data = response.json()
    assert float(data["amount"]) == 1200.00
    assert data["auction_id"] == str(auction.id)
    assert data["bidder_id"] == str(bidder.id)

    # Verify in DB
    async with TestAsyncSessionLocal() as db:
        updated_auction = (await db.execute(select(Auction).where(Auction.id == auction.id))).scalar_one()
        assert updated_auction.current_price == Decimal("1200.00")


@pytest.mark.asyncio
async def test_place_bid_lower_or_equal_amount(client: AsyncClient):
    """Verify that a bid lower than or equal to current_price is rejected with HTTP 400."""
    seller = await create_test_user()
    bidder = await create_test_user()
    auction = await create_test_auction(seller_id=str(seller.id), starting_price=Decimal("1000.00"))

    token = create_access_token(str(bidder.id))
    headers = {"Authorization": f"Bearer {token}"}

    # Equal to starting price
    res_equal = await client.post(
        f"/api/auctions/{auction.id}/bids",
        json={"amount": 1000.00},
        headers=headers,
    )
    assert res_equal.status_code == 400

    # Lower than starting price
    res_lower = await client.post(
        f"/api/auctions/{auction.id}/bids",
        json={"amount": 950.00},
        headers=headers,
    )
    assert res_lower.status_code == 400


@pytest.mark.asyncio
async def test_seller_cannot_bid_on_own_auction(client: AsyncClient):
    """Verify that sellers cannot bid on their own auctions."""
    seller = await create_test_user()
    auction = await create_test_auction(seller_id=str(seller.id), starting_price=Decimal("1000.00"))

    token = create_access_token(str(seller.id))
    headers = {"Authorization": f"Bearer {token}"}

    response = await client.post(
        f"/api/auctions/{auction.id}/bids",
        json={"amount": 1500.00},
        headers=headers,
    )

    assert response.status_code == 400
    assert "Sellers cannot place bids on their own auctions" in response.json()["detail"]


@pytest.mark.asyncio
async def test_anti_sniping_extension(client: AsyncClient):
    """Verify that a bid in the final 60 seconds auto-extends the auction end_time by 2 minutes."""
    seller = await create_test_user()
    bidder = await create_test_user()

    # Create auction ending in 30 seconds
    async with TestAsyncSessionLocal() as db:
        initial_end = datetime.now(timezone.utc) + timedelta(seconds=30)
        auction = Auction(
            id=str(uuid.uuid4()),
            seller_id=str(seller.id),
            title="Anti-sniping Test Watch",
            description="Testing timer extension.",
            category="Watches",
            image_urls="[]",
            starting_price=Decimal("500.00"),
            current_price=Decimal("500.00"),
            end_time=initial_end,
            status=AuctionStatus.open,
        )
        db.add(auction)
        await db.commit()
        await db.refresh(auction)

    token = create_access_token(str(bidder.id))
    headers = {"Authorization": f"Bearer {token}"}

    response = await client.post(
        f"/api/auctions/{auction.id}/bids",
        json={"amount": 600.00},
        headers=headers,
    )

    assert response.status_code == 201

    # Verify end_time extended in DB (should be roughly initial_end + 2 minutes)
    async with TestAsyncSessionLocal() as db:
        updated_auction = (await db.execute(select(Auction).where(Auction.id == auction.id))).scalar_one()
        time_diff = (updated_auction.end_time - initial_end).total_seconds()
        assert 110 <= time_diff <= 130  # extended by ~120s (2 minutes)


@pytest.mark.asyncio
async def test_bid_concurrency_race_condition():
    """
    CRITICAL TEST: Verify that simultaneous bids at the exact same price
    result in exactly ONE winning bid and ONE rejection due to SELECT ... FOR UPDATE locking.
    """
    seller = await create_test_user()
    bidder_1 = await create_test_user()
    bidder_2 = await create_test_user()

    auction = await create_test_auction(
        seller_id=str(seller.id),
        starting_price=Decimal("1000.00"),
    )

    token_1 = create_access_token(str(bidder_1.id))
    token_2 = create_access_token(str(bidder_2.id))

    headers_1 = {"Authorization": f"Bearer {token_1}"}
    headers_2 = {"Authorization": f"Bearer {token_2}"}

    transport = ASGITransport(app=app)

    async def place_concurrent_bid(headers, amount):
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            return await client.post(
                f"/api/auctions/{auction.id}/bids",
                json={"amount": amount},
                headers=headers,
            )

    # Fire both bids simultaneously for the exact same amount (1500.00)
    response_1, response_2 = await asyncio.gather(
        place_concurrent_bid(headers_1, 1500.00),
        place_concurrent_bid(headers_2, 1500.00),
    )

    status_codes = [response_1.status_code, response_2.status_code]

    # Exactly one must succeed (201) and exactly one must be rejected (400)
    assert status_codes.count(201) == 1, f"Expected exactly one 201, got: {status_codes}"
    assert status_codes.count(400) == 1, f"Expected exactly one 400, got: {status_codes}"

    # Verify DB has only 1 bid row
    async with TestAsyncSessionLocal() as db:
        bids_res = await db.execute(select(Bid).where(Bid.auction_id == auction.id))
        all_bids = bids_res.scalars().all()
        assert len(all_bids) == 1
        assert all_bids[0].amount == Decimal("1500.00")
