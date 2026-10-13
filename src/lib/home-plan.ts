import "server-only";
import { briefTitles, type SearchBrief } from "./brief-shape";
import { PHASE_INFO, nextPhase, phaseLabel, type PhaseId } from "./phases";
import { nameKey } from "./route-map";
import type { PromptActivity } from "./runs";
import type { Resume } from "./resumes";
import type { Settings } from "./settings";
import type { WeeklyMetrics } from "./weekly";
import type { WorkspaceCounts } from "./workspace";

// Home's "Your next step": for the member's phase, the checkpoint's checks
// worked out from their own data, and the first unmet check turned into one
// action. Checks a member can only judge themselves (a live LinkedIn profile,
// hard constraints) are shown as "Your call" and never block the checkpoint.
// When every data check is met, Home suggests moving to the next phase.

export type CheckState = "done" | "part" | "todo" | "self";

export type Check = { label: string; state: CheckState; detail: string };

/** What the card's main button does: start a prompt, or open a page. */
export type Action = { kind: "prompt"; name: string; label: string } | { kind: "link"; href: string; label: string };

export type NextStep = {
  gate: string;
  title: string;
  body: string;
  action: Action;
  alt: { href: string; label: string } | null;
  checks: Check[];
  /** 0 to 1, across the data checks only. */
  progress: number;
  /** Every data check met: the card says so and Home offers the next phase. */
  met: boolean;
  next: { id: PhaseId; label: string } | null;
};

export type PlanInput = {
  phase: PhaseId;
  resume: Resume | null;
  useOwnFile: boolean;
  counts: WorkspaceCounts;
  brief: SearchBrief;
  weekly: WeeklyMetrics;
  settings: Settings;
  /** Latest run of a prompt by its sheet name, if the member has run it. */
  ran: (promptName: string) => PromptActivity | undefined;
};

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

function daysSince(sqlite: string): number {
  const t = new Date(`${sqlite.replace(" ", "T")}Z`).getTime();
  return Math.floor((Date.now() - t) / 86_400_000);
}

type Step = Check & {
  /** The action shown while this check is the first unmet one. */
  title?: string;
  body?: string;
  action?: Action;
  alt?: { href: string; label: string } | null;
};

function build(
  phase: PhaseId,
  gate: string,
  steps: Step[],
  whenMet: { title: string; body: string; action: Action; alt?: { href: string; label: string } | null },
): NextStep {
  const data = steps.filter((s) => s.state !== "self");
  const score = data.reduce((sum, s) => sum + (s.state === "done" ? 1 : s.state === "part" ? 0.5 : 0), 0);
  const first = data.find((s) => s.state !== "done" && s.action);
  const met = !first;
  const np = nextPhase(phase);
  return {
    gate,
    title: first?.title ?? whenMet.title,
    body: first?.body ?? whenMet.body,
    action: first?.action ?? whenMet.action,
    alt: first ? (first.alt ?? null) : (whenMet.alt ?? null),
    checks: steps.map(({ label, state, detail }) => ({ label, state, detail })),
    progress: data.length ? score / data.length : 1,
    met,
    next: met && np ? { id: np, label: phaseLabel(np) } : null,
  };
}

