"""Stargate Transfer API client.

Supplements the `experiment/ofts/list` metadata API with a broader token
list that covers chains the experimental list has not been updated for
(e.g. Plasma). The Transfer API exposes user-facing token addresses
rather than OFT adapter addresses, so:

- For *native* OFTs (token == adapter) the address is immediately
  usable by the scanner.
- For *lockbox* OFTs (token != adapter) the scanner's adapter probes
  revert and the deployment falls through to status=unknown.
  The token still surfaces in the UI, which is better than hiding it.

The API also returns a flat `price.usd` per token which we use as a
fallback when DexScreener has no coverage. These prices are identical
across chains for the same symbol, so they MUST NOT be used for
cross-chain arbitrage spread calculation.
"""
from __future__ import annotations

from dataclasses import dataclass

import aiohttp
from eth_utils import to_checksum_address

TRANSFER_TOKENS_URL = "https://transfer.layerzero-api.com/v1/tokens"


@dataclass(frozen=True)
class TransferToken:
    chain_key: str
    symbol: str
    address: str       # checksum
    name: str | None
    decimals: int
    price_usd: float | None


async def fetch_transfer_tokens(
    session: aiohttp.ClientSession,
) -> list[TransferToken]:
    try:
        async with session.get(
            TRANSFER_TOKENS_URL,
            timeout=aiohttp.ClientTimeout(total=20),
        ) as resp:
            if resp.status != 200:
                return []
            payload = await resp.json()
    except Exception:
        return []

    tokens = payload.get("tokens") if isinstance(payload, dict) else None
    if not isinstance(tokens, list):
        return []

    out: list[TransferToken] = []
    for t in tokens:
        if not isinstance(t, dict):
            continue
        addr = t.get("address")
        chain = t.get("chainKey")
        symbol = t.get("symbol")
        if not addr or not chain or not symbol:
            continue
        try:
            addr_cs = to_checksum_address(addr)
        except Exception:
            continue
        price = None
        price_obj = t.get("price")
        if isinstance(price_obj, dict):
            raw = price_obj.get("usd")
            if isinstance(raw, (int, float)):
                price = float(raw)
        decimals = t.get("decimals")
        if not isinstance(decimals, int):
            decimals = 18
        out.append(
            TransferToken(
                chain_key=chain,
                symbol=symbol,
                address=addr_cs,
                name=t.get("name"),
                decimals=decimals,
                price_usd=price,
            )
        )
    return out


def group_by_chain(
    tokens: list[TransferToken],
) -> dict[str, list[tuple[str, str]]]:
    """Return {chain_key: [(symbol, checksum_address), ...]}."""
    out: dict[str, list[tuple[str, str]]] = {}
    for t in tokens:
        out.setdefault(t.chain_key, []).append((t.symbol, t.address))
    return out


def price_index(
    tokens: list[TransferToken],
) -> dict[tuple[str, str], float]:
    """Return {(chain_key, lower_address): price_usd} for cheap lookup."""
    out: dict[tuple[str, str], float] = {}
    for t in tokens:
        if t.price_usd is None:
            continue
        out[(t.chain_key, t.address.lower())] = t.price_usd
    return out
