import "server-only";
import { COUNT_FIELDS, emptyCounts, shortWeek, type CountKey, type Counts } from "./weekly-fields";

// Weekly numbers and the progress metrics built from them. One row per
// member per week; weeks start on Monday, Pacific time. Every query filters
// by the member id from a verified session.
//
// The metrics deliberately stop short of naming a bottleneck: that needs a
// benchmark, and the Weekly Pipeline Review prompt is where the benchmark is
// stated and labeled as approximate. The app shows the member's own numbers.

export type WeeklyLog = Counts & {
  id: number;
  week_start: string;
  note: string | null;
  updated_at: string;
};

const ZONE = "America/Los_Angeles";

/** Today's date in Pacific time, as YYYY-MM-DD. */
export function todayPacific(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** The Monday on or before a YYYY-MM-DD date. */
export function mondayOf(ymd: string): string {
  const d = new Date(`${ymd}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}

export function addWeeks(weekStart: string, n: number): string {
  const d = new Date(`${weekStart}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n * 7);
  return d.toISOString().slice(0, 10);
}

export function currentWeek(now = new Date()): string {
  return mondayOf(todayPacific(now));
}

export function isWeekStart(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && mondayOf(value) === value;
}

/** "Week of October 6, 2026". */
export function longWeek(weekStart: string): string {
  return `Week of ${new Date(`${weekStart}T12:00:00Z`).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  })}`;
}

const COLUMNS = COUNT_FIELDS.map((f) => f.key).join(", ");

export async function listLogs(db: D1Database, memberId: string): Promise<WeeklyLog[]> {
  return (
    await db
      .prepare(
        `SELECT id, week_start, ${COLUMNS}, note, updated_at FROM weekly_logs
         WHERE member_id = ?1 ORDER BY week_start DESC`,
      )
      .bind(memberId)
      .all<WeeklyLog>()
  ).results;
}

/** Saves the counts for one week, replacing what was there. */
export async function saveLog(
  db: D1Database,
  memberId: string,
  weekStart: string,
  counts: Counts,
  note: string | null,
): Promise<void> {
  const keys = COUNT_FIELDS.map((f) => f.key);
  const values = keys.map((k) => counts[k]);
  const placeholders = keys.map((_, i) => `?${i + 3}`).join(", ");
  const updates = keys.map((k) => `${k} = excluded.${k}`).join(", ");
  await db
    .prepare(
      `INSERT INTO weekly_logs (member_id, week_start, ${keys.join(", ")}, note)
       VALUES (?1, ?2, ${placeholders}, ?${keys.length + 3})
       ON CONFLICT (member_id, week_start) DO UPDATE SET
         ${updates}, note = excluded.note, updated_at = datetime('now')`,
    )
    .bind(memberId, weekStart, ...values, note)
    .run();
}

export async function deleteLog(db: D1Database, memberId: string, weekStart: string): Promise<boolean> {
  const res = await db
    .prepare("DELETE FROM weekly_logs WHERE member_id = ?1 AND week_start = ?2")
    .bind(memberId, weekStart)
    .run();
  return res.meta.changes > 0;
}

// ---------- metrics ----------

export type Rate = {
  /** What the row is called, such as "Applications to recruiter screens". */
  label: string;
  from: string;
  to: string;
  num: number;
  den: number;
  /** 0 to 1, or null when the earlier stage is zero. */
  value: number | null;
  /** False until the earlier stage reaches the minimum sample. */
  meaningful: boolean;
};

export type WeeklyMetrics = {
  week: string;
  thisWeek: WeeklyLog | null;
  weeksLogged: number;
  /** Weeks logged in a row, counting back from this week (or last week, until this week is logged). */
  streak: number;
  /** Weeks with outreach sent, out of the recent window. */
  outreachWeeks: { hit: number; of: number };
  /** The latest logged week's volume, against the average of the four weeks before it. */
  volume: { key: CountKey; label: string; week: string | null; value: number | null; average: number | null }[];
  totals: Counts;
  appFunnel: Rate[];
  networkFunnel: Rate[];
  referralsPerApplication: Rate;
  minSample: number;
};

function rate(from: string, to: string, num: number, den: number, minSample: number, label?: string): Rate {
  return {
    label: label ?? `${from} to ${to.toLowerCase()}`,
    from,
    to,
    num,
    den,
    value: den > 0 ? num / den : null,
    meaningful: den >= minSample,
  };
}

export function computeMetrics(logs: WeeklyLog[], week: string, minSample: number): WeeklyMetrics {
  const byWeek = new Map(logs.map((l) => [l.week_start, l]));
  const thisWeek = byWeek.get(week) ?? null;

  const totals = emptyCounts();
  for (const l of logs) for (const f of COUNT_FIELDS) totals[f.key] += l[f.key];

  // Cadence counts from this week once it is logged; until then, from last week,
  // so the streak does not reset every Monday morning.
  const anchor = thisWeek ? week : addWeeks(week, -1);
  let streak = 0;
  for (let w = anchor; byWeek.has(w); w = addWeeks(w, -1)) streak++;

  const earliest = logs.length ? logs[logs.length - 1].week_start : null;
  let hit = 0;
  let of = 0;
  if (earliest) {
    for (let i = 0, w = anchor; i < 4 && w >= earliest; i++, w = addWeeks(w, -1)) {
      of++;
      if ((byWeek.get(w)?.outreach ?? 0) > 0) hit++;
    }
  }

  const latest = logs[0] ?? null;
  const previous = latest
    ? [1, 2, 3, 4].map((n) => byWeek.get(addWeeks(latest.week_start, -n))).filter((l): l is WeeklyLog => !!l)
    : [];
  const volume = (["applications", "outreach"] as const).map((key) => ({
    key,
    label: COUNT_FIELDS.find((f) => f.key === key)!.label,
    week: latest ? latest.week_start : null,
    value: latest ? latest[key] : null,
    average: previous.length ? previous.reduce((s, l) => s + l[key], 0) / previous.length : null,
  }));

  const stages: [CountKey, string][] = [
    ["applications", "Applications"],
    ["recruiter_screens", "Recruiter screens"],
    ["hm_rounds", "Hiring manager rounds"],
    ["panels", "Panels and onsites"],
    ["offers", "Offers"],
  ];
  const appFunnel = stages.slice(1).map(([key, label], i) => {
    const [prevKey, prevLabel] = stages[i];
    return rate(prevLabel, label, totals[key], totals[prevKey], minSample);
  });
  const networkFunnel = [
    rate("Outreach sent", "Replies", totals.replies, totals.outreach, minSample),
    rate("Replies", "Referrals", totals.referrals, totals.replies, minSample),
  ];

  return {
    week,
    thisWeek,
    weeksLogged: logs.length,
    streak,
    outreachWeeks: { hit, of },
    volume,
    totals,
    appFunnel,
    networkFunnel,
    referralsPerApplication: rate(
      "Applications",
      "Referrals",
      totals.referrals,
      totals.applications,
      minSample,
      "Referrals per application",
    ),
    minSample,
  };
}

/** The text to paste into a Weekly Pipeline Review run: this week plus totals. */
export function reviewInput(log: WeeklyLog, totals: Counts, weeksLogged: number): string {
  const line = (c: Counts) => COUNT_FIELDS.map((f) => `${f.label} ${c[f.key]}`).join(", ");
  return [
    `Weekly review for the week of ${shortWeek(log.week_start)}.`,
    `This week: ${line(log)}.`,
    `Cumulative to date (${weeksLogged} ${weeksLogged === 1 ? "week" : "weeks"} logged): ${line(totals)}.`,
    log.note ? `Planned focus: ${log.note}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}
