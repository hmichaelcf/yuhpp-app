import { nameKey } from "./route-map";

// Which prompts write into the resume or the search brief, and which read
// the brief and saved companies. Listed by their names in the yuhpp_prompts
// sheet and matched the way the route map matches them, so a renamed prompt
// stops reading or writing until its name is updated here.
//
// A prompt that writes ends its reply with output blocks (see frame.ts); the
// run page turns each block into buttons such as "Use in my resume".

export type BlockKind = "skills" | "leadership" | "bullets" | "titles" | "companies";

/** What each block kind saves into, as members see it. */
export const BLOCK_TARGETS: Record<BlockKind, string> = {
  skills: "Skills & knowledge",
  leadership: "Leadership",
  bullets: "Experience bullets",
  titles: "Target titles",
  companies: "Saved companies",
};

const WRITERS: Record<string, BlockKind[]> = {
  "Experience Story Builder": ["bullets"],
  "Resume Bullet Refinement": ["bullets"],
  "Resume Value Builder": ["skills", "leadership"],
  "Resume Growth Advisor": ["bullets"],
  "Job Title Navigator": ["titles"],
  "Smart Job Search Builder": ["titles"],
  "Job Search Assistance Process": ["titles", "companies"],
};

/** Prompts that read the search brief (their instructions ask for titles, locations, or industries). */
const BRIEF_READERS = ["Smart Job Search Builder", "Job Search Assistance Process"];

/** Prompts that read the companies saved from Track A. */
const COMPANY_READERS = ["Networking Target Finder"];

const writerMap = new Map(Object.entries(WRITERS).map(([name, kinds]) => [nameKey(name), kinds]));
const briefSet = new Set(BRIEF_READERS.map(nameKey));
const companySet = new Set(COMPANY_READERS.map(nameKey));

export function blockKinds(promptName: string): BlockKind[] {
  return writerMap.get(nameKey(promptName)) ?? [];
}

/** Prompts that write resume sections read the working draft rather than the published resume. */
export function writesResume(promptName: string): boolean {
  return blockKinds(promptName).some((k) => k === "skills" || k === "leadership" || k === "bullets");
}

export function readsBrief(promptName: string): boolean {
  return briefSet.has(nameKey(promptName));
}

export function readsCompanies(promptName: string): boolean {
  return companySet.has(nameKey(promptName));
}

/** "Writes to: Skills & knowledge, Leadership" for a prompt card, or null. */
export function writesLabel(promptName: string): string | null {
  const kinds = blockKinds(promptName);
  return kinds.length ? kinds.map((k) => BLOCK_TARGETS[k]).join(", ") : null;
}

/** "Reads: search brief" for a prompt card, or null. */
export function readsLabel(promptName: string): string | null {
  const parts = [readsBrief(promptName) ? "your search brief" : "", readsCompanies(promptName) ? "your saved companies" : ""];
  const list = parts.filter(Boolean);
  return list.length ? list.join(", ") : null;
}
