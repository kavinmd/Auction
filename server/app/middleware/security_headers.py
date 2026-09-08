"""
Security Headers Middleware

Injects defensive HTTP response headers on every request:
  - X-Content-Type-Options   : prevents MIME sniffing
  - X-Frame-Options          : blocks clickjacking via iframes
  - X-XSS-Protection         : legacy browser XSS filter
  - Referrer-Policy          : limits referrer information leakage
  - Permissions-Policy       : disables unused browser features
"""

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """
    Starlette/FastAPI middleware that appends security headers to every
    HTTP response. Does not modify WebSocket upgrade responses.
    """

    async def dispatch(self, request: Request, call_next) -> Response:
        response: Response = await call_next(request)

        # Prevent MIME-type sniffing
        response.headers["X-Content-Type-Options"] = "nosniff"

        # Block the page from being loaded in a frame / iframe (clickjacking)
        response.headers["X-Frame-Options"] = "DENY"

        # Enable browser's built-in XSS filter (legacy browsers)
        response.headers["X-XSS-Protection"] = "1; mode=block"

        # Only send origin when navigating to same-origin; full URL on HTTPS→HTTPS
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"

        # Disable camera, microphone, geolocation — not needed for an auction app
        response.headers["Permissions-Policy"] = (
            "camera=(), microphone=(), geolocation=(), payment=()"
        )

        return response
