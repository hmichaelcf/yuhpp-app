import Link from "next/link";
import { ImportButton } from "./ResumeTools";
import { shortDate } from "@/lib/dates";
import type { ResumeState } from "@/lib/resume-record";
import { sectionStatuses, type SectionStatus } from "@/lib/resume-shape";

// The resume as Phase 02 builds it: one line per template section, what fills
// it, and whether it is ready. Shown at the top of the Positioning page and on
// the resume page.

export function SectionList({ statuses }: { statuses: SectionStatus[] }) {
  return (
    <ul className="section-status">
      {statuses.map((s) => (
        <li key={s.key}>
          <span className="ss-name">
            {s.label} <span className="ss-detail">&middot; {s.detail}</span>
          </span>
          <span className="ss-source">{s.source}</span>
          <span className={`ss-pill ${s.state}`}>{s.pill}</span>
        </li>
      ))}
    </ul>
  );
}

/** Where the member's resume stands, in one sentence. */
export function resumeStatusLine(state: ResumeState): string {
  const { current, version, useOwnFile, unpublished, upload } = state;
  if (useOwnFile && upload) {
    return `You are keeping the file you uploaded on ${shortDate(upload.created_at)}. Every run reads it, and searches use your search brief.`;
  }
  if (current?.source === "built") {
    return unpublished
      ? `v${version} was published on ${shortDate(current.created_at)}. Your draft has changes that runs do not see until you publish.`
      : `v${version} was published on ${shortDate(current.created_at)}. Every run reads it.`;
  }
  if (current) {
    return `Not published yet. Runs read the resume you saved on ${shortDate(current.created_at)} until you publish this one.`;
  }
  return "Not published yet, and no resume is saved. Runs will ask for one.";
}

export default function ResumePanel({ state, bulletMax }: { state: ResumeState; bulletMax: number }) {
  const { draft, upload } = state;
  const statuses = sectionStatuses(draft.data, bulletMax);
  const ready = statuses.filter((s) => s.state !== "needs").length;

  return (
    <section className="resume-panel" aria-labelledby="resume-panel-title">
      <p className="resume-panel-eyebrow">Your resume</p>
      <h2 id="resume-panel-title" className="resume-panel-title">
        Rebuilt here, <em>one step at a time.</em>
      </h2>
      {draft.hasContent ? (
        <>
          <p className="resume-panel-lede">
            The steps below write into this resume when you accept their output. {resumeStatusLine(state)}
          </p>
          <div className="resume-progress">
            <div
              className="progress-track"
              role="img"
              aria-label={`${ready} of ${statuses.length} sections ready`}
            >
              <div className="progress-fill" style={{ width: `${Math.round((ready / statuses.length) * 100)}%` }} />
            </div>
            <span>
              <b>
                {ready} of {statuses.length}
              </b>{" "}
              sections ready
            </span>
          </div>
          <SectionList statuses={statuses} />
          <div className="row-actions resume-panel-actions">
            <Link href="/resume" className="primary-button inline">
              Review and publish
            </Link>
            <Link href="/resume#details" className="quiet-link">
              Fill in details
            </Link>
          </div>
        </>
      ) : upload ? (
        <>
          <p className="resume-panel-lede">
            Start from the resume you saved on {shortDate(upload.created_at)}. Yuhpp reads it into the template&apos;s
            sections: roles and bullets go into your bullet bank, the rest into your details. Then each step below
            improves a section, and you publish the result at Checkpoint 02.
          </p>
          <ImportButton />
        </>
      ) : (
        <p className="resume-panel-lede">
          <Link href="/profile">Save your resume under Profile</Link> first. Yuhpp then reads it into the template&apos;s
          sections, and each step below improves one of them.
        </p>
      )}
    </section>
  );
}
