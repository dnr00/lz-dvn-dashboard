# PROJECT_STATUS — dashboard

## Overview

Terminal-brutalist dark dashboard that visualizes `scan_oft_dvn_lzapi.py`
output: LayerZero V2 OFT deployments per chain, 1-of-1 DVN vulnerability
flags, OpenZeppelin `paused()` state, and cross-chain price spread via
DexScreener. Primary user: security researcher / oncall for OFT bridges.

## Tech Stack

- **Backend**: Python 3.11+, FastAPI, aiohttp, eth-abi, pydantic v2, uv
- **Frontend**: Next.js 15 (App Router, React 19 RC), Tailwind 3.4,
  framer-motion, TypeScript 5.6
- **Fonts**: `JetBrains Mono` (body) + `Major Mono Display` (hero lockup)
- **Data sources**:
  - `metadata.layerzero-api.com/v1/metadata/experiment/ofts/list`
  - `api.dexscreener.com/tokens/v1/{chain}/{addresses}` (batch 30/call)
  - public RPC endpoints (publicnode.com, mainnet.unichain.org)
- **Repo layout**: sibling `dashboard/` under `kelp-investigate/`; backend
  imports `scan_oft_dvn` helpers from parent dir via `sys.path`

## Architecture

```
LZ API (registry) ─┐
                   ├─> aggregator.run_full_scan()
Public RPC × N ────┤     ├─ scanner.scan_all()  (multicall3 tryAggregate)
                   │     │    Round 1 getReceiveLibrary
                   │     │    Round 2 getConfig (ULN)
                   │     │    Round 3 paused() / token() / approvalRequired()
                   │     │    Round 4 symbol() / decimals() / balance|totalSupply
                   │     └─ prices.fetch_quotes()  (DexScreener batch)
DexScreener ───────┘
                         ▼
                   SingleTTLCache (60s)
                         ▼
                   FastAPI /api/scan
                         ▼
          Next.js SSR initial load + /api rewrite proxy
                         ▼
          Dashboard client (filter/sort/search/detail panel)
```

## Key Files

| Path | Role |
|------|------|
| `backend/app/main.py` | FastAPI entry, CORS, cache, endpoints |
| `backend/app/chains.py` | `CHAINS` dict: lz_name → ChainInfo (chain_id, eid, rpc, dex_slug) |
| `backend/app/registry.py` | LZ API fetch + invert to `chain → [(symbol, adapter)]` |
| `backend/app/scanner.py` | Per-chain multicall scan + pause check; reuses `scan_oft_dvn.py` helpers |
| `backend/app/prices.py` | DexScreener batch fetcher, liquidity-weighted best pool |
| `backend/app/aggregator.py` | Merges scan+prices+registry, computes spread/arbitrage |
| `backend/app/models.py` | Pydantic response schemas |
| `frontend/components/Dashboard.tsx` | Client state root: filter/sort/search/active row |
| `frontend/components/OftTable.tsx` | Sortable dense table |
| `frontend/components/DetailPanel.tsx` | Slide-over with per-chain deployment cards |
| `frontend/app/globals.css` | Dark phosphor palette, scanline, noise, brutal spacing |

## Recent Changes

- Initial implementation (2026-04-20): full stack bootstrapped. Terminal-
  brutalist dark theme. Backend returns all OFT deployments (not just
  vulnerable). Pause detection via `paused()` multicall added to Round 3.

## Known Issues / TODOs

- `Linea` currently doesn't appear in scan results — LZ registry key
  mismatch. Verify exact registry key before adding to `CHAINS`.
- Some DVNs are unlabeled in `KNOWN_DVNS`. Expand as they're identified.
- `cache_age_s` becomes `null` in JSON when scan has never run (guarded in
  `/api/health`, but `/api/scan` is always post-scan so it's fine there).
- No WebSocket push; user must click `re_scan` to force refresh.
- Frontend dev command uses `pnpm dev` (with Next.js rewrite to backend).
  `pnpm start` needs `BACKEND_URL` env for SSR initial load.

## Domain Rules

### Status classification (per-chain deployment)

- `vulnerable`: ULN `req_count==1 && opt_count==0 && opt_threshold==0` and
  the single required DVN is NOT in `STUB_DVNS`.
- `safe`: multi-DVN (req≥2) OR stub DVN (falls back to default receive lib).
- `paused`: OFT adapter's `paused()` returns `true`. Wins over vulnerable
  for display purposes.
- `unknown`: `getConfig` returned no usable ULN bytes.
- `unreachable`: RPC call itself failed (treated as chain-level failure).

### Arbitrage hint thresholds

- `ARBITRAGE_MIN_SPREAD_PCT = 0.5` — ignore noise below 0.5%.
- `ARBITRAGE_MIN_LIQUIDITY_USD = 50_000` — both ends must have ≥ $50k
  observed liquidity on DexScreener for the hint to appear.
- DexScreener pool floor: `MIN_LIQUIDITY = 1_000` when picking best pool
  per token.

### Caching

- Single 60-second TTL cache in-process. `?force=true` bypasses. Scan run
  takes ~8–12 s on current chain list. Safe to hammer cache; force rescans
  are rate-limited only by upstream (LZ API + 10 RPCs + DexScreener).
