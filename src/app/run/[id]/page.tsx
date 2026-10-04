import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import ChatView from "../../components/ChatView";
import Masthead from "../../components/Masthead";
import { isAdmin } from "@/lib/admin";
import { bindings } from "@/lib/cloudflare";
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
  const messages = await runMessages(DB, run.id);

  return (
    <>
      <Masthead signedIn admin={isAdmin(member)} />
      <main className="page">
        <p className="eyebrow">
          <Link href="/prompts">Prompts</Link> / Run
        </p>
        <h1 className="title run-title">{run.prompt_name}</h1>
        <ChatView
          runId={run.id}
          initialMessages={messages.map((m) => ({ role: m.role, content: m.content }))}
          initiallyOpen={run.status === "open"}
          description={run.prompt_description}
        />
      </main>
    </>
  );
}
