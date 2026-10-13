import Link from "next/link";
import { redirect } from "next/navigation";
import AppShell from "../components/AppShell";
import NameForm from "../components/NameForm";
import ResumeForm from "../components/ResumeForm";
import { isAdmin } from "@/lib/admin";
import { bindings } from "@/lib/cloudflare";
import { currentResume, savedOnDate } from "@/lib/resumes";
import { currentMember } from "@/lib/session";

export const dynamic = "force-dynamic";

export const metadata = { title: "Profile | Yuhpp" };

export default async function ProfilePage() {
  const member = await currentMember();
  if (!member) redirect("/login");

  const { DB } = await bindings();
  const resume = await currentResume(DB, member.id);

  return (
    <AppShell admin={isAdmin(member)} active="home">
      <div className="shell-narrow">
        <p className="eyebrow">Profile</p>
        <h1 className="title">
          Your resume, <em>saved once.</em>
        </h1>
        <p className="lede">
          Every prompt reads the resume you save here, so you never need to paste it into a run.
          Only the text is kept; the file you upload is read and then discarded.
        </p>

        <section className="admin-block" id="name">
          <p className="section-label">Your name</p>
          <NameForm first={member.first_name ?? ""} last={member.last_name ?? ""} />
        </section>

        <p className="aside">
          In Positioning, Yuhpp rebuilds this resume in its template, section by section, and you publish the result
          from <Link href="/resume">Your resume</Link>. Uploading a new file here makes it the version every prompt
          reads again.
        </p>

        <section className="admin-block">
          <p className="section-label">{resume ? "Replace your resume" : "Add your resume"}</p>
          <ResumeForm hasResume={!!resume} />
        </section>

        {resume ? (
          <section className="admin-block">
            <p className="section-label">What Yuhpp reads</p>
            <p className="aside">
              {resume.source === "built" ? (
                <>
                  Published {savedOnDate(resume.created_at)} from <Link href="/resume">your resume in Yuhpp</Link>.
                  This is the exact text every prompt receives.
                </>
              ) : (
                <>
                  Saved {savedOnDate(resume.created_at)} from{" "}
                  <strong>{resume.file_name ?? "pasted text"}</strong>. This is the exact text every
                  prompt receives. If anything looks garbled or missing, replace it with a Word file or
                  paste the text.
                </>
              )}
            </p>
            <pre className="resume-preview">{resume.text}</pre>
          </section>
        ) : null}
      </div>
    </AppShell>
  );
}
