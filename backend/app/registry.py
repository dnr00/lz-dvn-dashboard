"""Fetches LayerZero OFT registry and inverts it into per-chain deployments."""
from __future__ import annotations

import aiohttp
from eth_utils import to_checksum_address

LZ_OFTS_URL = "https://metadata.layerzero-api.com/v1/metadata/experiment/ofts/list"

UA = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
    "Chrome/131.0.0.0 Safari/537.36"
)


async def fetch_oft_registry(session: aiohttp.ClientSession) -> dict:
    async with session.get(
        LZ_OFTS_URL,
        headers={"User-Agent": UA, "Accept": "application/json"},
    ) as resp:
        resp.raise_for_status()
        return await resp.json()


def build_deployments_by_chain(
    registry: dict,
) -> dict[str, list[tuple[str, str]]]:
    """Invert registry: chain_name -> list of (symbol, adapter)."""
    out: dict[str, list[tuple[str, str]]] = {}
    for symbol, entries in registry.items():
        if not isinstance(entries, list):
            continue
        for entry in entries:
            if entry.get("endpointVersion") != "v2":
                continue
            for chain_name, dep in entry.get("deployments", {}).items():
                if not isinstance(dep, dict):
                    continue
                addr = dep.get("address")
                if not addr:
                    continue
                try:
                    addr = to_checksum_address(addr)
                except Exception:
                    continue
                out.setdefault(chain_name, []).append((symbol, addr))
    return out


def registry_symbol_names(registry: dict) -> dict[str, str]:
    """Map symbol -> first non-empty 'name' from entries."""
    out: dict[str, str] = {}
    for symbol, entries in registry.items():
        if not isinstance(entries, list):
            continue
        for entry in entries:
            name = entry.get("name")
            if name:
                out[symbol] = name
                break
    return out
