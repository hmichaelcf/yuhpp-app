import "server-only";
import { readWorkDates } from "./months";
import { distinctThemes } from "./story-themes";

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

// ---------- bullets and experiences ----------

/**
 * One role a member held: the heading the bullet bank groups bullets under.
 * Months are 'YYYY-MM'; is_current = 1 means "Present".
 */
export type Experience = {
  id: number;
  role: string | null;
  company: string | null;
  start_month: string | null;
  end_month: string | null;
  is_current: number;
};

export type Bullet = {
  id: number;
  text: string;
  tags: string | null;
  experience_id: number | null;
  updated_at: string;
};

/** Role, company, and dates as the member sent them, already checked. */
export type ExperienceInput = {
  role: string | null;
  company: string | null;
  start: string | null;
  end: string | null;
  current: boolean;
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

/**
 * The member's roles, most recent first: roles marked Present (latest start
 * first), then past roles by end date (or start date when there is no end),
 * then roles with no dates at all, newest entry first.
 */
export async function listExperiences(db: D1Database, memberId: string): Promise<Experience[]> {
  return (
    await db
      .prepare(
        `SELECT id, role, company, start_month, end_month, is_current FROM experiences
         WHERE member_id = ?1
         ORDER BY
           CASE WHEN is_current = 1 THEN 0
                WHEN end_month IS NOT NULL OR start_month IS NOT NULL THEN 1
                ELSE 2 END,
           COALESCE(end_month, start_month) DESC,
           start_month DESC,
           id DESC`,
      )
      .bind(memberId)
      .all<Experience>()
  ).results;
}

export async function listBullets(db: D1Database, memberId: string): Promise<Bullet[]> {
  return (
    await db
      .prepare(
        `SELECT id, text, tags, experience_id, updated_at FROM bullets
         WHERE member_id = ?1 ORDER BY id`,
      )
      .bind(memberId)
      .all<Bullet>()
  ).results;
}

/** The member's experience with this role and company, ignoring letter case. */
async function findExperience(
  db: D1Database,
  memberId: string,
  role: string | null,
  company: string | null,
  exceptId: number | null = null,
): Promise<Experience | null> {
  return db
    .prepare(
      `SELECT id, role, company, start_month, end_month, is_current FROM experiences
       WHERE member_id = ?1
         AND lower(COALESCE(role, '')) = lower(COALESCE(?2, ''))
         AND lower(COALESCE(company, '')) = lower(COALESCE(?3, ''))
         AND id IS NOT ?4
       ORDER BY id LIMIT 1`,
    )
    .bind(memberId, role, company, exceptId)
    .first<Experience>();
}

/** Reads role, company, start, end, and Present from a request body. */
export function experienceFields(body: Record<string, unknown>): ExperienceInput {
  const role = field(body.role, LIMITS.shortField, "The role");
  const company = field(body.company, LIMITS.shortField, "The company");
  const start = typeof body.start === "string" ? body.start : "";
  const end = typeof body.end === "string" ? body.end : "";
  const checked = readWorkDates(start, end, body.current === true);
  if (!checked.ok) throw new InputProblem(checked.message);
  return { role, company, ...checked.dates };
}

function hasDates(x: ExperienceInput): boolean {
  return x.start !== null || x.end !== null || x.current;
}

/** Removes the member's experiences that no longer have any bullets. */
function dropEmptyExperiences(db: D1Database, memberId: string) {
  return db
    .prepare(
      `DELETE FROM experiences WHERE member_id = ?1 AND id NOT IN (
         SELECT experience_id FROM bullets WHERE member_id = ?1 AND experience_id IS NOT NULL)`,
    )
    .bind(memberId);
}

/**
 * Adds bullets under a role. A role and company the member already has (in
 * any letter case) gets the new bullets; dates sent with them replace the
 * saved dates, and blank dates leave the saved ones alone.
 */
export async function addBullets(
  db: D1Database,
  memberId: string,
  lines: string[],
  meta: ExperienceInput & { tags: string | null },
): Promise<number> {
  const existing = await findExperience(db, memberId, meta.role, meta.company);
  let experienceId: number;
  if (existing) {
    experienceId = existing.id;
    if (hasDates(meta)) {
      await db
        .prepare(
          `UPDATE experiences SET start_month = ?3, end_month = ?4, is_current = ?5, updated_at = datetime('now')
           WHERE id = ?1 AND member_id = ?2`,
        )
        .bind(experienceId, memberId, meta.start, meta.end, meta.current ? 1 : 0)
        .run();
    }
  } else {
    const row = await db
      .prepare(
        `INSERT INTO experiences (member_id, role, company, start_month, end_month, is_current)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6) RETURNING id`,
      )
      .bind(memberId, meta.role, meta.company, meta.start, meta.end, meta.current ? 1 : 0)
      .first<{ id: number }>();
    if (!row) throw new Error("Could not save the role.");
    experienceId = row.id;
  }
  const insert = db.prepare(
    "INSERT INTO bullets (member_id, text, tags, experience_id) VALUES (?1, ?2, ?3, ?4)",
  );
  await db.batch(lines.map((line) => insert.bind(memberId, line, meta.tags, experienceId)));
  return lines.length;
}

/**
 * Fixes a role's title, company, or dates; every bullet under it follows.
 * If the new title and company match another of the member's roles, the two
 * become one: the bullets move over and this role is removed.
 * Returns false when the role is not the member's.
 */
export async function updateExperience(
  db: D1Database,
  memberId: string,
  id: number,
  x: ExperienceInput,
): Promise<{ found: boolean; merged: boolean }> {
  const mine = await db
    .prepare("SELECT id FROM experiences WHERE id = ?1 AND member_id = ?2")
    .bind(id, memberId)
    .first<{ id: number }>();
  if (!mine) return { found: false, merged: false };

  const twin = await findExperience(db, memberId, x.role, x.company, id);
  const target = twin ? twin.id : id;
  const statements = [
    db
      .prepare(
        `UPDATE experiences SET role = ?3, company = ?4, start_month = ?5, end_month = ?6, is_current = ?7,
           updated_at = datetime('now')
         WHERE id = ?1 AND member_id = ?2`,
      )
      .bind(target, memberId, x.role, x.company, x.start, x.end, x.current ? 1 : 0),
  ];
  if (twin) {
    statements.push(
      db
        .prepare(
          `UPDATE bullets SET experience_id = ?3, updated_at = datetime('now')
           WHERE experience_id = ?1 AND member_id = ?2`,
        )
        .bind(id, memberId, twin.id),
      db.prepare("DELETE FROM experiences WHERE id = ?1 AND member_id = ?2").bind(id, memberId),
    );
  }
  await db.batch(statements);
  return { found: true, merged: !!twin };
}

/** Edits one bullet's text and tags, and can move it to another of the member's roles. */
export async function updateBullet(
  db: D1Database,
  memberId: string,
  id: number,
  b: { text: string; tags: string | null; experienceId: number },
): Promise<boolean> {
  const [res] = await db.batch([
    db
      .prepare(
        `UPDATE bullets SET text = ?3, tags = ?4, experience_id = ?5, updated_at = datetime('now')
         WHERE id = ?1 AND member_id = ?2
           AND EXISTS (SELECT 1 FROM experiences WHERE id = ?5 AND member_id = ?2)`,
      )
      .bind(id, memberId, b.text, b.tags, b.experienceId),
    dropEmptyExperiences(db, memberId),
  ]);
  return res.meta.changes > 0;
}

export async function deleteBullet(db: D1Database, memberId: string, id: number): Promise<boolean> {
  const [res] = await db.batch([
    db.prepare("DELETE FROM bullets WHERE id = ?1 AND member_id = ?2").bind(id, memberId),
    dropEmptyExperiences(db, memberId),
  ]);
  return res.meta.changes > 0;
}

// ---------- stories ----------

export type Story = {
  id: number;
  title: string;
  company: string | null;
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
    company: field(body.company, LIMITS.shortField, "The company"),
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

/**
 * Distinct themes across the stories, grouped the same way the story bank
 * groups them (letter case and extra spaces ignored).
 */
export function storyThemes(stories: Pick<Story, "title" | "company" | "themes">[]): string[] {
  return distinctThemes(stories);
}

export async function listStories(db: D1Database, memberId: string): Promise<Story[]> {
  return (
    await db
      .prepare(
        `SELECT id, title, company, themes, situation, task, action, result, updated_at FROM stories
         WHERE member_id = ?1 ORDER BY updated_at DESC, id DESC`,
      )
      .bind(memberId)
      .all<Story>()
  ).results;
}

/** Saves a new story and returns its id, so the bank can open it right away. */
export async function addStory(db: D1Database, memberId: string, s: StoryInput): Promise<number> {
  const row = await db
    .prepare(
      `INSERT INTO stories (member_id, title, company, themes, situation, task, action, result)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8) RETURNING id`,
    )
    .bind(memberId, s.title, s.company, s.themes, s.situation, s.task, s.action, s.result)
    .first<{ id: number }>();
  if (!row) throw new Error("Could not save the story.");
  return row.id;
}

export async function updateStory(db: D1Database, memberId: string, id: number, s: StoryInput): Promise<boolean> {
  const res = await db
    .prepare(
      `UPDATE stories SET title = ?3, company = ?4, themes = ?5, situation = ?6, task = ?7, action = ?8,
         result = ?9, updated_at = datetime('now')
       WHERE id = ?1 AND member_id = ?2`,
    )
    .bind(id, memberId, s.title, s.company, s.themes, s.situation, s.task, s.action, s.result)
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
