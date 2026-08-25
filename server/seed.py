"""
Seed script — creates one demo user in the database.

Run from the server/ directory:
    python seed.py

The script is idempotent: if the email already exists it prints a notice
and exits cleanly without raising an error.
"""

import asyncio
import bcrypt

from sqlalchemy import select

from app.database import AsyncSessionLocal
from app.models.user import User  # noqa: F401 — needed so Base sees the table


# ── Seed data ──────────────────────────────────────────────────────────────────

SEED_USER = {
    "name": "Demo User",
    "email": "demo@auctionsphere.com",
    "password": "Demo@1234",   # plain-text; will be hashed below
    "is_admin": False,
}


# ── Helpers ────────────────────────────────────────────────────────────────────

def _hash_password(plain: str) -> str:
    return bcrypt.hashpw(plain.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


# ── Main ───────────────────────────────────────────────────────────────────────

async def seed() -> None:
    async with AsyncSessionLocal() as db:
        # Check if user already exists
        result = await db.execute(
            select(User).where(User.email == SEED_USER["email"])
        )
        existing = result.scalar_one_or_none()

        if existing:
            print(f"[seed] User '{SEED_USER['email']}' already exists — skipping.")
            return

        user = User(
            name=SEED_USER["name"],
            email=SEED_USER["email"],
            password_hash=_hash_password(SEED_USER["password"]),
            is_admin=SEED_USER["is_admin"],
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)

        print("=" * 50)
        print("[seed] [OK] Demo user created successfully!")
        print(f"       ID       : {user.id}")
        print(f"       Name     : {user.name}")
        print(f"       Email    : {user.email}")
        print(f"       Password : {SEED_USER['password']}")
        print(f"       Admin    : {user.is_admin}")
        print("=" * 50)


if __name__ == "__main__":
    asyncio.run(seed())
