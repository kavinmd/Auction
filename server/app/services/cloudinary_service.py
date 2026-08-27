"""
Image upload service with Cloudinary integration and automatic local fallback.

Features:
- If valid Cloudinary credentials are provided, uploads to Cloudinary and returns secure HTTPS URL.
- If Cloudinary credentials are placeholders (e.g. 'your_cloud_name') or if Cloudinary connection fails,
  automatically and gracefully falls back to local disk storage in the 'uploads/' directory.
- Guarantees auction creation never crashes due to missing or invalid third-party keys.
"""

import asyncio
import os
import uuid
from functools import partial
from pathlib import Path

import cloudinary
import cloudinary.uploader
from app.config import settings

# ── Local upload directory ───────────────────────────────────────────────────
UPLOADS_DIR = Path("uploads")
UPLOADS_DIR.mkdir(parents=True, exist_ok=True)

# ── Check if valid Cloudinary credentials exist ──────────────────────────────
def _is_cloudinary_configured() -> bool:
    cloud_name = (settings.cloudinary_cloud_name or "").strip()
    api_key = (settings.cloudinary_api_key or "").strip()
    api_secret = (settings.cloudinary_api_secret or "").strip()

    placeholders = {"your_cloud_name", "your_api_key", "your_api_secret", ""}
    return (
        cloud_name not in placeholders
        and api_key not in placeholders
        and api_secret not in placeholders
    )


# Configure Cloudinary SDK if credentials look valid
if _is_cloudinary_configured():
    cloudinary.config(
        cloud_name=settings.cloudinary_cloud_name,
        api_key=settings.cloudinary_api_key,
        api_secret=settings.cloudinary_api_secret,
        secure=True,
    )

_FOLDER = "auctionsphere"
_MAX_BYTES = 10 * 1024 * 1024  # 10 MB hard limit per image


def _save_local_file(file_bytes: bytes, filename: str) -> str:
    """Save raw file bytes to local uploads/ directory and return the relative path."""
    clean_filename = Path(filename).name.replace(" ", "_")
    unique_name = f"{uuid.uuid4().hex[:12]}_{clean_filename}"
    file_path = UPLOADS_DIR / unique_name

    with open(file_path, "wb") as f:
        f.write(file_bytes)

    return f"/uploads/{unique_name}"


async def upload_image(file_bytes: bytes, filename: str = "image.jpg") -> str:
    """
    Upload *file_bytes* to Cloudinary if configured; otherwise fall back to local storage.

    Args:
        file_bytes: Raw image bytes read from the uploaded file.
        filename:   Original filename.

    Returns:
        Secure HTTPS Cloudinary URL or local static URL path (/uploads/...).
    """
    if len(file_bytes) > _MAX_BYTES:
        raise ValueError(f"Image too large: max {_MAX_BYTES // (1024 * 1024)} MB allowed.")

    # 1. If Cloudinary is configured, try uploading to Cloudinary
    if _is_cloudinary_configured():
        try:
            loop = asyncio.get_event_loop()
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
        except Exception as e:
            print(f"[Warning] Cloudinary upload failed ({e}). Falling back to local storage.", flush=True)

    # 2. Local fallback storage (always reliable)
    return _save_local_file(file_bytes, filename)
