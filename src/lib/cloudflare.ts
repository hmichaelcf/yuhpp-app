import "server-only";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { SetupCheck } from "./config";

/** The storage bindings declared in wrangler.json (DB, SESSIONS). */
export async function bindings(): Promise<CloudflareEnv> {
  const { env } = await getCloudflareContext({ async: true });
  return env as CloudflareEnv;
}

/** Storage checks for /app/status and /app/api/health. */
export async function storageChecks(): Promise<SetupCheck[]> {
  let db: SetupCheck;
  let kv: SetupCheck;
  try {
    const env = await bindings();
    try {
      const row = await env.DB.prepare("SELECT COUNT(*) AS n FROM settings").first<{ n: number }>();
      const n = row?.n ?? 0;
      db = n > 0
        ? { label: "Database", ok: true, detail: `Ready (${n} settings)` }
        : { label: "Database", ok: false, detail: "Connected, but the first migration has not run" };
    } catch {
      db = { label: "Database", ok: false, detail: "Not reachable, or migrations have not run" };
    }
    try {
      await env.SESSIONS.get("health:probe");
      kv = { label: "Session store", ok: true, detail: "Ready" };
    } catch {
      kv = { label: "Session store", ok: false, detail: "Not reachable" };
    }
  } catch {
    db = { label: "Database", ok: false, detail: "Storage bindings missing" };
    kv = { label: "Session store", ok: false, detail: "Storage bindings missing" };
  }
  return [db, kv];
}
