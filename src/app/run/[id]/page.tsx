import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import ChatView, { type ReadItem } from "../../components/ChatView";
import type { BlockContext } from "../../components/RunBlocks";
import AppShell from "../../components/AppShell";
import { isAdmin } from "@/lib/admin";
import { bindings } from "@/lib/cloudflare";
import { briefFirstMessage, briefSummary, briefTitles } from "@/lib/brief-shape";
import { readsBrief, readsCompanies } from "@/lib/resume-prompts";
import { loadRunReads } from "@/lib/run-reads";
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
  const settings = await loadSettings(DB);
  const [messages, reads, stories] = await Promise.all([
    runMessages(DB, run.id),
    loadRunReads(DB, member, run.prompt_name, settings),
    readsBank ? listStories(DB, member.id) : Promise.resolve([]),
  ]);

  // A run started from a story in the bank arrives with a message naming it.
  const storyParam = Number(Array.isArray(query.story) ? query.story[0] : query.story);
  const fromStory = readsBank && messages.length === 0 ? stories.find((s) => s.id === storyParam) : undefined;

  const place = placeOfPrompt(run.prompt_name);

  // What this run reads, for the box above the chat.
  const resumeItem: ReadItem | null = reads.resume
    ? { label: reads.resume.label, detail: reads.resume.detail, href: reads.resume.href, link: reads.resume.link, on: true }
    : null;
  const briefOn = reads.briefText !== undefined && reads.briefText !== null;
  const briefItem: ReadItem | undefined =
    reads.brief && readsBrief(run.prompt_name)
      ? {
          label: "Your search brief",
          detail: briefOn ? briefSummary(reads.brief) : "empty; it will ask for titles and locations",
          href: "/phase/search#brief",
          link: briefOn ? "Edit" : "Fill it in",
          on: briefOn,
        }
      : undefined;
  const companiesItem: ReadItem | undefined =
    reads.companies && readsCompanies(run.prompt_name)
    ? {
        label: "Your saved companies",
        detail: reads.companies.length
          ? `${reads.companies.length} ${reads.companies.length === 1 ? "company" : "companies"}`
          : "none yet; it will ask",
        href: "/phase/search#companies",
        link: "Open",
        on: reads.companies.length > 0,
      }
    : undefined;

  // Save buttons for the output blocks this step writes.
  const draft = reads.state.draft.data;
  const blockCtx: BlockContext | undefined = reads.blocks.length
    ? {
        runId: run.id,
        bulletMax: settings.number("bullet_max_chars", 75),
        draft: {
          skills: draft.skills,
          leadership: draft.leadership,
          bullets: draft.roles.flatMap((r) =>
            r.bullets.filter((b) => b.id !== null).map((b) => ({ id: b.id as number, text: b.text, roleId: r.id })),
          ),
          roles: draft.roles
            .filter((r) => r.id !== null)
            .map((r, _, all) => {
              const shared = all.filter((x) => x.company && x.company === r.company).length > 1;
              const label = r.company ? (shared && r.title ? `${r.company}, ${r.title}` : r.company) : r.title;
              return { id: r.id as number, label: label || "Role not named yet", company: r.company };
            }),
        },
        briefTitles: reads.brief ? briefTitles(reads.brief) : undefined,
        companies: reads.companies?.map((c) => c.name),
      }
    : undefined;

  // A search run opens with its first message drafted from the brief.
  const fromBrief =
    !fromStory && messages.length === 0 && reads.brief && briefOn && readsBrief(run.prompt_name)
      ? briefFirstMessage(run.prompt_name, reads.brief)
      : "";

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
          reads={{ resume: resumeItem, brief: briefItem, companies: companiesItem }}
          blockCtx={blockCtx}
          draftFromBrief={!!fromBrief}
          initialBank={readsBank ? bankSummary(stories, storyBankMaxChars(settings)) : undefined}
          initialDraft={fromStory ? storyStarter(run.prompt_name, storyLabel(fromStory)) : fromBrief}
        />
      </div>
    </AppShell>
  );
}
