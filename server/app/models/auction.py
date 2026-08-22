import uuid
from datetime import datetime, timezone
from decimal import Decimal
from enum import Enum as PyEnum

from sqlalchemy import (
    Boolean,
    DateTime,
    Enum,
    ForeignKey,
    Numeric,
    String,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class AuctionStatus(str, PyEnum):
    open = "open"
    closed = "closed"
    paid = "paid"
    cancelled = "cancelled"


class Auction(Base):
    __tablename__ = "auctions"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    seller_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    category: Mapped[str] = mapped_column(String(100), nullable=False, index=True)

    # Store image URLs as a JSON/text column (ARRAY is PostgreSQL-specific)
    image_urls: Mapped[str] = mapped_column(Text, nullable=False, default="[]")

    starting_price: Mapped[Decimal] = mapped_column(
        Numeric(12, 2), nullable=False
    )
    current_price: Mapped[Decimal] = mapped_column(
        Numeric(12, 2), nullable=False
    )
    end_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    status: Mapped[AuctionStatus] = mapped_column(
        Enum(AuctionStatus), nullable=False, default=AuctionStatus.open, index=True
    )
    is_shipped: Mapped[bool] = mapped_column(
        Boolean, default=False, nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    def __repr__(self) -> str:
        return f"<Auction id={self.id} title={self.title!r} status={self.status}>"
