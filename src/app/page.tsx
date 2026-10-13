import Link from "next/link";
import { redirect } from "next/navigation";
import AppShell from "./components/AppShell";
import NudgeBar from "./components/NudgeBar";
import StartRunButton from "./components/StartRunButton";
import { isAdmin } from "@/lib/admin";
import { briefTitles } from "@/lib/brief-shape";
import { bindings } from "@/lib/cloudflare";
import { shortDate } from "@/lib/dates";
import { activityByName, nextStep, type Check } from "@/lib/home-plan";
import { PHASE_INFO, isPhase, phaseIndex, phaseLabel } from "@/lib/phases";
import { nameKey } from "@/lib/route-map";
import { currentResume } from "@/lib/resumes";
import { activityByPrompt, promptCatalog, recentRuns, runsUsedThisMonth } from "@/lib/runs";
import { loadBrief } from "@/lib/search-brief";
import { currentMember } from "@/lib/session";
import { loadSettings } from "@/lib/settings";
import { computeMetrics, currentWeek, listLogs, longWeek } from "@/lib/weekly";
import { listExperiences, workspaceCounts } from "@/lib/workspace";

// Home: the member's own page, organized by where they are.
//   1. You: name, target roles, current phase, runs left.
//   2. Your next step: one action for their phase, with the checkpoint's checks.
//   3. Your materials: what every step reads (resume, bullets, stories, brief).
//   4. This week: their numbers, from Phase 03 on.
//   5. Pick up where you left off: recent runs.
// A member who has not said where they are is asked first (/welcome).

export const dynamic = "force-dynamic";

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

type MaterialState = "Ready" | "In progress" | "Not started";

const CHECK_TEXT: Record<Check["state"], string> = {
  done: "Met",
  part: "Partly met",
  todo: "Not yet",
  self: "Your call",
};

