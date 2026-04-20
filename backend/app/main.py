"""FastAPI entry point."""
from __future__ import annotations

import os
import time
from contextlib import asynccontextmanager

import aiohttp
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from .aggregator import run_full_scan
from .cache import SingleTTLCache
from .models import ScanResponse

CACHE_TTL_S = float(os.environ.get("SCAN_CACHE_TTL", "60"))
ALLOW_ORIGINS = os.environ.get(
    "ALLOW_ORIGINS", "http://localhost:3000"
).split(",")

_scan_cache = SingleTTLCache(ttl_seconds=CACHE_TTL_S)
_session: aiohttp.ClientSession | None = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global _session
    timeout = aiohttp.ClientTimeout(total=120)
    _session = aiohttp.ClientSession(timeout=timeout)
    try:
        yield
    finally:
        await _session.close()
        _session = None


app = FastAPI(
    title="Kelp OFT DVN Dashboard",
    description="LayerZero OFT DVN scanner + price spread aggregator",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOW_ORIGINS,
    allow_credentials=False,
    allow_methods=["GET"],
    allow_headers=["*"],
)


@app.get("/api/health")
async def health() -> dict:
    age = _scan_cache.age
    if not isinstance(age, float) or age != age or age == float("inf"):
        age_val = None
    else:
        age_val = age
    return {"ok": True, "cache_age_s": age_val, "ts": time.time()}


@app.get("/api/scan", response_model=ScanResponse)
async def scan(
    force: bool = Query(False, description="Bypass cache and re-scan"),
) -> ScanResponse:
    if _session is None:
        raise HTTPException(status_code=503, detail="session not ready")

    if not force:
        cached = _scan_cache.get()
        if cached is not None:
            cached = cached.model_copy(update={})
            cached.meta = cached.meta.model_copy(
                update={"cache_age_s": _scan_cache.age}
            )
            return cached

    try:
        result = await run_full_scan(_session)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"scan failed: {exc}") from exc

    await _scan_cache.set(result)
    return result
