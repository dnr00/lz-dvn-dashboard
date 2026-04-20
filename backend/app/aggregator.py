"""Merges scan + prices + registry into dashboard-facing rows."""
from __future__ import annotations

import time
from collections import defaultdict

import aiohttp

from .chains import CHAINS
from .models import (
    ArbitrageHint,
    ChainDeployment,
    ChainHealth,
    OftRow,
    ScanMeta,
    ScanResponse,
)
from .prices import TokenQuote, fetch_quotes
from .registry import (
    build_deployments_by_chain,
    fetch_oft_registry,
    registry_symbol_names,
)
from .scanner import ChainScanResult, OftDeployment, scan_all
from .transfer_api import (
    TransferToken,
    fetch_transfer_tokens,
    group_by_chain,
    price_index,
)

ARBITRAGE_MIN_SPREAD_PCT = 0.5
ARBITRAGE_MIN_LIQUIDITY_USD = 50_000.0


def _deployment_to_api(
    dep: OftDeployment,
    quote: TokenQuote | None,
    transfer_prices: dict[tuple[str, str], float],
) -> ChainDeployment:
    price: float | None = None
    price_source: str | None = None
    liq = None
    pair_url = None
    if quote and quote.price_usd is not None:
        price = quote.price_usd
        price_source = "dexscreener"
        liq = quote.liquidity_usd
        pair_url = quote.pair_url
    elif dep.token:
        # DexScreener miss — fall back to Stargate Transfer API's flat
        # price. Flag the source so arbitrage logic knows to skip it
        # (those prices are identical across chains).
        t_price = transfer_prices.get((dep.chain_name, dep.token.lower()))
        if t_price is not None:
            price = t_price
            price_source = "transfer-api"
    tvl_usd = None
    if price is not None and dep.balance_human is not None:
        tvl_usd = price * dep.balance_human

    balance_raw_str: str | None = None
    if dep.balance_raw is not None:
        balance_raw_str = str(dep.balance_raw)

    return ChainDeployment(
        chain=dep.chain_name,
        chain_id=dep.chain_id,
        chain_display=dep.chain_display,
        adapter=dep.adapter,
        token=dep.token,
        adapter_type=dep.adapter_type,
        status=dep.status,
        dvn=dep.dvn,
        dvn_label=dep.dvn_label,
        confirmations=dep.confirmations,
        paused=dep.paused,
        paused_method=dep.paused_method,
        balance_raw=balance_raw_str,
        balance_human=dep.balance_human,
        decimals=dep.decimals,
        price_usd=price,
        price_source=price_source,
        liquidity_usd=liq,
        tvl_usd=tvl_usd,
        dex_pair_url=pair_url,
        peer_eids_active=list(dep.peer_eids_active),
        peer_eids_probed=list(dep.peer_eids_probed),
        send_blocked=dep.send_blocked,
    )


def _compute_arbitrage(deployments: list[ChainDeployment]) -> ArbitrageHint | None:
    # Only DexScreener prices carry per-pool liquidity AND per-chain
    # variation; the Transfer API fallback returns a single flat price
    # per symbol so it can't be used for cross-chain spread.
    priced = [
        d
        for d in deployments
        if d.price_usd and d.liquidity_usd and d.price_source == "dexscreener"
    ]
    if len(priced) < 2:
        return None
    cheap = min(priced, key=lambda d: d.price_usd or 0)
    expensive = max(priced, key=lambda d: d.price_usd or 0)
    if cheap.chain == expensive.chain:
        return None
    if not cheap.price_usd or not expensive.price_usd:
        return None
    spread_pct = (expensive.price_usd - cheap.price_usd) / cheap.price_usd * 100
    if spread_pct < ARBITRAGE_MIN_SPREAD_PCT:
        return None
    min_liq = min(cheap.liquidity_usd or 0, expensive.liquidity_usd or 0)
    if min_liq < ARBITRAGE_MIN_LIQUIDITY_USD:
        return None
    return ArbitrageHint(
        spread_pct=round(spread_pct, 4),
        cheap_chain=cheap.chain,
        expensive_chain=expensive.chain,
        cheap_price=cheap.price_usd,
        expensive_price=expensive.price_usd,
        min_liquidity_usd=min_liq,
    )


