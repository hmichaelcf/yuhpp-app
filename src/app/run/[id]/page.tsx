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
import { loadSettings } from "@/lib/settings";
import { bankSummary, storyBankMaxChars } from "@/lib/story-frame";
import { readsStoryBank, storyStarter } from "@/lib/story-prompts";
import { storyLabel } from "@/lib/story-themes";
import { listStories } from "@/lib/workspace";

export const dynamic = "force-dynamic";

export const metadata = { title: "Run | Yuhpp" };

export default async function RunPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ story?: string | string[] }>;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const member = await currentMember();
  if (!member) redirect("/login");

  const { DB } = await bindings();
  const run = await getRun(DB, id, member.id);
  if (!run) notFound();
  const readsBank = readsStoryBank(run.prompt_name);
  const [messages, resume, stories, settings] = await Promise.all([
    runMessages(DB, run.id),
    currentResume(DB, member.id),
    readsBank ? listStories(DB, member.id) : Promise.resolve([]),
    readsBank ? loadSettings(DB) : Promise.resolve(null),
  ]);

  // A run started from a story in the bank arrives with a message naming it.
  const storyParam = Number(Array.isArray(query.story) ? query.story[0] : query.story);
  const fromStory = readsBank && messages.length === 0 ? stories.find((s) => s.id === storyParam) : undefined;

  const place = placeOfPrompt(run.prompt_name);

  return (
    <AppShell admin={isAdmin(member)} active={place?.stop}>
      <div className="shell-narrow">
        <p className="eyebrow">
          {place ? <Link href={place.href}>{place.label}</Link> : <Link href="/prompts">Prompts</Link>} / Run
        </p>
        <h1 className="title run-title">{run.prompt_name}</h1>
        <ChatView
          runId={run.id}
          initialMessages={messages.map((m) => ({ role: m.role, content: m.content }))}
          initiallyOpen={run.status === "open"}
          description={run.prompt_description}
          saveSearches={nameKey(run.prompt_name) === nameKey(SEARCH_BUILDER)}
          resumeSavedOn={resume ? savedOnDate(resume.created_at) : null}
          initialBank={settings ? bankSummary(stories, storyBankMaxChars(settings)) : undefined}
          initialDraft={fromStory ? storyStarter(run.prompt_name, storyLabel(fromStory)) : ""}
        />
      </div>
    </AppShell>
  );
}
