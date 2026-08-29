"""
Pytest fixtures for async FastAPI testing and database sessions.
"""

import asyncio
from typing import AsyncGenerator
import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from app.auth.jwt_handler import create_access_token
from app.config import settings
from app.database import Base, get_db
from app.main import app
from app.models.user import User

# Dedicated test engine with NullPool so connections don't leak across event loops
test_engine = create_async_engine(
    settings.database_url,
    poolclass=NullPool,
    echo=False,
)

TestAsyncSessionLocal = async_sessionmaker(
    bind=test_engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
    autocommit=False,
)


@pytest_asyncio.fixture
async def db_session() -> AsyncGenerator[AsyncSession, None]:
    """Provide an async DB session for tests."""
    async with TestAsyncSessionLocal() as session:
        yield session


@pytest_asyncio.fixture
async def client(db_session: AsyncSession) -> AsyncGenerator[AsyncClient, None]:
    """Async HTTP client for testing API endpoints with overridden DB dependency."""
    async def override_get_db():
        async with TestAsyncSessionLocal() as session:
            yield session

    app.dependency_overrides[get_db] = override_get_db
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
    app.dependency_overrides.clear()
