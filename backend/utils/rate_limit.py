"""Dependency-free sliding-window rate limiter for the public /query endpoint.

In-memory (per process) — sufficient for a single instance. A multi-instance
deploy would need a shared store (e.g. Redis); noted here so it isn't a
surprise later. Protects the wallet: every /query spends OpenAI + Tavily
quota, so a scraped public URL can't run it up unbounded.
"""
from __future__ import annotations

import asyncio
import time
from collections import defaultdict, deque
from functools import lru_cache

from fastapi import HTTPException, Request

from backend.utils.config import get_settings


class SlidingWindowLimiter:
    def __init__(self, max_per_ip: int, window_sec: float, max_global: int | None) -> None:
        self.max_per_ip = max_per_ip
        self.window = window_sec
        self.max_global = max_global
        self._ip_hits: dict[str, deque[float]] = defaultdict(deque)
        self._global_hits: deque[float] = deque()
        self._lock = asyncio.Lock()

    @staticmethod
    def _prune(dq: deque[float], cutoff: float) -> None:
        while dq and dq[0] < cutoff:
            dq.popleft()

    async def check(self, ip: str) -> None:
        """Records a hit for `ip`, or raises HTTP 429 if over the limit."""
        if self.max_per_ip <= 0:  # limiter disabled
            return
        now = time.monotonic()
        cutoff = now - self.window
        async with self._lock:
            if self.max_global is not None:
                self._prune(self._global_hits, cutoff)
                if len(self._global_hits) >= self.max_global:
                    raise HTTPException(
                        status_code=429,
                        detail="The brain is at capacity right now — try again shortly.",
                        headers={"Retry-After": str(int(self.window))},
                    )
            hits = self._ip_hits[ip]
            self._prune(hits, cutoff)
            if len(hits) >= self.max_per_ip:
                retry_after = max(int(self.window - (now - hits[0])) + 1, 1)
                raise HTTPException(
                    status_code=429,
                    detail="Too many searches from your connection — please wait a moment.",
                    headers={"Retry-After": str(retry_after)},
                )
            hits.append(now)
            if self.max_global is not None:
                self._global_hits.append(now)


@lru_cache
def get_limiter() -> SlidingWindowLimiter:
    s = get_settings()
    return SlidingWindowLimiter(
        max_per_ip=s.rate_limit_per_ip,
        window_sec=s.rate_limit_window_sec,
        max_global=s.rate_limit_global,
    )


def client_ip(request: Request) -> str:
    """Real client IP behind a proxy (Render/Cloudflare set X-Forwarded-For)."""
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"
