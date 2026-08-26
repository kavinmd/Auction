"""
Cloudinary image upload service.
Provides a single async-compatible helper that uploads a file-like object
and returns the secure HTTPS URL stored in the DB.
"""

import asyncio
from functools import partial

import cloudinary
import cloudinary.uploader

from app.config import settings

# ── Configure SDK once at module load ─────────────────────────────────────────
cloudinary.config(
    cloud_name=settings.cloudinary_cloud_name,
    api_key=settings.cloudinary_api_key,
    api_secret=settings.cloudinary_api_secret,
    secure=True,  # always return https:// URLs
)

_FOLDER = "auctionsphere"          # all uploads go into this Cloudinary folder
_MAX_BYTES = 10 * 1024 * 1024     # 10 MB hard limit per image


async def upload_image(file_bytes: bytes, filename: str = "image") -> str:
    """
    Upload *file_bytes* to Cloudinary and return the secure URL.

    The upload runs in a thread-pool executor so it doesn't block the
    async event loop (cloudinary.uploader.upload is synchronous).

    Args:
        file_bytes: Raw image bytes read from the uploaded file.
        filename:   Original filename, used as the public_id base.

    Returns:
        Secure HTTPS URL of the uploaded image.

    Raises:
        ValueError: If the file exceeds the 10 MB limit.
        cloudinary.exceptions.Error: On upload failure.
    """
    if len(file_bytes) > _MAX_BYTES:
        raise ValueError(f"Image too large: max {_MAX_BYTES // (1024*1024)} MB allowed.")

    loop = asyncio.get_event_loop()

    # Run blocking Cloudinary SDK call in a thread pool
    result = await loop.run_in_executor(
        None,
        partial(
            cloudinary.uploader.upload,
            file_bytes,
            folder=_FOLDER,
            resource_type="image",
            overwrite=False,
        ),
    )

    return result["secure_url"]
