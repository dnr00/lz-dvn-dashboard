"use client";

import type { ChainDeployment } from "@/lib/types";
import { fmtChainCode } from "@/lib/format";

const COLORS: Record<string, string> = {
  vulnerable: "bg-vuln text-bg",
  paused: "bg-warn text-bg",
  safe: "bg-safe/80 text-bg",
  unknown: "bg-dim text-muted",
  unreachable: "bg-border-strong text-muted",
};

export function ChainGrid({ deployments }: { deployments: ChainDeployment[] }) {
  const sorted = [...deployments].sort((a, b) => {
    const order: Record<string, number> = {
      vulnerable: 0,
      paused: 1,
      unreachable: 2,
      unknown: 3,
      safe: 4,
    };
    return (order[a.status] ?? 9) - (order[b.status] ?? 9);
  });
  return (
    <div className="flex flex-wrap gap-1">
      {sorted.map((d) => {
        const cls = COLORS[d.status] ?? COLORS.unknown;
        return (
          <span
            key={d.chain}
            className={`${cls} text-[9px] uppercase tracking-[0.16em] px-1.5 py-0.5 leading-none`}
            title={`${d.chain_display} · ${d.status.toUpperCase()}`}
          >
            {fmtChainCode(d.chain)}
          </span>
        );
      })}
    </div>
  );
}
