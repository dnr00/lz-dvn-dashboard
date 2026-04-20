# /// script
# requires-python = ">=3.11"
# dependencies = [
#   "aiohttp",
#   "eth-abi",
#   "eth-utils",
#   "eth-hash[pycryptodome]",
# ]
# ///
"""Scan multi-chain LayerZero V2 OFT adapters for 1-of-1 DVN config.

Optimized via:
- Multicall3 aggregation (N subcalls per RPC request)
- Async parallel chain scanning
- Limited event fetch (recent blocks only)
- Two-round multicall: getReceiveLibrary → getConfig
"""
from __future__ import annotations

import asyncio
import json
import sys
import time
from dataclasses import dataclass, asdict
from typing import Any

import aiohttp
from eth_abi import decode, encode
from eth_utils import function_signature_to_4byte_selector, to_checksum_address

# ---- Constants ----
ENDPOINT_V2 = "0x1a44076050125825900e736c501f859c50fE728c"
MULTICALL3 = "0xcA11bde05977b3631167028862bE2a173976CA11"
PKT_DELIVERED_TOPIC = "0x3cd5e48f9730b129dc7550f0fcea9c767b7be37837cd10e55eb35f734f4bca04"

# Stub/placeholder DVNs - returned by getConfig when OApp uses default library
# config for an EID that isn't actively configured. Effectively unreachable,
# produces false positives if included.
STUB_DVNS: set[str] = {
    "0x747c741496a507e4b404b50463e691a8d692f6ac",  # LZ Labs default stub
    "0x0000000000000000000000000000000000000000",
    "0x000000000000000000000000000000000000dead",
}

# Function selectors
SEL_GET_RECV_LIB = function_signature_to_4byte_selector(
    "getReceiveLibrary(address,uint32)"
).hex()
SEL_GET_CONFIG = function_signature_to_4byte_selector(
    "getConfig(address,address,uint32,uint32)"
).hex()
SEL_TRY_AGGREGATE = function_signature_to_4byte_selector(
    "tryAggregate(bool,(address,bytes)[])"
).hex()
SEL_TOKEN = function_signature_to_4byte_selector("token()").hex()
SEL_BALANCE_OF = function_signature_to_4byte_selector("balanceOf(address)").hex()
SEL_SYMBOL = function_signature_to_4byte_selector("symbol()").hex()
SEL_DECIMALS = function_signature_to_4byte_selector("decimals()").hex()
SEL_TOTAL_SUPPLY = function_signature_to_4byte_selector("totalSupply()").hex()
SEL_APPROVAL_REQUIRED = function_signature_to_4byte_selector("approvalRequired()").hex()

# Chains to scan. Picked most active. srcEid = commonly-bridged remote chain.
CHAINS: list[dict[str, Any]] = [
    {
        "name": "Ethereum",
        "chain_id": 1,
        "rpc": "https://ethereum-rpc.publicnode.com",
        "self_eid": 30101,
        "probe_src_eids": [30110, 30184, 30111],  # Arb, Base, OP
        "block_range": 20000,
        "chunk_size": 10000,
    },
    {
        "name": "Arbitrum",
        "chain_id": 42161,
        "rpc": "https://arbitrum-one-rpc.publicnode.com",
        "self_eid": 30110,
        "probe_src_eids": [30101, 30184, 30102],
        "block_range": 200000,
        "chunk_size": 10000,
    },
    {
        "name": "Base",
        "chain_id": 8453,
        "rpc": "https://base-rpc.publicnode.com",
        "self_eid": 30184,
        "probe_src_eids": [30101, 30110, 30102],
        "block_range": 50000,
        "chunk_size": 10000,
    },
    {
        "name": "Optimism",
        "chain_id": 10,
        "rpc": "https://optimism-rpc.publicnode.com",
        "self_eid": 30111,
        "probe_src_eids": [30101, 30110, 30184],
        "block_range": 50000,
        "chunk_size": 10000,
    },
    {
        "name": "BSC",
        "chain_id": 56,
        "rpc": "https://bsc-rpc.publicnode.com",
        "self_eid": 30102,
        "probe_src_eids": [30101, 30110, 30184],
        "block_range": 50000,
        "chunk_size": 5000,
    },
    {
        "name": "Polygon",
        "chain_id": 137,
        "rpc": "https://polygon-bor-rpc.publicnode.com",
        "self_eid": 30109,
        "probe_src_eids": [30101, 30110, 30184],
        "block_range": 50000,
        "chunk_size": 3000,
    },
    {
        "name": "Avalanche",
        "chain_id": 43114,
        "rpc": "https://avalanche-c-chain-rpc.publicnode.com",
        "self_eid": 30106,
        "probe_src_eids": [30101, 30110, 30184],
        "block_range": 50000,
        "chunk_size": 10000,
    },
]

