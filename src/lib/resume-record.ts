import "server-only";
import {
  LIST_LIMITS,
  emptyResume,
  hasResumeContent,
  resumeContentKey,
  resumeText,
  type ListSection,
  type ResumeData,
  type ResumeReference,
  type ResumeRole,
} from "./resume-shape";
import { InputProblem, LIMITS, field, listBullets, listExperiences } from "./workspace";

// The member's resume record: roles and bullets from the bullet bank, plus
// one resume_profiles row for everything else on the template. Every query
// filters by the member id from a verified session.

export type ProfileRow = {
  member_id: string;
  full_name: string | null;
  headline: string | null;
  email: string | null;
  phone: string | null;
  location: string | null;
  skills: string | null;
  leadership: string | null;
  tools: string | null;
  interests: string | null;
  reference_list: string | null;
  school: string | null;
  degree: string | null;
  school_location: string | null;
  use_own_file: number;
  imported_at: string | null;
  updated_at: string;
};

/** A JSON list of strings from the database; anything else becomes []. */
export function jsonList(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw) as unknown;
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && x.trim() !== "") : [];
  } catch {
    return [];
  }
}

function jsonRefs(raw: string | null | undefined): ResumeReference[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw) as unknown;
    if (!Array.isArray(v)) return [];
    return v
      .filter((r): r is Record<string, unknown> => !!r && typeof r === "object")
      .map((r) => ({
        name: typeof r.name === "string" ? r.name : "",
        relationship: typeof r.relationship === "string" ? r.relationship : null,
        company: typeof r.company === "string" ? r.company : null,
      }))
      .filter((r) => r.name);
  } catch {
    return [];
  }
}

export async function loadProfile(db: D1Database, memberId: string): Promise<ProfileRow | null> {
  return db.prepare("SELECT * FROM resume_profiles WHERE member_id = ?1").bind(memberId).first<ProfileRow>();
}

export type Draft = {
  data: ResumeData;
  profile: ProfileRow | null;
  /** The latest change to any part of the draft (SQLite UTC), or null. */
  updatedAt: string | null;
  hasContent: boolean;
};

/**
 * The working draft: the bullet bank's roles (most recent first) with their
 * bullets in the order they were added, and the profile row. The account
 * email fills in until the member sets one.
 */
export async function loadDraft(db: D1Database, memberId: string, accountEmail: string | null): Promise<Draft> {
  const [profile, experiences, bullets] = await Promise.all([
    loadProfile(db, memberId),
    listExperiences(db, memberId),
    listBullets(db, memberId),
  ]);
  const byRole = new Map<number | null, typeof bullets>();
  for (const b of bullets) {
    const key = b.experience_id ?? null;
    byRole.set(key, [...(byRole.get(key) ?? []), b]);
  }
  const roles: ResumeRole[] = experiences.map((x) => ({
    id: x.id,
    company: x.company,
    title: x.role,
    start: x.start_month,
    end: x.is_current ? null : x.end_month,
    current: x.is_current === 1,
    bullets: (byRole.get(x.id) ?? []).map((b) => ({ id: b.id, text: b.text })),
  }));
  const loose = byRole.get(null);
  if (loose?.length) {
    roles.push({
      id: null,
      company: null,
      title: null,
      start: null,
      end: null,
      current: false,
      bullets: loose.map((b) => ({ id: b.id, text: b.text })),
    });
  }

  const data: ResumeData = {
    name: profile?.full_name ?? null,
    headline: jsonList(profile?.headline),
    contact: {
      email: profile?.email ?? accountEmail,
      phone: profile?.phone ?? null,
      location: profile?.location ?? null,
    },
    roles,
    skills: jsonList(profile?.skills),
    leadership: jsonList(profile?.leadership),
    tools: jsonList(profile?.tools),
    interests: jsonList(profile?.interests),
    references: jsonRefs(profile?.reference_list),
    education: {
      school: profile?.school ?? null,
      degree: profile?.degree ?? null,
      location: profile?.school_location ?? null,
    },
  };
  const stamps = [profile?.updated_at, ...bullets.map((b) => b.updated_at)].filter((s): s is string => !!s);
  const updatedAt = stamps.length ? stamps.sort().at(-1)! : null;
  return { data, profile, updatedAt, hasContent: hasResumeContent(data) };
}

// ---------- editing the profile ----------

export type ProfilePatch = Partial<{
  name: string | null;
  headline: string[];
  email: string | null;
  phone: string | null;
  location: string | null;
  skills: string[];
  leadership: string[];
  tools: string[];
  interests: string[];
  references: ResumeReference[];
  school: string | null;
  degree: string | null;
  schoolLocation: string | null;
}>;

