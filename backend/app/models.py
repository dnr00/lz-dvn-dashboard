"""Pydantic models for API responses."""
from __future__ import annotations

from pydantic import BaseModel

ChainStatus = str  # "vulnerable" | "paused" | "safe" | "unknown"


class ChainDeployment(BaseModel):
    chain: str                    # lz_name
    chain_id: int
    chain_display: str
    adapter: str                  # OFT adapter contract
    token: str | None = None      # underlying ERC-20 (None if native OFT)
    adapter_type: str             # "native" | "lockbox"
    status: ChainStatus           # per-chain status
    dvn: str | None = None        # required DVN address if 1-of-1
    dvn_label: str | None = None  # known DVN label if any
    confirmations: int | None = None
    paused: bool = False
    paused_method: str | None = None  # which pause signal hit
    balance_raw: str | None = None    # str to avoid JS bigint loss
    balance_human: float | None = None
    decimals: int | None = None
    price_usd: float | None = None
    liquidity_usd: float | None = None
    tvl_usd: float | None = None
    dex_pair_url: str | None = None
    peer_eids_active: list[int] = []  # destination EIDs with non-zero peer
    peer_eids_probed: list[int] = []  # EIDs the scanner checked
    send_blocked: bool = False        # all probed peers == 0x0


class ArbitrageHint(BaseModel):
    spread_pct: float              # (max-min)/min * 100
    cheap_chain: str
    expensive_chain: str
    cheap_price: float
    expensive_price: float
    min_liquidity_usd: float       # lowest of the two


class OftRow(BaseModel):
    symbol: str
    name: str | None = None
    deployments: list[ChainDeployment]
    chain_count: int
    vulnerable_count: int          # number of chains flagged vulnerable
    paused_count: int
    send_blocked_count: int = 0    # chains where every peer is 0x0
    total_tvl_usd: float | None = None
    price_spread_pct: float | None = None
    arbitrage: ArbitrageHint | None = None


class ChainHealth(BaseModel):
    chain: str
    chain_display: str
    chain_id: int
    rpc_ok: bool
    latency_ms: int | None = None
    oft_count: int = 0
    vulnerable_count: int = 0


class ScanMeta(BaseModel):
    started_at: float
    finished_at: float
    duration_ms: int
    lz_registry_symbols: int
    total_deployments: int
    scanned_chains: int
    chains_health: list[ChainHealth]
    dexscreener_hits: int
    dexscreener_misses: int
    cache_age_s: float = 0.0


class ScanResponse(BaseModel):
    meta: ScanMeta
    rows: list[OftRow]
