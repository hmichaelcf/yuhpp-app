import Link from "next/link";
import { CompanyList, SearchBriefForm } from "./SearchBriefForm";
import type { SearchBrief } from "@/lib/brief-shape";
import { shortDate } from "@/lib/dates";
import type { ResumeState } from "@/lib/resume-record";
import type { TargetCompany } from "@/lib/search-brief";

// The top of Phase 03: which resume searches read, the search brief every
// run starts from, and the companies saved for Track B.

export default function SearchBriefPanel({
  brief,
  companies,
  state,
}: {
  brief: SearchBrief;
  companies: TargetCompany[];
  state: ResumeState;
}) {
  const { current, version, unpublished } = state;
  const resumeLine = current
    ? current.source === "built"
      ? `Your resume v${version}, published ${shortDate(current.created_at)}`
      : `Your resume, saved ${shortDate(current.created_at)}`
    : null;

  return (
    <>
      {unpublished ? (
        <div className="note warn-soft" role="status">
          <p>
            <strong>Your resume draft has changes you have not published.</strong> Searches here still read{" "}
            {resumeLine ? resumeLine.replace(/^Your/, "your") : "nothing yet"}. <Link href="/resume">Review and publish</Link>
          </p>
        </div>
      ) : null}

      <section className="brief-panel" id="brief" aria-labelledby="brief-title">
        <p className="resume-panel-eyebrow">Search brief</p>
        <h2 id="brief-title" className="resume-panel-title">
          What every search here <em>starts from.</em>
        </h2>
        <p className="resume-panel-lede">
          Both tracks read it, so you never retype your titles or location. Change it here and the next run picks it
          up. {resumeLine ? `${resumeLine}, is loaded too.` : <Link href="/profile">Save your resume</Link>}
        </p>
        <SearchBriefForm brief={brief} />

        <div className="brief-companies" id="companies">
          <p className="section-label">Saved companies</p>
          <CompanyList companies={companies} />
        </div>
      </section>
    </>
  );
}
