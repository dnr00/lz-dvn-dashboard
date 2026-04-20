"""Chain metadata. EID, RPC, DexScreener chain id mapping."""
from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class ChainInfo:
    lz_name: str          # LayerZero registry name
    chain_id: int
    eid: int              # LayerZero EID
    rpc: str
    dex_slug: str         # DexScreener chain slug
    display: str          # UI label


CHAINS: dict[str, ChainInfo] = {
    "ethereum": ChainInfo(
        lz_name="ethereum",
        chain_id=1,
        eid=30101,
        rpc="https://ethereum-rpc.publicnode.com",
        dex_slug="ethereum",
        display="Ethereum",
    ),
    "arbitrum": ChainInfo(
        lz_name="arbitrum",
        chain_id=42161,
        eid=30110,
        rpc="https://arbitrum-one-rpc.publicnode.com",
        dex_slug="arbitrum",
        display="Arbitrum",
    ),
    "base": ChainInfo(
        lz_name="base",
        chain_id=8453,
        eid=30184,
        rpc="https://base-rpc.publicnode.com",
        dex_slug="base",
        display="Base",
    ),
    "optimism": ChainInfo(
        lz_name="optimism",
        chain_id=10,
        eid=30111,
        rpc="https://optimism-rpc.publicnode.com",
        dex_slug="optimism",
        display="Optimism",
    ),
    "bsc": ChainInfo(
        lz_name="bsc",
        chain_id=56,
        eid=30102,
        rpc="https://bsc-rpc.publicnode.com",
        dex_slug="bsc",
        display="BNB Chain",
    ),
    "polygon": ChainInfo(
        lz_name="polygon",
        chain_id=137,
        eid=30109,
        rpc="https://polygon-bor-rpc.publicnode.com",
        dex_slug="polygon",
        display="Polygon",
    ),
    "avalanche": ChainInfo(
        lz_name="avalanche",
        chain_id=43114,
        eid=30106,
        rpc="https://avalanche-c-chain-rpc.publicnode.com",
        dex_slug="avalanche",
        display="Avalanche",
    ),
    "scroll": ChainInfo(
        lz_name="scroll",
        chain_id=534352,
        eid=30214,
        rpc="https://scroll-rpc.publicnode.com",
        dex_slug="scroll",
        display="Scroll",
    ),
    "linea": ChainInfo(
        lz_name="linea",
        chain_id=59144,
        eid=30183,
        rpc="https://linea-rpc.publicnode.com",
        dex_slug="linea",
        display="Linea",
    ),
    "unichain": ChainInfo(
        lz_name="unichain",
        chain_id=130,
        eid=30320,
        rpc="https://mainnet.unichain.org",
        dex_slug="unichain",
        display="Unichain",
    ),
}


def by_chain_id(chain_id: int) -> ChainInfo | None:
    for c in CHAINS.values():
        if c.chain_id == chain_id:
            return c
    return None
