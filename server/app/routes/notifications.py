"""
Notification routes — fetch user notifications and mark as read.

Endpoints:
    GET /api/users/me/notifications — Retrieve notifications for current user
    PUT /api/notifications/{id}/read — Mark notification as read
"""

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user
from app.database import get_db
from app.models.user import User
from app.schemas.notification import NotificationOut
from app.services.notification_service import (
    get_user_notifications,
    mark_notification_as_read,
)

router = APIRouter()


@router.get(
    "/users/me/notifications",
    response_model=list[NotificationOut],
    status_code=status.HTTP_200_OK,
    summary="Get authenticated user's notifications",
)
async def get_my_notifications(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Fetch all notifications for the logged-in user sorted newest first.
    """
    return await get_user_notifications(db=db, user_id=current_user.id)


@router.put(
    "/notifications/{notification_id}/read",
    response_model=NotificationOut,
    status_code=status.HTTP_200_OK,
    summary="Mark a notification as read",
)
async def mark_read(
    notification_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Mark a specific notification owned by the current user as read.
    """
    return await mark_notification_as_read(
        db=db,
        notification_id=notification_id,
        user_id=current_user.id,
    )
