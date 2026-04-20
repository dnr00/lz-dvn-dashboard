import type { OftRow } from "./types";

export type SortKey =
  | "symbol"
  | "chain_count"
  | "vulnerable_count"
  | "paused_count"
  | "total_tvl_usd"
  | "price_spread_pct"
  | "arbitrage";

export type SortDir = "asc" | "desc";

function getSortValue(row: OftRow, key: SortKey): number | string {
  switch (key) {
    case "symbol":
      return row.symbol.toLowerCase();
    case "chain_count":
      return row.chain_count;
    case "vulnerable_count":
      return row.vulnerable_count;
    case "paused_count":
      return row.paused_count;
    case "total_tvl_usd":
      return row.total_tvl_usd ?? -1;
    case "price_spread_pct":
      return row.price_spread_pct ?? -1;
    case "arbitrage":
      return row.arbitrage?.spread_pct ?? -1;
  }
}

export function sortRows(
  rows: OftRow[],
  key: SortKey,
  dir: SortDir,
): OftRow[] {
  const out = [...rows];
  out.sort((a, b) => {
    const va = getSortValue(a, key);
    const vb = getSortValue(b, key);
    if (va < vb) return dir === "asc" ? -1 : 1;
    if (va > vb) return dir === "asc" ? 1 : -1;
    return a.symbol.localeCompare(b.symbol);
  });
  return out;
}
