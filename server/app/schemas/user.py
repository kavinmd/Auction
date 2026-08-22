from datetime import datetime

from pydantic import BaseModel, EmailStr, Field


# ─── Request schemas ──────────────────────────────────────────────────────────

class UserCreate(BaseModel):
    """Payload for POST /api/auth/register."""

    name: str = Field(..., min_length=1, max_length=100, examples=["Alice Smith"])
    email: EmailStr = Field(..., examples=["alice@example.com"])
    password: str = Field(..., min_length=8, examples=["S3cur3P@ss!"])


class UserLogin(BaseModel):
    """Payload for POST /api/auth/login."""

    email: EmailStr = Field(..., examples=["alice@example.com"])
    password: str = Field(..., examples=["S3cur3P@ss!"])


# ─── Response schemas ─────────────────────────────────────────────────────────

class UserOut(BaseModel):
    """Safe user representation returned to the client (no password hash)."""

    id: str
    name: str
    email: EmailStr
    is_admin: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class TokenResponse(BaseModel):
    """JWT token returned after successful login/register."""

    access_token: str
    token_type: str = "bearer"
    user: UserOut
