import "server-only";
import { adminEmails } from "./config";
import { isPhase, phaseLabel } from "./phases";
import { placeOfPrompt } from "./route-map";
import { loadSettings } from "./settings";
import { addWeeks, currentWeek, mondayOf } from "./weekly";
import { COUNT_FIELDS, emptyCounts, type Counts } from "./weekly-fields";

// The Insights page (/app/admin/insights): who the members are, what they do,
// and what it costs. Admin only.
//
// Product rule 6 exception, on purpose: every query here reads across all
// members. Only admins reach this module (requireAdminPage on the page), and
// nothing here reads message text, resume text, or any other member content;
// it counts rows and reads timestamps.
//
// Admin accounts (is_admin, or an email in ADMIN_EMAILS) are left out of the
// member numbers unless the page asks for them, so testing does not inflate
// them. Spend is always every account, because it is real money.

const ZONE = "America/Los_Angeles";
/** How far back activity is read for active counts, trends, and retention. */
const ACTIVITY_DAYS = 120;
const TREND_WEEKS = 12;
const COHORT_WEEKS = 8;

/** Where activity is read from: each source's member column and timestamp. */
const ACTIVITY_SOURCES: { from: string; member: string; at: string; where?: string }[] = [
  { from: "messages ms JOIN runs r ON r.id = ms.run_id", member: "r.member_id", at: "ms.created_at", where: "ms.role = 'user'" },
  { from: "weekly_logs", member: "member_id", at: "created_at" },
  { from: "weekly_logs", member: "member_id", at: "updated_at" },
  { from: "bullets", member: "member_id", at: "updated_at" },
  { from: "stories", member: "member_id", at: "updated_at" },
  { from: "experiences", member: "member_id", at: "updated_at" },
  { from: "saved_searches", member: "member_id", at: "created_at" },
  { from: "target_companies", member: "member_id", at: "created_at" },
  { from: "resumes", member: "member_id", at: "created_at" },
  { from: "resume_profiles", member: "member_id", at: "updated_at" },
  { from: "search_briefs", member: "member_id", at: "updated_at" },
  { from: "members", member: "id", at: "last_seen_at" },
  { from: "members", member: "id", at: "phase_set_at" },
  { from: "members", member: "id", at: "created_at" },
];

// ---------- dates ----------

/** SQLite "YYYY-MM-DD HH:MM:SS" (UTC) to a Date. Accepts a truncated hour too. */
function utc(sqlite: string): Date {
  const s = sqlite.replace(" ", "T");
  const full = s.length === 13 ? `${s}:00:00` : s;
  return new Date(`${full}Z`);
}

