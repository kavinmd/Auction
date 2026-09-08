from fastapi import Depends, HTTPException, status

from app.auth.dependencies import get_current_user
from app.models.user import User


async def require_admin(
    current_user: User = Depends(get_current_user),
) -> User:
    """
    FastAPI dependency that requires the caller to be an admin.

    Chains on top of ``get_current_user`` (so the caller must also be
    authenticated). Raises 403 if ``user.is_admin`` is False.

    Returns the authenticated admin :class:`~app.models.user.User` ORM instance.
    """
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required.",
        )
    return current_user
