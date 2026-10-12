import "server-only";
import { thisMonth } from "./months";
import { saveProfile, type ProfilePatch, type ProfileRow } from "./resume-record";
import { LIST_LIMITS, type ListSection } from "./resume-shape";
import { LIMITS, addBullets, findExperience } from "./workspace";

// Writes what was read from an uploaded resume into the resume record.
// Nothing the member already has is overwritten: a role they already have
// (same title and company) keeps its bullets, and a profile field they have
// filled in keeps its value. Reading the file itself happens in claude.ts.

export type ImportResult = {
  rolesAdded: number;
  bulletsAdded: number;
  /** Roles already in the bullet bank, left as they are. */
  rolesKept: number;
  /** Roles with no bullets in the upload; the bullet bank only keeps roles that have bullets. */
  rolesWithoutBullets: number;
  /** Profile fields that were empty and are now filled. */
  filled: string[];
};

function str(v: unknown, max: number = LIMITS.shortField): string | null {
  if (typeof v !== "string") return null;
  const s = v.replace(/\s+/g, " ").trim();
  return s && s.length <= max ? s : s ? s.slice(0, max).trim() : null;
}

function month(v: unknown, now: Date): string | null {
  if (typeof v !== "string") return null;
  const m = v.trim().match(/^(\d{4})-(\d{2})$/);
  if (!m) return null;
  const mm = Number(m[2]);
  if (mm < 1 || mm > 12 || Number(m[1]) < 1950) return null;
  const value = `${m[1]}-${m[2]}`;
  return value > thisMonth(now) ? null : value;
}

function list(v: unknown, section: ListSection): string[] {
  if (!Array.isArray(v)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of v) {
    const s = str(item, LIST_LIMITS.item * 2);
    if (!s || s.length > LIST_LIMITS.item || seen.has(s.toLowerCase())) continue;
    seen.add(s.toLowerCase());
    out.push(s);
  }
  return out.slice(0, LIST_LIMITS[section]);
}

const isEmptyList = (raw: string | null | undefined) => !raw || raw === "[]";

export async function applyImport(
  db: D1Database,
  memberId: string,
  raw: Record<string, unknown>,
  profile: ProfileRow | null,
  now = new Date(),
): Promise<ImportResult> {
  const result: ImportResult = { rolesAdded: 0, bulletsAdded: 0, rolesKept: 0, rolesWithoutBullets: 0, filled: [] };

  const roles = Array.isArray(raw.roles) ? raw.roles : [];
  // Oldest first, so the most recent role is the newest row, which is how
  // the bullet bank orders roles that have no dates.
  for (const item of [...roles].reverse()) {
    if (!item || typeof item !== "object") continue;
    const r = item as Record<string, unknown>;
    const company = str(r.company);
    const title = str(r.title);
    if (!company && !title) continue;
    const bullets = (Array.isArray(r.bullets) ? r.bullets : [])
      .map((b) => str(b, LIMITS.bulletText))
      .filter((b): b is string => !!b)
      .slice(0, LIMITS.bulletsPerSave);
    if (bullets.length === 0) {
      result.rolesWithoutBullets++;
      continue;
    }
    if (await findExperience(db, memberId, title, company)) {
      result.rolesKept++;
      continue;
    }
    const current = r.current === true;
    const start = month(r.start, now);
    let end = current ? null : month(r.end, now);
    if (end && (!start || end < start)) end = null;
    await addBullets(db, memberId, bullets, { role: title, company, start, end, current, tags: null });
    result.rolesAdded++;
    result.bulletsAdded += bullets.length;
  }

  const patch: ProfilePatch = {};
  const fill = <K extends keyof ProfilePatch>(key: K, label: string, empty: boolean, value: ProfilePatch[K]) => {
    const has = Array.isArray(value) ? value.length > 0 : !!value;
    if (empty && has) {
      patch[key] = value;
      result.filled.push(label);
    }
  };
  const edu = raw.education && typeof raw.education === "object" ? (raw.education as Record<string, unknown>) : {};
  fill("name", "name", !profile?.full_name, str(raw.name));
  fill("email", "email", !profile?.email, str(raw.email));
  fill("phone", "phone", !profile?.phone, str(raw.phone));
  fill("location", "location", !profile?.location, str(raw.location));
  fill("skills", "skills", isEmptyList(profile?.skills), list(raw.skills, "skills"));
  fill("tools", "tools", isEmptyList(profile?.tools), list(raw.tools, "tools"));
  fill("interests", "interests", isEmptyList(profile?.interests), list(raw.interests, "interests"));
  if (!profile?.school && str(edu.school)) {
    patch.school = str(edu.school);
    patch.degree = str(edu.degree);
    patch.schoolLocation = str(edu.location);
    result.filled.push("education");
  }
  await saveProfile(db, memberId, patch, { imported: true });
  return result;
}