def _aggregate_rows(
    scan_results: list[ChainScanResult],
    quotes: dict[tuple[str, str], TokenQuote],
    names: dict[str, str],
    transfer_prices: dict[tuple[str, str], float],
) -> list[OftRow]:
    by_symbol: dict[str, list[ChainDeployment]] = defaultdict(list)
    for chain in scan_results:
        chain_info = CHAINS.get(chain.chain_name)
        if chain_info is None:
            continue
        for dep in chain.deployments:
            quote = None
            if dep.token:
                quote = quotes.get((chain_info.dex_slug, dep.token.lower()))
            by_symbol[dep.symbol].append(
                _deployment_to_api(dep, quote, transfer_prices)
            )

    rows: list[OftRow] = []
    for symbol, deps in by_symbol.items():
        vulnerable_count = sum(1 for d in deps if d.status == "vulnerable")
        paused_count = sum(1 for d in deps if d.paused)
        send_blocked_count = sum(1 for d in deps if d.send_blocked)
        priced_for_spread = [
            d for d in deps if d.price_usd and d.price_source == "dexscreener"
        ]
        spread_pct = None
        if len(priced_for_spread) >= 2:
            prices = [d.price_usd for d in priced_for_spread if d.price_usd]
            lo, hi = min(prices), max(prices)
            if lo > 0:
                spread_pct = round((hi - lo) / lo * 100, 4)
        total_tvl = sum((d.tvl_usd or 0) for d in deps) or None
        rows.append(
            OftRow(
                symbol=symbol,
                name=names.get(symbol),
                deployments=sorted(deps, key=lambda d: d.chain_display),
                chain_count=len(deps),
                vulnerable_count=vulnerable_count,
                paused_count=paused_count,
                send_blocked_count=send_blocked_count,
                total_tvl_usd=total_tvl,
                price_spread_pct=spread_pct,
                arbitrage=_compute_arbitrage(deps),
            )
        )
    # default ordering: vulnerable desc, then paused desc, then symbol
    rows.sort(key=lambda r: (-r.vulnerable_count, -r.paused_count, r.symbol))
    return rows


async def run_full_scan(session: aiohttp.ClientSession) -> ScanResponse:
    t0 = time.time()
    registry = await fetch_oft_registry(session)
    by_chain = build_deployments_by_chain(registry)
    names = registry_symbol_names(registry)

    # Supplementary registry: Stargate Transfer API tokens. Used to
    # backfill chains the experimental OFT list hasn't been updated for
    # (Plasma at the time of writing). Existing chain entries from the
    # metadata registry take priority — we only add tokens for chains
    # that the metadata registry returns empty for.
    transfer_tokens = await fetch_transfer_tokens(session)
    transfer_by_chain = group_by_chain(transfer_tokens)
    for chain_name, entries in transfer_by_chain.items():
        if chain_name not in CHAINS:
            continue
        existing = by_chain.get(chain_name) or []
        if existing:
            continue
        by_chain[chain_name] = entries
        for sym, _ in entries:
            names.setdefault(sym, sym)
    transfer_prices = price_index(transfer_tokens)

    scan_results = await scan_all(session, by_chain)

    # collect targets for DexScreener
    price_targets: list[tuple[str, str]] = []
    for chain in scan_results:
        info = CHAINS.get(chain.chain_name)
        if info is None:
            continue
        for dep in chain.deployments:
            if dep.token and int(dep.token, 16) != 0:
                price_targets.append((info.dex_slug, dep.token))

    quotes = await fetch_quotes(session, price_targets)
    dex_hits = sum(1 for q in quotes.values() if q.price_usd is not None)
    dex_misses = len(quotes) - dex_hits

    rows = _aggregate_rows(scan_results, quotes, names, transfer_prices)

    chain_health: list[ChainHealth] = []
    for chain in scan_results:
        chain_info = CHAINS.get(chain.chain_name)
        if chain_info is None:
            continue
        oft_count = len(chain.deployments)
        vuln_count = sum(1 for d in chain.deployments if d.status == "vulnerable")
        chain_health.append(
            ChainHealth(
                chain=chain.chain_name,
                chain_display=chain_info.display,
                chain_id=chain_info.chain_id,
                rpc_ok=chain.rpc_ok,
                latency_ms=chain.latency_ms,
                oft_count=oft_count,
                vulnerable_count=vuln_count,
            )
        )
    chain_health.sort(key=lambda c: c.chain_display)

    t1 = time.time()
    meta = ScanMeta(
        started_at=t0,
        finished_at=t1,
        duration_ms=int((t1 - t0) * 1000),
        lz_registry_symbols=len(registry),
        total_deployments=sum(len(v) for v in by_chain.values()),
        scanned_chains=len(scan_results),
        chains_health=chain_health,
        dexscreener_hits=dex_hits,
        dexscreener_misses=dex_misses,
    )
    return ScanResponse(meta=meta, rows=rows)
