import type { ScanResponse } from "./types";

export async function fetchScan(force = false): Promise<ScanResponse> {
  const url = `/api/scan${force ? "?force=true" : ""}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`scan request failed ${res.status}: ${text}`);
  }
  return (await res.json()) as ScanResponse;
}
