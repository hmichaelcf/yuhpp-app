import "server-only";

// Prompt runs. Every function that reads or changes a run takes the member id
// from a verified session and filters by it, so one member can never see or
// touch another member's runs.

export type RunRow = {
  id: string;
  prompt_id: number;
  status: string;
  model: string;
  turns: number;
  cost_usd: number;
  created_at: string;
  prompt_key: string;
  prompt_name: string;
  prompt_description: string;
};

export type MessageRow = { id: number; role: "user" | "assistant"; content: string };

function newRunId(): string {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return `run_${Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")}`;
}

/** Runs this member has used this calendar month (runs with at least one turn). */
export async function runsUsedThisMonth(db: D1Database, memberId: string): Promise<number> {
  const row = await db
    .prepare(
      `SELECT COUNT(*) AS n FROM runs
       WHERE member_id = ?1 AND turns > 0 AND created_at >= datetime('now', 'start of month')`,
    )
    .bind(memberId)
    .first<{ n: number }>();
  return row?.n ?? 0;
}

/** The current version of a prompt by key, without its body. */
export async function currentPrompt(db: D1Database, key: string) {
  return db
    .prepare("SELECT id, key, name, description FROM prompts WHERE key = ?1 AND is_current = 1")
    .bind(key)
    .first<{ id: number; key: string; name: string; description: string }>();
}

export async function createRun(
  db: D1Database,
  memberId: string,
  promptId: number,
  model: string,
): Promise<string> {
  const id = newRunId();
  await db
    .prepare("INSERT INTO runs (id, member_id, prompt_id, model) VALUES (?1, ?2, ?3, ?4)")
    .bind(id, memberId, promptId, model)
    .run();
  return id;
}

export async function getRun(db: D1Database, runId: string, memberId: string): Promise<RunRow | null> {
  return db
    .prepare(
      `SELECT r.id, r.prompt_id, r.status, r.model, r.turns, r.cost_usd, r.created_at,
              p.key AS prompt_key, p.name AS prompt_name, p.description AS prompt_description
       FROM runs r JOIN prompts p ON p.id = r.prompt_id
       WHERE r.id = ?1 AND r.member_id = ?2`,
    )
    .bind(runId, memberId)
    .first<RunRow>();
}

export async function recentRuns(db: D1Database, memberId: string, limit = 8): Promise<RunRow[]> {
  return (
    await db
      .prepare(
        `SELECT r.id, r.prompt_id, r.status, r.model, r.turns, r.cost_usd, r.created_at,
                p.key AS prompt_key, p.name AS prompt_name, p.description AS prompt_description
         FROM runs r JOIN prompts p ON p.id = r.prompt_id
         WHERE r.member_id = ?1 AND r.turns > 0
         ORDER BY r.updated_at DESC LIMIT ?2`,
      )
      .bind(memberId, limit)
      .all<RunRow>()
  ).results;
}

/** Messages of a run the caller has already confirmed belongs to the member. */
export async function runMessages(db: D1Database, runId: string): Promise<MessageRow[]> {
  return (
    await db
      .prepare("SELECT id, role, content FROM messages WHERE run_id = ?1 ORDER BY id")
      .bind(runId)
      .all<MessageRow>()
  ).results;
}

/** The prompt body for a run. Server use only: never return this to a page. */
export async function promptBodyForRun(db: D1Database, promptId: number): Promise<string | null> {
  const row = await db
    .prepare("SELECT body FROM prompts WHERE id = ?1")
    .bind(promptId)
    .first<{ body: string }>();
  return row?.body ?? null;
}

export async function addMessage(
  db: D1Database,
  runId: string,
  role: "user" | "assistant",
  content: string,
): Promise<number> {
  const res = await db
    .prepare("INSERT INTO messages (run_id, role, content) VALUES (?1, ?2, ?3)")
    .bind(runId, role, content)
    .run();
  return Number(res.meta.last_row_id);
}

export async function deleteMessage(db: D1Database, messageId: number): Promise<void> {
  await db.prepare("DELETE FROM messages WHERE id = ?1").bind(messageId).run();
}

export async function recordTurn(
  db: D1Database,
  runId: string,
  t: { input: number; output: number; cacheWrite: number; cacheRead: number; searches: number; cost: number },
): Promise<void> {
  await db
    .prepare(
      `UPDATE runs SET
         turns = turns + 1,
         input_tokens = input_tokens + ?2,
         output_tokens = output_tokens + ?3,
         cache_write_tokens = cache_write_tokens + ?4,
         cache_read_tokens = cache_read_tokens + ?5,
         web_searches = web_searches + ?6,
         cost_usd = cost_usd + ?7,
         updated_at = datetime('now')
       WHERE id = ?1`,
    )
    .bind(runId, t.input, t.output, t.cacheWrite, t.cacheRead, t.searches, t.cost)
    .run();
}

export async function closeRun(db: D1Database, runId: string, memberId: string): Promise<boolean> {
  const res = await db
    .prepare(
      `UPDATE runs SET status = 'closed', updated_at = datetime('now')
       WHERE id = ?1 AND member_id = ?2 AND status = 'open'`,
    )
    .bind(runId, memberId)
    .run();
  return res.meta.changes > 0;
}

/** Current prompts for the picker: names and descriptions only. */
export async function promptCatalog(db: D1Database) {
  return (
    await db
      .prepare(
        `SELECT key, name, description, stage FROM prompts
         WHERE is_current = 1 ORDER BY name`,
      )
      .all<{ key: string; name: string; description: string; stage: string | null }>()
  ).results;
}
