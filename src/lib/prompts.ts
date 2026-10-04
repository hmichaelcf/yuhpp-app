import "server-only";
import { parseCsv } from "./csv";

// The prompt library: reads the yuhpp_prompts sheet export and keeps the
// prompts table in step with it. Prompt bodies stay on the server; nothing
// in this file returns a body to a page or an API response.

export type SheetPrompt = {
  key: string;
  name: string;
  description: string;
  body: string;
  stage: string | null;
  category: string | null;
};

export type SyncResult = {
  rowsRead: number;
  added: string[];
  changed: string[];
  unchanged: number;
  retired: string[];
};

export type LibraryRow = {
  key: string;
  name: string;
  version: number;
  stage: string | null;
  created_at: string;
};

const MIN_PROMPTS = 20; // the library has 37; fewer than this means a wrong file

/** "Interview Q&A Prepper" becomes "interview-q-a-prepper". */
export function promptKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function clean(value: string | undefined): string {
  return (value ?? "").replace(/\r\n?/g, "\n").trim();
}

/**
 * Reads the CSV export of the yuhpp_prompts sheet. Columns are found by their
 * header (Name, Description, Instructions, Stage, Category), so reordering the
 * sheet's columns is safe. Returns the prompts, or the problems that stop a sync.
 */
export function readSheet(csvText: string): { prompts: SheetPrompt[]; problems: string[] } {
  let rows: string[][];
  try {
    rows = parseCsv(csvText);
  } catch (e) {
    return { prompts: [], problems: [(e as Error).message] };
  }
  if (rows.length === 0) {
    return { prompts: [], problems: ["The file is empty."] };
  }

  const header = rows[0].map((h) => clean(h).toLowerCase());
  const col = (prefix: string) => header.findIndex((h) => h.startsWith(prefix));
  const nameCol = col("name");
  const descCol = col("description");
  const bodyCol = col("instructions");
  const stageCol = col("stage");
  const categoryCol = col("category");

  const missing = [
    nameCol < 0 ? "Name" : null,
    descCol < 0 ? "Description" : null,
    bodyCol < 0 ? "Instructions" : null,
  ].filter(Boolean);
  if (missing.length > 0) {
    return {
      prompts: [],
      problems: [
        `This does not look like the yuhpp_prompts sheet: no ${missing.join(", ")} column.`,
      ],
    };
  }

  const problems: string[] = [];
  const prompts: SheetPrompt[] = [];
  const seen = new Set<string>();

  for (const row of rows.slice(1)) {
    const name = clean(row[nameCol]);
    if (!name) continue;
    const key = promptKey(name);
    const body = clean(row[bodyCol]);
    if (!body) {
      problems.push(`"${name}" has no instructions.`);
      continue;
    }
    if (seen.has(key)) {
      problems.push(`"${name}" appears more than once.`);
      continue;
    }
    seen.add(key);
    prompts.push({
      key,
      name,
      description: clean(row[descCol]),
      body,
      stage: stageCol >= 0 ? clean(row[stageCol]) || null : null,
      category: categoryCol >= 0 ? clean(row[categoryCol]) || null : null,
    });
  }

  if (prompts.length < MIN_PROMPTS) {
    problems.push(
      `Only ${prompts.length} prompts found. The full library has 37, so this looks like the wrong file or a partial export.`,
    );
  }
  return { prompts, problems };
}

async function hashPrompt(p: SheetPrompt): Promise<string> {
  const data = new TextEncoder().encode(
    JSON.stringify([p.name, p.description, p.body, p.stage, p.category]),
  );
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Brings the prompts table in line with the sheet, in one transaction:
 * new prompts get version 1, edited prompts get a new version, prompts no
 * longer in the sheet are retired. Old versions are kept, so every run can
 * still point at the exact text it used.
 */
export async function syncPrompts(
  db: D1Database,
  prompts: SheetPrompt[],
  syncedBy: string,
): Promise<SyncResult> {
  const current = (
    await db
      .prepare("SELECT id, key, name, body_hash FROM prompts WHERE is_current = 1")
      .all<{ id: number; key: string; name: string; body_hash: string }>()
  ).results;
  const maxVersions = (
    await db
      .prepare("SELECT key, MAX(version) AS v FROM prompts GROUP BY key")
      .all<{ key: string; v: number }>()
  ).results;

  const currentByKey = new Map(current.map((r) => [r.key, r]));
  const maxVersion = new Map(maxVersions.map((r) => [r.key, r.v]));
  const uploaded = new Set(prompts.map((p) => p.key));

  const result: SyncResult = {
    rowsRead: prompts.length,
    added: [],
    changed: [],
    unchanged: 0,
    retired: [],
  };
  const inserts: { prompt: SheetPrompt; hash: string; version: number; replaces?: number }[] = [];

  for (const p of prompts) {
    const hash = await hashPrompt(p);
    const existing = currentByKey.get(p.key);
    const nextVersion = (maxVersion.get(p.key) ?? 0) + 1;
    if (!existing) {
      result.added.push(p.name);
      inserts.push({ prompt: p, hash, version: nextVersion });
    } else if (existing.body_hash !== hash) {
      result.changed.push(p.name);
      inserts.push({ prompt: p, hash, version: nextVersion, replaces: existing.id });
    } else {
      result.unchanged++;
    }
  }
  const retiredRows = current.filter((r) => !uploaded.has(r.key));
  result.retired = retiredRows.map((r) => r.name);

  const statements: D1PreparedStatement[] = [
    db
      .prepare(
        `INSERT INTO prompt_syncs (synced_by, rows_read, added, changed, unchanged, retired)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)`,
      )
      .bind(
        syncedBy,
        result.rowsRead,
        result.added.length,
        result.changed.length,
        result.unchanged,
        result.retired.length,
      ),
  ];
  for (const r of retiredRows) {
    statements.push(db.prepare("UPDATE prompts SET is_current = 0 WHERE id = ?1").bind(r.id));
  }
  for (const ins of inserts) {
    if (ins.replaces) {
      statements.push(
        db.prepare("UPDATE prompts SET is_current = 0 WHERE id = ?1").bind(ins.replaces),
      );
    }
    statements.push(
      db
        .prepare(
          `INSERT INTO prompts (key, version, name, description, body, body_hash, stage, category, is_current, sync_id)
           VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, 1, (SELECT MAX(id) FROM prompt_syncs))`,
        )
        .bind(
          ins.prompt.key,
          ins.version,
          ins.prompt.name,
          ins.prompt.description,
          ins.prompt.body,
          ins.hash,
          ins.prompt.stage,
          ins.prompt.category,
        ),
    );
  }

  await db.batch(statements);
  return result;
}

/** The current library, without prompt bodies. */
export async function promptLibrary(db: D1Database): Promise<LibraryRow[]> {
  return (
    await db
      .prepare(
        `SELECT key, name, version, stage, created_at FROM prompts
         WHERE is_current = 1 ORDER BY name`,
      )
      .all<LibraryRow>()
  ).results;
}

export type SyncLogRow = {
  id: number;
  synced_at: string;
  rows_read: number;
  added: number;
  changed: number;
  unchanged: number;
  retired: number;
};

export async function recentSyncs(db: D1Database, limit = 5): Promise<SyncLogRow[]> {
  return (
    await db
      .prepare(
        `SELECT id, synced_at, rows_read, added, changed, unchanged, retired
         FROM prompt_syncs ORDER BY id DESC LIMIT ?1`,
      )
      .bind(limit)
      .all<SyncLogRow>()
  ).results;
}
