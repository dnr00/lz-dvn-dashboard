"use client";

import { useState } from "react";

export function CopyBtn({ text, label }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={async (e) => {
        e.stopPropagation();
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1400);
        } catch {
          // ignore
        }
      }}
      className="text-[10px] uppercase tracking-[0.2em] text-muted hover:text-accent transition-colors border border-border px-1.5 py-0.5"
      title={text}
    >
      {copied ? "copied" : label ?? "copy"}
    </button>
  );
}
