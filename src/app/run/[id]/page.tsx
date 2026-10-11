import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import ChatView from "../../components/ChatView";
import AppShell from "../../components/AppShell";
import { isAdmin } from "@/lib/admin";
import { bindings } from "@/lib/cloudflare";
import { currentResume, savedOnDate } from "@/lib/resumes";
import { SEARCH_BUILDER, nameKey, placeOfPrompt } from "@/lib/route-map";
import { getRun, runMessages } from "@/lib/runs";
import { currentMember } from "@/lib/session";

export const dynamic = "force-dynamic";

export const metadata = { title: "Run | Yuhpp" };

export default async function RunPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const member = await currentMember();
  if (!member) redirect("/login");

  const { DB } = await bindings();
  const run = await getRun(DB, id, member.id);
  if (!run) notFound();
  const [messages, resume] = await Promise.all([
    runMessages(DB, run.id),
    currentResume(DB, member.id),
  ]);

  const place = placeOfPrompt(run.prompt_name);

  return (
    <AppShell admin={isAdmin(member)} active={place?.stop}>
      <div className="shell-narrow">
        <p className="eyebrow">
          {place ? <Link href={place.href}>{place.label}</Link> : <Link href="/prompts">Prompts</Link>} / Run
        </p>
        <h1 className="title run-title">{run.prompt_name}</h1>
        <p className="resume-note">
          {resume ? (
            <>
              This run can read your resume saved {savedOnDate(resume.created_at)}.{" "}
              <Link href="/profile">Change it</Link>
            </>
          ) : (
            <>
              No resume saved. If this step needs one, it will ask you to paste it, or you can{" "}
              <Link href="/profile">save it to your profile</Link> first.
            </>
          )}
        </p>
        <ChatView
          runId={run.id}
          initialMessages={messages.map((m) => ({ role: m.role, content: m.content }))}
          initiallyOpen={run.status === "open"}
          description={run.prompt_description}
          saveSearches={nameKey(run.prompt_name) === nameKey(SEARCH_BUILDER)}
        />
      </div>
    </AppShell>
  );
}
