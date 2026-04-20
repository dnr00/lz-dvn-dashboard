"use client";

import { motion } from "framer-motion";
import type { ChainHealth, ScanMeta } from "@/lib/types";
import { fmtChainCode, fmtDurationAgo, fmtSeconds } from "@/lib/format";

interface Props {
  meta: ScanMeta;
  vulnerableCount: number;
  pausedCount: number;
  arbitrageCount: number;
}

function ChainDot({ health }: { health: ChainHealth }) {
  const color = !health.rpc_ok
    ? "bg-vuln"
    : health.vulnerable_count > 0
      ? "bg-vuln"
      : "bg-safe";
  const glow = !health.rpc_ok
    ? "shadow-glow-vuln"
    : health.vulnerable_count > 0
      ? "shadow-glow-vuln"
      : "";
  return (
    <div
      title={`${health.chain_display} — ${health.oft_count} OFTs, ${health.vulnerable_count} vuln, ${
        health.latency_ms != null ? `${health.latency_ms}ms` : "no rpc"
      }`}
      className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.18em] text-muted hover:text-fg transition-colors"
    >
      <span className={`inline-block w-1.5 h-1.5 ${color} ${glow}`} />
      <span>{fmtChainCode(health.chain)}</span>
      <span className="text-dim">{health.oft_count}</span>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: React.ReactNode; tone?: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-dim text-[10px] uppercase tracking-[0.22em]">{label}</span>
      <span className={`text-xs md:text-[13px] ${tone ?? "text-fg"}`}>{value}</span>
    </div>
  );
}

export function StatusBar({ meta, vulnerableCount, pausedCount, arbitrageCount }: Props) {
  const stale = meta.cache_age_s > 30;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.15, duration: 0.35 }}
      className="border-b border-border bg-panel/60 backdrop-blur-sm sticky top-0 z-20"
    >
      <div className="mx-auto max-w-[1440px] px-6 md:px-10 py-3 flex flex-wrap items-center gap-x-6 gap-y-2">
        <Stat
          label="LZ_API"
          value={<span className="text-safe">OK</span>}
        />
        <span className="text-border-strong">|</span>
        <Stat label="SCAN" value={fmtSeconds(meta.duration_ms)} />
        <span className="text-border-strong">|</span>
        <Stat
          label="CACHE"
          value={
            <span className={stale ? "text-warn" : "text-fg"}>
              {fmtDurationAgo(meta.cache_age_s)}
            </span>
          }
        />
        <span className="text-border-strong">|</span>
        <Stat
          label="VULN"
          value={
            <span className={vulnerableCount > 0 ? "text-vuln" : "text-muted"}>
              {vulnerableCount}
            </span>
          }
        />
        <span className="text-border-strong">|</span>
        <Stat
          label="PAUSED"
          value={
            <span className={pausedCount > 0 ? "text-warn" : "text-muted"}>
              {pausedCount}
            </span>
          }
        />
        <span className="text-border-strong">|</span>
        <Stat
          label="ARB"
          value={
            <span className={arbitrageCount > 0 ? "text-accent" : "text-muted"}>
              {arbitrageCount}
            </span>
          }
        />
        <span className="text-border-strong">|</span>
        <Stat
          label="PRICES"
          value={
            <span className="text-muted">
              <span className="text-fg">{meta.dexscreener_hits}</span>
              <span className="text-dim">/</span>
              {meta.dexscreener_hits + meta.dexscreener_misses}
            </span>
          }
        />

        <div className="flex-1" />

        <div className="flex items-center gap-3 flex-wrap">
          {meta.chains_health.map((h) => (
            <ChainDot key={h.chain} health={h} />
          ))}
        </div>
      </div>
    </motion.div>
  );
}
