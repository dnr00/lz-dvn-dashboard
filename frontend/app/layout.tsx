import type { Metadata } from "next";
import { JetBrains_Mono, Major_Mono_Display } from "next/font/google";
import "./globals.css";

const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
  weight: ["300", "400", "500", "600", "700", "800"],
});

const display = Major_Mono_Display({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
  weight: "400",
});

export const metadata: Metadata = {
  title: "LZ.OFT//SCAN — LayerZero DVN dashboard",
  description:
    "Monitor LayerZero OFT deployments: 1-of-1 DVN vulnerabilities, pause state, and cross-chain price spread.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${mono.variable} ${display.variable}`}>
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
