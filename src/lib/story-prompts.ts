import { nameKey } from "./route-map";

// Which prompts read the member's story bank. Listed by their names in the
// yuhpp_prompts sheet and matched the way the route map matches them (letter
// case and punctuation ignored), so a renamed prompt stops reading the bank
// until its name is updated here.
//
// The rule for this list: a prompt reads the bank when its own instructions
// ask for stories, STAR accomplishments, or experience examples. Self-Review
// Analyzer is left out on purpose: it scores only what the candidate actually
// said in an answer, and the bank would invite comparing against it.

/** Prompts that find, build, and shape stories. They read the bank so they know what is already in it. */
export const STORY_BUILDERS = ["STAR Story Scout", "Experience Story Builder", "STAR Story Shaper"];

/** Prompts that put the bank to work in applications and interviews. */
export const STORY_USERS = [
  "STAR to Bullet Converter",
  "Map Accomplishments to Values",
  "Panel Interview Coach",
  "Practice Session Kit Builder",
  "Job Application Responses",
  "Thank-You Note Writer",
  "Interview Improvement Suggestions",
];

const READERS = new Set([...STORY_BUILDERS, ...STORY_USERS].map(nameKey));

export function readsStoryBank(promptName: string): boolean {
  return READERS.has(nameKey(promptName));
}

/**
 * One-click actions on an open story in the bank. Each starts a run of the
 * prompt with a first message that names the story, ready to send.
 */
export const STORY_ACTIONS = [
  { prompt: "STAR Story Shaper", label: "Shape it into an answer", title: "Start STAR Story Shaper with this story" },
  { prompt: "STAR to Bullet Converter", label: "Make interview notes", title: "Start STAR to Bullet Converter with this story" },
];

/** The first message a run started from one story arrives with. */
export function storyStarter(promptName: string, label: string): string {
  const key = nameKey(promptName);
  if (key === nameKey("STAR Story Shaper")) return `Shape this story from my bank into a spoken answer: "${label}".`;
  if (key === nameKey("STAR to Bullet Converter")) return `Turn this story from my bank into interview notes: "${label}".`;
  return `Use this story from my bank: "${label}".`;
}
