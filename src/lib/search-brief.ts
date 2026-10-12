import "server-only";
import { BRIEF_LIMITS, POSTING_WINDOWS, type SearchBrief } from "./brief-shape";
import { jsonList } from "./resume-record";
import type { Settings } from "./settings";
import { InputProblem, LIMITS, field } from "./workspace";

// The member's search brief and saved companies. Every query filters by the
// member id from a verified session.

type BriefRow = {
  titles_strong: string | null;
  titles_stretch: string | null;
  level: string | null;
  location: string | null;
  industries: string | null;
  keywords: string | null;
  posted_within_days: number | null;
};

/**
 * The saved brief, or defaults until the member saves one: location from
 * their resume, keywords from its tools, and the posting window from
 * settings.
 */
export async function loadBrief(
  db: D1Database,
  memberId: string,
  settings: Settings,
  fromResume: { location: string | null; tools: string[] },
): Promise<SearchBrief> {
  const row = await db
    .prepare(
      `SELECT titles_strong, titles_stretch, level, location, industries, keywords, posted_within_days
       FROM search_briefs WHERE member_id = ?1`,
    )
    .bind(memberId)
    .first<BriefRow>();
  const defaultDays = settings.number("search_posted_within_days", 7);
  if (!row) {
    return {
      titlesStrong: [],
      titlesStretch: [],
      level: null,
      location: fromResume.location,
      industries: null,
      keywords: fromResume.tools.slice(0, 6),
      postedWithinDays: defaultDays,
      saved: false,
    };
  }
  return {
    titlesStrong: jsonList(row.titles_strong),
    titlesStretch: jsonList(row.titles_stretch),
    level: row.level,
    location: row.location,
    industries: row.industries,
    keywords: jsonList(row.keywords),
    postedWithinDays: row.posted_within_days ?? defaultDays,
    saved: true,
  };
}

function readTitles(value: unknown, label: string, max: number): string[] {
  const raw = Array.isArray(value) ? value : typeof value === "string" ? value.split(/\n|;/) : [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of raw) {
    if (typeof item !== "string") continue;
    const v = item.replace(/^\s*(?:[•\-*·]|\d+[.)])\s*/, "").trim();
    if (!v || seen.has(v.toLowerCase())) continue;
    if (v.length > BRIEF_LIMITS.item) throw new InputProblem(`One entry in ${label} is over ${BRIEF_LIMITS.item} characters.`);
    seen.add(v.toLowerCase());
    out.push(v);
  }
  if (out.length > max) throw new InputProblem(`${label} holds up to ${max}.`);
  return out;
}

/** Reads the brief form. */
export function readBrief(body: Record<string, unknown>): Omit<SearchBrief, "saved"> {
  const days = Number(body.postedWithinDays);
  return {
    titlesStrong: readTitles(body.titlesStrong, "Strong match titles", BRIEF_LIMITS.titles),
    titlesStretch: readTitles(body.titlesStretch, "Stretch titles", BRIEF_LIMITS.titles),
    level: field(body.level, BRIEF_LIMITS.text, "Level"),
    location: field(body.location, BRIEF_LIMITS.text, "Location"),
    industries: field(body.industries, BRIEF_LIMITS.text, "Industries"),
    keywords: readTitles(
      typeof body.keywords === "string" ? body.keywords.split(",") : body.keywords,
      "Keywords",
      BRIEF_LIMITS.keywords,
    ),
    postedWithinDays: (POSTING_WINDOWS as readonly number[]).includes(days) ? days : 7,
  };
}

