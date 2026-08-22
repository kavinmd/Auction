from sqlalchemy import ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Watchlist(Base):
    __tablename__ = "watchlist"

    # Composite primary key: one row per (user, auction) pair
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    auction_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("auctions.id", ondelete="CASCADE"), primary_key=True
    )

    __table_args__ = (
        UniqueConstraint("user_id", "auction_id", name="uq_watchlist_user_auction"),
    )

    def __repr__(self) -> str:
        return f"<Watchlist user={self.user_id} auction={self.auction_id}>"
