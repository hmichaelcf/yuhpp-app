// The route map: the rail every workspace page shows, and what each phase
// page holds. Structure and copy come from the public guide on yuhpp.com
// (job-search-system-guide.html), so the app and the guide read as one
// product. Prompts are listed by their name in the yuhpp_prompts sheet; the
// page looks each one up in the prompts table, so a renamed or retired prompt
// simply drops off the page rather than breaking it.
//
// Inline emphasis: *text* renders in italics, **text** in bold (see Rich).
// Numbers that live in settings appear as tokens, such as {exceptions}, and
// are filled in when the page renders; the apply-or-skip table is built from
// the g3_* settings for the same reason.

export type StopId =
  | "start"
  | "direction"
  | "positioning"
  | "search"
  | "application"
  | "interview"
  | "practice"
  | "offer"
  | "weekly"
  | "community"
  | "rejection";

export type RailItem =
  | { kind: "stop"; id: StopId; code: string; name: string; href: string; loop?: boolean }
  | { kind: "gate" }
  | { kind: "group"; label: string };

export const RAIL: RailItem[] = [
  { kind: "stop", id: "start", code: "Start", name: "Where you begin", href: "/" },
  { kind: "stop", id: "direction", code: "01", name: "Direction", href: "/phase/direction" },
  { kind: "gate" },
  { kind: "stop", id: "positioning", code: "02", name: "Positioning", href: "/phase/positioning" },
  { kind: "gate" },
  { kind: "stop", id: "search", code: "03", name: "Search and outreach", href: "/phase/search" },
  { kind: "gate" },
  { kind: "stop", id: "application", code: "04", name: "Application", href: "/phase/application" },
  { kind: "gate" },
  { kind: "stop", id: "interview", code: "05", name: "Interview", href: "/phase/interview" },
  { kind: "gate" },
  { kind: "stop", id: "practice", code: "Loop", name: "Practice loop", href: "/phase/practice", loop: true },
  { kind: "gate" },
  { kind: "stop", id: "offer", code: "06", name: "Offer", href: "/phase/offer" },
  { kind: "group", label: "Runs alongside" },
  { kind: "stop", id: "weekly", code: "Wk", name: "Weekly review", href: "/weekly" },
  { kind: "stop", id: "community", code: "GC", name: "Good company", href: "/community" },
  { kind: "stop", id: "rejection", code: "Rej", name: "After a rejection", href: "/phase/rejection" },
];

export type Table = { head: [string, string]; rows: { a: string; b: string; tone?: "go" | "stop" }[] };

export type Block =
  | { t: "purpose"; v: string }
  | { t: "label"; v: string }
  | { t: "prompts"; names: string[]; loop?: boolean; note?: string }
  | { t: "aside"; v: string }
  | { t: "note"; tone: "calm" | "warn" | "loop"; v: string }
  | { t: "gate"; num: string; title: string; body: string; criteria?: string[]; table?: Table | "apply" }
  | { t: "table"; table: Table }
  | { t: "checklist"; items: string[] }
  /** The member's resume as Phase 02 builds it (ResumePanel). */
  | { t: "resume" }
  /** The search brief and saved companies Phase 03 runs read (SearchBriefPanel). */
  | { t: "brief" };

export type Phase = {
  slug: string;
  stop: StopId;
  code: string;
  title: string;
  loop?: boolean;
  blocks: Block[];
};

