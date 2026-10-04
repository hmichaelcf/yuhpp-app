import { NextResponse } from "next/server";
import { setupChecks } from "@/lib/config";
import { storageChecks } from "@/lib/cloudflare";

// Read env and storage at request time, not at build time.
export const dynamic = "force-dynamic";

/**
 * GET /app/api/health
 *
 * Reports whether the app is deployed, configured, and has its storage.
 * Returns only ok or not ok for each check, never a secret value.
 */
export async function GET() {
  const checks = [...setupChecks(), ...(await storageChecks())];
  const ready = checks.every((c) => c.ok);
  return NextResponse.json(
    {
      status: ready ? "ready" : "not_ready",
      phase: 1,
      checks: checks.map(({ label, ok }) => ({ label, ok })),
      timestamp: new Date().toISOString(),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
