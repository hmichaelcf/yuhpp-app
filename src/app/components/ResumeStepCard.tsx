import Link from "next/link";
import { shortDate } from "@/lib/dates";
import type { ResumeState } from "@/lib/resume-record";

// "Get your resume": the last step of the resume work in Phase 02. It sits in
// the numbered list after the steps that write into the resume, so finishing
// them leads somewhere: the resume in the Yuhpp template, ready to publish
// and download.

export default function ResumeStepCard({ state, num }: { state: ResumeState; num: number }) {
  const { draft, current, version, useOwnFile, unpublished } = state;
  const published = current?.source === "built";

  let what: string;
  let status: string | null = null;
  let action: string;
  if (!draft.hasContent) {
    what =
      "Your resume in the Yuhpp template, built from the steps above. Start from your upload in the Your resume box at the top of this page first.";
    action = "Open";
  } else if (useOwnFile) {
    what = "Your resume in the Yuhpp template. You chose to keep your own file, so every step reads that instead.";
    action = "Open";
  } else if (published && !unpublished) {
    what = "Your resume in the Yuhpp template. Download it as a PDF, or come back after more steps to publish an update.";
    status = `Published v${version} on ${shortDate(current.created_at)}. Every step reads it.`;
    action = "Open your resume";
  } else {
    what =
      "See your resume in the Yuhpp template with everything you saved from the steps above. Fill in what is missing, publish it so every step reads it, and download it as a PDF.";
    status = published
      ? `v${version} published ${shortDate(current.created_at)}. Your draft has changes since then.`
      : null;
    action = "Review and publish";
  }

  return (
    <ol className="cards resume-step" start={num}>
      <li className={published && !unpublished ? "card has-run" : "card"}>
        <div className="card-head">
          <span className="card-num">{String(num).padStart(2, "0")}</span>
          <span className="card-body">
            <span className="card-name">Get your resume</span>
            <span className="card-what">{what}</span>
            <span className="flow-tags">
              <span className="flow-tag writes">Publishes your resume</span>
            </span>
            {status ? <span className="card-last">{status}</span> : null}
          </span>
          <div className="start-run">
            <Link href="/resume" className="primary-button inline">
              {action}
            </Link>
          </div>
        </div>
      </li>
    </ol>
  );
}