export const PHASES: Phase[] = [
  {
    slug: "direction",
    stop: "direction",
    code: "Phase 01",
    title: "Direction",
    blocks: [
      { t: "purpose", v: "Decide what you are going after, before you build anything to go after it with." },
      { t: "label", v: "Run these in order" },
      {
        t: "prompts",
        names: ["Next Role Advisor", "Job Title Navigator", "Career Growth Analysis", "Resume Growth Advisor"],
      },
      {
        t: "gate",
        num: "Checkpoint 01",
        title: "Direction set",
        body: "Do not continue until you can state all three of these in one breath.",
        criteria: [
          "Three to five target job titles",
          "The level you are targeting",
          "Your hard constraints: location and work model, compensation floor, work authorization, anything else non-negotiable",
        ],
      },
      {
        t: "note",
        tone: "calm",
        v: "**Write the constraints down.** Several later prompts ask for them, and a target you cannot state in one sentence produces a search you cannot execute.",
      },
    ],
  },
  {
    slug: "positioning",
    stop: "positioning",
    code: "Phase 02",
    title: "Positioning",
    blocks: [
      {
        t: "purpose",
        v: "Build the assets. Every one of them is built against the direction you just set, which is why this phase comes second.",
      },
      { t: "resume" },
      { t: "label", v: "Resume: run in this order" },
      { t: "prompts", names: ["Experience Story Builder", "Resume Bullet Refinement", "Resume Value Builder"] },
      {
        t: "aside",
        v: "Value Builder runs last because it summarizes your finished bullets. Each step offers to save its output into your resume; nothing changes until you accept it.",
      },
      { t: "label", v: "LinkedIn" },
      { t: "prompts", names: ["LinkedIn Experience Optimizer", "LinkedIn About Architect"] },
      { t: "label", v: "Story bank" },
      { t: "prompts", names: ["STAR Story Scout", "STAR Story Shaper", "STAR to Bullet Converter"] },
      {
        t: "gate",
        num: "Checkpoint 02",
        title: "Assets ready",
        body: "You need all three of these before you start applying at volume.",
        criteria: [
          "Your resume, published in Yuhpp (or your own file, kept as final)",
          "A live LinkedIn profile",
          "Six to eight developed stories covering distinct themes",
        ],
      },
      {
        t: "note",
        tone: "calm",
        v: "Applying without a story bank means **building it under interview pressure**, one panel at a time.",
      },
    ],
  },
  {
    slug: "search",
    stop: "search",
    code: "Phase 03",
    title: "Search and outreach",
    blocks: [
      {
        t: "purpose",
        v: "Generate a real pipeline. Two tracks run at the same time, and the second one is the one most people skip.",
      },
      { t: "brief" },
      { t: "label", v: "Track A: finding roles" },
      { t: "prompts", names: ["Smart Job Search Builder", "Job Search Assistance Process"] },
      { t: "label", v: "Track B: finding people" },
      {
        t: "prompts",
        names: ["Networking Target Finder", "LinkedIn Outreach Strategist", "Referral Draft Builder"],
      },
      {
        t: "note",
        tone: "calm",
        v: "**Track B is not optional.** Referred applications convert at a materially different rate than cold ones, and outreach has a long lag, so it has to start early.",
      },
      {
        t: "gate",
        num: "Checkpoint 03",
        title: "Pipeline active",
        body: "If you have applications but no conversations, the problem is Track B.",
        criteria: ["Live roles identified against your target titles", "Outreach going out every week, not in bursts"],
      },
    ],
  },
  {
    slug: "application",
    stop: "application",
    code: "Phase 04",
    title: "Application",
    blocks: [
      { t: "purpose", v: "Decide what to apply to, and apply well. This is where discipline saves the most time." },
      { t: "label", v: "For every role, in this order" },
      { t: "prompts", names: ["Resume Match Meter", "Company Fit Crafter", "Job Application Responses"] },
      {
        t: "aside",
        v: "Then attempt a referral *before* you submit. Referral Draft Builder and LinkedIn Outreach Strategist are in Phase 03.",
      },
      {
        t: "gate",
        num: "Checkpoint 04",
        title: "Apply or skip",
        body: "Run the Match Meter first. Always. Then use the score.",
        table: "apply",
      },
      {
        t: "note",
        tone: "warn",
        v: "**Strategic exceptions: {exceptions} a week, maximum.** A role below threshold that you want badly enough is allowed, but only with a referral attempt, and it gets tracked separately so it does not distort your conversion data.",
      },
      {
        t: "aside",
        v: "The Match Meter also runs a Direction Check against Phase 01. A role can score well and still pull you sideways. Applying anyway is a valid choice. Applying without noticing is not.",
      },
    ],
  },
  {
    slug: "interview",
    stop: "interview",
    code: "Phase 05",
    title: "Interview",
    blocks: [
      { t: "purpose", v: "Prepare per round, not per company. Each round is asking a different question about you." },
      { t: "label", v: "Once per process" },
      { t: "prompts", names: ["Interview Intel Brief", "Map Accomplishments to Values"] },
      { t: "label", v: "Recruiter screen" },
      {
        t: "prompts",
        note: "Round one is short and fast, and it tests alignment before competence. Comp and logistics are the usual filters here, not depth.",
        names: ["Recruiter Screen Prep"],
      },
      { t: "label", v: "Hiring manager" },
      {
        t: "prompts",
        note: "The round that decides whether you advance. Run all three: what they will ask, your opener, and the walk through your background.",
        names: ["Interview Q&A Prepper", "Interview Introduction Builder", "Interview Background Builder"],
      },
      { t: "label", v: "Technical" },
      {
        t: "prompts",
        note: "Predicted questions by topic area, the method for answering each type, and two worked answers annotated so you can build your own.",
        names: ["Technical Interview Prep Guide"],
      },
      { t: "label", v: "Case or presentation" },
      {
        t: "prompts",
        note: "A deliverable round. Scope it to the time you actually have, put the recommendation first, and prepare to defend the decisions.",
        names: ["Case Study & Take-Home Prep Coach"],
      },
      { t: "label", v: "Panel or onsite" },
      {
        t: "prompts",
        note: "Several interviewers in sequence. Story allocation is what goes wrong, so this prompt assigns each story to one panelist and flags repeats.",
        names: ["Panel Interview Coach"],
      },
      { t: "label", v: "Within 24 hours of every round" },
      { t: "prompts", names: ["Thank-You Note Writer"] },
      {
        t: "note",
        tone: "calm",
        v: "**Carry the story usage log forward.** Hand it to the prep prompt for the next round. Panels compare notes, and telling the same story twice in one process weakens both tellings.",
      },
      {
        t: "gate",
        num: "Checkpoint 05",
        title: "Round ready",
        body: "There is no universal prep stack. What you run depends on the round type, but all four of these hold for every round. Prep read silently is not preparation.",
        criteria: [
          "You know which round type this is, and you ran that stack rather than all of them",
          "The Intel Brief is current, refreshed if the last one is more than two weeks old",
          "Behavioral rounds only: your stories are assigned, and none is being told twice in this process",
          "At least one practice session, scored on the rubric that matches this round type",
        ],
      },
    ],
  },
  {
    slug: "practice",
    stop: "practice",
    code: "Runs alongside Phase 05",
    title: "The practice loop",
    loop: true,
    blocks: [
      { t: "purpose", v: "Find out which answers are actually weak, then fix *the right thing*." },
      { t: "prompts", loop: true, names: ["Practice Session Kit Builder", "Self-Review Analyzer"] },
      {
        t: "aside",
        v: "Two or three short sessions beat one long one. Score every answer immediately after giving it, not at the end of the session.",
      },
      { t: "label", v: "Two rubrics. Pick the one that matches the round." },
      {
        t: "table",
        table: {
          head: ["Behavioral rounds", "Technical and case rounds"],
          rows: [
            { a: "Structure", b: "Approach: was one chosen and stated before you started solving" },
            { a: "Specificity", b: "Reasoning aloud: was your thinking audible, or did you go quiet" },
            { a: "Quantified result", b: "Tradeoffs: were alternatives named and the choice justified" },
            { a: "Length discipline", b: "Handling the follow-up: did you adapt without abandoning a sound approach" },
            { a: "Close", b: "Time management: did you reach a complete result in the time available" },
          ],
        },
      },
      {
        t: "gate",
        num: "Checkpoint 06",
        title: "Fix or repeat",
        body: "The rule that makes this loop work: repetition only fixes delivery. Everything else routes backward.",
        table: {
          head: ["What is actually wrong", "Where it goes"],
          rows: [
            { a: "Rambling", b: "The story has no structure. STAR Story Shaper." },
            { a: "No number", b: "The story has no defensible metric. Experience Story Builder." },
            { a: "Wrong story", b: "Chosen badly, or one story used everywhere. Map Accomplishments to Values." },
            { a: "Caught cold", b: "A question type keeps surprising you. Interview Q&A Prepper, or Panel Interview Coach." },
            { a: "Knowledge gap", b: "You did not know the material. Study, not reps. Technical Interview Prep Guide." },
            { a: "The deliverable", b: "Scoping or defending a case or take-home. Case Study & Take-Home Prep Coach." },
            { a: "Just delivery", b: "The story is fine. More reps. Practice Session Kit Builder.", tone: "go" },
          ],
        },
      },
      {
        t: "note",
        tone: "loop",
        v: "If an answer scores **below 3 on structure or on quantified result**, more reps will only make the weak version fluent. That is a content problem. Send it back.",
      },
    ],
  },
  {
    slug: "offer",
    stop: "offer",
    code: "Phase 06",
    title: "Offer",
    blocks: [
      { t: "purpose", v: "Move the numbers first, then decide. In that order." },
      { t: "label", v: "Run these in order" },
      { t: "prompts", names: ["Reference Prep Coach", "Offer Negotiation Strategist", "Offer Decision Framework"] },
      {
        t: "note",
        tone: "warn",
        v: "**Do not reverse the last two.** Deciding against unnegotiated numbers is deciding against the wrong data.",
      },
      {
        t: "aside",
        v: "References cannot wait for the offer. Reference calls typically happen within days of a decision, so confirm the slate while you are still interviewing.",
      },
      { t: "label", v: "The four rules, if you remember nothing else" },
      {
        t: "checklist",
        items: [
          "**Sequence over speed.** An asset built before the direction is set will be rebuilt.",
          "**Score before you apply.** The Match Meter exists so volume does not replace judgment.",
          "**Diagnose before you repeat.** Practicing a weak story more does not fix the story.",
          "**Review weekly.** The bottleneck moves. Your effort should move with it.",
        ],
      },
    ],
  },
  {
    slug: "rejection",
    stop: "rejection",
    code: "When it does not work out",
    title: "After a rejection",
    blocks: [
      { t: "purpose", v: "Three things cause a rejection. Only one of them is your qualifications." },
      { t: "prompts", names: ["Interview Improvement Suggestions"] },
      {
        t: "table",
        table: {
          head: ["What it was", "Where it goes"],
          rows: [
            { a: "A gap", b: "Resume Growth Advisor, and a longer plan before you reapply." },
            { a: "Execution", b: "The practice loop. The application was fine; the answers were not." },
            { a: "The pool", b: "Nothing to fix. The application was right, and the answer is volume.", tone: "go" },
          ],
        },
      },
      {
        t: "aside",
        v: "Assume the first one only after the prompt has ruled out the other two. Most people assume it first and rebuild things that were never broken.",
      },
    ],
  },
];

