import { Dashboard } from "@/components/Dashboard";
import type { ScanResponse } from "@/lib/types";

async function loadInitial(): Promise<ScanResponse> {
  const base = process.env.BACKEND_URL ?? "http://127.0.0.1:8000";
  const res = await fetch(`${base}/api/scan`, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`scan failed ${res.status}`);
  }
  return (await res.json()) as ScanResponse;
}

export default async function Page() {
  let data: ScanResponse;
  try {
    data = await loadInitial();
  } catch (err) {
    return (
      <main className="min-h-screen flex items-center justify-center p-10">
        <div className="max-w-xl border border-vuln bg-vuln/10 p-8">
          <div className="text-vuln text-[10px] uppercase tracking-[0.3em] mb-3">
            scan bootstrap failed
          </div>
          <div className="text-fg text-sm">
            backend is unreachable. verify that the FastAPI server is running at{" "}
            <code className="text-accent">
              {process.env.BACKEND_URL ?? "http://127.0.0.1:8000"}
            </code>
            .
          </div>
          <pre className="mt-4 text-xs text-muted overflow-x-auto whitespace-pre-wrap">
            {err instanceof Error ? err.message : String(err)}
          </pre>
          <div className="mt-5 text-[10px] uppercase tracking-[0.3em] text-dim">
            hint: <span className="text-fg">./dashboard/backend/run.sh</span>
          </div>
        </div>
      </main>
    );
  }
  return <Dashboard initialData={data} />;
}
