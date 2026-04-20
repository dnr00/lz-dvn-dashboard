export function fmtUsd(value: number | null | undefined, compact = true): string {
  if (value == null || !Number.isFinite(value)) return "—";
  const abs = Math.abs(value);
  if (compact) {
    if (abs >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(2)}B`;
    if (abs >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
    if (abs >= 1_000) return `$${(value / 1_000).toFixed(2)}K`;
  }
  if (abs >= 1) return `$${value.toFixed(2)}`;
  if (abs >= 0.01) return `$${value.toFixed(4)}`;
  return `$${value.toPrecision(3)}`;
}

export function fmtPct(value: number | null | undefined, digits = 2): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${value.toFixed(digits)}%`;
}

export function fmtNumber(value: number | null | undefined, digits = 2): string {
  if (value == null || !Number.isFinite(value)) return "—";
  const abs = Math.abs(value);
  if (abs >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(digits)}B`;
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(digits)}M`;
  if (abs >= 1_000) return `${(value / 1_000).toFixed(digits)}K`;
  return value.toFixed(digits);
}

export function fmtAddress(addr: string | null | undefined, size = 4): string {
  if (!addr) return "—";
  if (addr.length < size * 2 + 4) return addr;
  return `${addr.slice(0, 2 + size)}…${addr.slice(-size)}`;
}

export function fmtChainCode(name: string): string {
  const map: Record<string, string> = {
    ethereum: "ETH",
    arbitrum: "ARB",
    base: "BASE",
    optimism: "OP",
    bsc: "BSC",
    polygon: "POL",
    avalanche: "AVAX",
    scroll: "SCR",
    linea: "LIN",
    unichain: "UNI",
    mantle: "MNT",
    plasma: "XPL",
  };
  return map[name] ?? name.slice(0, 4).toUpperCase();
}

export function fmtSeconds(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export function fmtDurationAgo(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "—";
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  return `${(seconds / 3600).toFixed(1)}h`;
}
