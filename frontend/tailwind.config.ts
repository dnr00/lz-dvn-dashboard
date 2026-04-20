import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: "var(--bg)",
        panel: "var(--panel)",
        "panel-2": "var(--panel-2)",
        border: "var(--border)",
        "border-strong": "var(--border-strong)",
        fg: "var(--fg)",
        muted: "var(--muted)",
        dim: "var(--dim)",
        vuln: "var(--vuln)",
        safe: "var(--safe)",
        warn: "var(--warn)",
        info: "var(--info)",
        accent: "var(--accent)",
      },
      fontFamily: {
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
        display: ["var(--font-display)", "ui-monospace", "monospace"],
      },
      fontSize: {
        "2xs": ["0.625rem", { lineHeight: "1" }],
      },
      boxShadow: {
        glow: "0 0 12px var(--accent)",
        "glow-vuln": "0 0 14px rgba(255,59,92,0.55)",
        "glow-safe": "0 0 14px rgba(61,255,168,0.45)",
        brutal: "4px 4px 0 var(--border-strong)",
      },
      animation: {
        blink: "blink 1.2s steps(2, end) infinite",
        pulse: "glowPulse 2.4s ease-in-out infinite",
        scan: "scan 5s linear infinite",
        reveal: "reveal 0.5s ease-out both",
      },
      keyframes: {
        blink: {
          "0%, 60%": { opacity: "1" },
          "61%, 100%": { opacity: "0" },
        },
        glowPulse: {
          "0%, 100%": { opacity: "1", filter: "brightness(1)" },
          "50%": { opacity: "0.8", filter: "brightness(1.2)" },
        },
        scan: {
          "0%": { transform: "translateY(-100%)" },
          "100%": { transform: "translateY(100vh)" },
        },
        reveal: {
          from: { opacity: "0", transform: "translateY(6px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
