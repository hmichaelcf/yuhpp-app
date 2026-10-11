// Story themes: how the story bank groups stories. Shared by the server (the
// progress count) and the browser (the bank itself), so both agree on which
// spellings are the same theme. No server-only imports here.

/** "ownership, Delivering results" becomes ["ownership", "Delivering results"]. */
export function splitThemes(themes: string | null | undefined): string[] {
  return themes ? themes.split(",").map((t) => t.trim().replace(/\s+/g, " ")).filter(Boolean) : [];
}

/** What two spellings of one theme share: "Customer  Obsession" and "customer obsession". */
export function themeKey(theme: string): string {
  return theme.trim().replace(/\s+/g, " ").toLowerCase();
}

const SMALL_WORDS = new Set(["a", "an", "and", "as", "at", "but", "by", "for", "in", "of", "on", "or", "the", "to", "with"]);

/**
 * A theme as a heading. A spelling the member already capitalized is kept as
 * typed ("Bias for Action", "AI adoption"); an all-lowercase one is put in
 * title case ("customer obsession" becomes "Customer Obsession").
 */
export function themeHeading(theme: string): string {
  const t = theme.trim().replace(/\s+/g, " ");
  if (t !== t.toLowerCase()) return t;
  return t
    .split(" ")
    .map((w, i) => (i > 0 && SMALL_WORDS.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(" ");
}

export type ThemeGroup<T> = { key: string; name: string; stories: T[] };

type Groupable = { title: string; company: string | null; themes: string | null };

function byCompanyThenTitle(a: Groupable, b: Groupable): number {
  const ca = a.company?.trim() ?? "";
  const cb = b.company?.trim() ?? "";
  if (!ca !== !cb) return ca ? -1 : 1; // stories with a company first
  return ca.localeCompare(cb, "en", { sensitivity: "base" }) || a.title.localeCompare(b.title, "en", { sensitivity: "base" });
}

/**
 * Stories grouped under each theme they cover, themes A to Z. A story tagged
 * with three themes appears under all three, which is the point: it can
 * answer any of those questions. Inside a theme, stories sort by company,
 * then name. Stories with no theme yet are returned separately.
 */
export function groupByTheme<T extends Groupable>(stories: T[]): { groups: ThemeGroup<T>[]; untagged: T[] } {
  const groups = new Map<string, { spellings: string[]; stories: T[] }>();
  const untagged: T[] = [];
  for (const s of stories) {
    const themes = splitThemes(s.themes);
    if (!themes.length) {
      untagged.push(s);
      continue;
    }
    const seen = new Set<string>();
    for (const t of themes) {
      const key = themeKey(t);
      if (seen.has(key)) continue;
      seen.add(key);
      const g = groups.get(key) ?? { spellings: [], stories: [] };
      g.spellings.push(t);
      g.stories.push(s);
      groups.set(key, g);
    }
  }
  return {
    groups: [...groups.entries()]
      .map(([key, g]) => ({
        key,
        // Prefer a spelling the member capitalized themselves.
        name: themeHeading(g.spellings.find((x) => x !== x.toLowerCase()) ?? g.spellings[0]),
        stories: [...g.stories].sort(byCompanyThenTitle),
      }))
      .sort((a, b) => a.name.localeCompare(b.name, "en", { sensitivity: "base" })),
    untagged: [...untagged].sort(byCompanyThenTitle),
  };
}

/** Distinct theme headings across the stories, A to Z. */
export function distinctThemes(stories: Groupable[]): string[] {
  return groupByTheme(stories).groups.map((g) => g.name);
}
