import Link from "next/link";
import { redirect } from "next/navigation";
import AppShell from "../components/AppShell";
import ResumeDocument from "../components/ResumeDocument";
import { SectionList, resumeStatusLine } from "../components/ResumePanel";
import { FitCheck, ImportButton, PublishPanel, ResumeEditor, RoleGaps } from "../components/ResumeTools";
import { isAdmin } from "@/lib/admin";
import { bindings } from "@/lib/cloudflare";
import { resumeState } from "@/lib/resume-record";
import { changedSections, publishBlockers, sectionStatuses } from "@/lib/resume-shape";
import { currentMember } from "@/lib/session";
import { loadSettings } from "@/lib/settings";

// /app/resume: the member's resume in the Yuhpp template (Checkpoint 02).
// Review the draft as it will print, fill in what is missing, and publish it
// so every run reads it, or keep an uploaded file instead.

export const dynamic = "force-dynamic";

export const metadata = { title: "Your resume | Yuhpp" };

export default async function ResumePage() {
  const member = await currentMember();
  if (!member) redirect("/login");

  const { DB } = await bindings();
  const [settings, state] = await Promise.all([loadSettings(DB), resumeState(DB, member.id, member.email)]);
  const { draft } = state;
  const bulletMax = settings.number("bullet_max_chars", 75);
  const blockers = publishBlockers(draft.data);
  // What differs from the published version; nothing to compare with until one is published.
  const changed = state.unpublished && state.currentData ? changedSections(draft.data, state.currentData) : [];
  const roleGaps = draft.data.roles
    .filter((r) => r.id !== null && (!r.title || !r.start || !r.company))
    .map((r) => ({ id: r.id as number, company: r.company, title: r.title, start: r.start, end: r.end, current: r.current }));

  return (
    <AppShell admin={isAdmin(member)} active="resume">
      <p className="eyebrow">
        <Link href="/phase/positioning">Positioning</Link> / Checkpoint 02
      </p>
      <h1 className="title">
        Your resume, <em>in your template.</em>
      </h1>

      {!draft.hasContent ? (
        <>
          <p className="lede">
            Yuhpp rebuilds your resume in its template, one section at a time, then you publish it so every step reads
            the improved version.
          </p>
          {state.upload ? (
            <div className="resume-card">
              <p className="aside">
                Start from the resume you saved. Roles and bullets go into your bullet bank and the rest into your
                details below. Nothing you already have is changed.
              </p>
              <ImportButton />
            </div>
          ) : (
            <p className="aside">
              <Link href="/profile">Save your resume under Profile</Link> first, or add roles and bullets in your{" "}
              <Link href="/bullets">bullet bank</Link>.
            </p>
          )}
        </>
      ) : (
        <>
          <p className="lede">
            This is what an employer sees. Amber marks what is still missing; it never prints. {resumeStatusLine(state)}
          </p>

          <div className="resume-layout">
            <div className="resume-preview-wrap">
              <div className="rp-preview">
                <ResumeDocument data={draft.data} />
              </div>
              <FitCheck />
            </div>

            <div className="resume-side">
              {changed.length ? (
                <section className="resume-card">
                  <p className="section-label">Not published yet</p>
                  <p className="aside">Changed since the version runs read: {changed.join(", ")}.</p>
                </section>
              ) : null}

              {roleGaps.length ? (
                <section className="resume-card warn">
                  <p className="section-label">Roles to finish</p>
                  <p className="aside">Each role needs a title, a company, and a start date before you publish.</p>
                  <RoleGaps roles={roleGaps} />
                </section>
              ) : null}

              <section className="resume-card">
                <p className="section-label">How your searches use it</p>
                <PublishPanel
                  blockers={blockers}
                  useOwnFile={state.useOwnFile}
                  hasUpload={!!state.upload}
                  unpublished={state.unpublished}
                />
              </section>
            </div>
          </div>

          <section className="home-block">
            <p className="section-label">Sections</p>
            <SectionList statuses={sectionStatuses(draft.data, bulletMax)} />
            <p className="aside resume-bank-note">
              Roles and bullets come from your <Link href="/bullets">bullet bank</Link>. Edit, reorder, or remove
              them there, and run Resume Bullet Refinement to tighten them.
            </p>
          </section>

          <section className="home-block" id="details">
            <p className="section-label">Your details</p>
            <ResumeEditor data={draft.data} />
          </section>

          {state.upload ? (
            <section className="home-block">
              <p className="section-label">Your upload</p>
              <p className="aside">
                Uploaded a newer resume? Read it in again: new roles are added, and anything you already have stays as
                it is.
              </p>
              <ImportButton again />
            </section>
          ) : null}
        </>
      )}
    </AppShell>
  );
}
