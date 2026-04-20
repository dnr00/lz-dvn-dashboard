"use client";

const ITEMS: { cls: string; label: string; note?: string }[] = [
  { cls: "bg-vuln text-bg", label: "vuln", note: "1-of-1 DVN (non-stub)" },
  { cls: "bg-safe text-bg", label: "safe", note: "multi-DVN or default lib" },
  {
    cls: "bg-warn text-bg ring-2 ring-warn",
    label: "paused",
    note: "adapter or token paused()",
  },
  { cls: "bg-dim text-fg", label: "unknown", note: "getConfig failed" },
  {
    cls: "bg-border-strong text-muted",
    label: "unreachable",
    note: "RPC error",
  },
];

export function Legend() {
  return (
    <div className="border-b border-border bg-panel/40">
      <div className="mx-auto max-w-[1440px] px-6 md:px-10 py-2 flex flex-wrap items-center gap-x-5 gap-y-2">
        <span className="text-dim text-[10px] uppercase tracking-[0.25em]">
          legend
        </span>
        {ITEMS.map((it) => (
          <div
            key={it.label}
            className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.18em] text-muted"
            title={it.note}
          >
            <span
              className={`${it.cls} px-1.5 py-0.5 leading-none text-[9px] font-semibold tracking-[0.14em]`}
            >
              {it.label}
            </span>
            {it.note && <span className="text-dim normal-case tracking-normal lowercase">{it.note}</span>}
          </div>
        ))}
      </div>
    </div>
  );
}
