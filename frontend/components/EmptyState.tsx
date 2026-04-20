"use client";

export function EmptyState({
  title,
  hint,
  tone = "muted",
}: {
  title: string;
  hint?: string;
  tone?: "muted" | "vuln" | "accent";
}) {
  const color =
    tone === "vuln" ? "text-vuln" : tone === "accent" ? "text-accent" : "text-muted";
  return (
    <div className="border border-border bg-panel/40 py-16 text-center">
      <div className={`${color} text-[10px] uppercase tracking-[0.3em]`}>{title}</div>
      {hint && <div className="mt-3 text-muted text-sm">{hint}</div>}
    </div>
  );
}
