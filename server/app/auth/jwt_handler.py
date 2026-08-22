from datetime import datetime, timedelta, timezone
from typing import Any

from jose import JWTError, jwt

from app.config import settings


def create_access_token(subject: str) -> str:
    """
    Create a signed HS256 JWT for the given subject (user id).

    Args:
        subject: The user's UUID string stored in the ``sub`` claim.

    Returns:
        Encoded JWT string.
    """
    expire = datetime.now(timezone.utc) + timedelta(days=settings.jwt_expire_days)
    payload: dict[str, Any] = {
        "sub": subject,
        "exp": expire,
        "iat": datetime.now(timezone.utc),
    }
    return jwt.encode(payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)


def decode_access_token(token: str) -> str:
    """
    Validate and decode a JWT, returning the ``sub`` (user id) claim.

    Raises:
        ValueError: If the token is invalid, expired, or missing the ``sub`` claim.
    """
    try:
        payload = jwt.decode(
            token,
            settings.jwt_secret_key,
            algorithms=[settings.jwt_algorithm],
        )
        user_id: str | None = payload.get("sub")
        if user_id is None:
            raise ValueError("Token is missing 'sub' claim")
        return user_id
    except JWTError as exc:
        raise ValueError(f"Invalid or expired token: {exc}") from exc