function pacificYmd(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

function weekOf(sqlite: string): string {
  return mondayOf(pacificYmd(utc(sqlite)));
}

function weeksBetween(fromWeek: string, toWeek: string): number {
  const a = new Date(`${fromWeek}T12:00:00Z`).getTime();
  const b = new Date(`${toWeek}T12:00:00Z`).getTime();
  return Math.round((b - a) / (7 * 86400000));
}

function daysAgo(d: Date, now: Date): number {
  return (now.getTime() - d.getTime()) / 86400000;
}

function median(values: number[]): number | null {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

// ---------- types ----------

export type Share = { n: number; of: number };

export type MemberRow = {
  id: string;
  name: string;
  email: string | null;
  isAdmin: boolean;
  joined: string;
  phase: string;
  lastActive: string | null;
  runs: number;
  runs30: number;
  weeksLogged: number;
  resume: "Published" | "Uploaded" | "None";
  bullets: number;
  stories: number;
  researchConsent: boolean;
};

export type Nudge = { id: string; name: string; email: string | null; reason: string; since: string };

export type PromptUse = {
  key: string;
  name: string;
  place: string;
  runs: number;
  runs30: number;
  members: number;
  avgTurns: number;
  capped: number;
  cost: number;
};

export type Insights = {
  includeAdmins: boolean;
  excludedCount: number;
  minSample: number;
  generatedAt: string;
  headline: {
    members: number;
    new7: number;
    new30: number;
    wau: number;
    mau: number;
    runs7: number;
    runs30: number;
    spendMonth: number;
    spendProjected: number;
  };
  trend: { week: string; signups: number; active: number; runs: number }[];
  milestones: { label: string; detail: string; share: Share }[];
  medianHoursToFirstRun: number | null;
  cohorts: { week: string; size: number; cells: (Share | null)[] }[];
  phases: { label: string; n: number }[];
  prompts: PromptUse[];
  unusedPrompts: string[];
  libraryCount: number;
  places: { label: string; runs: number }[];
  depth: { label: string; detail: string; share: Share }[];
  capWatch: { cap: number; near: number; at: number };
  outcomes: {
    totals: Counts;
    loggers: number;
    loggersConsented: number;
    weeks: { week: string; members: number; counts: Counts }[];
    rates: { label: string; num: number; den: number }[];
  };
  spend: {
    months: { month: string; runs: number; runCost: number; otherCost: number }[];
    byPurpose: { purpose: string; cost: number; calls: number }[];
    costPerRun30: number | null;
    costPerActive30: number | null;
  };
  nudges: Nudge[];
  members: MemberRow[];
};

type MemberBase = {
  id: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  current_phase: string | null;
  is_admin: number;
  consent_research_at: string | null;
  created_at: string;
  last_seen_at: string | null;
};

// ---------- the report ----------

export async function loadInsights(db: D1Database, opts: { includeAdmins: boolean }): Promise<Insights> {
  const now = new Date();
  const settings = await loadSettings(db);
  const minSample = settings.number("metric_min_sample", 10);
  const runCap = settings.number("run_cap_monthly", 75);
  const maxTurns = settings.number("max_turns_per_run", 40);
  const storyTarget = settings.number("story_bank_target_min", 6);

  const allMembers = (
    await db
      .prepare(
        `SELECT id, email, first_name, last_name, current_phase, is_admin, consent_research_at, created_at, last_seen_at
         FROM members ORDER BY created_at`,
      )
      .all<MemberBase>()
  ).results;

  const admins = new Set(adminEmails());
  const isAdminRow = (m: MemberBase) => m.is_admin === 1 || (!!m.email && admins.has(m.email.toLowerCase()));
  const excludedIds = opts.includeAdmins ? [] : allMembers.filter(isAdminRow).map((m) => m.id);
  const members = allMembers.filter((m) => !excludedIds.includes(m.id));
  const excl = JSON.stringify(excludedIds);
  // Every member-level query binds ?1 to the left-out ids.
  const NOT_EXCLUDED = "NOT IN (SELECT value FROM json_each(?1))";
  const since = `-${ACTIVITY_DAYS} days`;

  const [runAgg, resumeAgg, weeklyAgg, bulletAgg, storyAgg, events, promptRows, library, monthRuns, monthOther, purposeRows, weekRows, runsThisMonth, runDays] =
    await Promise.all([
      db
        .prepare(
          `SELECT member_id,
                  SUM(turns > 0) AS runs,
                  SUM(CASE WHEN turns > 0 AND created_at >= datetime('now', '-30 days') THEN 1 ELSE 0 END) AS runs30,
                  MIN(CASE WHEN turns > 0 THEN created_at END) AS first_run
           FROM runs WHERE member_id ${NOT_EXCLUDED} GROUP BY member_id`,
        )
        .bind(excl)
        .all<{ member_id: string; runs: number; runs30: number; first_run: string | null }>(),
      db
        .prepare(
          `SELECT member_id, MAX(source = 'built') AS published, COUNT(*) AS n
           FROM resumes WHERE member_id ${NOT_EXCLUDED} GROUP BY member_id`,
        )
        .bind(excl)
        .all<{ member_id: string; published: number; n: number }>(),
      db
        .prepare(`SELECT member_id, COUNT(*) AS weeks FROM weekly_logs WHERE member_id ${NOT_EXCLUDED} GROUP BY member_id`)
        .bind(excl)
        .all<{ member_id: string; weeks: number }>(),
      db
        .prepare(`SELECT member_id, COUNT(*) AS n FROM bullets WHERE member_id ${NOT_EXCLUDED} GROUP BY member_id`)
        .bind(excl)
        .all<{ member_id: string; n: number }>(),
      db
        .prepare(`SELECT member_id, COUNT(*) AS n FROM stories WHERE member_id ${NOT_EXCLUDED} GROUP BY member_id`)
        .bind(excl)
        .all<{ member_id: string; n: number }>(),
      // Activity: any timestamped thing a member did, to the hour. One query
      // per source, because D1 allows only a few terms in a UNION. Sign-ins
      // only record the latest one (members.last_seen_at), so older sign-ins
      // without other activity are not counted.
      Promise.all(
        ACTIVITY_SOURCES.map((src) =>
          db
            .prepare(
              `SELECT DISTINCT ${src.member} AS member_id, substr(${src.at}, 1, 13) AS h FROM ${src.from}
               WHERE ${src.at} >= datetime('now', ?2) AND ${src.member} ${NOT_EXCLUDED}${src.where ? ` AND ${src.where}` : ""}`,
            )
            .bind(excl, since)
            .all<{ member_id: string; h: string }>()
            .then((r) => r.results),
        ),
      ).then((lists) => ({ results: lists.flat() })),
      db
        .prepare(
          `SELECT p.key, MAX(p.name) AS name,
                  COUNT(*) AS runs,
                  SUM(CASE WHEN r.created_at >= datetime('now', '-30 days') THEN 1 ELSE 0 END) AS runs30,
                  COUNT(DISTINCT r.member_id) AS members,
                  AVG(r.turns) AS avg_turns,
                  SUM(r.turns >= ?2) AS capped,
                  SUM(r.cost_usd) AS cost
           FROM runs r JOIN prompts p ON p.id = r.prompt_id
           WHERE r.turns > 0 AND r.member_id ${NOT_EXCLUDED}
           GROUP BY p.key ORDER BY runs DESC, name`,
        )
        .bind(excl, maxTurns)
        .all<{ key: string; name: string; runs: number; runs30: number; members: number; avg_turns: number; capped: number; cost: number }>(),
      db
        .prepare("SELECT key, name FROM prompts WHERE is_current = 1 ORDER BY name")
        .all<{ key: string; name: string }>(),
      // Spend: every account, admins included.
      db
        .prepare(
          `SELECT strftime('%Y-%m', created_at) AS month, COUNT(*) AS runs, SUM(cost_usd) AS cost
           FROM runs WHERE created_at >= datetime('now', 'start of month', '-5 months')
           GROUP BY month ORDER BY month`,
        )
        .all<{ month: string; runs: number; cost: number }>(),
      db
        .prepare(
          `SELECT strftime('%Y-%m', created_at) AS month, SUM(cost_usd) AS cost
           FROM api_usage WHERE created_at >= datetime('now', 'start of month', '-5 months')
           GROUP BY month ORDER BY month`,
        )
        .all<{ month: string; cost: number }>(),
      db
        .prepare(
          `SELECT purpose, SUM(cost_usd) AS cost, COUNT(*) AS calls FROM (
             SELECT 'prompt runs' AS purpose, cost_usd FROM runs WHERE created_at >= datetime('now', '-30 days')
             UNION ALL SELECT purpose, cost_usd FROM api_usage WHERE created_at >= datetime('now', '-30 days')
           ) GROUP BY purpose ORDER BY cost DESC`,
        )
        .all<{ purpose: string; cost: number; calls: number }>(),
      db
        .prepare(
          `SELECT w.week_start, COUNT(*) AS members, ${COUNT_FIELDS.map((f) => `SUM(w.${f.key}) AS ${f.key}`).join(", ")}
           FROM weekly_logs w WHERE w.member_id ${NOT_EXCLUDED}
           GROUP BY w.week_start ORDER BY w.week_start DESC`,
        )
        .bind(excl)
        .all<Counts & { week_start: string; members: number }>(),
      db
        .prepare(
          `SELECT member_id, COUNT(*) AS n FROM runs
           WHERE turns > 0 AND created_at >= datetime('now', 'start of month') AND member_id ${NOT_EXCLUDED}
           GROUP BY member_id`,
        )
        .bind(excl)
        .all<{ member_id: string; n: number }>(),
      db
        .prepare(
          `SELECT created_at FROM runs
           WHERE turns > 0 AND created_at >= datetime('now', ?2) AND member_id ${NOT_EXCLUDED}`,
        )
        .bind(excl, since)
        .all<{ created_at: string }>(),
    ]);

  // ---------- per member ----------
  const runsBy = new Map(runAgg.results.map((r) => [r.member_id, r]));
  const resumeBy = new Map(resumeAgg.results.map((r) => [r.member_id, r]));
  const weeksBy = new Map(weeklyAgg.results.map((r) => [r.member_id, r.weeks]));
  const bulletsBy = new Map(bulletAgg.results.map((r) => [r.member_id, r.n]));
  const storiesBy = new Map(storyAgg.results.map((r) => [r.member_id, r.n]));

  const activeHours = new Map<string, Date[]>();
  for (const e of events.results) {
    const list = activeHours.get(e.member_id) ?? [];
    list.push(utc(e.h));
    activeHours.set(e.member_id, list);
  }
  const lastActive = (id: string): Date | null => {
    const list = activeHours.get(id);
    if (!list?.length) return null;
    return list.reduce((a, b) => (a > b ? a : b));
  };
  const activeWithin = (days: number) =>
    members.filter((m) => (activeHours.get(m.id) ?? []).some((d) => daysAgo(d, now) <= days)).length;

  const nameOf = (m: MemberBase) =>
    [m.first_name, m.last_name].filter(Boolean).join(" ") || (m.email ? m.email.split("@")[0] : "Unnamed");

  const thisWeek = currentWeek(now);
  const activeWeeks = new Map<string, Set<string>>();
  for (const m of members) {
    activeWeeks.set(m.id, new Set((activeHours.get(m.id) ?? []).map((d) => mondayOf(pacificYmd(d)))));
  }

  const memberRows: MemberRow[] = members.map((m) => {
    const r = runsBy.get(m.id);
    const res = resumeBy.get(m.id);
    const last = lastActive(m.id);
    return {
      id: m.id,
      name: nameOf(m),
      email: m.email,
      isAdmin: isAdminRow(m),
      joined: m.created_at,
      phase: isPhase(m.current_phase) ? phaseLabel(m.current_phase) : "Not chosen",
      lastActive: last ? last.toISOString() : null,
      runs: r?.runs ?? 0,
      runs30: r?.runs30 ?? 0,
      weeksLogged: weeksBy.get(m.id) ?? 0,
      resume: res ? (res.published ? "Published" : "Uploaded") : "None",
      bullets: bulletsBy.get(m.id) ?? 0,
      stories: storiesBy.get(m.id) ?? 0,
      researchConsent: !!m.consent_research_at,
    };
  });
  memberRows.sort((a, b) => (b.lastActive ?? "").localeCompare(a.lastActive ?? "") || b.joined.localeCompare(a.joined));

  // ---------- headline ----------
  const joinedWithin = (days: number) => members.filter((m) => daysAgo(utc(m.created_at), now) <= days).length;
  const runsWithin = (days: number) => runDays.results.filter((r) => daysAgo(utc(r.created_at), now) <= days).length;

  const monthKey = new Date().toISOString().slice(0, 7);
  const runCostMonth = monthRuns.results.find((r) => r.month === monthKey)?.cost ?? 0;
  const otherCostMonth = monthOther.results.find((r) => r.month === monthKey)?.cost ?? 0;
  const spendMonth = runCostMonth + otherCostMonth;
  const dayOfMonth = now.getUTCDate() - 1 + now.getUTCHours() / 24;
  const daysInMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)).getUTCDate();
  const spendProjected = dayOfMonth > 0.5 ? (spendMonth / dayOfMonth) * daysInMonth : spendMonth;

  // ---------- weekly trend ----------
  const trend = Array.from({ length: TREND_WEEKS }, (_, i) => addWeeks(thisWeek, i - (TREND_WEEKS - 1))).map(
    (week) => ({
      week,
      signups: members.filter((m) => weekOf(m.created_at) === week).length,
      active: members.filter((m) => activeWeeks.get(m.id)?.has(week)).length,
      runs: runDays.results.filter((r) => weekOf(r.created_at) === week).length,
    }),
  );

  // ---------- milestones ----------
  const total = members.length;
  const count = (f: (m: MemberBase) => boolean) => members.filter(f).length;
  const cameBack = count((m) => {
    const signupWeek = weekOf(m.created_at);
    return [...(activeWeeks.get(m.id) ?? [])].some((w) => w > signupWeek);
  });
  const milestones = [
    { label: "Created an account", detail: "Signed up", share: { n: total, of: total } },
    { label: "Chose a phase", detail: "Answered “Where are you in your search?”", share: { n: count((m) => !!m.current_phase), of: total } },
    { label: "Saved a resume", detail: "Uploaded, pasted, or built one", share: { n: count((m) => resumeBy.has(m.id)), of: total } },
    { label: "Ran a first prompt", detail: "At least one run with a reply", share: { n: count((m) => (runsBy.get(m.id)?.runs ?? 0) > 0), of: total } },
    { label: "Ran 3 or more prompts", detail: "All time", share: { n: count((m) => (runsBy.get(m.id)?.runs ?? 0) >= 3), of: total } },
    { label: "Came back a later week", detail: "Active in any week after the signup week", share: { n: cameBack, of: total } },
    { label: "Logged a weekly number", detail: "At least one week on the weekly review", share: { n: count((m) => weeksBy.has(m.id)), of: total } },
  ];
  const hoursToFirst = members
    .map((m) => runsBy.get(m.id)?.first_run)
    .map((first, i) => (first ? (utc(first).getTime() - utc(members[i].created_at).getTime()) / 3600000 : null))
    .filter((h): h is number => h !== null && h >= 0);

  // ---------- retention cohorts ----------
  const cohorts = Array.from({ length: COHORT_WEEKS }, (_, i) => addWeeks(thisWeek, i - (COHORT_WEEKS - 1)))
    .reverse()
    .map((week) => {
      const group = members.filter((m) => weekOf(m.created_at) === week);
      const elapsed = weeksBetween(week, thisWeek);
      const cells = Array.from({ length: COHORT_WEEKS }, (_, k) => {
        if (k > elapsed || !group.length) return null;
        const target = addWeeks(week, k);
        return { n: group.filter((m) => activeWeeks.get(m.id)?.has(target)).length, of: group.length };
      });
      return { week, size: group.length, cells };
    });

  // ---------- phases ----------
  const phaseCounts = new Map<string, number>();
  for (const r of memberRows) phaseCounts.set(r.phase, (phaseCounts.get(r.phase) ?? 0) + 1);
  const phaseOrder = ["direction", "positioning", "search", "application", "interview", "practice", "offer"]
    .map((p) => (isPhase(p) ? phaseLabel(p) : p))
    .concat("Not chosen");
  const phases = phaseOrder.map((label) => ({ label, n: phaseCounts.get(label) ?? 0 }));

  // ---------- prompts ----------
  const prompts: PromptUse[] = promptRows.results.map((p) => ({
    key: p.key,
    name: p.name,
    place: placeOfPrompt(p.name)?.label ?? "Not on the route",
    runs: p.runs,
    runs30: p.runs30,
    members: p.members,
    avgTurns: p.avg_turns,
    capped: p.capped,
    cost: p.cost,
  }));
  const used = new Set(prompts.map((p) => p.key));
  const unusedPrompts = library.results.filter((p) => !used.has(p.key)).map((p) => p.name);
  const placeRuns = new Map<string, number>();
  for (const p of prompts) placeRuns.set(p.place, (placeRuns.get(p.place) ?? 0) + p.runs);
  const places = [...placeRuns.entries()].map(([label, runs]) => ({ label, runs })).sort((a, b) => b.runs - a.runs);

  // ---------- workspace depth ----------
  const depth = [
    { label: "Published a resume", detail: "In the Yuhpp template", share: { n: memberRows.filter((r) => r.resume === "Published").length, of: total } },
    { label: "Started a bullet bank", detail: "At least one bullet", share: { n: memberRows.filter((r) => r.bullets > 0).length, of: total } },
    {
      label: `Story bank at ${storyTarget}+`,
      detail: "Checkpoint 02 story target",
      share: { n: memberRows.filter((r) => r.stories >= storyTarget).length, of: total },
    },
    { label: "Logged 3+ weeks", detail: "The weekly cadence is sticking", share: { n: memberRows.filter((r) => r.weeksLogged >= 3).length, of: total } },
    { label: "Research consent", detail: "Can be counted in the evidence pack", share: { n: memberRows.filter((r) => r.researchConsent).length, of: total } },
  ];

  // ---------- run cap ----------
  const capWatch = {
    cap: runCap,
    near: runsThisMonth.results.filter((r) => r.n >= runCap * 0.8 && r.n < runCap).length,
    at: runsThisMonth.results.filter((r) => r.n >= runCap).length,
  };

  // ---------- outcomes ----------
  const totals = emptyCounts();
  for (const w of weekRows.results) for (const f of COUNT_FIELDS) totals[f.key] += w[f.key] ?? 0;
  const loggerIds = memberRows.filter((r) => r.weeksLogged > 0);
  const weeks = weekRows.results.slice(0, 8).map((w) => {
    const counts = emptyCounts();
    for (const f of COUNT_FIELDS) counts[f.key] = w[f.key] ?? 0;
    return { week: w.week_start, members: w.members, counts };
  });
  const rates = [
    { label: "Applications to recruiter screens", num: totals.recruiter_screens, den: totals.applications },
    { label: "Recruiter screens to hiring manager rounds", num: totals.hm_rounds, den: totals.recruiter_screens },
    { label: "Hiring manager rounds to panels", num: totals.panels, den: totals.hm_rounds },
    { label: "Panels to offers", num: totals.offers, den: totals.panels },
    { label: "Outreach sent to replies", num: totals.replies, den: totals.outreach },
    { label: "Replies to referrals", num: totals.referrals, den: totals.replies },
  ];

  // ---------- spend ----------
  const months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (5 - i), 1));
    return d.toISOString().slice(0, 7);
  }).map((month) => {
    const r = monthRuns.results.find((x) => x.month === month);
    return { month, runs: r?.runs ?? 0, runCost: r?.cost ?? 0, otherCost: monthOther.results.find((x) => x.month === month)?.cost ?? 0 };
  });
  const spend30 = purposeRows.results.reduce((s, p) => s + p.cost, 0);
  const runs30All = purposeRows.results.find((p) => p.purpose === "prompt runs")?.calls ?? 0;
  const mau = activeWithin(30);

  // ---------- people to nudge ----------
  const nudges: Nudge[] = [];
  for (const m of members) {
    const joinedDays = daysAgo(utc(m.created_at), now);
    const r = runsBy.get(m.id);
    const last = lastActive(m.id);
    if (!r?.runs && joinedDays >= 3) {
      nudges.push({ id: m.id, name: nameOf(m), email: m.email, reason: "Signed up, never ran a prompt", since: m.created_at });
    } else if (r?.runs && last && daysAgo(last, now) >= 14) {
      nudges.push({ id: m.id, name: nameOf(m), email: m.email, reason: "Was active, quiet for 14+ days", since: last.toISOString() });
    }
  }

  return {
    includeAdmins: opts.includeAdmins,
    excludedCount: excludedIds.length,
    minSample,
    generatedAt: now.toISOString(),
    headline: {
      members: total,
      new7: joinedWithin(7),
      new30: joinedWithin(30),
      wau: activeWithin(7),
      mau,
      runs7: runsWithin(7),
      runs30: runsWithin(30),
      spendMonth,
      spendProjected,
    },
    trend,
    milestones,
    medianHoursToFirstRun: median(hoursToFirst),
    cohorts,
    phases,
    prompts,
    unusedPrompts,
    libraryCount: library.results.length,
    places,
    depth,
    capWatch,
    outcomes: {
      totals,
      loggers: loggerIds.length,
      loggersConsented: loggerIds.filter((r) => r.researchConsent).length,
      weeks,
      rates,
    },
    spend: {
      months,
      byPurpose: purposeRows.results,
      costPerRun30: runs30All ? purposeRows.results.find((p) => p.purpose === "prompt runs")!.cost / runs30All : null,
      costPerActive30: mau ? spend30 / mau : null,
    },
    nudges,
    members: memberRows,
  };
}
