"""Rate limit por IP em memória (janela deslizante simples).

Suficiente para uma única instância; em vários workers cada processo mantém a
própria contagem.
"""

import os
import time
from collections import defaultdict, deque

from fastapi import Request
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

RATE_LIMIT_ENABLED = os.getenv("RATE_LIMIT_ENABLED", "true").lower() not in {
    "0",
    "false",
    "no",
}
RATE_LIMIT_PER_MINUTE = int(os.getenv("RATE_LIMIT_PER_MINUTE", "60"))
AUTH_RATE_LIMIT_PER_MINUTE = int(os.getenv("AUTH_RATE_LIMIT_PER_MINUTE", "10"))

WINDOW_SECONDS = 60
MAX_TRACKED_KEYS = 5000
AUTH_PREFIXES = ("/auth/login", "/auth/register")


def client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for")

    if forwarded:
        return forwarded.split(",")[0].strip()

    if request.client is None:
        return "unknown"

    return request.client.host


class RateLimitMiddleware(BaseHTTPMiddleware):
    def __init__(self, app):
        super().__init__(app)
        self.hits: dict[tuple[str, str], deque[float]] = defaultdict(deque)

    def _over_limit(self, key: tuple[str, str], limit: int) -> bool:
        now = time.monotonic()
        hits = self.hits[key]

        while hits and now - hits[0] > WINDOW_SECONDS:
            hits.popleft()

        if len(hits) >= limit:
            return True

        hits.append(now)

        if len(self.hits) > MAX_TRACKED_KEYS:
            self._prune(now)

        return False

    def _prune(self, now: float) -> None:
        stale = [
            key
            for key, hits in self.hits.items()
            if not hits or now - hits[-1] > WINDOW_SECONDS
        ]

        for key in stale:
            del self.hits[key]

    async def dispatch(self, request: Request, call_next):
        if not RATE_LIMIT_ENABLED or request.method == "OPTIONS":
            return await call_next(request)

        ip = client_ip(request)
        is_auth = request.url.path.startswith(AUTH_PREFIXES)
        bucket = "auth" if is_auth else "global"
        limit = AUTH_RATE_LIMIT_PER_MINUTE if is_auth else RATE_LIMIT_PER_MINUTE

        if self._over_limit((ip, bucket), limit):
            return JSONResponse(
                status_code=429,
                content={"detail": "Muitas requisições. Aguarde um minuto."},
                headers={"Retry-After": str(WINDOW_SECONDS)},
            )

        return await call_next(request)
