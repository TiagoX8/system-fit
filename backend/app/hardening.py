"""Headers de segurança e HTTPS obrigatório na API."""

import os

from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware

FORCE_HTTPS = os.getenv("FORCE_HTTPS", "false").lower() in {"1", "true", "yes"}

DOCS_PATHS = ("/docs", "/redoc", "/openapi.json")

API_CSP = (
    "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'"
)
HSTS = "max-age=63072000; includeSubDomains"


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)

        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "no-referrer"
        response.headers["Cross-Origin-Resource-Policy"] = "same-site"
        response.headers["Permissions-Policy"] = (
            "camera=(), microphone=(), geolocation=()"
        )

        if FORCE_HTTPS:
            response.headers["Strict-Transport-Security"] = HSTS

        # o Swagger carrega JS/CSS de CDN; nas rotas de dados nada é renderizado
        if not request.url.path.startswith(DOCS_PATHS):
            response.headers["Content-Security-Policy"] = API_CSP

        return response
