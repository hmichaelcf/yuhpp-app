import "server-only";
import type { Member } from "./members";
import { briefText, briefTitles, type SearchBrief } from "./brief-shape";
import { resumeState, type ResumeState } from "./resume-record";
import { blockKinds, readsBrief, readsCompanies, writesResume, type BlockKind } from "./resume-prompts";
import { resumeText } from "./resume-shape";
import { savedOnDate } from "./resumes";
import { companiesText, listCompanies, loadBrief, type TargetCompany } from "./search-brief";
import type { Settings } from "./settings";

// What one step reads from the member's workspace, worked out the same way
// for the run page (to show it) and the messages route (to send it).
//
// - Steps that write resume sections read the working draft, with bullet
//   ids, so what they rewrite can be saved back.
// - Every other step reads the resume runs read now: the version published
//   from Yuhpp, or the member's upload.
// - Phase 03 steps read the search brief; Track B reads saved companies.

export type RunResume = {
  text: string;
  savedOn: string;
  isDraft: boolean;
  /** How the run page names it: "Your resume draft", "Your resume v3". */
  label: string;
  detail: string;
  href: string;
  link: string;
};

export type RunReads = {
  state: ResumeState;
  resume: RunResume | null;
  blocks: BlockKind[];
  brief?: SearchBrief;
  /** The brief as the frame sends it; null when it holds no titles or location. */
  briefText?: string | null;
  companies?: TargetCompany[];
  companiesText?: string;
};

function today(): string {
  return new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "America/Los_Angeles",
  });
}

export async function loadRunReads(
  db: D1Database,
  member: Pick<Member, "id" | "email">,
  promptName: string,
  settings: Settings,
): Promise<RunReads> {
  const state = await resumeState(db, member.id, member.email);
  const { draft, current } = state;
  const blocks = blockKinds(promptName);

  let resume: RunResume | null = null;
  if (writesResume(promptName) && draft.hasContent) {
    const savedOn = draft.updatedAt ? savedOnDate(draft.updatedAt) : today();
    resume = {
      text: resumeText(draft.data, { withIds: true }),
      savedOn,
      isDraft: true,
      label: "Your resume draft",
      detail: `updated ${savedOn}`,
      href: "/resume",
      link: "Open",
    };
  } else if (current) {
    const savedOn = savedOnDate(current.created_at);
    const built = current.source === "built";
    resume = {
      text: current.text,
      savedOn,
      isDraft: false,
      label: built ? `Your resume v${state.version}` : "Your resume",
      detail: built ? `published ${savedOn}` : `saved ${savedOn}`,
      href: built ? "/resume" : "/profile",
      link: "Change",
    };
  }

  const reads: RunReads = { state, resume, blocks };
  const fromResume = { location: draft.data.contact.location, tools: draft.data.tools };
  if (readsBrief(promptName) || blocks.includes("titles")) {
    const brief = await loadBrief(db, member.id, settings, fromResume);
    reads.brief = brief;
    if (readsBrief(promptName)) {
      reads.briefText = briefTitles(brief).length || brief.location ? briefText(brief) : null;
    }
  }
  if (readsCompanies(promptName) || blocks.includes("companies")) {
    const companies = await listCompanies(db, member.id);
    reads.companies = companies;
    if (readsCompanies(promptName)) {
      reads.companiesText = companiesText(companies, settings.number("target_companies_in_frame", 25));
    }
  }
  return reads;
}
