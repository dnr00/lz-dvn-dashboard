"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { fetchScan } from "@/lib/api";
import type { ChainHealth, OftRow, ScanResponse } from "@/lib/types";
import { sortRows, type SortDir, type SortKey } from "@/lib/sort";
import { Header } from "./Header";
import { StatusBar } from "./StatusBar";
import { FilterBar, type ViewMode } from "./FilterBar";
import { Legend } from "./Legend";
import { OftTable } from "./OftTable";
import { DetailPanel } from "./DetailPanel";
import { EmptyState } from "./EmptyState";

function filterRows(
  rows: OftRow[],
  mode: ViewMode,
  selectedChains: Set<string>,
  query: string,
): OftRow[] {
  const q = query.trim().toLowerCase();
  return rows.filter((row) => {
    if (mode === "vulnerable" && row.vulnerable_count === 0) return false;
    if (mode === "paused" && row.paused_count === 0) return false;
    if (mode === "arbitrage" && !row.arbitrage) return false;
    if (selectedChains.size > 0) {
      const hit = row.deployments.some((d) => selectedChains.has(d.chain));
      if (!hit) return false;
    }
    if (q) {
      const hit =
        row.symbol.toLowerCase().includes(q) ||
        (row.name ?? "").toLowerCase().includes(q) ||
        row.deployments.some(
          (d) =>
            (d.adapter && d.adapter.toLowerCase().includes(q)) ||
            (d.token && d.token.toLowerCase().includes(q)) ||
            (d.dvn && d.dvn.toLowerCase().includes(q)) ||
            (d.dvn_label && d.dvn_label.toLowerCase().includes(q)),
        );
      if (!hit) return false;
    }
    return true;
  });
}

export function Dashboard({ initialData }: { initialData: ScanResponse }) {
  const [data, setData] = useState<ScanResponse>(initialData);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [mode, setModeRaw] = useState<ViewMode>("vulnerable");
  const [selectedChains, setSelectedChains] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("vulnerable_count");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [active, setActive] = useState<OftRow | null>(null);

  const setMode = useCallback((m: ViewMode) => {
    setModeRaw(m);
    if (m === "arbitrage") {
      setSortKey("price_spread_pct");
      setSortDir("desc");
    } else if (m === "paused") {
      setSortKey("paused_count");
      setSortDir("desc");
    } else if (m === "vulnerable") {
      setSortKey("vulnerable_count");
      setSortDir("desc");
    }
  }, []);

  const toggleChain = useCallback((c: string) => {
    setSelectedChains((prev) => {
      const next = new Set(prev);
      if (next.has(c)) next.delete(c);
      else next.add(c);
      return next;
    });
  }, []);

  const clearChains = useCallback(() => setSelectedChains(new Set()), []);

  const refresh = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const next = await fetchScan(true);
      setData(next);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "scan failed");
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSort = useCallback(
    (key: SortKey) => {
      if (sortKey === key) {
        setSortDir((d) => (d === "asc" ? "desc" : "asc"));
      } else {
        setSortKey(key);
        setSortDir(key === "symbol" ? "asc" : "desc");
      }
    },
    [sortKey],
  );

  const counts = useMemo(() => {
    const all = data.rows.length;
    const vulnerable = data.rows.filter((r) => r.vulnerable_count > 0).length;
    const paused = data.rows.filter((r) => r.paused_count > 0).length;
    const arbitrage = data.rows.filter((r) => r.arbitrage).length;
    return { all, vulnerable, paused, arbitrage } as Record<ViewMode, number>;
  }, [data.rows]);

  const visible = useMemo(() => {
    const filtered = filterRows(data.rows, mode, selectedChains, query);
    return sortRows(filtered, sortKey, sortDir);
  }, [data.rows, mode, selectedChains, query, sortKey, sortDir]);

  const chains = useMemo(
    () =>
      data.meta.chains_health.map((c: ChainHealth) => ({
        chain: c.chain,
        chain_display: c.chain_display,
      })),
    [data.meta.chains_health],
  );

  useEffect(() => {
    if (!active) return;
    const fresh = data.rows.find((r) => r.symbol === active.symbol);
    if (fresh) setActive(fresh);
  }, [data.rows, active]);

  return (
    <div className="min-h-screen flex flex-col">
      <Header
        totalOfts={data.meta.total_deployments}
        scannedChains={data.meta.scanned_chains}
        onRefresh={refresh}
        refreshing={loading}
      />
      <StatusBar
        meta={data.meta}
        vulnerableCount={counts.vulnerable}
        pausedCount={counts.paused}
        arbitrageCount={counts.arbitrage}
      />
      <FilterBar
        mode={mode}
        setMode={setMode}
        counts={counts}
        chains={chains}
        selectedChains={selectedChains}
        toggleChain={toggleChain}
        clearChains={clearChains}
        query={query}
        setQuery={setQuery}
      />
      <Legend />

      <main className="flex-1 mx-auto max-w-[1440px] w-full px-6 md:px-10 py-8">
        <AnimatePresence>
          {err && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mb-4 border border-vuln bg-vuln/10 text-vuln px-4 py-3 text-xs uppercase tracking-[0.22em]"
            >
              &gt; scan error: {err}
            </motion.div>
          )}
        </AnimatePresence>

        {visible.length === 0 && !loading ? (
          <EmptyState
            title="empty result set"
            hint={
              mode === "vulnerable"
                ? "no 1-of-1 DVN OFTs match the current filters. try toggling view → all."
                : "no rows match. clear filters or search."
            }
          />
        ) : (
          <OftTable
            rows={visible}
            sortKey={sortKey}
            sortDir={sortDir}
            onSort={handleSort}
            onOpen={setActive}
            activeSymbol={active?.symbol}
          />
        )}

        <footer className="mt-10 text-[10px] uppercase tracking-[0.3em] text-dim flex flex-wrap gap-6">
          <span>registry: layerzero-api.com/metadata/experiment/ofts/list</span>
          <span>prices: dexscreener</span>
          <span>scanner: multicall3 · tryAggregate</span>
          <span>ui: lz.oft//scan v0.1.0</span>
        </footer>
      </main>

      <DetailPanel row={active} onClose={() => setActive(null)} />
    </div>
  );
}