const COLUMNS: Record<keyof ProfilePatch, string> = {
  name: "full_name",
  headline: "headline",
  email: "email",
  phone: "phone",
  location: "location",
  skills: "skills",
  leadership: "leadership",
  tools: "tools",
  interests: "interests",
  references: "reference_list",
  school: "school",
  degree: "degree",
  schoolLocation: "school_location",
};

const LIST_LABELS: Record<ListSection, string> = {
  headline: "Headline",
  skills: "Skills & knowledge",
  leadership: "Leadership",
  tools: "Tools",
  interests: "Interests",
};

/** A list from a request: an array of strings, or one entry per line. */
export function readList(value: unknown, section: ListSection): string[] {
  const label = LIST_LABELS[section];
  const raw = Array.isArray(value) ? value : typeof value === "string" ? value.split("\n") : null;
  if (!raw) throw new InputProblem(`${label} must be a list.`);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of raw) {
    if (typeof item !== "string") throw new InputProblem(`${label} must be text.`);
    const v = item.replace(/^\s*(?:[•\-*·]|\d+[.)])\s*/, "").trim();
    if (!v || seen.has(v.toLowerCase())) continue;
    if (v.length > LIST_LIMITS.item) throw new InputProblem(`One ${label} entry is over ${LIST_LIMITS.item} characters.`);
    seen.add(v.toLowerCase());
    out.push(v);
  }
  if (out.length > LIST_LIMITS[section]) {
    throw new InputProblem(`${label} holds up to ${LIST_LIMITS[section]} entries.`);
  }
  return out;
}

function readReferences(value: unknown): ResumeReference[] {
  if (!Array.isArray(value)) throw new InputProblem("References must be a list.");
  const out: ResumeReference[] = [];
  for (const r of value) {
    if (!r || typeof r !== "object") continue;
    const o = r as Record<string, unknown>;
    const name = field(o.name, LIMITS.shortField, "A reference's name");
    if (!name) continue;
    out.push({
      name,
      relationship: field(o.relationship, LIMITS.shortField, "A reference's relationship"),
      company: field(o.company, LIMITS.shortField, "A reference's company"),
    });
  }
  if (out.length > LIST_LIMITS.references) throw new InputProblem(`Add up to ${LIST_LIMITS.references} references.`);
  return out;
}

/** Reads whichever profile fields a request sent; the rest stay as they are. */
export function readProfilePatch(body: Record<string, unknown>): ProfilePatch {
  const patch: ProfilePatch = {};
  const text = (key: "name" | "email" | "phone" | "location" | "school" | "degree" | "schoolLocation", label: string) => {
    if (key in body) patch[key] = field(body[key], LIMITS.shortField, label);
  };
  text("name", "Your name");
  text("email", "Email");
  text("phone", "Phone");
  text("location", "Location");
  text("school", "School");
  text("degree", "Degree");
  text("schoolLocation", "School location");
  for (const section of ["headline", "skills", "leadership", "tools", "interests"] as const) {
    if (section in body) patch[section] = readList(body[section], section);
  }
  if ("references" in body) patch.references = readReferences(body.references);
  return patch;
}

/** Saves the fields in the patch, creating the member's profile row if needed. */
export async function saveProfile(
  db: D1Database,
  memberId: string,
  patch: ProfilePatch,
  extra: { useOwnFile?: boolean; imported?: boolean } = {},
): Promise<void> {
  const cols: string[] = [];
  const values: (string | number | null)[] = [];
  for (const [key, column] of Object.entries(COLUMNS) as [keyof ProfilePatch, string][]) {
    if (!(key in patch)) continue;
    const v = patch[key];
    cols.push(column);
    values.push(Array.isArray(v) ? JSON.stringify(v) : (v ?? null));
  }
  if (extra.useOwnFile !== undefined) {
    cols.push("use_own_file");
    values.push(extra.useOwnFile ? 1 : 0);
  }
  if (extra.imported) {
    cols.push("imported_at");
    values.push(new Date().toISOString().replace("T", " ").slice(0, 19));
  }
  const placeholders = cols.map((_, i) => `?${i + 2}`);
  const updates = cols.map((c) => `${c} = excluded.${c}`);
  await db
    .prepare(
      `INSERT INTO resume_profiles (member_id${cols.map((c) => `, ${c}`).join("")}, updated_at)
       VALUES (?1${placeholders.map((p) => `, ${p}`).join("")}, datetime('now'))
       ON CONFLICT (member_id) DO UPDATE SET ${[...updates, "updated_at = datetime('now')"].join(", ")}`,
    )
    .bind(memberId, ...values)
    .run();
}

// ---------- bullets written from a run ----------

/** Replaces one bullet's text. False when the bullet is not the member's. */
export async function replaceBulletText(db: D1Database, memberId: string, id: number, text: string): Promise<boolean> {
  const res = await db
    .prepare("UPDATE bullets SET text = ?3, updated_at = datetime('now') WHERE id = ?1 AND member_id = ?2")
    .bind(id, memberId, text)
    .run();
  return res.meta.changes > 0;
}