MAX_MULTICALL_BATCH = 300  # adapters per tryAggregate call (keep under RPC limits)
MAX_CONCURRENT_RPCS_PER_CHAIN = 4


# ---- Result types ----
@dataclass
class Vulnerable:
    chain: str
    chain_id: int
    adapter: str
    src_eid: int
    confirmations: int
    dvn: str
    token: str | None = None
    symbol: str | None = None
    decimals: int | None = None
    balance_raw: int | None = None
    balance_human: float | None = None
    approval_required: bool | None = None
    note: str = ""


# ---- RPC helpers ----
async def rpc_call(
    session: aiohttp.ClientSession, rpc: str, method: str, params: list
) -> Any:
    payload = {"jsonrpc": "2.0", "id": 1, "method": method, "params": params}
    async with session.post(rpc, json=payload, timeout=aiohttp.ClientTimeout(total=30)) as resp:
        data = await resp.json()
        if "error" in data:
            raise RuntimeError(f"RPC err: {data['error']} method={method}")
        return data["result"]


async def get_latest_block(session, rpc: str) -> int:
    res = await rpc_call(session, rpc, "eth_blockNumber", [])
    return int(res, 16)


async def get_logs_chunked(
    session, rpc: str, address: str, topic0: str, from_block: int, to_block: int,
    chunk_size: int
) -> list[dict]:
    logs: list[dict] = []
    sem = asyncio.Semaphore(MAX_CONCURRENT_RPCS_PER_CHAIN)

    async def fetch(f, t):
        async with sem:
            params = [
                {
                    "address": address,
                    "topics": [topic0],
                    "fromBlock": hex(f),
                    "toBlock": hex(t),
                }
            ]
            try:
                return await rpc_call(session, rpc, "eth_getLogs", params)
            except Exception as e:
                sys.stderr.write(f"[warn] getLogs {f}-{t}: {e}\n")
                return []

    tasks = []
    b = from_block
    while b <= to_block:
        t = min(b + chunk_size - 1, to_block)
        tasks.append(fetch(b, t))
        b = t + 1
    results = await asyncio.gather(*tasks)
    for r in results:
        logs.extend(r)
    return logs


def extract_receivers(logs: list[dict]) -> set[str]:
    """PacketDelivered data = origin(96) + receiver(32). Receiver is bytes 96..128, last 20B address."""
    out: set[str] = set()
    for log in logs:
        data = log["data"]
        if data.startswith("0x"):
            data = data[2:]
        if len(data) < 256:
            continue
        recv_word = data[192:256]
        addr = "0x" + recv_word[-40:]
        out.add(to_checksum_address(addr))
    return out


# ---- Multicall encode/decode ----
def pad32(hex_no0x: str) -> str:
    return hex_no0x.rjust(64, "0")


def encode_address(addr: str) -> str:
    return pad32(addr[2:].lower())


def encode_uint32(v: int) -> str:
    return pad32(format(v, "x"))


def encode_get_recv_lib(oapp: str, src_eid: int) -> bytes:
    return bytes.fromhex(SEL_GET_RECV_LIB + encode_address(oapp) + encode_uint32(src_eid))


def encode_get_config(oapp: str, lib: str, src_eid: int, cfg_type: int) -> bytes:
    return bytes.fromhex(
        SEL_GET_CONFIG
        + encode_address(oapp)
        + encode_address(lib)
        + encode_uint32(src_eid)
        + encode_uint32(cfg_type)
    )


def encode_try_aggregate(require_success: bool, calls: list[tuple[str, bytes]]) -> str:
    data = encode(
        ["bool", "(address,bytes)[]"],
        [require_success, [(to_checksum_address(t), c) for t, c in calls]],
    )
    return "0x" + SEL_TRY_AGGREGATE + data.hex()


def decode_try_aggregate(result_hex: str) -> list[tuple[bool, bytes]]:
    raw = bytes.fromhex(result_hex[2:] if result_hex.startswith("0x") else result_hex)
    decoded = decode(["(bool,bytes)[]"], raw)[0]
    return [(s, b) for s, b in decoded]


async def multicall(
    session, rpc: str, calls: list[tuple[str, bytes]]
) -> list[tuple[bool, bytes]]:
    """Batch eth_call via Multicall3.tryAggregate. Splits into chunks."""
    out: list[tuple[bool, bytes]] = []
    for i in range(0, len(calls), MAX_MULTICALL_BATCH):
        chunk = calls[i : i + MAX_MULTICALL_BATCH]
        data = encode_try_aggregate(False, chunk)
        try:
            res = await rpc_call(
                session,
                rpc,
                "eth_call",
                [{"to": MULTICALL3, "data": data}, "latest"],
            )
            out.extend(decode_try_aggregate(res))
        except Exception as e:
            sys.stderr.write(f"[warn] multicall chunk fail: {e}\n")
            out.extend([(False, b"")] * len(chunk))
    return out


