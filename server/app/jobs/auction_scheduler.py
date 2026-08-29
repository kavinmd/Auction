from datetime import datetime, timezone
import logging
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger
from sqlalchemy import desc, select

from app.database import AsyncSessionLocal
from app.models.auction import Auction, AuctionStatus
from app.models.bid import Bid
from app.models.notification import Notification
from app.websocket.connection_manager import manager

logger = logging.getLogger(__name__)

scheduler = AsyncIOScheduler()


async def check_and_close_auctions():
    """
    Periodic job that queries open auctions past their end time,
    transitions their status to 'closed', creates notifications for the winner
    and seller, and broadcasts a WebSocket update.
    """
    logger.info("[Scheduler] Checking for expired open auctions...")
    now = datetime.now(timezone.utc)

    async with AsyncSessionLocal() as db:
        try:
            stmt = (
                select(Auction)
                .where(
                    Auction.status == AuctionStatus.open,
                    Auction.end_time <= now,
                )
            )
            result = await db.execute(stmt)
            expired_auctions = result.scalars().all()

            if not expired_auctions:
                logger.info("[Scheduler] No expired auctions found.")
                return

            for auction in expired_auctions:
                auction.status = AuctionStatus.closed

                # Find highest bid
                bid_stmt = (
                    select(Bid)
                    .where(Bid.auction_id == auction.id)
                    .order_by(desc(Bid.amount))
                    .limit(1)
                )
                bid_res = await db.execute(bid_stmt)
                winning_bid = bid_res.scalar_one_or_none()

                if winning_bid:
                    winner_id = winning_bid.bidder_id
                    # Notification for winner
                    winner_note = Notification(
                        user_id=winner_id,
                        message=f"Congratulations! You won the auction for '{auction.title}' with a winning bid of ${winning_bid.amount:,.2f}.",
                    )
                    # Notification for seller
                    seller_note = Notification(
                        user_id=auction.seller_id,
                        message=f"Your auction '{auction.title}' has closed and sold for ${winning_bid.amount:,.2f}.",
                    )
                    db.add_all([winner_note, seller_note])

                    # Broadcast WS event
                    await manager.broadcast(
                        auction.id,
                        {
                            "type": "auction_closed",
                            "auction_id": auction.id,
                            "winner_id": winner_id,
                            "final_price": float(winning_bid.amount),
                        },
                    )
                else:
                    # No bids placed
                    seller_note = Notification(
                        user_id=auction.seller_id,
                        message=f"Your auction '{auction.title}' has closed with no bids placed.",
                    )
                    db.add(seller_note)

                    await manager.broadcast(
                        auction.id,
                        {
                            "type": "auction_closed",
                            "auction_id": auction.id,
                            "winner_id": None,
                            "final_price": float(auction.starting_price),
                        },
                    )

            await db.commit()
            logger.info(f"[Scheduler] Successfully closed {len(expired_auctions)} expired auction(s).")
        except Exception as e:
            await db.rollback()
            logger.error(f"[Scheduler] Error during auction auto-close: {e}", exc_info=True)


def start_scheduler():
    """Start APScheduler background job."""
    if not scheduler.running:
        scheduler.add_job(
            check_and_close_auctions,
            trigger=IntervalTrigger(seconds=60),
            id="close_expired_auctions",
            replace_existing=True,
        )
        scheduler.start()
        logger.info("[Scheduler] APScheduler started for auction expiration checks.")


def stop_scheduler():
    """Shutdown APScheduler background job."""
    if scheduler.running:
        scheduler.shutdown(wait=False)
        logger.info("[Scheduler] APScheduler stopped.")
