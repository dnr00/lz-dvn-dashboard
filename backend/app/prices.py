"""DexScreener batch price fetcher.

Docs: https://docs.dexscreener.com/api/reference
Endpoint used: GET /tokens/v1/{chainId}/{comma,sep,addresses}
Limit: 30 addresses per call, 300 req/min free tier.
Returns pools sorted by liquidity. We pick highest-liquidity pool as the price
reference (ignoring tiny noise pools).
"""
from __future__ import annotations

import asyncio
from dataclasses import dataclass

import aiohttp

DEX_BASE = "https://api.dexscreener.com/tokens/v1"
BATCH = 30
CONCURRENCY = 4
MIN_LIQUIDITY = 1_000.0  # ignore pools below $1k for noise rejection


@dataclass
class TokenQuote:
    chain_slug: str
    token_address: str         # checksum ignored at dexscreener side
    price_usd: float | None = None
    liquidity_usd: float | None = None
    pair_url: str | None = None


async def _fetch_batch(
    session: aiohttp.ClientSession,
    chain_slug: str,
    addresses: list[str],
) -> list[dict]:
    url = f"{DEX_BASE}/{chain_slug}/{','.join(addresses)}"
    try:
        async with session.get(url, timeout=aiohttp.ClientTimeout(total=15)) as resp:
            if resp.status != 200:
                return []
            data = await resp.json()
            if isinstance(data, list):
                return data
            if isinstance(data, dict) and "pairs" in data:
                return data["pairs"] or []
            return []
    except Exception:
        return []


def _best_pool(
    pools: list[dict],
    target_addr: str,
    chain_slug: str,
) -> tuple[float | None, float | None, str | None]:
    """Return (price_usd, liquidity_usd, pair_url) for the highest-liquidity
    pool where `target_addr` is the BASE token.

    DexScreener's `priceUsd` is the price of the pool's base token in USD.
    Pools where the target is the QUOTE token must be ignored — otherwise
    the returned price is of the OTHER token (e.g. a WBTC/USDT pool returns
    WBTC's price, which incorrectly appears as USDT's price).
    """
    target = target_addr.lower()
    best_price: float | None = None
    best_liq: float | None = None
    best_url: str | None = None
    for pool in pools:
        if pool.get("chainId", "").lower() != chain_slug.lower():
            continue
        base = (pool.get("baseToken") or {}).get("address", "").lower()
        if base != target:
            continue
        liq = ((pool.get("liquidity") or {}).get("usd")) or 0.0
        if liq < MIN_LIQUIDITY:
            continue
        price_str = pool.get("priceUsd")
        if not price_str:
            continue
        try:
            price = float(price_str)
        except (TypeError, ValueError):
            continue
        if best_liq is None or liq > best_liq:
            best_price = price
            best_liq = liq
            best_url = pool.get("url")
    return best_price, best_liq, best_url


async def fetch_quotes(
    session: aiohttp.ClientSession,
    targets: list[tuple[str, str]],  # (chain_slug, token_address)
) -> dict[tuple[str, str], TokenQuote]:
    """Batch fetch prices. Key = (chain_slug, token_address_lower)."""
    # group addresses per chain
    per_chain: dict[str, list[str]] = {}
    for slug, addr in targets:
        if not addr or int(addr, 16) == 0:
            continue
        per_chain.setdefault(slug, []).append(addr)
    # dedupe per chain
    for slug in per_chain:
        per_chain[slug] = list(dict.fromkeys(per_chain[slug]))

    sem = asyncio.Semaphore(CONCURRENCY)

    async def bounded_fetch(slug: str, batch: list[str]) -> tuple[str, list[dict]]:
        async with sem:
            data = await _fetch_batch(session, slug, batch)
            return slug, data

    tasks = []
    for slug, addrs in per_chain.items():
        for i in range(0, len(addrs), BATCH):
            batch = addrs[i : i + BATCH]
            tasks.append(bounded_fetch(slug, batch))

    quotes: dict[tuple[str, str], TokenQuote] = {}
    if not tasks:
        return quotes

    results = await asyncio.gather(*tasks, return_exceptions=True)
    # merge pools per chain
    pools_by_chain: dict[str, list[dict]] = {}
    for r in results:
        if isinstance(r, Exception):
            continue
        slug, data = r
        pools_by_chain.setdefault(slug, []).extend(data)

    for slug, addrs in per_chain.items():
        pools = pools_by_chain.get(slug, [])
        for addr in addrs:
            price, liq, url = _best_pool(pools, addr, slug)
            quotes[(slug, addr.lower())] = TokenQuote(
                chain_slug=slug,
                token_address=addr,
                price_usd=price,
                liquidity_usd=liq,
                pair_url=url,
            )
    return quotes
