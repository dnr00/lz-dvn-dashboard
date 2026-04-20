"""Scan LayerZero OFT deployments per chain.

Extends the original scan_oft_dvn_lzapi script:
- Returns ALL OFTs (not just vulnerable) with per-deployment status
- Adds Pausable.paused() detection via multicall
- Preserves DVN config + token enrichment

Uses multicall3 tryAggregate so reverts do not abort batches.
"""
from __future__ import annotations

import asyncio
import sys
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import aiohttp
from eth_abi import decode
from eth_utils import function_signature_to_4byte_selector, to_checksum_address

from .chains import CHAINS, ChainInfo

# Import constants + helpers from scan_oft_dvn.py vendored under backend/.
_BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(_BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(_BACKEND_ROOT))

from scan_oft_dvn import (  # noqa: E402
    ENDPOINT_V2,
    SEL_APPROVAL_REQUIRED,
    SEL_BALANCE_OF,
    SEL_DECIMALS,
    SEL_SYMBOL,
    SEL_TOKEN,
    SEL_TOTAL_SUPPLY,
    STUB_DVNS,
    decode_uln_config,
    encode_address,
    encode_get_config,
    encode_get_recv_lib,
    multicall,
)

SEL_PAUSED = function_signature_to_4byte_selector("paused()").hex()
SEL_DELEGATE = function_signature_to_4byte_selector("delegate()").hex()

# Known DVN labels (lowercase address -> label). Extend as needed.
KNOWN_DVNS: dict[str, str] = {
    "0x589dedbd617e0cbcb916a9223f4d1300c294236b": "LayerZero Labs",
    "0x380275805876ff19055ea900cdb2b46a94ecf20d": "Google Cloud",
    "0x3c5575898f59c097681d1fc239c2c6ad36b7b41c": "Polyhedra",
    "0xd56e4eab23cb81f43168f9f45211eb027b9ac7cc": "Nethermind",
    "0xa59ba433ac34d2927232918ef5b2eaafcf130ba5": "Horizen Labs",
    "0x809cde2afcf8627312e87a6a7bbffab3f8f347c7": "Axelar",
    "0x7e65bdd15c8db8995f80aabcb305cae8f80c3d91": "Animoca-Blockdaemon",
    "0x2f55c492897526677c5b68fb199ea31e2c126416": "Delegate (BTC)",
}

STUB_LIKE = {a.lower() for a in STUB_DVNS}


@dataclass
class OftDeployment:
    chain_name: str
    chain_id: int
    chain_display: str
    symbol: str
    adapter: str
    status: str = "unknown"           # vulnerable | safe | paused | unknown | unreachable
    dvn: str | None = None
    dvn_label: str | None = None
    confirmations: int | None = None
    token: str | None = None
    token_symbol: str | None = None
    decimals: int | None = None
    balance_raw: int | None = None
    balance_human: float | None = None
    approval_required: bool | None = None
    adapter_type: str = "unknown"     # native | lockbox | unknown
    paused: bool = False
    paused_method: str | None = None


@dataclass
class ChainScanResult:
    chain_name: str
    chain_id: int
    chain_display: str
    deployments: list[OftDeployment] = field(default_factory=list)
    rpc_ok: bool = False
    latency_ms: int | None = None
    error: str | None = None


def _decode_bool(ret: bytes) -> bool | None:
    try:
        return bool(decode(["bool"], ret)[0])
    except Exception:
        return None


