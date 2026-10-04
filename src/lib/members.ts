import "server-only";

// Member rows. Every query that reads member data filters by a member id
// that came from a verified session, never from the request.

export type Member = {
  id: string;
  email: string | null;
  cohort_id: string | null;
  is_admin: number;
  consent_terms_at: string | null;
  consent_research_at: string | null;
  created_at: string;
};

/**
 * Creates the member row on first sign-in, or refreshes it.
 * Consent timestamps are recorded the first time consent is given and never
 * overwritten.
 */
export async function upsertMember(
  db: D1Database,
  input: { id: string; email: string | null; consentTerms: boolean; consentResearch: boolean },
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO members (id, email, consent_terms_at, consent_research_at, last_seen_at)
       VALUES (?1, ?2,
               CASE WHEN ?3 = 1 THEN datetime('now') END,
               CASE WHEN ?4 = 1 THEN datetime('now') END,
               datetime('now'))
       ON CONFLICT (id) DO UPDATE SET
         email = COALESCE(excluded.email, members.email),
         consent_terms_at = COALESCE(members.consent_terms_at, excluded.consent_terms_at),
         consent_research_at = COALESCE(members.consent_research_at, excluded.consent_research_at),
         last_seen_at = datetime('now')`,
    )
    .bind(input.id, input.email, input.consentTerms ? 1 : 0, input.consentResearch ? 1 : 0)
    .run();
}

export async function getMember(db: D1Database, id: string): Promise<Member | null> {
  return db
    .prepare(
      `SELECT id, email, cohort_id, is_admin, consent_terms_at, consent_research_at, created_at
       FROM members WHERE id = ?1`,
    )
    .bind(id)
    .first<Member>();
}
