import "server-only";

// The member's workspace: bullet bank, story bank, and saved searches.
// Every function takes the member id from a verified session and filters by
// it, so one member can never read or change another member's rows.

export const LIMITS = {
  bulletText: 400,
  shortField: 120,
  storyField: 4000,
  searchQuery: 2000,
  bulletsPerSave: 60,
} as const;

/** A problem with what the member sent, worded for the member. */
export class InputProblem extends Error {}

/** Trims a field; empty becomes null. Throws if it is too long. */
export function field(value: unknown, max: number, label: string): string | null {
  if (value == null) return null;
  if (typeof value !== "string") throw new InputProblem(`${label} must be text.`);
  const v = value.replace(/\r\n?/g, "\n").trim();
  if (!v) return null;
  if (v.length > max) throw new InputProblem(`${label} is too long (over ${max.toLocaleString("en-US")} characters).`);
  return v;
}

export function required(value: unknown, max: number, label: string): string {
  const v = field(value, max, label);
  if (!v) throw new InputProblem(`${label} is empty.`);
  return v;
}

/** "ownership, Delivering results ,ownership" becomes "ownership, Delivering results". */
export function cleanTags(value: unknown, label: string): string | null {
  const raw = field(value, LIMITS.shortField * 3, label);
  if (!raw) return null;
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of raw.split(",")) {
    const t = part.trim();
    if (t && !seen.has(t.toLowerCase())) {
      seen.add(t.toLowerCase());
      out.push(t);
    }
  }
  return out.length ? out.join(", ") : null;
}

export function splitTags(tags: string | null): string[] {
  return tags ? tags.split(",").map((t) => t.trim()).filter(Boolean) : [];
}

// ---------- bullets ----------

export type Bullet = {
  id: number;
  text: string;
  role: string | null;
  company: string | null;
  tags: string | null;
  updated_at: string;
};

/**
 * Turns a pasted block into bullets: one per line, with leading bullet marks
 * ("•", "-", "*", "1.") removed.
 */
export function splitBulletLines(text: string): string[] {
  return text
    .split("\n")
    .map((l) => l.replace(/^\s*(?:[•\-*–·▪◦]|\d+[.)])\s*/, "").trim())
    .filter(Boolean);
}

export async function listBullets(db: D1Database, memberId: string): Promise<Bullet[]> {
  return (
    await db
      .prepare(
        `SELECT id, text, role, company, tags, updated_at FROM bullets
         WHERE member_id = ?1 ORDER BY COALESCE(company, ''), COALESCE(role, ''), id`,
      )
      .bind(memberId)
      .all<Bullet>()
  ).results;
}

export async function addBullets(
  db: D1Database,
  memberId: string,
  lines: string[],
  meta: { role: string | null; company: string | null; tags: string | null },
): Promise<number> {
  const insert = db.prepare(
    "INSERT INTO bullets (member_id, text, role, company, tags) VALUES (?1, ?2, ?3, ?4, ?5)",
  );
  await db.batch(lines.map((line) => insert.bind(memberId, line, meta.role, meta.company, meta.tags)));
  return lines.length;
}

export async function updateBullet(
  db: D1Database,
  memberId: string,
  id: number,
  b: { text: string; role: string | null; company: string | null; tags: string | null },
): Promise<boolean> {
  const res = await db
    .prepare(
      `UPDATE bullets SET text = ?3, role = ?4, company = ?5, tags = ?6, updated_at = datetime('now')
       WHERE id = ?1 AND member_id = ?2`,
    )
    .bind(id, memberId, b.text, b.role, b.company, b.tags)
    .run();
  return res.meta.changes > 0;
}

export async function deleteBullet(db: D1Database, memberId: string, id: number): Promise<boolean> {
  const res = await db.prepare("DELETE FROM bullets WHERE id = ?1 AND member_id = ?2").bind(id, memberId).run();
  return res.meta.changes > 0;
}

// ---------- stories ----------

export type Story = {
  id: number;
  title: string;
  themes: string | null;
  situation: string | null;
  task: string | null;
  action: string | null;
  result: string | null;
  updated_at: string;
};

export type StoryInput = Omit<Story, "id" | "updated_at">;

/** Reads a story from an API request body. */
export function readStory(body: Record<string, unknown>): StoryInput {
  return {
    title: required(body.title, LIMITS.shortField, "The story name"),
    themes: cleanTags(body.themes, "The themes"),
    situation: field(body.situation, LIMITS.storyField, "Situation"),
    task: field(body.task, LIMITS.storyField, "Task"),
    action: field(body.action, LIMITS.storyField, "Action"),
    result: field(body.result, LIMITS.storyField, "Result"),
  };
}

/** A story counts as developed once all four STAR parts are filled in. */
export function isDeveloped(s: Pick<Story, "situation" | "task" | "action" | "result">): boolean {
  return !!(s.situation && s.task && s.action && s.result);
}

