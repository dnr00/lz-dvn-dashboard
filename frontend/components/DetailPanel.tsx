"use client";

import { AnimatePresence, motion } from "framer-motion";
import type { ChainDeployment, OftRow } from "@/lib/types";
import { fmtAddress, fmtChainCode, fmtPct, fmtUsd } from "@/lib/format";
import { StatusPill } from "./StatusPill";
import { CopyBtn } from "./CopyBtn";

interface Props {
  row: OftRow | null;
  onClose: () => void;
}

function explorerUrl(chainId: number, addr: string): string {
  const bases: Record<number, string> = {
    1: "https://etherscan.io",
    42161: "https://arbiscan.io",
    8453: "https://basescan.org",
    10: "https://optimistic.etherscan.io",
    56: "https://bscscan.com",
    137: "https://polygonscan.com",
    43114: "https://snowtrace.io",
    534352: "https://scrollscan.com",
    59144: "https://lineascan.build",
    130: "https://uniscan.xyz",
    5000: "https://explorer.mantle.xyz",
    9745: "https://plasmascan.to",
  };
  const base = bases[chainId] ?? "https://etherscan.io";
  return `${base}/address/${addr}`;
}

function DeploymentCard({ d }: { d: ChainDeployment }) {
  return (
    <div
      className={`border p-4 ${
        d.status === "vulnerable"
          ? "border-vuln/40 bg-vuln/5"
          : d.status === "paused"
            ? "border-warn/40 bg-warn/5"
            : "border-border bg-panel-2/60"
      }`}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-[10px] uppercase tracking-[0.22em] text-dim">
            {fmtChainCode(d.chain)}
          </span>
          <span className="text-fg text-sm">{d.chain_display}</span>
        </div>
        <StatusPill status={d.status} />
      </div>

      <div className="grid grid-cols-2 gap-3 text-[11px]">
        <Field label="adapter">
          <div className="flex items-center gap-1.5">
            <a
              href={explorerUrl(d.chain_id, d.adapter)}
              target="_blank"
              rel="noreferrer"
              className="text-fg link-dash font-mono"
            >
              {fmtAddress(d.adapter, 6)}
            </a>
            <CopyBtn text={d.adapter} />
          </div>
        </Field>
        <Field label="type">
          <span
            className={`uppercase tracking-wider ${
              d.adapter_type === "native" ? "text-warn" : "text-info"
            }`}
          >
            {d.adapter_type}
          </span>
        </Field>

        <Field label="token">
          {d.token ? (
            <div className="flex items-center gap-1.5">
              <a
                href={explorerUrl(d.chain_id, d.token)}
                target="_blank"
                rel="noreferrer"
                className="text-fg link-dash"
              >
                {fmtAddress(d.token, 6)}
              </a>
              <CopyBtn text={d.token} />
            </div>
          ) : (
            <span className="text-dim">—</span>
          )}
        </Field>
        <Field label="confirms">
          <span className="tabular-nums">
            {d.confirmations ?? <span className="text-dim">—</span>}
          </span>
        </Field>

        <Field label="dvn">
          {d.dvn ? (
            <div className="flex items-center gap-1.5">
              <span className="text-fg">{fmtAddress(d.dvn, 5)}</span>
              {d.dvn_label && (
                <span className="text-muted text-[9px] uppercase tracking-wider border border-border px-1 py-0.5">
                  {d.dvn_label}
                </span>
              )}
              <CopyBtn text={d.dvn} />
            </div>
          ) : (
            <span className="text-dim">—</span>
          )}
        </Field>
        <Field label="paused">
          {d.paused ? (
            <span className="text-warn">{d.paused_method ?? "true"}</span>
          ) : (
            <span className="text-dim">false</span>
          )}
        </Field>

        <Field label="price">
          <span className="text-fg tabular-nums">
            {d.price_usd != null ? fmtUsd(d.price_usd, false) : <span className="text-dim">—</span>}
          </span>
        </Field>
        <Field label="liquidity">
          <span className="tabular-nums">
            {d.liquidity_usd != null ? (
              fmtUsd(d.liquidity_usd)
            ) : (
              <span className="text-dim">—</span>
            )}
          </span>
        </Field>

        <Field label="balance">
          <span className="tabular-nums">
            {d.balance_human != null ? (
              d.balance_human.toLocaleString(undefined, { maximumFractionDigits: 4 })
            ) : (
              <span className="text-dim">—</span>
            )}
          </span>
        </Field>
        <Field label="tvl">
          <span className="tabular-nums text-accent">
            {d.tvl_usd != null ? (
              fmtUsd(d.tvl_usd)
            ) : (
              <span className="text-dim">—</span>
            )}
          </span>
        </Field>
      </div>

      {d.dex_pair_url && (
        <div className="mt-3 pt-3 border-t border-border/60 text-[10px] uppercase tracking-[0.22em]">
          <a
            href={d.dex_pair_url}
            target="_blank"
            rel="noreferrer"
            className="text-muted hover:text-accent transition-colors link-dash"
          >
            dexscreener ↗
          </a>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-dim text-[9px] uppercase tracking-[0.25em]">
        {label}
      </span>
      <span className="text-fg">{children}</span>
    </div>
  );
}

export function DetailPanel({ row, onClose }: Props) {
  return (
    <AnimatePresence>
      {row && (
        <>
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-bg/70 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.aside
            key="panel"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "tween", duration: 0.3, ease: [0.2, 0.9, 0.1, 1] }}
            className="fixed right-0 top-0 bottom-0 z-50 w-full sm:w-[560px] lg:w-[640px] bg-panel border-l border-accent/40 shadow-[ -12px_0_60px_rgba(0,0,0,0.6)] overflow-y-auto noise"
          >
            <div className="sticky top-0 z-10 bg-panel/95 backdrop-blur border-b border-border px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="bracket-label text-accent text-[11px] uppercase tracking-[0.25em]">
                  oft
                </span>
                <h2 className="font-display text-2xl">{row.symbol}</h2>
                {row.name && (
                  <span className="text-muted text-xs uppercase tracking-wider">
                    {row.name}
                  </span>
                )}
              </div>
              <button
                onClick={onClose}
                className="text-muted hover:text-accent text-lg px-2"
                aria-label="close"
              >
                ×
              </button>
            </div>

            <div className="px-6 py-5 space-y-5">
              <div className="grid grid-cols-4 gap-2">
                <Summary label="chains" value={row.chain_count} />
                <Summary
                  label="vuln"
                  value={row.vulnerable_count}
                  tone={row.vulnerable_count > 0 ? "text-vuln" : "text-muted"}
                />
                <Summary
                  label="paused"
                  value={row.paused_count}
                  tone={row.paused_count > 0 ? "text-warn" : "text-muted"}
                />
                <Summary
                  label="tvl"
                  value={row.total_tvl_usd != null ? fmtUsd(row.total_tvl_usd) : "—"}
                  tone="text-accent"
                />
              </div>

              {row.arbitrage && (
                <div className="border border-accent/40 bg-accent/5 p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="bracket-label text-accent text-[10px] uppercase tracking-[0.25em]">
                      arbitrage
                    </span>
                    <span className="text-accent font-display text-xl tabular-nums">
                      {fmtPct(row.arbitrage.spread_pct)}
                    </span>
                  </div>
                  <div className="text-xs text-muted">
                    buy on{" "}
                    <span className="text-fg uppercase">
                      {row.arbitrage.cheap_chain}
                    </span>{" "}
                    @ {fmtUsd(row.arbitrage.cheap_price, false)} → sell on{" "}
                    <span className="text-fg uppercase">
                      {row.arbitrage.expensive_chain}
                    </span>{" "}
                    @ {fmtUsd(row.arbitrage.expensive_price, false)}
                  </div>
                  <div className="mt-2 text-[10px] uppercase tracking-[0.25em] text-dim">
                    min_liq: {fmtUsd(row.arbitrage.min_liquidity_usd)}
                  </div>
                </div>
              )}

              <div className="space-y-3">
                <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.25em] text-muted">
                  <span className="bracket-label text-muted">deployments</span>
                  <span className="text-dim">{row.deployments.length}</span>
                </div>
                <div className="grid grid-cols-1 gap-3">
                  {row.deployments.map((d) => (
                    <DeploymentCard key={d.chain} d={d} />
                  ))}
                </div>
              </div>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

function Summary({
  label,
  value,
  tone,
}: {
  label: string;
  value: React.ReactNode;
  tone?: string;
}) {
  return (
    <div className="border border-border bg-panel-2 p-3">
      <div className="text-[9px] uppercase tracking-[0.25em] text-dim">{label}</div>
      <div className={`mt-1 font-display text-xl ${tone ?? "text-fg"}`}>{value}</div>
    </div>
  );
}