export default async function Home() {
  const member = await currentMember();
  if (!member) redirect("/login");
  const phase = isPhase(member.current_phase) ? member.current_phase : null;
  if (!phase) redirect("/welcome");

  const { DB } = await bindings();
  const [settings, used, runs, resume, counts, logs, catalog, activity, roles, profile] = await Promise.all([
    loadSettings(DB),
    runsUsedThisMonth(DB, member.id),
    recentRuns(DB, member.id, 4),
    currentResume(DB, member.id),
    workspaceCounts(DB, member.id),
    listLogs(DB, member.id),
    promptCatalog(DB),
    activityByPrompt(DB, member.id),
    listExperiences(DB, member.id),
    DB.prepare("SELECT use_own_file FROM resume_profiles WHERE member_id = ?1")
      .bind(member.id)
      .first<{ use_own_file: number }>(),
  ]);
  const brief = await loadBrief(DB, member.id, settings, { location: null, tools: [] });
  const cap = settings.number("run_cap_monthly", 75);
  const left = Math.max(cap - used, 0);
  const storyMin = settings.number("story_bank_target_min", 6);
  const weekly = computeMetrics(logs, currentWeek(), settings.number("metric_min_sample", 10));
  const ran = activityByName(catalog, activity);
  const step = nextStep({
    phase,
    resume,
    useOwnFile: !!profile?.use_own_file,
    counts,
    brief,
    weekly,
    settings,
    ran,
  });
  const promptKey = (name: string) => catalog.find((c) => nameKey(c.name) === nameKey(name))?.key ?? null;
  const actionKey = step.action.kind === "prompt" ? promptKey(step.action.name) : null;
  const showNudge = step.met && !!step.next && member.nudge_snoozed !== phase;
  const titles = briefTitles(brief);
  const now = new Date();
  const resetsOn = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });

  const resumeState: MaterialState =
    resume && (resume.source === "built" || profile?.use_own_file) ? "Ready" : resume ? "In progress" : "Not started";
  const materials: { href: string; title: string; state: MaterialState; detail: string }[] = [
    {
      href: resume ? "/resume" : "/profile",
      title: "Resume",
      state: resumeState,
      detail: !resume
        ? "Upload or paste it once. Every step reads it."
        : resume.source === "built"
          ? `Published ${shortDate(resume.created_at)} in the Yuhpp template.`
          : profile?.use_own_file
            ? `Your own file, saved ${shortDate(resume.created_at)}.`
            : `Uploaded ${shortDate(resume.created_at)}. Rebuild it in the template in Phase 02.`,
    },
    {
      href: "/bullets",
      title: "Bullet bank",
      state: counts.bullets ? "Ready" : "Not started",
      detail: counts.bullets
        ? `${plural(counts.bullets, "bullet", "bullets")} across ${plural(roles.length, "role", "roles")}.`
        : "Your resume bullets, sorted by role.",
    },
    {
      href: "/stories",
      title: "Story bank",
      state: counts.developedStories >= storyMin ? "Ready" : counts.stories ? "In progress" : "Not started",
      detail: counts.stories
        ? `${counts.developedStories} of ${storyMin} developed stories, ${plural(counts.themes, "theme", "themes")}.`
        : "Interview stories, grouped by theme.",
    },
    {
      href: "/phase/search",
      title: "Search brief",
      state: brief.saved && titles.length >= 3 ? "Ready" : brief.saved || titles.length ? "In progress" : "Not started",
      detail: titles.length
        ? `${plural(titles.length, "target title", "target titles")}${brief.location ? `, ${brief.location}` : ". Location not set"}.`
        : "Target titles, level, and location.",
    },
  ];

  const showWeek = phaseIndex(phase) >= phaseIndex("search");
  const tw = weekly.thisWeek;
  const avg = (key: "applications" | "outreach") => weekly.volume.find((v) => v.key === key)?.average ?? null;
  const fmtAvg = (n: number | null) => (n === null ? "No average yet" : `Average ${Number.isInteger(n) ? n : n.toFixed(1)}`);

  return (
    <AppShell admin={isAdmin(member)} active="home">
      <div className="home">
        {/* 1. You */}
        <section className="home-you" aria-labelledby="you">
          <div className="home-you-main">
            <p className="eyebrow">Home</p>
            <h1 id="you" className="title">
              {member.first_name ? (
                <>
                  Welcome back, <em>{member.first_name}.</em>
                </>
              ) : (
                <>
                  Welcome <em>back.</em>
                </>
              )}
            </h1>
            <p className="home-target">
              {titles.length ? (
                <>
                  Targeting <strong>{titles.slice(0, 3).join(", ")}</strong>
                  {titles.length > 3 ? ` and ${titles.length - 3} more` : ""}
                </>
              ) : (
                <>Target roles not set yet.</>
              )}
              {member.first_name ? null : (
                <>
                  {" "}
                  <Link href="/profile#name">Add your name</Link>
                </>
              )}
            </p>
          </div>
          <div className="home-facts">
            <div className="home-fact">
              <span className="home-fact-label">Current phase</span>
              <span className="home-fact-value">{phaseLabel(phase)}</span>
              <Link href="/welcome" className="home-fact-link">
                Change where I am
              </Link>
            </div>
            <div className="home-fact">
              <span className="home-fact-label">Runs left this month</span>
              <span className="home-fact-value">
                {left} of {cap}
              </span>
              <span className="home-fact-note">Resets {resetsOn}</span>
            </div>
          </div>
        </section>

        {showNudge && step.next ? (
          <NudgeBar
            title={`${step.gate} looks met.`}
            body={`Ready to move on to ${step.next.label}?`}
            nextId={step.next.id}
            nextLabel={step.next.id === "practice" ? "Practice loop" : PHASE_INFO[step.next.id].code}
          />
        ) : null}

        {/* 2. Your next step */}
        <section className="home-block" aria-labelledby="next">
          <h2 id="next" className="home-label">
            Your next step
          </h2>
          <div className="next-card">
            <div className="next-main">
              <span className="next-kicker">
                {phaseLabel(phase)} · {step.gate}
              </span>
              <h3 className="next-title">{step.title}</h3>
              <p className="next-body">{step.body}</p>
              <div className="next-actions">
                {step.action.kind === "prompt" && actionKey ? (
                  <StartRunButton
                    promptKey={actionKey}
                    label={step.action.label}
                    buttonClass="next-cta"
                    className="next-start"
                  />
                ) : step.action.kind === "link" ? (
                  <Link href={step.action.href} className="next-cta">
                    {step.action.label}
                  </Link>
                ) : (
                  <Link href={PHASE_INFO[phase].href} className="next-cta">
                    Open {phaseLabel(phase)}
                  </Link>
                )}
                {step.alt ? (
                  <Link href={step.alt.href} className="next-alt">
                    {step.alt.label}
                  </Link>
                ) : null}
              </div>
            </div>
            <div className="next-checks">
              <span className="next-checks-title">{step.gate}: what it asks for</span>
              <ul>
                {step.checks.map((c) => (
                  <li key={c.label} className={`next-check ${c.state}`}>
                    <span className="next-check-mark" aria-hidden="true" />
                    <span className="next-check-label">{c.label}</span>
                    <span className="next-check-detail">
                      <span className="sr-only">{CHECK_TEXT[c.state]}: </span>
                      {c.detail}
                    </span>
                  </li>
                ))}
              </ul>
              <div className="next-bar" aria-hidden="true">
                <span style={{ width: `${Math.round(step.progress * 100)}%` }} />
              </div>
            </div>
          </div>
        </section>

        {/* 3. Your materials */}
        <section className="home-block" aria-labelledby="materials">
          <div className="home-label-row">
            <h2 id="materials" className="home-label">
              Your materials
            </h2>
            <span className="home-label-note">Every step reads these. Build them once, keep them current.</span>
          </div>
          <ul className="materials">
            {materials.map((m) => (
              <li key={m.title}>
                <Link href={m.href} className="material">
                  <span className="material-state">
                    <span className={`material-dot ${m.state === "Ready" ? "ready" : m.state === "In progress" ? "part" : "none"}`} aria-hidden="true" />
                    {m.state}
                  </span>
                  <span className="material-title">{m.title}</span>
                  <span className="material-detail">{m.detail}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        {/* 4. This week (Phase 03 on) */}
        {showWeek ? (
          <section className="home-block" aria-labelledby="week">
            <div className="home-label-row">
              <h2 id="week" className="home-label">
                This week · {longWeek(weekly.week).replace("Week of ", "")}
              </h2>
              <Link href="/weekly" className="home-label-link">
                {tw ? "See your progress" : "Log this week"}
              </Link>
            </div>
            <div className="week-strip">
              <div className="week-num">
                <span className="week-num-label">Applications</span>
                <span className="week-num-value">{tw ? tw.applications : "Not logged"}</span>
                <span className="week-num-note">{fmtAvg(avg("applications"))}</span>
              </div>
              <div className="week-num">
                <span className="week-num-label">Outreach sent</span>
                <span className="week-num-value">{tw ? tw.outreach : "Not logged"}</span>
                <span className="week-num-note">{fmtAvg(avg("outreach"))}</span>
              </div>
              <div className="week-num">
                <span className="week-num-label">Replies</span>
                <span className="week-num-value">{tw ? tw.replies : "Not logged"}</span>
                <span className="week-num-note">This week</span>
              </div>
              <div className="week-num">
                <span className="week-num-label">Weeks logged</span>
                <span className="week-num-value">{weekly.streak}</span>
                <span className="week-num-note">In a row</span>
              </div>
            </div>
          </section>
        ) : null}

        {/* 5. Pick up where you left off */}
        {runs.length > 0 ? (
          <section className="home-block" aria-labelledby="recent">
            <h2 id="recent" className="home-label">
              Pick up where you left off
            </h2>
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
      </div>
    </AppShell>
  );
}
