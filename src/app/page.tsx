import Link from "next/link";
import { redirect } from "next/navigation";
import AppShell from "./components/AppShell";
import { isAdmin } from "@/lib/admin";
import { bindings } from "@/lib/cloudflare";
import { shortDate } from "@/lib/dates";
import { currentResume, sourceLabel } from "@/lib/resumes";
import { ENTRIES } from "@/lib/route-map";
import { recentRuns, runsUsedThisMonth } from "@/lib/runs";
import { currentMember } from "@/lib/session";
import { loadSettings } from "@/lib/settings";
import { computeMetrics, currentWeek, listLogs } from "@/lib/weekly";
import { workspaceCounts } from "@/lib/workspace";

// Signed-in home: a welcome, the member's workspace (what they are working
// on), their recent runs, and the guide's "start here" entries.

export const dynamic = "force-dynamic";

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

type Tile = {
  href: string;
  code: string;
  title: string;
  status: string;
  done: boolean;
  action: string;
};

export default async function Home() {
  const member = await currentMember();
  if (!member) {
    redirect("/login");
  }

  const { DB } = await bindings();
  const [settings, used, runs, resume, counts, logs] = await Promise.all([
    loadSettings(DB),
    runsUsedThisMonth(DB, member.id),
    recentRuns(DB, member.id, 5),
    currentResume(DB, member.id),
    workspaceCounts(DB, member.id),
    listLogs(DB, member.id),
  ]);
  const cap = settings.number("run_cap_monthly", 75);
  const left = Math.max(cap - used, 0);
  const storyMin = settings.number("story_bank_target_min", 6);
  const storyMax = settings.number("story_bank_target_max", 8);
  const weekly = computeMetrics(logs, currentWeek(), settings.number("metric_min_sample", 10));

  const tiles: Tile[] = [
    {
      href: resume ? "/resume" : "/profile",
      code: "Phase 02",
      title: "Current resume",
      status: resume
        ? resume.source === "built"
          ? `Published ${shortDate(resume.created_at)} in the Yuhpp template. Every prompt reads it.`
          : `Saved ${shortDate(resume.created_at)}, ${sourceLabel(resume.source)}. Every prompt reads it.`
        : "Not added yet. Save it once and every prompt can read it.",
      done: !!resume,
      action: resume ? (resume.source === "built" ? "Open your resume" : "Rebuild it in the template") : "Add your resume",
    },
    {
      href: "/bullets",
      code: "Phase 02",
      title: "Bullet bank",
      status: counts.bullets
        ? `${plural(counts.bullets, "bullet", "bullets")} saved, sorted by role.`
        : "Keep every resume bullet here, sorted by role, ready for the next tailored resume.",
      done: counts.bullets > 0,
      action: counts.bullets ? "Open the bank" : "Add bullets",
    },
    {
      href: "/stories",
      code: "Phase 02",
      title: "STAR stories",
      status: counts.stories
        ? `${plural(counts.developedStories, "developed story", "developed stories")}, ${plural(counts.themes, "theme", "themes")}. Checkpoint 02 asks for ${storyMin} to ${storyMax}.`
        : `Your story bank. Checkpoint 02 asks for ${storyMin} to ${storyMax} developed stories covering distinct themes.`,
      done: counts.developedStories >= storyMin,
      action: counts.stories ? "Open the bank" : "Add a story",
    },
    {
      href: "/outreach",
      code: "Phase 03",
      title: "Outreach",
      status: counts.searches
        ? `${plural(counts.searches, "saved search", "saved searches")}, one click from running.`
        : "Save the searches Smart Job Search Builder writes for you, and run them in one click.",
      done: counts.searches > 0,
      action: counts.searches ? "Open searches" : "Save a search",
    },
    {
      href: "/weekly",
      code: "Weekly",
      title: "Weekly review",
      status: weekly.thisWeek
        ? `This week is logged. ${weekly.streak > 1 ? `${weekly.streak} weeks in a row.` : ""}`.trim()
        : weekly.weeksLogged
          ? `This week is not logged yet.${weekly.streak > 0 ? ` ${plural(weekly.streak, "week", "weeks")} in a row so far.` : ""}`
          : "Log your numbers each week to see which stage is converting and which is not.",
      done: !!weekly.thisWeek,
      action: weekly.thisWeek ? "See your progress" : "Log this week",
    },
  ];

  return (
    <AppShell admin={isAdmin(member)} active="start">
      <p className="eyebrow">Your workspace</p>
      <h1 className="title">
        {member.first_name ? (
          <>
            Welcome, <em>{member.first_name}.</em>
          </>
        ) : (
          <>
            Welcome <em>back.</em>
          </>
        )}
      </h1>
      <p className="lede">
        You have{" "}
        <strong>
          {left} of {cap}
        </strong>{" "}
        prompt runs left this month. Pick a phase on the route to run its prompts, or open what you
        are working on below.
        {member.first_name ? null : (
          <>
            {" "}
            <Link href="/profile#name" className="quiet-link">
              Add your name
            </Link>
          </>
        )}
      </p>

      <section className="home-block" aria-labelledby="working-on">
        <p className="section-label" id="working-on">
          What you are working on
        </p>
        <ul className="tiles">
          {tiles.map((t) => (
            <li key={t.href}>
              <Link href={t.href} className={t.done ? "tile done" : "tile"}>
                <span className="tile-code">
                  <span className="tile-dot" aria-hidden="true" />
                  {t.code}
                </span>
                <span className="tile-title">{t.title}</span>
                <span className="tile-status">{t.status}</span>
                <span className="tile-action">{t.action} &rarr;</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {runs.length > 0 ? (
        <section className="home-block">
          <p className="section-label">Pick up where you left off</p>
          <ul className="run-list">
            {runs.map((r) => (
              <li key={r.id}>
                <Link href={`/run/${r.id}`} className="run-row">
                  <span className="run-name">{r.prompt_name}</span>
                  <span className={r.status === "open" ? "run-state open" : "run-state"}>
                    {r.status === "open" ? "In progress" : "Finished"}, {shortDate(r.created_at)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          <p className="more-link">
            <Link href="/prompts">See every prompt in the library</Link>
          </p>
        </section>
      ) : null}

      <section className="home-block">
        <p className="section-label">Not sure where you are? Start here</p>
        <div className="entry-grid">
          {ENTRIES.map((e) => (
            <Link key={e.q} href={e.href} className="entry">
              <span className="entry-q">{e.q}</span>
              <span className="entry-a">{e.a} &rarr;</span>
            </Link>
          ))}
        </div>
      </section>
    </AppShell>
  );
}
