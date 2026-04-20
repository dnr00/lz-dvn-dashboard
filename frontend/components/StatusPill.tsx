"use client";

import type { ChainStatus } from "@/lib/types";

const MAP: Record<
  ChainStatus,
  { label: string; className: string; dot: string }
> = {
  vulnerable: {
    label: "VULN",
    className: "text-vuln border-vuln/60 bg-vuln/10",
    dot: "bg-vuln shadow-glow-vuln",
  },
  paused: {
    label: "PAUSED",
    className: "text-warn border-warn/60 bg-warn/5",
    dot: "bg-warn",
  },
  safe: {
    label: "SAFE",
    className: "text-safe border-safe/40 bg-safe/5",
    dot: "bg-safe shadow-glow-safe",
  },
  unknown: {
    label: "UNK",
    className: "text-muted border-border-strong",
    dot: "bg-dim",
  },
  unreachable: {
    label: "NO_RPC",
    className: "text-muted border-border-strong",
    dot: "bg-dim",
  },
};

export function StatusPill({
  status,
  size = "md",
}: {
  status: ChainStatus;
  size?: "sm" | "md";
}) {
  const cfg = MAP[status] ?? MAP.unknown;
  const padding = size === "sm" ? "px-1.5 py-0.5 text-[9px]" : "px-2 py-1 text-[10px]";
  return (
    <span
      className={`inline-flex items-center gap-1.5 ${padding} uppercase tracking-[0.22em] border ${cfg.className}`}
    >
      <span className={`inline-block w-1 h-1 ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}
