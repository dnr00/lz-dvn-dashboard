"use client";

import { motion } from "framer-motion";
import { fmtChainCode } from "@/lib/format";

export type ViewMode = "all" | "vulnerable" | "paused" | "arbitrage";

interface Props {
  mode: ViewMode;
  setMode: (m: ViewMode) => void;
  counts: Record<ViewMode, number>;
  chains: { chain: string; chain_display: string }[];
  selectedChains: Set<string>;
  toggleChain: (c: string) => void;
  clearChains: () => void;
  query: string;
  setQuery: (q: string) => void;
}

const MODES: { key: ViewMode; label: string }[] = [
  { key: "vulnerable", label: "vulnerable" },
  { key: "paused", label: "paused" },
  { key: "arbitrage", label: "arbitrage" },
  { key: "all", label: "all" },
];

export function FilterBar({
  mode,
  setMode,
  counts,
  chains,
  selectedChains,
  toggleChain,
  clearChains,
  query,
  setQuery,
}: Props) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.25, duration: 0.35 }}
      className="border-b border-border bg-bg/80"
    >
      <div className="mx-auto max-w-[1440px] px-6 md:px-10 py-4 flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-dim text-[10px] uppercase tracking-[0.25em] mr-1">
            view
          </span>
          <div className="flex flex-wrap gap-0 border border-border-strong">
            {MODES.map((m) => {
              const active = mode === m.key;
              return (
                <button
                  key={m.key}
                  onClick={() => setMode(m.key)}
                  className={`px-3 py-2 text-[11px] uppercase tracking-[0.2em] border-r border-border-strong last:border-r-0 transition-colors ${
                    active
                      ? "bg-accent text-bg"
                      : "bg-transparent text-muted hover:text-fg hover:bg-panel"
                  }`}
                >
                  <span>{m.label}</span>
                  <span className={`ml-2 ${active ? "text-bg/70" : "text-dim"}`}>
                    {counts[m.key]}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="flex-1 min-w-[180px] max-w-sm relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-accent text-xs pointer-events-none">
              &gt;
            </span>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="search symbol / token / adapter / dvn"
              className="w-full bg-panel border border-border text-fg px-7 py-2 text-xs uppercase tracking-wider placeholder:text-dim focus:border-accent focus:outline-none transition-colors"
              spellCheck={false}
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-dim text-[10px] uppercase tracking-[0.25em] mr-1">
            chains
          </span>
          <button
            onClick={clearChains}
            className={`px-2 py-1 text-[10px] uppercase tracking-[0.2em] border ${
              selectedChains.size === 0
                ? "border-accent text-accent"
                : "border-border text-muted hover:border-border-strong hover:text-fg"
            }`}
          >
            all
          </button>
          {chains.map((c) => {
            const active = selectedChains.has(c.chain);
            return (
              <button
                key={c.chain}
                onClick={() => toggleChain(c.chain)}
                className={`px-2 py-1 text-[10px] uppercase tracking-[0.2em] border ${
                  active
                    ? "border-accent text-accent bg-accent/5"
                    : "border-border text-muted hover:border-border-strong hover:text-fg"
                }`}
                title={c.chain_display}
              >
                {fmtChainCode(c.chain)}
              </button>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}
