"use client";

import { motion } from "framer-motion";

interface Props {
  totalOfts: number;
  scannedChains: number;
  onRefresh: () => void;
  refreshing: boolean;
}

export function Header({ totalOfts, scannedChains, onRefresh, refreshing }: Props) {
  return (
    <header className="relative border-b border-border scanline noise overflow-hidden">
      <div className="grid-surface">
        <div className="mx-auto max-w-[1440px] px-6 md:px-10 py-8 md:py-10 relative">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6">
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45 }}
              className="relative"
            >
              <div className="flex items-center gap-3 mb-3 text-[11px] tracking-[0.3em] text-muted uppercase">
                <span className="inline-block w-2 h-2 bg-accent animate-pulse shadow-glow" />
                <span>LAYERZERO::V2 ENDPOINT</span>
                <span className="text-dim">//</span>
                <span>1-OF-1 DVN SCANNER</span>
              </div>
              <h1 className="font-display text-[clamp(2.4rem,6vw,4.5rem)] leading-[0.9] tracking-tight text-fg">
                lz.oft
                <span className="text-accent">//</span>
                scan
              </h1>
              <p className="mt-4 text-muted text-sm md:text-base max-w-xl">
                <span className="text-accent">&gt;</span> monitoring{" "}
                <span className="text-fg">{totalOfts}</span> OFT deployments across{" "}
                <span className="text-fg">{scannedChains}</span> chains — DVN config,
                pause state, cross-chain price spread
                <span className="cursor-blink" />
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.25, duration: 0.3 }}
              className="flex items-stretch gap-2"
            >
              <button
                onClick={onRefresh}
                disabled={refreshing}
                className="group relative px-5 py-3 border border-accent/60 bg-panel/60 text-accent uppercase text-xs tracking-[0.28em] hover:bg-accent hover:text-bg transition-colors disabled:opacity-50 disabled:cursor-wait"
              >
                <span className="relative z-10 flex items-center gap-2">
                  <span
                    className={`inline-block w-1.5 h-1.5 ${
                      refreshing
                        ? "bg-accent animate-pulse"
                        : "bg-accent group-hover:bg-bg"
                    }`}
                  />
                  {refreshing ? "scanning…" : "re_scan"}
                </span>
              </button>
            </motion.div>
          </div>

          {/* decorative corners */}
          <span
            aria-hidden
            className="pointer-events-none absolute left-0 top-0 h-3 w-3 border-l border-t border-accent/60"
          />
          <span
            aria-hidden
            className="pointer-events-none absolute right-0 top-0 h-3 w-3 border-r border-t border-accent/60"
          />
          <span
            aria-hidden
            className="pointer-events-none absolute left-0 bottom-0 h-3 w-3 border-l border-b border-accent/40"
          />
          <span
            aria-hidden
            className="pointer-events-none absolute right-0 bottom-0 h-3 w-3 border-r border-b border-accent/40"
          />
        </div>
      </div>
    </header>
  );
}
