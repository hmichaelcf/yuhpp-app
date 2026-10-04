import Masthead from "../components/Masthead";
import PromptUpload from "../components/PromptUpload";
import { requireAdminPage } from "@/lib/admin";
import { bindings } from "@/lib/cloudflare";
import { promptLibrary, recentSyncs } from "@/lib/prompts";

export const dynamic = "force-dynamic";

export const metadata = { title: "Admin | Yuhpp" };

type Setting = { key: string; value: string; description: string };

// Admin-wide totals deliberately read across all members. Member-facing pages
// never do this; they always filter by the signed-in member.
async function usage(db: D1Database) {
  const members = await db.prepare("SELECT COUNT(*) AS n FROM members").first<{ n: number }>();
  const month = await db
    .prepare(
      `SELECT COUNT(*) AS runs, COALESCE(SUM(cost_usd), 0) AS cost
       FROM runs WHERE created_at >= datetime('now', 'start of month')`,
    )
    .first<{ runs: number; cost: number }>();
  // Calls outside prompt runs, such as reading uploaded resume PDFs.
  const other = await db
    .prepare(
      `SELECT COALESCE(SUM(cost_usd), 0) AS cost
       FROM api_usage WHERE created_at >= datetime('now', 'start of month')`,
    )
    .first<{ cost: number }>();
  return {
    members: members?.n ?? 0,
    runs: month?.runs ?? 0,
    cost: (month?.cost ?? 0) + (other?.cost ?? 0),
  };
}

function formatDate(sqlite: string): string {
  const d = new Date(`${sqlite.replace(" ", "T")}Z`);
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Los_Angeles",
  });
}

export default async function AdminPage() {
  await requireAdminPage();
  const { DB } = await bindings();
  const [library, syncs, totals, settings] = await Promise.all([
    promptLibrary(DB),
    recentSyncs(DB),
    usage(DB),
    DB.prepare("SELECT key, value, description FROM settings ORDER BY key").all<Setting>(),
  ]);
  const lastSync = syncs[0];

  return (
    <>
      <Masthead signedIn admin />
      <main className="page">
        <p className="eyebrow">Admin</p>
        <h1 className="title">
          Run the <em>system.</em>
        </h1>
        <p className="lede">
          Sync the prompt library, watch usage and cost, and see the settings the gates run on.
        </p>

        <section className="admin-block">
          <p className="section-label">This month</p>
          <div className="stats">
            <div className="stat">
              <span className="stat-value">{totals.members}</span>
              <span className="stat-label">Members</span>
            </div>
            <div className="stat">
              <span className="stat-value">{totals.runs}</span>
              <span className="stat-label">Prompt runs</span>
            </div>
            <div className="stat">
              <span className="stat-value">${totals.cost.toFixed(2)}</span>
              <span className="stat-label">API cost</span>
            </div>
          </div>
        </section>

        <section className="admin-block">
          <p className="section-label">Prompt library</p>
          <p className="aside">
            {library.length} current prompts.{" "}
            {lastSync
              ? `Last synced ${formatDate(lastSync.synced_at)}: ${lastSync.added} added, ${lastSync.changed} updated, ${lastSync.retired} retired.`
              : "Not synced yet. Upload the sheet to load the library."}
          </p>
          <PromptUpload />

          {library.length > 0 ? (
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Prompt</th>
                  <th>Stage</th>
                  <th>Version</th>
                  <th>Since</th>
                </tr>
              </thead>
              <tbody>
                {library.map((p) => (
                  <tr key={p.key}>
                    <td>{p.name}</td>
                    <td>{p.stage ?? ""}</td>
                    <td>v{p.version}</td>
                    <td>{formatDate(p.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}
        </section>

        <section className="admin-block">
          <p className="section-label">Settings</p>
          <table className="admin-table">
            <thead>
              <tr>
                <th>Setting</th>
                <th>Value</th>
                <th>What it controls</th>
              </tr>
            </thead>
            <tbody>
              {settings.results.map((s) => (
                <tr key={s.key}>
                  <td className="mono">{s.key}</td>
                  <td className="mono">{s.value}</td>
                  <td>{s.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </main>
    </>
  );
}
