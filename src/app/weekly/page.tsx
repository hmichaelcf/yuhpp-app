import Link from "next/link";
import { redirect } from "next/navigation";
import AppShell from "../components/AppShell";
import CopyButton from "../components/CopyButton";
import PromptCards, { catalogMap } from "../components/PromptCards";
import WeeklyForm, { type LoggedWeek } from "../components/WeeklyForm";
import { isAdmin } from "@/lib/admin";
import { bindings } from "@/lib/cloudflare";
import { activityByPrompt, promptCatalog } from "@/lib/runs";
import { currentMember } from "@/lib/session";
import { loadSettings } from "@/lib/settings";
import {
  addWeeks,
  computeMetrics,
  currentWeek,
  listLogs,
  longWeek,
  reviewInput,
  type Rate,
  type WeeklyLog,
} from "@/lib/weekly";
import { COUNT_FIELDS, shortWeek, weeklyNumberLine } from "@/lib/weekly-fields";

// Weekly review: log the week's numbers, see progress metrics built from the
// member's own data, copy the weekly number, and run the review prompt.

export const dynamic = "force-dynamic";

export const metadata = { title: "Weekly review | Yuhpp" };

const pct = (v: number | null) => (v === null ? "No data" : `${Math.round(v * 100)}%`);
const avg = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(1));

function RateRow({ r }: { r: Rate }) {
  const width = r.value === null ? 0 : Math.min(r.value, 1) * 100;
  return (
    <li className={r.meaningful ? "rate" : "rate thin"}>
      <span className="rate-label">{r.label}</span>
      <span className="rate-bar" aria-hidden="true">
        <span className="rate-fill" style={{ width: `${width}%` }} />
      </span>
      <span className={r.value === null ? "rate-value none" : "rate-value"}>{pct(r.value)}</span>
      <span className="rate-detail">
        {r.num} of {r.den}
        {r.meaningful ? "" : <span className="sr-only">, too few to read yet</span>}
      </span>
    </li>
  );
}