/** Distinct themes across the stories, in the spelling first used. */
export function storyThemes(stories: Pick<Story, "themes">[]): string[] {
  const seen = new Map<string, string>();
  for (const s of stories) {
    for (const t of splitTags(s.themes)) {
      if (!seen.has(t.toLowerCase())) seen.set(t.toLowerCase(), t);
    }
  }
  return [...seen.values()];
}

export async function listStories(db: D1Database, memberId: string): Promise<Story[]> {
  return (
    await db
      .prepare(
        `SELECT id, title, themes, situation, task, action, result, updated_at FROM stories
         WHERE member_id = ?1 ORDER BY updated_at DESC, id DESC`,
      )
      .bind(memberId)
      .all<Story>()
  ).results;
}

export async function addStory(db: D1Database, memberId: string, s: StoryInput): Promise<void> {
  await db
    .prepare(
      `INSERT INTO stories (member_id, title, themes, situation, task, action, result)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)`,
    )
    .bind(memberId, s.title, s.themes, s.situation, s.task, s.action, s.result)
    .run();
}

export async function updateStory(db: D1Database, memberId: string, id: number, s: StoryInput): Promise<boolean> {
  const res = await db
    .prepare(
      `UPDATE stories SET title = ?3, themes = ?4, situation = ?5, task = ?6, action = ?7, result = ?8,
         updated_at = datetime('now')
       WHERE id = ?1 AND member_id = ?2`,
    )
    .bind(id, memberId, s.title, s.themes, s.situation, s.task, s.action, s.result)
    .run();
  return res.meta.changes > 0;
}

export async function deleteStory(db: D1Database, memberId: string, id: number): Promise<boolean> {
  const res = await db.prepare("DELETE FROM stories WHERE id = ?1 AND member_id = ?2").bind(id, memberId).run();
  return res.meta.changes > 0;
}

// ---------- saved searches ----------

export type SavedSearch = {
  id: number;
  label: string;
  query: string;
  run_id: string | null;
  created_at: string;
};

/** A readable name for a query: its job board, or "Broad search". */
export function defaultSearchLabel(query: string): string {
  const site = query.match(/site:\s*([^\s)]+)/i);
  if (site) return site[1].replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  const quoted = query.match(/"([^"]{3,60})"/);
  return quoted ? `Broad search: ${quoted[1]}` : "Broad search";
}

export async function listSearches(db: D1Database, memberId: string): Promise<SavedSearch[]> {
  return (
    await db
      .prepare(
        `SELECT id, label, query, run_id, created_at FROM saved_searches
         WHERE member_id = ?1 ORDER BY created_at DESC, id DESC`,
      )
      .bind(memberId)
      .all<SavedSearch>()
  ).results;
}

/**
 * Saves a search. A run id is kept only if that run belongs to the member.
 * Saving the same query twice keeps one copy.
 */
export async function addSearch(
  db: D1Database,
  memberId: string,
  s: { label: string; query: string; runId: string | null },
): Promise<"saved" | "exists"> {
  const existing = await db
    .prepare("SELECT id FROM saved_searches WHERE member_id = ?1 AND query = ?2")
    .bind(memberId, s.query)
    .first<{ id: number }>();
  if (existing) return "exists";
  let runId: string | null = null;
  if (s.runId) {
    const owned = await db
      .prepare("SELECT id FROM runs WHERE id = ?1 AND member_id = ?2")
      .bind(s.runId, memberId)
      .first<{ id: string }>();
    runId = owned ? owned.id : null;
  }
  await db
    .prepare("INSERT INTO saved_searches (member_id, label, query, run_id) VALUES (?1, ?2, ?3, ?4)")
    .bind(memberId, s.label, s.query, runId)
    .run();
  return "saved";
}

export async function renameSearch(db: D1Database, memberId: string, id: number, label: string): Promise<boolean> {
  const res = await db
    .prepare("UPDATE saved_searches SET label = ?3 WHERE id = ?1 AND member_id = ?2")
    .bind(id, memberId, label)
    .run();
  return res.meta.changes > 0;
}

export async function deleteSearch(db: D1Database, memberId: string, id: number): Promise<boolean> {
  const res = await db
    .prepare("DELETE FROM saved_searches WHERE id = ?1 AND member_id = ?2")
    .bind(id, memberId)
    .run();
  return res.meta.changes > 0;
}

// ---------- home page summary ----------

export type WorkspaceCounts = {
  bullets: number;
  stories: number;
  developedStories: number;
  themes: number;
  searches: number;
};

export async function workspaceCounts(db: D1Database, memberId: string): Promise<WorkspaceCounts> {
  const [[bullets, searches], storyRows] = await Promise.all([
    db.batch<{ n: number }>([
      db.prepare("SELECT COUNT(*) AS n FROM bullets WHERE member_id = ?1").bind(memberId),
      db.prepare("SELECT COUNT(*) AS n FROM saved_searches WHERE member_id = ?1").bind(memberId),
    ]),
    listStories(db, memberId),
  ]);
  return {
    bullets: bullets.results[0]?.n ?? 0,
    stories: storyRows.length,
    developedStories: storyRows.filter(isDeveloped).length,
    themes: storyThemes(storyRows).length,
    searches: searches.results[0]?.n ?? 0,
  };
}
