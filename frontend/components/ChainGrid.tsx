"use client";

import type { ChainDeployment } from "@/lib/types";
import { fmtChainCode } from "@/lib/format";

const COLORS: Record<string, string> = {
  vulnerable: "bg-vuln text-bg",
  paused: "bg-warn text-bg",
  safe: "bg-safe text-bg",
  unknown: "bg-dim text-fg",
  unreachable: "bg-border-strong text-muted",
};

export function ChainGrid({ deployments }: { deployments: ChainDeployment[] }) {
  const sorted = [...deployments].sort((a, b) => {
    const score = (d: ChainDeployment) => {
      const s = d.status;
      if (s === "vulnerable") return 0;
      if (d.paused) return 1;
      if (d.send_blocked) return 2;
      if (s === "unreachable") return 3;
      if (s === "unknown") return 4;
      return 5;
    };
    return score(a) - score(b);
  });
  return (
    <div className="flex flex-wrap gap-1">
      {sorted.map((d) => {
        const cls = COLORS[d.status] ?? COLORS.unknown;
        const ring = d.paused
          ? "ring-2 ring-warn ring-offset-0"
          : d.send_blocked
            ? "ring-2 ring-info ring-offset-0 opacity-70"
            : "";
        const flags: string[] = [];
        if (d.paused) flags.push("PAUSED");
        if (d.send_blocked) flags.push("SEND-BLOCKED (all peers 0x0)");
        const title = `${d.chain_display} · ${d.status.toUpperCase()}${flags.length ? " · " + flags.join(" · ") : ""}`;
        return (
          <span
            key={d.chain}
            className={`${cls} ${ring} text-[10px] font-semibold uppercase tracking-[0.14em] px-1.5 py-0.5 leading-none inline-flex items-center gap-0.5`}
            title={title}
          >
            {fmtChainCode(d.chain)}
            {d.paused && <span aria-hidden className="text-[9px] leading-none">⏸</span>}
            {d.send_blocked && !d.paused && (
              <span aria-hidden className="text-[9px] leading-none">⊘</span>
            )}
          </span>
        );
      })}
    </div>
  );
}