# ---- ULN config decode ----
def decode_uln_config(data: bytes) -> dict | None:
    """Parse the bytes returned by getConfig for ULN config.

    Outer: abi-encoded bytes wrapper (offset, length, content).
    Content is abi-encoded UlnConfig struct (dynamic) with leading 0x20 offset.
    Struct: (uint64 conf, uint8 req, uint8 opt, uint8 thr, address[] req, address[] opt)
    """
    if len(data) < 320:
        return None
    try:
        inner_bytes = decode(["bytes"], data)[0]
    except Exception:
        return None
    if len(inner_bytes) < 256:
        return None
    try:
        conf, req, opt, thr, req_dvns, opt_dvns = decode(
            ["(uint64,uint8,uint8,uint8,address[],address[])"], inner_bytes
        )[0]
    except Exception:
        return None
    return {
        "confirmations": conf,
        "req_count": req,
        "opt_count": opt,
        "opt_threshold": thr,
        "req_dvns": [to_checksum_address(a) for a in req_dvns],
        "opt_dvns": [to_checksum_address(a) for a in opt_dvns],
    }


# ---- Chain scan ----
async def scan_chain(chain: dict, session: aiohttp.ClientSession) -> list[Vulnerable]:
    name = chain["name"]
    rpc = chain["rpc"]
    t0 = time.time()
    sys.stderr.write(f"[{name}] fetching latest block...\n")
    latest = await get_latest_block(session, rpc)
    from_block = max(0, latest - chain["block_range"])
    sys.stderr.write(f"[{name}] enumerating OApps in blocks {from_block}-{latest}\n")
    logs = await get_logs_chunked(
        session,
        rpc,
        ENDPOINT_V2,
        PKT_DELIVERED_TOPIC,
        from_block,
        latest,
        chain["chunk_size"],
    )
    oapps = sorted(extract_receivers(logs))
    sys.stderr.write(f"[{name}] found {len(oapps)} unique OApps in {time.time()-t0:.1f}s\n")
    if not oapps:
        return []

    # Round 1: getReceiveLibrary for each (oapp, each probe_src_eid)
    calls_r1: list[tuple[str, bytes]] = []
    call_map_r1: list[tuple[str, int]] = []  # (oapp, src_eid)
    for oapp in oapps:
        for eid in chain["probe_src_eids"]:
            calls_r1.append((ENDPOINT_V2, encode_get_recv_lib(oapp, eid)))
            call_map_r1.append((oapp, eid))

    t1 = time.time()
    sys.stderr.write(f"[{name}] multicall getReceiveLibrary × {len(calls_r1)}...\n")
    r1 = await multicall(session, rpc, calls_r1)
    sys.stderr.write(f"[{name}] r1 done in {time.time()-t1:.1f}s\n")

    # Round 2: getConfig using recovered libs
    calls_r2: list[tuple[str, bytes]] = []
    call_map_r2: list[tuple[str, int, str]] = []  # (oapp, src_eid, lib)
    for (oapp, eid), (ok, ret) in zip(call_map_r1, r1, strict=False):
        if not ok or len(ret) < 64:
            continue
        try:
            lib_addr, _is_default = decode(["address", "bool"], ret)
            lib_addr = to_checksum_address(lib_addr)
        except Exception:
            continue
        if int(lib_addr, 16) == 0:
            continue
        calls_r2.append((ENDPOINT_V2, encode_get_config(oapp, lib_addr, eid, 2)))
        call_map_r2.append((oapp, eid, lib_addr))

    t2 = time.time()
    sys.stderr.write(f"[{name}] multicall getConfig × {len(calls_r2)}...\n")
    r2 = await multicall(session, rpc, calls_r2)
    sys.stderr.write(f"[{name}] r2 done in {time.time()-t2:.1f}s\n")

    # Filter: req=1, opt=0 (pure 1-of-1). Keep minimum req across EIDs per OApp.
    adapter_best: dict[str, Vulnerable] = {}
    for (oapp, eid, _lib), (ok, ret) in zip(call_map_r2, r2, strict=False):
        if not ok:
            continue
        cfg = decode_uln_config(ret)
        if cfg is None:
            continue
        if cfg["req_count"] == 1 and cfg["opt_count"] == 0 and cfg["opt_threshold"] == 0:
            dvn = cfg["req_dvns"][0].lower() if cfg["req_dvns"] else "0x0"
            # Filter stub DVNs - default config returned when OApp has no
            # custom config for this EID; not a real vulnerability.
            if dvn in STUB_DVNS:
                continue
            prev = adapter_best.get(oapp)
            if prev is None:
                adapter_best[oapp] = Vulnerable(
                    chain=name,
                    chain_id=chain["chain_id"],
                    adapter=oapp,
                    src_eid=eid,
                    confirmations=cfg["confirmations"],
                    dvn=cfg["req_dvns"][0] if cfg["req_dvns"] else "0x0",
                )

    flagged = list(adapter_best.values())
    sys.stderr.write(f"[{name}] flagged {len(flagged)} pure 1-of-1 adapters\n")

    if not flagged:
        return []

    # Round 3: enrich with token/symbol/decimals/balance/approvalRequired
    calls_r3: list[tuple[str, bytes]] = []
    for v in flagged:
        calls_r3.append((v.adapter, bytes.fromhex(SEL_TOKEN)))
        calls_r3.append((v.adapter, bytes.fromhex(SEL_APPROVAL_REQUIRED)))
    t3 = time.time()
    r3 = await multicall(session, rpc, calls_r3)
    sys.stderr.write(f"[{name}] r3 (token) done in {time.time()-t3:.1f}s\n")

    for i, v in enumerate(flagged):
        ok_token, ret_token = r3[i * 2]
        ok_appr, ret_appr = r3[i * 2 + 1]
        if ok_token and len(ret_token) >= 32:
            try:
                v.token = to_checksum_address(decode(["address"], ret_token)[0])
            except Exception:
                v.token = None
        if ok_appr and len(ret_appr) >= 32:
            try:
                v.approval_required = decode(["bool"], ret_appr)[0]
            except Exception:
                pass

    # Round 4: token symbol, decimals, balance (only for those with valid token)
    calls_r4: list[tuple[str, bytes]] = []
    idx_map: list[int] = []
    for i, v in enumerate(flagged):
        if v.token and int(v.token, 16) != 0:
            target_for_bal = v.adapter if v.approval_required else v.adapter  # lockbox or native OFT
            calls_r4.append((v.token, bytes.fromhex(SEL_SYMBOL)))
            calls_r4.append((v.token, bytes.fromhex(SEL_DECIMALS)))
            if v.approval_required:
                # lockbox: balance of adapter in underlying token
                bal_data = bytes.fromhex(SEL_BALANCE_OF + encode_address(v.adapter))
                calls_r4.append((v.token, bal_data))
            else:
                # native OFT: total supply represents exposure
                calls_r4.append((v.token, bytes.fromhex(SEL_TOTAL_SUPPLY)))
            idx_map.extend([i] * 3)
    t4 = time.time()
    r4 = await multicall(session, rpc, calls_r4)
    sys.stderr.write(f"[{name}] r4 (balance) done in {time.time()-t4:.1f}s\n")

    for j in range(0, len(r4), 3):
        i = idx_map[j]
        v = flagged[i]
        ok_sym, ret_sym = r4[j]
        ok_dec, ret_dec = r4[j + 1]
        ok_bal, ret_bal = r4[j + 2]
        if ok_sym and len(ret_sym) >= 32:
            try:
                v.symbol = decode(["string"], ret_sym)[0]
            except Exception:
                try:
                    # some tokens return bytes32 symbol
                    v.symbol = ret_sym[:32].rstrip(b"\x00").decode("utf-8", errors="replace")
                except Exception:
                    pass
        if ok_dec and len(ret_dec) >= 32:
            try:
                v.decimals = decode(["uint8"], ret_dec)[0]
            except Exception:
                pass
        if ok_bal and len(ret_bal) >= 32:
            try:
                v.balance_raw = decode(["uint256"], ret_bal)[0]
                if v.decimals is not None and v.decimals > 0:
                    v.balance_human = v.balance_raw / (10 ** v.decimals)
            except Exception:
                pass
        if not v.approval_required:
            v.note = "native OFT - mint risk (totalSupply shown)"
        else:
            v.note = "OFT Adapter lockbox - drain risk"

    return flagged


async def main() -> None:
    t0 = time.time()
    timeout = aiohttp.ClientTimeout(total=120)
    async with aiohttp.ClientSession(timeout=timeout) as session:
        results = await asyncio.gather(
            *[scan_chain(c, session) for c in CHAINS], return_exceptions=True
        )
    all_flagged: list[Vulnerable] = []
    for chain, r in zip(CHAINS, results, strict=False):
        if isinstance(r, Exception):
            sys.stderr.write(f"[{chain['name']}] ERROR: {r}\n")
        else:
            all_flagged.extend(r)

    sys.stderr.write(f"\n=== TOTAL scan time: {time.time()-t0:.1f}s ===\n")
    print(json.dumps([asdict(v) for v in all_flagged], indent=2))


if __name__ == "__main__":
    asyncio.run(main())
