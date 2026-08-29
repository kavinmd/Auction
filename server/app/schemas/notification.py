"""
Pydantic schemas for notification payloads.
"""

from datetime import datetime
from pydantic import BaseModel


class NotificationOut(BaseModel):
    """Notification response schema."""

    id: str
    user_id: str
    message: str
    is_read: bool
    created_at: datetime

    model_config = {"from_attributes": True}
