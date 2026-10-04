import { NextResponse } from "next/server";
import { setupChecks } from "@/lib/config";

// Read env at request time, not at build time, so a newly added secret
// shows up after the next deploy without a stale cached answer.
export const dynamic = "force-dynamic";

/**
 * GET /app/api/health
 *
 * Reports whether the app is deployed and its secrets are wired up.
 * Returns only set or missing for each secret, never a value.
 */
export function GET() {
  const checks = setupChecks();
  const ready = checks.every((c) => c.ok);
  return NextResponse.json(
    {
      status: ready ? "ready" : "waiting_for_secrets",
      phase: 0,
      checks: checks.map(({ label, ok }) => ({ label, ok })),
      timestamp: new Date().toISOString(),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