/** Adds a bullet under one of the member's roles. False when the role is not theirs. */
export async function addBulletToRole(
  db: D1Database,
  memberId: string,
  experienceId: number,
  text: string,
): Promise<boolean> {
  const res = await db
    .prepare(
      `INSERT INTO bullets (member_id, text, experience_id)
       SELECT ?1, ?3, id FROM experiences WHERE id = ?2 AND member_id = ?1`,
    )
    .bind(memberId, experienceId, text)
    .run();
  return res.meta.changes > 0;
}

// ---------- published versions ----------

export type SavedResumeRow = {
  id: number;
  file_name: string | null;
  source: "pdf" | "docx" | "text" | "paste" | "built";
  text: string;
  record: string | null;
  created_at: string;
};

export function parseRecord(raw: string | null): ResumeData | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as Partial<ResumeData>;
    const base = emptyResume();
    return {
      ...base,
      ...v,
      contact: { ...base.contact, ...(v.contact ?? {}) },
      education: { ...base.education, ...(v.education ?? {}) },
    } as ResumeData;
  } catch {
    return null;
  }
}

export type ResumeState = {
  draft: Draft;
  /** The resume every run reads now: a published version or an upload. */
  current: SavedResumeRow | null;
  /** The current version as a record, when it was published from Yuhpp. */
  currentData: ResumeData | null;
  /** "v3": the current version's place among the member's saved versions. */
  version: number;
  /** The latest uploaded (not built) version. */
  upload: SavedResumeRow | null;
  useOwnFile: boolean;
  /** The draft differs from what runs read, and the member means to publish it. */
  unpublished: boolean;
};

export async function resumeState(db: D1Database, memberId: string, accountEmail: string | null): Promise<ResumeState> {
  const [draft, current, upload] = await Promise.all([
    loadDraft(db, memberId, accountEmail),
    db
      .prepare(
        `SELECT id, file_name, source, text, record, created_at FROM resumes
         WHERE member_id = ?1 AND is_current = 1 ORDER BY id DESC LIMIT 1`,
      )
      .bind(memberId)
      .first<SavedResumeRow>(),
    db
      .prepare(
        `SELECT id, file_name, source, text, record, created_at FROM resumes
         WHERE member_id = ?1 AND source != 'built' ORDER BY id DESC LIMIT 1`,
      )
      .bind(memberId)
      .first<SavedResumeRow>(),
  ]);
  const version = current
    ? ((
        await db
          .prepare("SELECT COUNT(*) AS n FROM resumes WHERE member_id = ?1 AND id <= ?2")
          .bind(memberId, current.id)
          .first<{ n: number }>()
      )?.n ?? 1)
    : 0;
  const currentData = current?.source === "built" ? parseRecord(current.record) : null;
  const useOwnFile = draft.profile?.use_own_file === 1;
  const unpublished =
    draft.hasContent &&
    !useOwnFile &&
    (!currentData || resumeContentKey(currentData) !== resumeContentKey(draft.data));
  return { draft, current, currentData, version, upload, useOwnFile, unpublished };
}

/** Publishes the draft: it becomes the resume every run reads. Returns its version number. */
export async function publishDraft(db: D1Database, memberId: string, data: ResumeData): Promise<number> {
  const cleanData: ResumeData = { ...data, roles: data.roles.map((r) => ({ ...r })) };
  await db.batch([
    db.prepare("UPDATE resumes SET is_current = 0 WHERE member_id = ?1").bind(memberId),
    db
      .prepare(
        `INSERT INTO resumes (member_id, file_name, source, text, record, is_current)
         VALUES (?1, NULL, 'built', ?2, ?3, 1)`,
      )
      .bind(memberId, resumeText(cleanData), JSON.stringify(cleanData)),
  ]);
  await saveProfile(db, memberId, {}, { useOwnFile: false });
  const row = await db
    .prepare("SELECT COUNT(*) AS n FROM resumes WHERE member_id = ?1")
    .bind(memberId)
    .first<{ n: number }>();
  return row?.n ?? 1;
}

/**
 * The member keeps their uploaded file as their resume: the latest upload
 * becomes current again. False when there is no upload to keep.
 */
export async function keepOwnFile(db: D1Database, memberId: string): Promise<boolean> {
  const upload = await db
    .prepare("SELECT id FROM resumes WHERE member_id = ?1 AND source != 'built' ORDER BY id DESC LIMIT 1")
    .bind(memberId)
    .first<{ id: number }>();
  if (!upload) return false;
  await db
    .prepare("UPDATE resumes SET is_current = CASE WHEN id = ?2 THEN 1 ELSE 0 END WHERE member_id = ?1")
    .bind(memberId, upload.id)
    .run();
  await saveProfile(db, memberId, {}, { useOwnFile: true });
  return true;
}
