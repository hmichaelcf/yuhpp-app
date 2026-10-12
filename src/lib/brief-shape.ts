// The search brief: what every Phase 03 search starts from. Shared by the
// browser and the server; nothing here touches the database.

export type SearchBrief = {
  titlesStrong: string[];
  titlesStretch: string[];
  level: string | null;
  location: string | null;
  industries: string | null;
  keywords: string[];
  postedWithinDays: number;
  /** False until the member saves the brief; the values above are then defaults. */
  saved: boolean;
};

export const BRIEF_LIMITS = { titles: 8, keywords: 12, item: 80, text: 200 } as const;

export const POSTING_WINDOWS = [1, 3, 7, 14, 30] as const;

export function briefTitles(b: SearchBrief): string[] {
  return [...b.titlesStrong, ...b.titlesStretch];
}

export function windowLabel(days: number): string {
  return days === 1 ? "the last 24 hours" : `the last ${days} days`;
}

const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** "4 titles, manager to senior manager, San Diego or remote, last 7 days" */
export function briefSummary(b: SearchBrief): string {
  const titles = briefTitles(b).length;
  return [
    titles ? count(titles, "title", "titles") : "no titles yet",
    b.level,
    b.location,
    windowLabel(b.postedWithinDays).replace(/^the /, ""),
  ]
    .filter(Boolean)
    .join(", ");
}

/** The brief as prompts read it. */
export function briefText(b: SearchBrief): string {
  const lines = [
    `Target titles, strong match: ${b.titlesStrong.join("; ") || "not set"}`,
    `Target titles, stretch: ${b.titlesStretch.join("; ") || "not set"}`,
    `Level: ${b.level || "not set"}`,
    `Location and work model: ${b.location || "not set"}`,
    `Industries: ${b.industries || "not set"}`,
    `Posted within: ${windowLabel(b.postedWithinDays)}`,
    `Keywords from their resume: ${b.keywords.join(", ") || "none"}`,
  ];
  return lines.join("\n");
}

/**
 * A first message drafted from the brief, so a search run opens ready to
 * send. Worded for what each step asks for in its own instructions.
 */
export function briefFirstMessage(promptName: string, b: SearchBrief): string {
  const key = promptName.toLowerCase().replace(/[^a-z0-9]/g, "");
  const strong = b.titlesStrong.join(", ");
  const stretch = b.titlesStretch.join(", ");
  const titles = [strong ? `Titles: ${strong}.` : "", stretch ? `Stretch: ${stretch}.` : ""].filter(Boolean).join(" ");
  const level = b.level ? `Level: ${b.level}.` : "";
  const where = b.location ? `Location: ${b.location}.` : "";
  if (key === "smartjobsearchbuilder") {
    return [
      "Build this week's searches.",
      titles,
      level,
      where,
      `Posted: ${windowLabel(b.postedWithinDays)}.`,
      b.keywords.length ? `Keywords worth including: ${b.keywords.slice(0, 5).join(", ")}.` : "",
    ]
      .filter(Boolean)
      .join("\n");
  }
  if (key === "jobsearchassistanceprocess") {
    return [
      `Find companies hiring for these roles${b.industries ? ` in ${b.industries}` : ""}.`,
      titles,
      level,
      where,
    ]
      .filter(Boolean)
      .join("\n");
  }
  return [titles, level, where].filter(Boolean).join("\n");
}
