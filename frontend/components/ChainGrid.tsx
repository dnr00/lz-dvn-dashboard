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
    const score = (d: ChainDeployment) => {
      const s = d.status;
      if (s === "vulnerable") return 0;
      if (d.paused) return 1;
      if (s === "unreachable") return 2;
      if (s === "unknown") return 3;
      return 4;
    };
    return score(a) - score(b);
  });
  return (
    <div className="flex flex-wrap gap-1">
      {sorted.map((d) => {
        const cls = COLORS[d.status] ?? COLORS.unknown;
        const pausedRing = d.paused ? "ring-2 ring-warn ring-offset-0" : "";
        const title = `${d.chain_display} · ${d.status.toUpperCase()}${d.paused ? " · PAUSED" : ""}`;
        return (
          <span
            key={d.chain}
            className={`${cls} ${pausedRing} text-[10px] font-semibold uppercase tracking-[0.14em] px-1.5 py-0.5 leading-none inline-flex items-center gap-0.5`}
            title={title}
          >
            {fmtChainCode(d.chain)}
            {d.paused && <span aria-hidden className="text-[9px] leading-none">⏸</span>}
          </span>
        );
      })}
    </div>
  );
}