export default async function WeeklyPage() {
  const member = await currentMember();
  if (!member) redirect("/login");

  const { DB } = await bindings();
  const [settings, logs, catalog, activity] = await Promise.all([
    loadSettings(DB),
    listLogs(DB, member.id),
    promptCatalog(DB),
    activityByPrompt(DB, member.id),
  ]);
  const week = currentWeek();
  const minSample = settings.number("metric_min_sample", 10);
  const m = computeMetrics(logs, week, minSample);

  const weeks = Array.from({ length: 8 }, (_, i) => {
    const value = addWeeks(week, -i);
    return { value, label: i === 0 ? `This week (${shortWeek(value)})` : i === 1 ? `Last week (${shortWeek(value)})` : `Week of ${shortWeek(value)}` };
  });
  const logged: Record<string, LoggedWeek> = Object.fromEntries(
    logs.map((l) => [l.week_start, { ...pick(l), note: l.note }]),
  );
  const latest: WeeklyLog | undefined = logs[0];
  const invite = settings.text("community_invite_url", "");

  return (
    <AppShell admin={isAdmin(member)} active="weekly">
      <p className="eyebrow">Runs alongside, every week</p>
      <h1 className="panel-title">Weekly review</h1>
      <p className="purpose">
        One review a week tells you which phase you are <em>actually</em> stuck in, which is often not
        the phase you think.
      </p>

      <section className="home-block">
        <p className="section-label">Log your numbers</p>
        <WeeklyForm weeks={weeks} logged={logged} initialWeek={week} />
      </section>

      <section className="home-block">
        <p className="section-label">How you are progressing</p>
        {m.weeksLogged === 0 ? (
          <p className="aside">
            Log your first week and your progress appears here: how steady your cadence is, how your
            volume compares with recent weeks, and how each stage converts to the next.
          </p>
        ) : (
          <>
            <div className="kpis">
              <div className="kpi">
                <span className="kpi-label">Weeks logged in a row</span>
                <span className="kpi-value">{m.streak}</span>
                <span className="kpi-note">
                  {m.thisWeek ? "Including this week." : "This week is not logged yet."}
                </span>
              </div>
              <div className="kpi">
                <span className="kpi-label">Weeks with outreach sent</span>
                <span className="kpi-value">
                  {m.outreachWeeks.hit}
                  <small> of {m.outreachWeeks.of}</small>
                </span>
                <span className="kpi-note">Outreach every week, not in bursts.</span>
              </div>
              {m.volume.map((v) => (
                <div key={v.key} className="kpi">
                  <span className="kpi-label">{v.label}</span>
                  <span className="kpi-value">{v.value ?? 0}</span>
                  <span className="kpi-note">
                    {v.week === week ? "This week" : v.week ? `Week of ${shortWeek(v.week)}` : ""}
                    {v.average === null ? ". No earlier weeks to compare yet." : `, against a recent average of ${avg(v.average)}.`}
                  </span>
                </div>
              ))}
            </div>

            <h2 className="sub-title">Application funnel, all weeks</h2>
            <ul className="rates">
              {m.appFunnel.map((r) => (
                <RateRow key={r.label} r={r} />
              ))}
            </ul>

            <h2 className="sub-title">Networking funnel, all weeks</h2>
            <ul className="rates">
              {m.networkFunnel.map((r) => (
                <RateRow key={r.label} r={r} />
              ))}
              <RateRow r={m.referralsPerApplication} />
            </ul>
            <p className="form-hint rate-legend">
              <span className="legend-swatch" aria-hidden="true" /> Gray bars start from fewer than{" "}
              {minSample}, so read them as a direction only. These are your own conversion rates; which
              one is the bottleneck depends on a benchmark, and that is what Weekly Pipeline Review is for.
            </p>
          </>
        )}
      </section>

      {latest ? (
        <section className="home-block">
          <p className="section-label">Your weekly number</p>
          <div className="number-card">
            <p className="number-line">{weeklyNumberLine(latest.week_start, latest, latest.note)}</p>
            <div className="row-actions">
              <CopyButton text={weeklyNumberLine(latest.week_start, latest, latest.note)} label="Copy the line" />
              {invite ? <Link href="/community">Post it in Good company</Link> : null}
            </div>
          </div>
        </section>
      ) : null}

      <section className="home-block">
        <p className="section-label">Get the diagnosis</p>
        <p className="aside">
          Same day each week. The review turns your numbers into a funnel, finds the single weakest
          conversion, and hands back three to five ranked actions.
          {latest ? " Copy your numbers, start the review, and paste them in as your first message." : ""}
        </p>
        {latest ? (
          <p>
            <CopyButton text={reviewInput(latest, m.totals, m.weeksLogged)} label="Copy numbers for the review" />
          </p>
        ) : null}
        <PromptCards names={["Weekly Pipeline Review"]} catalog={catalogMap(catalog)} activity={activity} />
      </section>

      {logs.length ? (
        <section className="home-block">
          <p className="section-label">Every week you have logged</p>
          <div className="table-scroll">
            <table className="admin-table history">
              <thead>
                <tr>
                  <th>Week</th>
                  {COUNT_FIELDS.map((f) => (
                    <th key={f.key}>{f.short}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {logs.map((l) => (
                  <tr key={l.week_start}>
                    <td className="mono" title={longWeek(l.week_start)}>
                      {shortWeek(l.week_start)}
                    </td>
                    {COUNT_FIELDS.map((f) => (
                      <td key={f.key} className="num">
                        {l[f.key]}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </AppShell>
  );
}

function pick(l: WeeklyLog) {
  return Object.fromEntries(COUNT_FIELDS.map((f) => [f.key, l[f.key]])) as Omit<LoggedWeek, "note">;
}