/** "If you are already mid-search, start here" from the guide's opening panel. */
export const ENTRIES: { q: string; href: string; a: string }[] = [
  { q: "I have no idea what I actually want next", href: "/phase/direction", a: "Phase 01" },
  { q: "My resume and LinkedIn are not ready", href: "/phase/positioning", a: "Phase 02" },
  { q: "I am applying and hearing nothing back", href: "/phase/application", a: "Phase 04" },
  { q: "I get screens, and they end there", href: "/phase/interview", a: "Phase 05" },
  { q: "I get onsites, and I lose them", href: "/phase/practice", a: "Practice loop" },
  { q: "I have a take-home or a case study due", href: "/phase/interview", a: "Phase 05" },
  { q: "I have an offer in hand", href: "/phase/offer", a: "Phase 06" },
];

export function phaseBySlug(slug: string): Phase | undefined {
  return PHASES.find((p) => p.slug === slug);
}

/**
 * The comparison key for a prompt name: lower case, letters and digits only,
 * so "Interview Q&A Prepper" and "Interview QA Prepper" match.
 */
export function nameKey(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** Prompt names the Smart Job Search Builder runs under, for saving searches. */
export const SEARCH_BUILDER = "Smart Job Search Builder";
export const WEEKLY_REVIEW = "Weekly Pipeline Review";

/** Where a prompt sits on the route, for the rail and the breadcrumb on its runs. */
export function placeOfPrompt(promptName: string): { stop: StopId; label: string; href: string } | null {
  const key = nameKey(promptName);
  if (key === nameKey(WEEKLY_REVIEW)) return { stop: "weekly", label: "Weekly review", href: "/weekly" };
  for (const phase of PHASES) {
    for (const b of phase.blocks) {
      if (b.t === "prompts" && b.names.some((n) => nameKey(n) === key)) {
        return { stop: phase.stop, label: phase.title, href: `/phase/${phase.slug}` };
      }
    }
  }
  return null;
}
