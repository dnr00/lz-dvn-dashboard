"use client";

import type { OftRow } from "@/lib/types";
import type { SortDir, SortKey } from "@/lib/sort";
import { fmtPct, fmtUsd } from "@/lib/format";
import { ChainGrid } from "./ChainGrid";
import { SpreadBar } from "./SpreadBar";

interface Props {
  rows: OftRow[];
  sortKey: SortKey;
  sortDir: SortDir;
  onSort: (key: SortKey) => void;
  onOpen: (row: OftRow) => void;
  activeSymbol?: string;
}

const COLS: { key: SortKey; label: string; className: string; align?: "left" | "right" }[] = [
  { key: "symbol", label: "symbol", className: "w-[14%]" },
  { key: "chain_count", label: "chains", className: "w-[22%]" },
  { key: "vulnerable_count", label: "vuln", className: "w-[7%]", align: "right" },
  { key: "paused_count", label: "paused", className: "w-[7%]", align: "right" },
  { key: "total_tvl_usd", label: "tvl", className: "w-[13%]", align: "right" },
  { key: "price_spread_pct", label: "spread", className: "w-[13%]" },
  { key: "arbitrage", label: "arb", className: "w-[24%]" },
];

function SortIcon({
  active,
  dir,
}: {
  active: boolean;
  dir: SortDir;
}) {
  if (!active)
    return <span className="text-dim opacity-60">~</span>;
  return (
    <span className="text-accent">
      {dir === "asc" ? "▲" : "▼"}
    </span>
  );
}

export function OftTable({ rows, sortKey, sortDir, onSort, onOpen, activeSymbol }: Props) {
  return (
    <div className="border border-border bg-panel/60 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-panel-2/80">
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.25em] text-muted">
          <span className="bracket-label text-accent">registry</span>
          <span className="text-dim">·</span>
          <span>{rows.length} symbols</span>
        </div>
        <div className="text-[10px] text-dim uppercase tracking-[0.25em]">
          click row → details
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs min-w-[1040px]">
          <thead>
            <tr className="border-b border-border bg-bg/60 text-dim">
              <th className="w-10 py-3 px-3 text-left font-normal">
                <span className="text-[10px] uppercase tracking-[0.22em]">#</span>
              </th>
              {COLS.map((c) => (
                <th
                  key={c.key}
                  className={`${c.className} py-3 px-3 font-normal cursor-pointer select-none hover:text-fg transition-colors ${
                    c.align === "right" ? "text-right" : "text-left"
                  }`}
                  onClick={() => onSort(c.key)}
                >
                  <span
                    className={`text-[10px] uppercase tracking-[0.22em] flex items-center gap-1.5 ${
                      c.align === "right" ? "justify-end" : ""
                    }`}
                  >
                    {c.label}
                    <SortIcon active={sortKey === c.key} dir={sortDir} />
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => {
              const active = row.symbol === activeSymbol;
              const isVuln = row.vulnerable_count > 0;
              const isPaused = row.paused_count > 0;
              const arb = row.arbitrage;
              return (
                <tr
                  key={row.symbol}
                  data-active={active ? "true" : undefined}
                  className="row-accent border-b border-border/70 cursor-pointer hover:bg-panel-2/80 transition-colors"
                  onClick={() => onOpen(row)}
                >
                  <td className="py-3 px-3 text-dim tabular-nums text-[10px]">
                    {String(i + 1).padStart(3, "0")}
                  </td>
                  <td className="py-3 px-3 align-top">
                    <div className="flex flex-col">
                      <span
                        className={`font-display text-[1.05rem] ${isVuln ? "text-vuln" : "text-fg"} link-dash`}
                      >
                        {row.symbol}
                      </span>
                      {row.name && (
                        <span className="text-[10px] text-dim uppercase tracking-wider truncate max-w-[11rem]">
                          {row.name}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-3 px-3 align-top">
                    <ChainGrid deployments={row.deployments} />
                  </td>
                  <td className="py-3 px-3 align-top text-right">
                    {isVuln ? (
                      <span className="text-vuln font-semibold tabular-nums">
                        {row.vulnerable_count}
                      </span>
                    ) : (
                      <span className="text-dim">0</span>
                    )}
                  </td>
                  <td className="py-3 px-3 align-top text-right">
                    {isPaused ? (
                      <span className="text-warn font-semibold tabular-nums">
                        {row.paused_count}
                      </span>
                    ) : (
                      <span className="text-dim">0</span>
                    )}
                  </td>
                  <td className="py-3 px-3 align-top text-right tabular-nums">
                    {row.total_tvl_usd != null ? (
                      <span className="text-fg">{fmtUsd(row.total_tvl_usd)}</span>
                    ) : (
                      <span className="text-dim">—</span>
                    )}
                  </td>
                  <td className="py-3 px-3 align-top">
                    <SpreadBar pct={row.price_spread_pct} />
                  </td>
                  <td className="py-3 px-3 align-top">
                    {arb ? (
                      <div className="flex items-center gap-2">
                        <span className="inline-block w-1.5 h-1.5 bg-accent animate-pulse" />
                        <span className="text-accent font-semibold tabular-nums text-[11px]">
                          {fmtPct(arb.spread_pct)}
                        </span>
                        <span className="text-muted text-[10px] uppercase tracking-wide">
                          {arb.cheap_chain} → {arb.expensive_chain}
                        </span>
                      </div>
                    ) : (
                      <span className="text-dim">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {rows.length === 0 && (
        <div className="py-16 text-center text-muted">
          <div className="text-[10px] uppercase tracking-[0.25em] text-dim mb-2">
            no matches
          </div>
          <div className="text-sm">adjust filters or toggle view mode</div>
        </div>
      )}
    </div>
  );
}
