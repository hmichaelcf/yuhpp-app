import "server-only";
import type { Settings } from "./settings";
import type { BankSummary } from "./story-bank-summary";
import { splitThemes, storyLabel, themeHeading, themeKey } from "./story-themes";
import { isDeveloped, listStories, type Story } from "./workspace";

// The member's story bank as a run reads it: written into the system frame
// for prompts that ask for stories (src/lib/story-prompts.ts) and rebuilt on
// every turn, so a story added or edited in the bank reaches an open run on
// its next message. Each run also remembers what it last read
// (runs.story_bank_seen), so it can be told exactly what changed.

export type StoryBankFrame = {
  /** The stories, ready for the frame. Empty when the bank is empty. */
  text: string;
  /** Stories in the bank. */
  total: number;
  /** Stories that fit in this run. */
  included: number;
  /** Themes across the stories that fit. */
  themes: number;
  /** Labels of stories left out because the bank is larger than one run holds. */
  omitted: string[];
  /** Ids of the stories left out. */
  omittedIds: number[];
  /** For each story: a fingerprint of everything the run reads, and its label. */
  seen: Record<string, [string, string]>;
};

export type BankChanges = { added: string[]; edited: string[]; removed: string[] };

const PARTS = [
  ["situation", "Situation"],
  ["task", "Task"],
  ["action", "Action"],
  ["result", "Result"],
] as const;

/** Keeps a member's text from closing or opening the frame's story tags. */
function inert(text: string): string {
  return text.replace(/<(\/?)(story_bank|story)\b/gi, "‹$1$2");
}

/** A short fingerprint of a string (FNV-1a), enough to notice an edit. */
function fingerprint(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

function storyBlock(s: Story): string {
  const missing = PARTS.filter(([k]) => !s[k]).map(([, label]) => label);
  const themes = splitThemes(s.themes).map(themeHeading);
  return [
    "<story>",
    `Label: ${inert(storyLabel(s))}`,
    `Themes: ${themes.length ? inert(themes.join(", ")) : "none tagged yet"}`,
    `Status: ${missing.length ? `incomplete, missing ${missing.join(" and ")}` : "complete"}`,
    ...PARTS.map(([k, label]) => `${label}: ${s[k] ? inert(s[k]) : "(not written yet)"}`),
    "</story>",
  ].join("\n");
}

/**
 * Writes the bank for one run, within `maxChars`. Complete stories go first,
 * then incomplete ones, each group most recently edited first; whatever does
 * not fit is named in `omitted` so the run can ask for it.
 */
export function storyBankForFrame(stories: Story[], maxChars: number): StoryBankFrame {
  const ordered = [...stories.filter(isDeveloped), ...stories.filter((s) => !isDeveloped(s))];
  const blocks: string[] = [];
  const omitted: string[] = [];
  const omittedIds: number[] = [];
  const themes = new Set<string>();
  const seen: Record<string, [string, string]> = {};
  let used = 0;
  for (const s of ordered) {
    const block = storyBlock(s);
    seen[String(s.id)] = [fingerprint(block), storyLabel(s)];
    if (used + block.length > maxChars) {
      omitted.push(storyLabel(s));
      omittedIds.push(s.id);
      continue;
    }
    blocks.push(block);
    used += block.length + 2;
    for (const t of splitThemes(s.themes)) themes.add(themeKey(t));
  }
  return {
    text: blocks.join("\n\n"),
    total: stories.length,
    included: blocks.length,
    themes: themes.size,
    omitted,
    omittedIds,
    seen,
  };
}

/**
 * What changed in the bank since the run last read it: stories added,
 * edited (any part, the name, the company, or the themes), or removed.
 * Null when the run has not read the bank before or nothing changed.
 */
export function bankChanges(previous: string | null, now: StoryBankFrame): BankChanges | null {
  if (!previous) return null;
  let before: Record<string, [string, string]>;
  try {
    before = JSON.parse(previous);
  } catch {
    return null;
  }
  const changes: BankChanges = { added: [], edited: [], removed: [] };
  for (const [id, [hash, label]] of Object.entries(now.seen)) {
    const was = before[id];
    if (!was) changes.added.push(label);
    else if (was[0] !== hash) changes.edited.push(label);
  }
  for (const [id, [, label]] of Object.entries(before)) {
    if (!now.seen[id]) changes.removed.push(label);
  }
  return changes.added.length || changes.edited.length || changes.removed.length ? changes : null;
}

/** The bank for the run page: the stories a run reads and the counts it shows. */
export function bankSummary(stories: Story[], maxChars: number): BankSummary {
  const frame = storyBankForFrame(stories, maxChars);
  const omitted = new Set(frame.omittedIds);
  return {
    stories: stories
      .filter((s) => !omitted.has(s.id))
      .map((s) => ({
        id: s.id,
        title: s.title,
        company: s.company,
        themes: s.themes,
        label: storyLabel(s),
        complete: isDeveloped(s),
      })),
    total: frame.total,
    themes: frame.themes,
  };
}

export function storyBankMaxChars(settings: Settings): number {
  return settings.number("story_bank_max_chars", 60000);
}

/** The member's bank as their runs read it. */
export async function loadStoryBankFrame(db: D1Database, memberId: string, settings: Settings): Promise<StoryBankFrame> {
  return storyBankForFrame(await listStories(db, memberId), storyBankMaxChars(settings));
}
