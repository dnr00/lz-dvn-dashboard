"use client";

export function SpreadBar({
  pct,
  max = 2,
}: {
  pct: number | null | undefined;
  max?: number;
}) {
  if (pct == null) return <span className="text-dim">—</span>;
  const width = Math.min(100, (Math.abs(pct) / max) * 100);
  const tone = pct >= 1 ? "text-accent" : pct >= 0.3 ? "text-info" : "text-muted";
  return (
    <div className="flex flex-col gap-1">
      <span className={`${tone} text-xs tabular-nums`}>{pct.toFixed(2)}%</span>
      <div className={`spark-bar ${tone}`}>
        <span style={{ width: `${width}%` }} />
      </div>
    </div>
  );
}
