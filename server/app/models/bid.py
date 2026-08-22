import uuid
from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy import DateTime, ForeignKey, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Bid(Base):
    __tablename__ = "bids"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    auction_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("auctions.id", ondelete="CASCADE"), nullable=False, index=True
    )
    bidder_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
        index=True,  # indexed for ORDER BY created_at DESC queries
    )

    def __repr__(self) -> str:
        return f"<Bid id={self.id} auction={self.auction_id} amount={self.amount}>"
