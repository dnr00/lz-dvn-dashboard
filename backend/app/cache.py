"""Tiny TTL-based single-slot cache for scan results."""
from __future__ import annotations

import asyncio
import time
from typing import Any


class SingleTTLCache:
    def __init__(self, ttl_seconds: float = 60.0) -> None:
        self._ttl = ttl_seconds
        self._value: Any | None = None
        self._stored_at: float = 0.0
        self._lock = asyncio.Lock()

    @property
    def age(self) -> float:
        if self._stored_at == 0:
            return float("inf")
        return time.time() - self._stored_at

    def get(self) -> Any | None:
        if self.age > self._ttl:
            return None
        return self._value

    async def set(self, value: Any) -> None:
        async with self._lock:
            self._value = value
            self._stored_at = time.time()

    def invalidate(self) -> None:
        self._value = None
        self._stored_at = 0.0
