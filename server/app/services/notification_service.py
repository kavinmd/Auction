from typing import Sequence

from fastapi import HTTPException, status
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.notification import Notification


async def create_notification(
    db: AsyncSession,
    user_id: str,
    message: str,
) -> Notification:
    """
    Create and persist a notification for a user.
    """
    notification = Notification(
        user_id=user_id,
        message=message,
    )
    db.add(notification)
    await db.commit()
    await db.refresh(notification)
    return notification


async def get_user_notifications(
    db: AsyncSession,
    user_id: str,
) -> Sequence[Notification]:
    """
    Fetch all notifications for a given user, ordered newest first.
    """
    stmt = (
        select(Notification)
        .where(Notification.user_id == user_id)
        .order_by(desc(Notification.created_at))
    )
    result = await db.execute(stmt)
    return result.scalars().all()


async def mark_notification_as_read(
    db: AsyncSession,
    notification_id: str,
    user_id: str,
) -> Notification:
    """
    Mark a notification as read for the authenticated user.
    """
    stmt = select(Notification).where(
        Notification.id == notification_id,
        Notification.user_id == user_id,
    )
    result = await db.execute(stmt)
    notification = result.scalar_one_or_none()

    if notification is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notification not found.",
        )

    notification.is_read = True
    await db.commit()
    await db.refresh(notification)
    return notification
