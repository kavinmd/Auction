"""
Day 13 — Auth Tests (Task 13.2)

Covers:
  - Register new user → 201
  - Duplicate email → 400
  - Login correct password → returns JWT
  - Login wrong password → 401
  - GET /me with valid token → returns user
  - GET /me with no token → 401
"""

import uuid

import pytest
from httpx import AsyncClient

from tests.conftest import TestAsyncSessionLocal


# ── helpers ──────────────────────────────────────────────────────────────────

def unique_email() -> str:
    return f"testuser_{uuid.uuid4().hex[:8]}@example.com"


# ── Register ─────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_register_new_user_returns_201(client: AsyncClient):
    """POST /api/auth/register with valid payload → 201 + access_token."""
    payload = {
        "name": "Alice Smith",
        "email": unique_email(),
        "password": "Secret@123",
    }
    res = await client.post("/api/auth/register", json=payload)
    assert res.status_code == 201, res.text
    data = res.json()
    assert "access_token" in data
    assert data["user"]["email"] == payload["email"]
    assert data["user"]["name"] == payload["name"]


@pytest.mark.asyncio
async def test_register_duplicate_email_returns_400(client: AsyncClient):
    """POST /api/auth/register with an already-registered email → 400."""
    email = unique_email()
    payload = {"name": "Bob Jones", "email": email, "password": "Secret@123"}

    # First registration should succeed
    first = await client.post("/api/auth/register", json=payload)
    assert first.status_code == 201

    # Second registration with same email must fail
    second = await client.post("/api/auth/register", json=payload)
    assert second.status_code == 400, second.text


# ── Login ─────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_login_correct_password_returns_jwt(client: AsyncClient):
    """POST /api/auth/login with valid credentials → 200 + access_token."""
    email = unique_email()
    reg_payload = {"name": "Charlie Brown", "email": email, "password": "Secret@123"}
    await client.post("/api/auth/register", json=reg_payload)

    login_payload = {"email": email, "password": "Secret@123"}
    res = await client.post("/api/auth/login", json=login_payload)
    assert res.status_code == 200, res.text
    data = res.json()
    assert "access_token" in data
    assert data["access_token"]  # non-empty


@pytest.mark.asyncio
async def test_login_wrong_password_returns_401(client: AsyncClient):
    """POST /api/auth/login with wrong password → 401."""
    email = unique_email()
    reg_payload = {"name": "Diana Prince", "email": email, "password": "CorrectPass@1"}
    await client.post("/api/auth/register", json=reg_payload)

    login_payload = {"email": email, "password": "WrongPass@999"}
    res = await client.post("/api/auth/login", json=login_payload)
    assert res.status_code == 401, res.text


@pytest.mark.asyncio
async def test_login_nonexistent_user_returns_401(client: AsyncClient):
    """POST /api/auth/login for an email that doesn't exist → 401."""
    payload = {"email": "nobody_exists@example.com", "password": "Anything@1"}
    res = await client.post("/api/auth/login", json=payload)
    assert res.status_code == 401, res.text


# ── GET /me ───────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_get_me_with_valid_token_returns_user(client: AsyncClient):
    """GET /api/auth/me with a valid Bearer token → 200 + user data."""
    email = unique_email()
    reg_payload = {"name": "Eve Adams", "email": email, "password": "Secret@123"}
    reg_res = await client.post("/api/auth/register", json=reg_payload)
    token = reg_res.json()["access_token"]

    me_res = await client.get(
        "/api/auth/me",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert me_res.status_code == 200, me_res.text
    me_data = me_res.json()
    assert me_data["email"] == email
    assert me_data["name"] == "Eve Adams"


@pytest.mark.asyncio
async def test_get_me_with_no_token_returns_401(client: AsyncClient):
    """GET /api/auth/me with no Authorization header → 401."""
    res = await client.get("/api/auth/me")
    assert res.status_code == 401, res.text


@pytest.mark.asyncio
async def test_get_me_with_invalid_token_returns_401(client: AsyncClient):
    """GET /api/auth/me with a garbage token → 401."""
    res = await client.get(
        "/api/auth/me",
        headers={"Authorization": "Bearer this.is.garbage"},
    )
    assert res.status_code == 401, res.text