export function nextStep(p: PlanInput): NextStep {
  const { phase, counts, brief, weekly, settings, ran } = p;
  const phaseLink = { href: PHASE_INFO[phase].href, label: `Or see all of ${phaseLabel(phase)}` };

  switch (phase) {
    case "direction": {
      const titles = briefTitles(brief).length;
      const advisor = ran("Next Role Advisor");
      return build(
        phase,
        "Checkpoint 01",
        [
          {
            label: "Three to five target job titles",
            state: titles >= 3 ? "done" : titles > 0 ? "part" : "todo",
            detail: `${titles} of 3`,
            ...(p.resume
              ? advisor
                ? {
                    title: "Turn your direction into titles",
                    body: "Job Title Navigator turns the roles Next Role Advisor named into the exact titles to search on, split into strong matches and stretches. Save three to five to your search brief.",
                    action: { kind: "prompt", name: "Job Title Navigator", label: "Run Job Title Navigator" },
                    alt: phaseLink,
                  }
                : {
                    title: "Name the roles you are going after",
                    body: "Next Role Advisor reads your resume and names the roles you can credibly go after, with a confidence score on each.",
                    action: { kind: "prompt", name: "Next Role Advisor", label: "Run Next Role Advisor" },
                    alt: phaseLink,
                  }
              : {
                  title: "Save your resume first",
                  body: "Every step in Direction reads your resume. Upload it or paste it once and every prompt can use it.",
                  action: { kind: "link", href: "/profile", label: "Add your resume" },
                  alt: phaseLink,
                }),
          },
          {
            label: "The level you are targeting",
            state: brief.level ? "done" : "todo",
            detail: brief.level ?? "Not set",
            title: "Set the level you are targeting",
            body: "Add it to your search brief so every search and every score is calibrated to it.",
            action: { kind: "link", href: "/phase/search", label: "Open your search brief" },
            alt: phaseLink,
          },
          {
            label: "Your hard constraints: location, pay floor, work authorization",
            state: "self",
            detail: "Your call",
          },
        ],
        {
          title: "Your direction is set",
          body: "You have target titles and a level. Write your hard constraints down too: several later steps ask for them.",
          action: { kind: "link", href: "/phase/positioning", label: "Go to 02 Positioning" },
        },
      );
    }

    case "positioning": {
      const min = settings.number("story_bank_target_min", 6);
      const max = settings.number("story_bank_target_max", 8);
      const built = p.resume?.source === "built";
      const resumeReady = !!p.resume && (built || p.useOwnFile);
      const dev = counts.developedStories;
      return build(
        phase,
        "Checkpoint 02",
        [
          {
            label: "A current resume",
            state: resumeReady ? "done" : p.resume ? "part" : "todo",
            detail: built ? "Published" : resumeReady ? "Your own file" : p.resume ? "Not rebuilt yet" : "Not added",
            title: p.resume ? "Rebuild your resume in the template" : "Add your resume",
            body: p.resume
              ? "Yuhpp rebuilds your resume section by section in its template, then you publish it. Every step reads the published version."
              : "Upload it or paste it once. Yuhpp then rebuilds it section by section in its template.",
            action: p.resume
              ? { kind: "link", href: "/resume", label: "Open your resume" }
              : { kind: "link", href: "/profile", label: "Add your resume" },
            alt: phaseLink,
          },
          { label: "A live LinkedIn profile", state: "self", detail: "Your call" },
          {
            label: `${min} to ${max} developed stories covering distinct themes`,
            state: dev >= min ? "done" : dev > 0 ? "part" : "todo",
            detail: `${dev} of ${min}`,
            title: "Finish your story bank",
            body: `You have ${plural(dev, "developed story", "developed stories")}. Interviews draw on ${min} to ${max}, each covering a different theme. STAR Story Scout finds the ones already in your resume.`,
            action: { kind: "prompt", name: "STAR Story Scout", label: "Run STAR Story Scout" },
            alt: { href: "/stories", label: "Or add a story yourself" },
          },
        ],
        {
          title: "Your assets are ready",
          body: "Your resume is current and your story bank is full. If your LinkedIn profile is live too, you are ready to search.",
          action: { kind: "link", href: "/phase/search", label: "Go to 03 Search and outreach" },
        },
      );
    }

    case "search": {
      const { hit, of } = weekly.outreachWeeks;
      const finder = ran("Networking Target Finder");
      return build(
        phase,
        "Checkpoint 03",
        [
          {
            label: "Live roles against your target titles",
            state: counts.searches > 0 ? "done" : "todo",
            detail: counts.searches ? `${counts.searches} saved` : "None saved",
            title: "Find live roles",
            body: "Smart Job Search Builder turns your search brief into searches that surface postings the job boards bury. Save the ones worth running again.",
            action: { kind: "prompt", name: "Smart Job Search Builder", label: "Run Smart Job Search Builder" },
            alt: phaseLink,
          },
          {
            label: "Outreach every week, not in bursts",
            state: of >= 2 && hit === of ? "done" : hit > 0 ? "part" : "todo",
            detail: of ? `${hit} of ${of} weeks` : "No weeks logged",
            title: "Get outreach going every week",
            body: finder
              ? "LinkedIn Outreach Strategist writes the first message and the follow-up for the people you found. Replies take time, so keep it weekly."
              : "Networking Target Finder works out who to contact and who first. Referred applications convert better, and replies take time, so start now.",
            action: finder
              ? { kind: "prompt", name: "LinkedIn Outreach Strategist", label: "Run LinkedIn Outreach Strategist" }
              : { kind: "prompt", name: "Networking Target Finder", label: "Run Networking Target Finder" },
            alt: { href: "/weekly", label: "Or log this week" },
          },
        ],
        {
          title: "Your pipeline is active",
          body: "You have live roles and outreach going out every week. Keep both running while you apply.",
          action: { kind: "link", href: "/weekly", label: "Log this week" },
          alt: phaseLink,
        },
      );
    }

    case "application": {
      const meter = ran("Resume Match Meter");
      const apps = weekly.thisWeek?.applications ?? 0;
      const cutoff = settings.number("g3_apply_min", 7).toFixed(1);
      return build(
        phase,
        "Checkpoint 04",
        [
          {
            label: "Every role scored before you apply",
            state: meter ? "done" : "todo",
            detail: meter ? `${plural(meter.count, "score", "scores")}` : "None yet",
            title: "Score the next role before you apply",
            body: `Run the Match Meter on every role. ${cutoff} and up, apply and attempt a referral first. Under ${cutoff}, skip.`,
            action: { kind: "prompt", name: "Resume Match Meter", label: "Run Resume Match Meter" },
            alt: phaseLink,
          },
          {
            label: "Applications logged this week",
            state: apps > 0 ? "done" : "todo",
            detail: weekly.thisWeek ? String(apps) : "Not logged",
            title: "Log this week",
            body: "Your weekly numbers show which stage is converting. Estimates are fine.",
            action: { kind: "link", href: "/weekly", label: "Log this week" },
            alt: phaseLink,
          },
        ],
        {
          title: "Keep scoring before you apply",
          body: `Every role gets the Match Meter first. ${cutoff} and up, apply and attempt a referral first. Under ${cutoff}, skip.`,
          action: { kind: "prompt", name: "Resume Match Meter", label: "Run Resume Match Meter" },
          alt: phaseLink,
        },
      );
    }

    case "interview": {
      const maxAge = settings.number("intel_brief_max_age_days", 14);
      const intel = ran("Interview Intel Brief");
      const intelAge = intel ? daysSince(intel.lastAt) : null;
      const kit = ran("Practice Session Kit Builder");
      const review = ran("Self-Review Analyzer");
      const practiced = [kit, review].some((r) => r && daysSince(r.lastAt) <= maxAge);
      return build(
        phase,
        "Checkpoint 05",
        [
          { label: "You know the round type and ran that stack", state: "self", detail: "Your call" },
          {
            label: `The Intel Brief is under ${maxAge} days old`,
            state: intelAge !== null && intelAge <= maxAge ? "done" : intel ? "part" : "todo",
            detail: intelAge === null ? "Not run" : intelAge === 0 ? "Today" : `${plural(intelAge, "day", "days")} old`,
            title: intel ? "Refresh your Intel Brief" : "Research the company first",
            body: "Interview Intel Brief curates what is worth referencing about the company, from the last six months, so you are not reading everything the night before.",
            action: { kind: "prompt", name: "Interview Intel Brief", label: "Run Interview Intel Brief" },
            alt: phaseLink,
          },
          { label: "Behavioral rounds: stories assigned, none told twice", state: "self", detail: "Your call" },
          {
            label: "At least one scored practice session",
            state: practiced ? "done" : "todo",
            detail: practiced ? "Done" : "None recent",
            title: "Do one scored practice session",
            body: "Prep you only read silently does not count. Practice Session Kit Builder gives you the questions and the scoring card; you run the reps.",
            action: { kind: "prompt", name: "Practice Session Kit Builder", label: "Run Practice Session Kit Builder" },
            alt: { href: "/phase/practice", label: "Or open the practice loop" },
          },
        ],
        {
          title: "Ready for your next round",
          body: "Pick the round type and run that stack. Within 24 hours of every round, send thank-you notes and carry the story log forward.",
          action: { kind: "link", href: "/phase/interview", label: "Open the round stacks" },
        },
      );
    }

    case "practice": {
      const kit = ran("Practice Session Kit Builder");
      const review = ran("Self-Review Analyzer");
      return build(
        phase,
        "Checkpoint 06",
        [
          {
            label: "A practice kit built",
            state: kit ? "done" : "todo",
            detail: kit ? "Built" : "Not yet",
            title: "Build your practice kit",
            body: "Practice Session Kit Builder gives you the question set, the scoring card, and the session plan. Two or three short sessions beat one long one.",
            action: { kind: "prompt", name: "Practice Session Kit Builder", label: "Run Practice Session Kit Builder" },
            alt: phaseLink,
          },
          {
            label: "Your answers reviewed and routed",
            state: review ? "done" : "todo",
            detail: review ? `${plural(review.count, "review", "reviews")}` : "Not yet",
            title: "Review the answers you gave",
            body: "Paste what you actually said into Self-Review Analyzer. It names the failure behind each weak answer and where to fix it. Repetition only fixes delivery.",
            action: { kind: "prompt", name: "Self-Review Analyzer", label: "Run Self-Review Analyzer" },
            alt: phaseLink,
          },
        ],
        {
          title: "Fix, then repeat",
          body: "Send weak stories back to the step that fixes them, and only rep the ones that are just delivery.",
          action: { kind: "prompt", name: "Self-Review Analyzer", label: "Run Self-Review Analyzer" },
          alt: phaseLink,
        },
      );
    }

    case "offer": {
      const refs = ran("Reference Prep Coach");
      const neg = ran("Offer Negotiation Strategist");
      const dec = ran("Offer Decision Framework");
      return build(
        phase,
        "Phase 06",
        [
          {
            label: "References briefed",
            state: refs ? "done" : "todo",
            detail: refs ? "Done" : "Not yet",
            title: "Brief your references",
            body: "Reference calls usually happen within days of a decision. Reference Prep Coach picks the slate and briefs each person on the theme only they can cover.",
            action: { kind: "prompt", name: "Reference Prep Coach", label: "Run Reference Prep Coach" },
            alt: phaseLink,
          },
          {
            label: "The numbers moved",
            state: neg ? "done" : "todo",
            detail: neg ? "Done" : "Not yet",
            title: "Negotiate before you decide",
            body: "Offer Negotiation Strategist benchmarks the market and scripts the ask around leverage you actually have.",
            action: { kind: "prompt", name: "Offer Negotiation Strategist", label: "Run Offer Negotiation Strategist" },
            alt: phaseLink,
          },
          {
            label: "The decision made against negotiated numbers",
            state: dec ? "done" : "todo",
            detail: dec ? "Done" : "Not yet",
            title: "Make the decision",
            body: "Offer Decision Framework weighs what you care about, tests each offer against your direction, and names the risks.",
            action: { kind: "prompt", name: "Offer Decision Framework", label: "Run Offer Decision Framework" },
            alt: phaseLink,
          },
        ],
        {
          title: "You have done the work",
          body: "References briefed, numbers negotiated, decision made. Congratulations on the offer.",
          action: { kind: "link", href: "/weekly", label: "Log this week" },
        },
      );
    }
  }
}

/** Looks up a member's latest run by the prompt's sheet name. */
export function activityByName(
  catalog: { key: string; name: string }[],
  activity: Map<string, PromptActivity>,
): (name: string) => PromptActivity | undefined {
  const keyByName = new Map(catalog.map((c) => [nameKey(c.name), c.key]));
  return (name) => {
    const key = keyByName.get(nameKey(name));
    return key ? activity.get(key) : undefined;
  };
}
