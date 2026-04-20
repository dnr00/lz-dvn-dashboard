export type ChainStatus =
  | "vulnerable"
  | "paused"
  | "safe"
  | "unknown"
  | "unreachable";

export interface ChainDeployment {
  chain: string;
  chain_id: number;
  chain_display: string;
  adapter: string;
  token: string | null;
  adapter_type: "native" | "lockbox" | "unknown";
  status: ChainStatus;
  dvn: string | null;
  dvn_label: string | null;
  confirmations: number | null;
  paused: boolean;
  paused_method: string | null;
  balance_raw: string | null;
  balance_human: number | null;
  decimals: number | null;
  price_usd: number | null;
  liquidity_usd: number | null;
  tvl_usd: number | null;
  dex_pair_url: string | null;
  peer_eids_active: number[];
  peer_eids_probed: number[];
  send_blocked: boolean;
}

export interface ArbitrageHint {
  spread_pct: number;
  cheap_chain: string;
  expensive_chain: string;
  cheap_price: number;
  expensive_price: number;
  min_liquidity_usd: number;
}

export interface OftRow {
  symbol: string;
  name: string | null;
  deployments: ChainDeployment[];
  chain_count: number;
  vulnerable_count: number;
  paused_count: number;
  send_blocked_count: number;
  total_tvl_usd: number | null;
  price_spread_pct: number | null;
  arbitrage: ArbitrageHint | null;
}

export interface ChainHealth {
  chain: string;
  chain_display: string;
  chain_id: number;
  rpc_ok: boolean;
  latency_ms: number | null;
  oft_count: number;
  vulnerable_count: number;
}

export interface ScanMeta {
  started_at: number;
  finished_at: number;
  duration_ms: number;
  lz_registry_symbols: number;
  total_deployments: number;
  scanned_chains: number;
  chains_health: ChainHealth[];
  dexscreener_hits: number;
  dexscreener_misses: number;
  cache_age_s: number;
}

export interface ScanResponse {
  meta: ScanMeta;
  rows: OftRow[];
}
