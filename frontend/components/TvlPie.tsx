"use client";

import { useState } from "react";
import type { ChainDeployment } from "@/lib/types";
import { fmtChainCode, fmtUsd } from "@/lib/format";

const CHAIN_COLORS: Record<string, string> = {
  ethereum: "#6ecbff",
  arbitrum: "#28a0f0",
  base: "#0052ff",
  optimism: "#ff0420",
  bsc: "#f0b90b",
  polygon: "#8247e5",
  avalanche: "#e84142",
  scroll: "#ffe0b3",
  linea: "#61dfc6",
  unichain: "#ff007a",
  mantle: "#0b0b0b",
  plasma: "#d8ff2b",
};

interface Props {
  deployments: ChainDeployment[];
  total: number;
  children: React.ReactNode;
}

interface Slice {
  chain: string;
  chain_display: string;
  value: number;
  pct: number;
  color: string;
  start: number;
  end: number;
}

function buildSlices(deps: ChainDeployment[], total: number): Slice[] {
  const priced = deps
    .filter((d) => d.tvl_usd && d.tvl_usd > 0)
    .sort((a, b) => (b.tvl_usd ?? 0) - (a.tvl_usd ?? 0));
  let cursor = 0;
  return priced.map((d) => {
    const value = d.tvl_usd ?? 0;
    const pct = total > 0 ? value / total : 0;
    const start = cursor;
    cursor += pct;
    return {
      chain: d.chain,
      chain_display: d.chain_display,
      value,
      pct,
      color: CHAIN_COLORS[d.chain] ?? "#8b8ba1",
      start,
      end: cursor,
    };
  });
}

function polar(cx: number, cy: number, r: number, angle: number) {
  const rad = angle * Math.PI * 2 - Math.PI / 2;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function arcPath(
  cx: number,
  cy: number,
  rOuter: number,
  rInner: number,
  start: number,
  end: number,
): string {
  // guard: full-circle single slice needs two half arcs
  if (end - start >= 0.999) {
    const top = polar(cx, cy, rOuter, 0);
    const bot = polar(cx, cy, rOuter, 0.5);
    const topI = polar(cx, cy, rInner, 0);
    const botI = polar(cx, cy, rInner, 0.5);
    return `M ${top.x} ${top.y} A ${rOuter} ${rOuter} 0 1 1 ${bot.x} ${bot.y} A ${rOuter} ${rOuter} 0 1 1 ${top.x} ${top.y} Z M ${topI.x} ${topI.y} A ${rInner} ${rInner} 0 1 0 ${botI.x} ${botI.y} A ${rInner} ${rInner} 0 1 0 ${topI.x} ${topI.y} Z`;
  }
  const pStart = polar(cx, cy, rOuter, start);
  const pEnd = polar(cx, cy, rOuter, end);
  const pStartI = polar(cx, cy, rInner, end);
  const pEndI = polar(cx, cy, rInner, start);
  const large = end - start > 0.5 ? 1 : 0;
  return [
    `M ${pStart.x} ${pStart.y}`,
    `A ${rOuter} ${rOuter} 0 ${large} 1 ${pEnd.x} ${pEnd.y}`,
    `L ${pStartI.x} ${pStartI.y}`,
    `A ${rInner} ${rInner} 0 ${large} 0 ${pEndI.x} ${pEndI.y}`,
    "Z",
  ].join(" ");
}

export function TvlPie({ deployments, total, children }: Props) {
  const [hover, setHover] = useState(false);
  const slices = buildSlices(deployments, total);
  const canShow = slices.length > 0 && total > 0;

  return (
    <span
      className="relative inline-block"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      {children}
      {canShow && hover && (
        <span className="absolute right-0 top-full z-20 mt-2 pointer-events-none">
          <span className="block bg-panel border border-border-strong shadow-brutal p-3 min-w-[220px]">
            <span className="block text-[9px] uppercase tracking-[0.25em] text-dim mb-2">
              tvl by chain · {fmtUsd(total)}
            </span>
            <span className="flex items-center gap-3">
              <svg width="72" height="72" viewBox="0 0 72 72" className="shrink-0">
                {slices.map((s) => (
                  <path
                    key={s.chain}
                    d={arcPath(36, 36, 34, 20, s.start, s.end)}
                    fill={s.color}
                    opacity="0.9"
                  />
                ))}
              </svg>
              <span className="flex flex-col gap-1 flex-1 min-w-0">
                {slices.map((s) => (
                  <span
                    key={s.chain}
                    className="flex items-center gap-1.5 text-[10px]"
                  >
                    <span
                      className="inline-block w-2 h-2 shrink-0"
                      style={{ background: s.color }}
                    />
                    <span className="text-muted uppercase tracking-wider w-8 shrink-0">
                      {fmtChainCode(s.chain)}
                    </span>
                    <span className="text-fg tabular-nums">
                      {(s.pct * 100).toFixed(1)}%
                    </span>
                    <span className="text-dim tabular-nums ml-auto">
                      {fmtUsd(s.value)}
                    </span>
                  </span>
                ))}
              </span>
            </span>
          </span>
        </span>
      )}
    </span>
  );
}
