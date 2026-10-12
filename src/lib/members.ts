import "server-only";

// Member rows. Every query that reads member data filters by a member id
// that came from a verified session, never from the request.

export type Member = {
  id: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  cohort_id: string | null;
  is_admin: number;
  consent_terms_at: string | null;
  consent_research_at: string | null;
  created_at: string;
};

/** Longest first or last name accepted, in characters. */
export const NAME_MAX = 60;

/** Trims a name and collapses inner spaces; empty becomes null, overlong is cut to NAME_MAX. */
export function cleanName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const v = value.replace(/\s+/g, " ").trim();
  return v ? v.slice(0, NAME_MAX) : null;
}

/**
 * Creates the member row on first sign-in, or refreshes it.
 * Consent timestamps are recorded the first time consent is given and never
 * overwritten. Names are sent only at sign-up; a later sign-in sends none,
 * so a stored name is never cleared by signing in.
 */
export async function upsertMember(
  db: D1Database,
  input: {
    id: string;
    email: string | null;
    consentTerms: boolean;
    consentResearch: boolean;
    firstName?: string | null;
    lastName?: string | null;
  },
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO members (id, email, first_name, last_name, consent_terms_at, consent_research_at, last_seen_at)
       VALUES (?1, ?2, ?5, ?6,
               CASE WHEN ?3 = 1 THEN datetime('now') END,
               CASE WHEN ?4 = 1 THEN datetime('now') END,
               datetime('now'))
       ON CONFLICT (id) DO UPDATE SET
         email = COALESCE(excluded.email, members.email),
         first_name = COALESCE(excluded.first_name, members.first_name),
         last_name = COALESCE(excluded.last_name, members.last_name),
         consent_terms_at = COALESCE(members.consent_terms_at, excluded.consent_terms_at),
         consent_research_at = COALESCE(members.consent_research_at, excluded.consent_research_at),
         last_seen_at = datetime('now')`,
    )
    .bind(
      input.id,
      input.email,
      input.consentTerms ? 1 : 0,
      input.consentResearch ? 1 : 0,
      input.firstName ?? null,
      input.lastName ?? null,
    )
    .run();
}

export async function getMember(db: D1Database, id: string): Promise<Member | null> {
  return db
    .prepare(
      `SELECT id, email, first_name, last_name, cohort_id, is_admin, consent_terms_at, consent_research_at, created_at
       FROM members WHERE id = ?1`,
    )
    .bind(id)
    .first<Member>();
}

/** Sets or clears the member's first and last name (from the profile page). */
export async function setName(
  db: D1Database,
  id: string,
  name: { firstName: string | null; lastName: string | null },
): Promise<void> {
  await db
    .prepare("UPDATE members SET first_name = ?2, last_name = ?3 WHERE id = ?1")
    .bind(id, name.firstName, name.lastName)
    .run();
}