export async function saveBrief(db: D1Database, memberId: string, b: Omit<SearchBrief, "saved">): Promise<void> {
  await db
    .prepare(
      `INSERT INTO search_briefs
         (member_id, titles_strong, titles_stretch, level, location, industries, keywords, posted_within_days, updated_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, datetime('now'))
       ON CONFLICT (member_id) DO UPDATE SET
         titles_strong = excluded.titles_strong, titles_stretch = excluded.titles_stretch,
         level = excluded.level, location = excluded.location, industries = excluded.industries,
         keywords = excluded.keywords, posted_within_days = excluded.posted_within_days,
         updated_at = datetime('now')`,
    )
    .bind(
      memberId,
      JSON.stringify(b.titlesStrong),
      JSON.stringify(b.titlesStretch),
      b.level,
      b.location,
      b.industries,
      JSON.stringify(b.keywords),
      b.postedWithinDays,
    )
    .run();
}

/** Adds one title from a run. "exists" when the brief already has it under either kind. */
export async function addBriefTitle(
  db: D1Database,
  memberId: string,
  settings: Settings,
  fromResume: { location: string | null; tools: string[] },
  title: string,
  kind: "strong" | "stretch",
): Promise<"added" | "exists" | "full"> {
  const b = await loadBrief(db, memberId, settings, fromResume);
  const all = [...b.titlesStrong, ...b.titlesStretch].map((t) => t.toLowerCase());
  if (all.includes(title.toLowerCase())) return "exists";
  const list = kind === "strong" ? b.titlesStrong : b.titlesStretch;
  if (list.length >= BRIEF_LIMITS.titles) return "full";
  list.push(title);
  await saveBrief(db, memberId, b);
  return "added";
}

// ---------- saved companies ----------

export type TargetCompany = {
  id: number;
  name: string;
  note: string | null;
  where_to_look: string | null;
  run_id: string | null;
  created_at: string;
};

export async function listCompanies(db: D1Database, memberId: string): Promise<TargetCompany[]> {
  return (
    await db
      .prepare(
        `SELECT id, name, note, where_to_look, run_id, created_at FROM target_companies
         WHERE member_id = ?1 ORDER BY created_at DESC, id DESC`,
      )
      .bind(memberId)
      .all<TargetCompany>()
  ).results;
}

export function readCompany(body: Record<string, unknown>) {
  const name = field(body.name, LIMITS.shortField, "The company");
  if (!name) throw new InputProblem("The company is empty.");
  return {
    name,
    note: field(body.note, BRIEF_LIMITS.text * 2, "Why it fits"),
    where: field(body.where, BRIEF_LIMITS.text * 2, "Where to look"),
    runId: typeof body.runId === "string" ? body.runId : null,
  };
}

/** Saves a company once per member (letter case ignored). A run id is kept only if the run is the member's. */
export async function addCompany(
  db: D1Database,
  memberId: string,
  c: { name: string; note: string | null; where: string | null; runId: string | null },
): Promise<"saved" | "exists"> {
  const existing = await db
    .prepare("SELECT id FROM target_companies WHERE member_id = ?1 AND lower(name) = lower(?2)")
    .bind(memberId, c.name)
    .first<{ id: number }>();
  if (existing) return "exists";
  let runId: string | null = null;
  if (c.runId) {
    const owned = await db
      .prepare("SELECT id FROM runs WHERE id = ?1 AND member_id = ?2")
      .bind(c.runId, memberId)
      .first<{ id: string }>();
    runId = owned ? owned.id : null;
  }
  await db
    .prepare("INSERT INTO target_companies (member_id, name, note, where_to_look, run_id) VALUES (?1, ?2, ?3, ?4, ?5)")
    .bind(memberId, c.name, c.note, c.where, runId)
    .run();
  return "saved";
}

export async function deleteCompany(db: D1Database, memberId: string, id: number): Promise<boolean> {
  const res = await db
    .prepare("DELETE FROM target_companies WHERE id = ?1 AND member_id = ?2")
    .bind(id, memberId)
    .run();
  return res.meta.changes > 0;
}

/** The saved companies as prompts read them. */
export function companiesText(list: TargetCompany[], max: number): string {
  return list
    .slice(0, max)
    .map((c) => `- ${c.name}${c.note ? `: ${c.note}` : ""}${c.where_to_look ? ` (where to look: ${c.where_to_look})` : ""}`)
    .join("\n");
}
