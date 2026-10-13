// The phases a member can be in, in route order, and the onboarding lines
// that map to them. Shared by the server and the browser.

export const PHASE_IDS = [
  "direction",
  "positioning",
  "search",
  "application",
  "interview",
  "practice",
  "offer",
] as const;

export type PhaseId = (typeof PHASE_IDS)[number];

export const PHASE_INFO: Record<PhaseId, { code: string; name: string; href: string }> = {
  direction: { code: "01", name: "Direction", href: "/phase/direction" },
  positioning: { code: "02", name: "Positioning", href: "/phase/positioning" },
  search: { code: "03", name: "Search and outreach", href: "/phase/search" },
  application: { code: "04", name: "Application", href: "/phase/application" },
  interview: { code: "05", name: "Interview", href: "/phase/interview" },
  practice: { code: "Loop", name: "Practice loop", href: "/phase/practice" },
  offer: { code: "06", name: "Offer", href: "/phase/offer" },
};

export function isPhase(value: unknown): value is PhaseId {
  return typeof value === "string" && (PHASE_IDS as readonly string[]).includes(value);
}

export function phaseIndex(id: PhaseId): number {
  return PHASE_IDS.indexOf(id);
}

/** The phase after this one on the route, or null at the end. */
export function nextPhase(id: PhaseId): PhaseId | null {
  return PHASE_IDS[phaseIndex(id) + 1] ?? null;
}

/** "02 Positioning", "Loop Practice loop" reads oddly, so the loop is named alone. */
export function phaseLabel(id: PhaseId): string {
  const p = PHASE_INFO[id];
  return id === "practice" ? p.name : `${p.code} ${p.name}`;
}

/** "Where are you in your search?": the guide's start-here lines, each pointing at a phase. */
export const WHERE_LINES: { q: string; phase: PhaseId }[] = [
  { q: "I have no idea what I actually want next", phase: "direction" },
  { q: "I am employed and not in a hurry", phase: "direction" },
  { q: "My resume and LinkedIn are not ready", phase: "positioning" },
  { q: "I know what I want and I am ready to look", phase: "search" },
  { q: "I am applying and hearing nothing back", phase: "application" },
  { q: "I get screens, and they end there", phase: "interview" },
  { q: "I have a take-home or a case study due", phase: "interview" },
  { q: "I get onsites, and I lose them", phase: "practice" },
  { q: "I have an offer in hand", phase: "offer" },
];