async def scan_chain(
    chain: ChainInfo,
    entries: list[tuple[str, str]],  # (symbol, adapter)
    session: aiohttp.ClientSession,
) -> ChainScanResult:
    t0 = time.time()
    result = ChainScanResult(
        chain_name=chain.lz_name,
        chain_id=chain.chain_id,
        chain_display=chain.display,
    )

    # dedupe by adapter address (LZ registry sometimes lists same addr for aliases)
    seen: dict[str, str] = {}
    for sym, addr in entries:
        seen.setdefault(addr, sym)
    oapps = list(seen.keys())
    result.deployments = [
        OftDeployment(
            chain_name=chain.lz_name,
            chain_id=chain.chain_id,
            chain_display=chain.display,
            symbol=seen[addr],
            adapter=addr,
        )
        for addr in oapps
    ]

    if not oapps:
        result.rpc_ok = True
        result.latency_ms = 0
        return result

    probe_eids = [e for e in (30101, 30110, 30184, 30102, 30111) if e != chain.eid][:3]

    try:
        # Round 1: getReceiveLibrary for each (adapter, probe_eid)
        r1_calls: list[tuple[str, bytes]] = []
        r1_meta: list[tuple[int, int]] = []  # (deployment_index, eid)
        for i, oapp in enumerate(oapps):
            for eid in probe_eids:
                r1_calls.append((ENDPOINT_V2, encode_get_recv_lib(oapp, eid)))
                r1_meta.append((i, eid))

        r1 = await multicall(session, chain.rpc, r1_calls)

        # Round 2: getConfig for entries that returned a non-zero library
        r2_calls: list[tuple[str, bytes]] = []
        r2_meta: list[tuple[int, int]] = []  # (deployment_index, eid)
        for (i, eid), (ok, ret) in zip(r1_meta, r1, strict=False):
            if not ok or len(ret) < 64:
                continue
            try:
                lib, _ = decode(["address", "bool"], ret)
                lib = to_checksum_address(lib)
            except Exception:
                continue
            if int(lib, 16) == 0:
                continue
            r2_calls.append((ENDPOINT_V2, encode_get_config(oapps[i], lib, eid, 2)))
            r2_meta.append((i, eid))

        r2 = await multicall(session, chain.rpc, r2_calls)

        # Track the "best" (= first usable) config per deployment.
        seen_idx: set[int] = set()
        for (i, eid), (ok, ret) in zip(r2_meta, r2, strict=False):
            if i in seen_idx or not ok:
                continue
            cfg = decode_uln_config(ret)
            if cfg is None:
                continue
            dep = result.deployments[i]
            dep.confirmations = cfg["confirmations"]

            req = cfg["req_count"]
            opt = cfg["opt_count"]
            opt_thr = cfg["opt_threshold"]
            if req == 1 and opt == 0 and opt_thr == 0:
                dvn = (cfg["req_dvns"][0].lower() if cfg["req_dvns"] else "0x0")
                if dvn in STUB_LIKE:
                    dep.status = "safe"  # falls back to default library
                else:
                    dep.status = "vulnerable"
                    dep.dvn = cfg["req_dvns"][0]
                    dep.dvn_label = KNOWN_DVNS.get(dvn)
            else:
                dep.status = "safe"
                if cfg["req_dvns"]:
                    dep.dvn = cfg["req_dvns"][0]
                    dep.dvn_label = KNOWN_DVNS.get(cfg["req_dvns"][0].lower())
            seen_idx.add(i)

        # Round 3: paused() + token() + approvalRequired() for every OFT
        r3_calls: list[tuple[str, bytes]] = []
        for oapp in oapps:
            r3_calls.append((oapp, bytes.fromhex(SEL_PAUSED)))
            r3_calls.append((oapp, bytes.fromhex(SEL_TOKEN)))
            r3_calls.append((oapp, bytes.fromhex(SEL_APPROVAL_REQUIRED)))
        r3 = await multicall(session, chain.rpc, r3_calls)

        for i, _ in enumerate(oapps):
            dep = result.deployments[i]
            ok_p, ret_p = r3[i * 3]
            ok_t, ret_t = r3[i * 3 + 1]
            ok_a, ret_a = r3[i * 3 + 2]
            if ok_p and len(ret_p) >= 32:
                is_paused = _decode_bool(ret_p)
                if is_paused:
                    dep.paused = True
                    dep.paused_method = "paused()"
            if ok_t and len(ret_t) >= 32:
                try:
                    dep.token = to_checksum_address(decode(["address"], ret_t)[0])
                except Exception:
                    pass
            if ok_a and len(ret_a) >= 32:
                dep.approval_required = _decode_bool(ret_a)
            if dep.approval_required is True:
                dep.adapter_type = "lockbox"
            elif dep.approval_required is False:
                dep.adapter_type = "native"

        # Round 4: token metadata + balance/total-supply + token paused()
        # Some OFTs don't implement Pausable on the adapter but DO on the
        # underlying token (e.g. rsETH). Calling paused() on both catches
        # either case. For native OFTs (adapter == token) this round 4
        # paused() call is redundant with round 3 but harmless.
        r4_calls: list[tuple[str, bytes]] = []
        idx_map: list[int] = []
        for i, dep in enumerate(result.deployments):
            if not dep.token or int(dep.token, 16) == 0:
                continue
            r4_calls.append((dep.token, bytes.fromhex(SEL_SYMBOL)))
            r4_calls.append((dep.token, bytes.fromhex(SEL_DECIMALS)))
            if dep.approval_required:
                r4_calls.append(
                    (dep.token, bytes.fromhex(SEL_BALANCE_OF + encode_address(dep.adapter)))
                )
            else:
                r4_calls.append((dep.token, bytes.fromhex(SEL_TOTAL_SUPPLY)))
            r4_calls.append((dep.token, bytes.fromhex(SEL_PAUSED)))
            idx_map.extend([i, i, i, i])

        if r4_calls:
            r4 = await multicall(session, chain.rpc, r4_calls)
            for j in range(0, len(r4), 4):
                i = idx_map[j]
                dep = result.deployments[i]
                ok_s, ret_s = r4[j]
                ok_d, ret_d = r4[j + 1]
                ok_b, ret_b = r4[j + 2]
                ok_tp, ret_tp = r4[j + 3]
                if ok_s and len(ret_s) >= 32:
                    try:
                        dep.token_symbol = decode(["string"], ret_s)[0] or None
                    except Exception:
                        pass
                if ok_d and len(ret_d) >= 32:
                    try:
                        dep.decimals = decode(["uint8"], ret_d)[0]
                    except Exception:
                        pass
                if ok_b and len(ret_b) >= 32:
                    try:
                        dep.balance_raw = decode(["uint256"], ret_b)[0]
                        if dep.decimals is not None:
                            dep.balance_human = dep.balance_raw / 10 ** dep.decimals
                    except Exception:
                        pass
                if ok_tp and len(ret_tp) >= 32 and not dep.paused:
                    token_paused = _decode_bool(ret_tp)
                    if token_paused:
                        dep.paused = True
                        dep.paused_method = "token.paused()"

        result.rpc_ok = True
        result.latency_ms = int((time.time() - t0) * 1000)
    except Exception as exc:  # noqa: BLE001
        result.rpc_ok = False
        result.error = str(exc)
        result.latency_ms = int((time.time() - t0) * 1000)
        for dep in result.deployments:
            if dep.status == "unknown":
                dep.status = "unreachable"

    return result


async def scan_all(
    session: aiohttp.ClientSession,
    deployments_by_chain: dict[str, list[tuple[str, str]]],
) -> list[ChainScanResult]:
    tasks = []
    for name, entries in deployments_by_chain.items():
        chain = CHAINS.get(name)
        if chain is None:
            continue
        tasks.append(scan_chain(chain, entries, session))
    results: list[Any] = await asyncio.gather(*tasks, return_exceptions=True)
    out: list[ChainScanResult] = []
    for r in results:
        if isinstance(r, Exception):
            sys.stderr.write(f"[scanner] error: {r}\n")
            continue
        out.append(r)
    return out
