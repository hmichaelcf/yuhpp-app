import Link from "next/link";
import InsightBars from "../../components/InsightBars";
import Masthead from "../../components/Masthead";
import { requireAdminPage } from "@/lib/admin";
import { bindings } from "@/lib/cloudflare";
import { loadInsights, type Share } from "@/lib/insights";
import { COUNT_FIELDS } from "@/lib/weekly-fields";

export const dynamic = "force-dynamic";

export const metadata = { title: "Insights | Yuhpp" };

// Admin only. Reads across all members (see src/lib/insights.ts), counts rows
// and timestamps, and never shows message or resume text.

const ZONE = "America/Los_Angeles";

function shortDay(iso: string): string {
  const d = new Date(iso.includes("T") ? iso : `${iso.replace(" ", "T")}Z`);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: ZONE });
}

function weekLabel(weekStart: string): string {
  return new Date(`${weekStart}T12:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function monthLabel(ym: string): string {
  return new Date(`${ym}-15T12:00:00Z`).toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" });
}

function ago(iso: string | null): string {
  if (!iso) return "No activity";
  const days = (Date.now() - new Date(iso).getTime()) / 86400000;
  if (days < 1) return "Today";
  if (days < 2) return "Yesterday";
  return `${Math.floor(days)} days ago`;
}

const money = (n: number) =>
  Number.isInteger(n) || n >= 10 ? `$${Math.round(n).toLocaleString("en-US")}` : `$${n.toFixed(2)}`;
const pct = (s: Share) => (s.of ? `${Math.round((s.n / s.of) * 100)}%` : "0%");

/** One labeled meter: a share of members, grayed when the group is under the sample minimum. */
function Meter({ label, detail, share, small }: { label: string; detail?: string; share: Share; small: boolean }) {
  const width = share.of ? Math.round((share.n / share.of) * 100) : 0;
  return (
    <li className={small ? "ins-meter is-small" : "ins-meter"}>
      <div className="ins-meter-text">
        <span className="ins-meter-label">{label}</span>
        {detail ? <span className="ins-meter-detail">{detail}</span> : null}
      </div>
      <div className="ins-meter-track" aria-hidden="true">
        <div className="ins-meter-fill" style={{ width: `${width}%` }} />
      </div>
      <span className="ins-meter-value">
        <strong>{pct(share)}</strong> {share.n} of {share.of}
      </span>
    </li>
  );
}

function Stat({ value, label, note }: { value: string | number; label: string; note?: string }) {
  return (
    <div className="stat">
      <span className="stat-value">{value}</span>
      <span className="stat-label">{label}</span>
      {note ? <span className="ins-stat-note">{note}</span> : null}
    </div>
  );
}

export default async function InsightsPage({ searchParams }: { searchParams: Promise<{ admins?: string }> }) {
  await requireAdminPage();
  const [{ DB }, query] = await Promise.all([bindings(), searchParams]);
  const includeAdmins = query.admins === "1";
  const d = await loadInsights(DB, { includeAdmins });
  const small = d.headline.members < d.minSample;
  const h = d.headline;
  const stickiness = h.mau ? Math.round((h.wau / h.mau) * 100) : null;
  const updated = new Date(d.generatedAt).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: ZONE,
  });

  return (
    <>
      <Masthead signedIn admin />
      <main className="page ins">
        <p className="eyebrow">
          <Link href="/admin">Admin</Link> / Insights
        </p>
        <h1 className="title">
          Read the <em>room.</em>
        </h1>
        <p className="lede">
          Who is using Yuhpp, what they do once they are in, whether they come back, and what it costs. Live from the
          app&apos;s database.
        </p>
        <p className="aside ins-meta">
          Updated {updated} Pacific.{" "}
          {includeAdmins ? (
            <>
              Admin accounts are included. <Link href="/admin/insights">Leave them out</Link>
            </>
          ) : (
            <>
              {d.excludedCount} admin account{d.excludedCount === 1 ? " is" : "s are"} left out of member numbers.{" "}
              <Link href="/admin/insights?admins=1">Include them</Link>
            </>
          )}
          . Spend always counts every account.
        </p>
        {small ? (
          <p className="ins-note">
            {h.members} member{h.members === 1 ? "" : "s"} so far. Under {d.minSample}, every percentage here is direction
            only, so read the counts beside them.
          </p>
        ) : null}

        <section className="admin-block">
          <p className="section-label">At a glance</p>
          <div className="stats ins-stats">
            <Stat value={h.members} label="Members" note={`${h.new7} new this week, ${h.new30} in 30 days`} />
            <Stat value={h.wau} label="Active this week" note={`Last 7 days. ${h.mau} in 30 days`} />
            <Stat
              value={stickiness === null ? "n/a" : `${stickiness}%`}
              label="Weekly / monthly active"
              note="How many monthly members show up each week"
            />
            <Stat value={h.runs7} label="Prompt runs, 7 days" note={`${h.runs30} in 30 days`} />
            <Stat value={money(h.spendMonth)} label="API spend this month" note={`On pace for ${money(h.spendProjected)}`} />
            <Stat
              value={d.medianHoursToFirstRun === null ? "n/a" : d.medianHoursToFirstRun < 48 ? `${Math.round(d.medianHoursToFirstRun)}h` : `${Math.round(d.medianHoursToFirstRun / 24)}d`}
              label="Signup to first run"
              note="Median, members who ran one"
            />
          </div>
        </section>

        <section className="admin-block">
          <p className="section-label">Growth, last 12 weeks</p>
          <p className="aside">
            Weeks start Monday, Pacific. Active means the member did anything the app records that week: a prompt turn,
            a save in their workspace, a weekly number, a phase pick, or a sign-in.
          </p>
          <div className="ins-charts">
            <InsightBars
              title="New members per week"
              bars={d.trend.map((t) => ({ label: weekLabel(t.week), value: t.signups, tip: `Week of ${weekLabel(t.week)}: ${t.signups} new` }))}
            />
            <InsightBars
              title="Active members per week"
              bars={d.trend.map((t) => ({ label: weekLabel(t.week), value: t.active, tip: `Week of ${weekLabel(t.week)}: ${t.active} active` }))}
            />
            <InsightBars
              title="Prompt runs per week"
              bars={d.trend.map((t) => ({ label: weekLabel(t.week), value: t.runs, tip: `Week of ${weekLabel(t.week)}: ${t.runs} runs` }))}
            />
          </div>
          <details className="ins-details">
            <summary>See the weekly numbers</summary>
            <table className="admin-table ins-num">
              <thead>
                <tr>
                  <th>Week of</th>
                  <th>New</th>
                  <th>Active</th>
                  <th>Runs</th>
                </tr>
              </thead>
              <tbody>
                {[...d.trend].reverse().map((t) => (
                  <tr key={t.week}>
                    <td>{weekLabel(t.week)}</td>
                    <td>{t.signups}</td>
                    <td>{t.active}</td>
                    <td>{t.runs}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        </section>

        <section className="admin-block">
          <p className="section-label">Activation</p>
          <p className="aside">Share of all members who have reached each milestone, in the order the app expects them.</p>
          <ul className="ins-meters">
            {d.milestones.map((m) => (
              <Meter key={m.label} label={m.label} detail={m.detail} share={m.share} small={small} />
            ))}
          </ul>
        </section>

        <section className="admin-block">
          <p className="section-label">Retention by signup week</p>
          <p className="aside">
            Each row is the members who joined that week. Each column is the share of them active N weeks later. Week 0
            is the signup week.
          </p>
          <div className="ins-scroll">
            <table className="admin-table ins-cohort">
              <thead>
                <tr>
                  <th>Joined</th>
                  <th>Members</th>
                  {d.cohorts[0]?.cells.map((_, k) => (
                    <th key={k}>Wk {k}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {d.cohorts.map((c) => (
                  <tr key={c.week}>
                    <td>{weekLabel(c.week)}</td>
                    <td>{c.size}</td>
                    {c.cells.map((cell, k) => {
                      if (!cell) return <td key={k} className="ins-cell is-empty" />;
                      const share = cell.of ? cell.n / cell.of : 0;
                      const step = cell.n === 0 ? 0 : Math.min(4, Math.ceil(share * 4));
                      return (
                        <td key={k} className={`ins-cell s${step}`} title={`${cell.n} of ${cell.of} active`}>
                          {pct(cell)}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="admin-block">
          <p className="section-label">Where members are</p>
          <p className="aside">The phase each member picked on Home. Members change it themselves as they move.</p>
          <ul className="ins-meters">
            {d.phases.map((p) => (
              <Meter key={p.label} label={p.label} share={{ n: p.n, of: h.members }} small={small} />
            ))}
          </ul>
        </section>

        <section className="admin-block">
          <p className="section-label">Prompts</p>
          <p className="aside">
            {d.prompts.length} of {d.libraryCount} current prompts have been run. Runs with at least one reply, all
            time.
            {d.capWatch.at || d.capWatch.near
              ? ` This month, ${d.capWatch.at} member${d.capWatch.at === 1 ? " has" : "s have"} hit the ${d.capWatch.cap}-run cap and ${d.capWatch.near} ${d.capWatch.near === 1 ? "is" : "are"} within 20% of it.`
              : ` No one is near the ${d.capWatch.cap}-run monthly cap.`}
          </p>
          {d.places.length ? (
            <ul className="ins-meters">
              {d.places.map((p) => (
                <Meter
                  key={p.label}
                  label={p.label}
                  share={{ n: p.runs, of: d.places.reduce((s, x) => s + x.runs, 0) }}
                  small={false}
                />
              ))}
            </ul>
          ) : (
            <p className="aside">No prompt runs yet.</p>
          )}
          {d.prompts.length ? (
            <div className="ins-scroll">
              <table className="admin-table ins-num">
                <thead>
                  <tr>
                    <th>Prompt</th>
                    <th>Where</th>
                    <th>Runs</th>
                    <th>30 days</th>
                    <th>Members</th>
                    <th>Avg turns</th>
                    <th>Hit turn cap</th>
                    <th>Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {d.prompts.map((p) => (
                    <tr key={p.key}>
                      <td>{p.name}</td>
                      <td>{p.place}</td>
                      <td>{p.runs}</td>
                      <td>{p.runs30}</td>
                      <td>{p.members}</td>
                      <td>{p.avgTurns.toFixed(1)}</td>
                      <td>{p.capped}</td>
                      <td>{money(p.cost)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
          {d.unusedPrompts.length ? (
            <details className="ins-details">
              <summary>
                {d.unusedPrompts.length} prompt{d.unusedPrompts.length === 1 ? "" : "s"} never run
              </summary>
              <ul className="ins-list">
                {d.unusedPrompts.map((n) => (
                  <li key={n}>{n}</li>
                ))}
              </ul>
            </details>
          ) : null}
        </section>

        <section className="admin-block">
          <p className="section-label">Workspace depth</p>
          <p className="aside">How far members build the materials the method runs on.</p>
          <ul className="ins-meters">
            {d.depth.map((m) => (
              <Meter key={m.label} label={m.label} detail={m.detail} share={m.share} small={small} />
            ))}
          </ul>
        </section>

        <section className="admin-block">
          <p className="section-label">Search outcomes</p>
          <p className="aside">
            From the weekly numbers members log, all time. {d.outcomes.loggers} member
            {d.outcomes.loggers === 1 ? " has" : "s have"} logged, {d.outcomes.loggersConsented} with research consent,
            so only theirs can go in the evidence pack. Rates where the earlier stage is under {d.minSample} are gray.
          </p>
          <div className="stats ins-stats">
            <Stat value={d.outcomes.totals.applications} label="Applications" />
            <Stat value={d.outcomes.totals.recruiter_screens} label="Recruiter screens" />
            <Stat value={d.outcomes.totals.offers} label="Offers" />
          </div>
          <table className="admin-table ins-rates">
            <thead>
              <tr>
                <th>Rate</th>
                <th>Count</th>
                <th>Rate</th>
              </tr>
            </thead>
            <tbody>
              {d.outcomes.rates.map((r) => (
                <tr key={r.label} className={r.den < d.minSample ? "is-small" : undefined}>
                  <td>{r.label}</td>
                  <td>
                    {r.num} of {r.den}
                  </td>
                  <td>{r.den ? `${Math.round((r.num / r.den) * 100)}%` : "n/a"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {d.outcomes.weeks.length ? (
            <details className="ins-details">
              <summary>Totals by week</summary>
              <div className="ins-scroll">
                <table className="admin-table ins-num">
                  <thead>
                    <tr>
                      <th>Week of</th>
                      <th>Members</th>
                      {COUNT_FIELDS.map((f) => (
                        <th key={f.key}>{f.short}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {d.outcomes.weeks.map((w) => (
                      <tr key={w.week}>
                        <td>{weekLabel(w.week)}</td>
                        <td>{w.members}</td>
                        {COUNT_FIELDS.map((f) => (
                          <td key={f.key}>{w.counts[f.key]}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          ) : null}
        </section>

        <section className="admin-block">
          <p className="section-label">Spend</p>
          <p className="aside">Claude API cost recorded by the app, every account. Months are UTC.</p>
          <div className="stats ins-stats">
            <Stat value={money(h.spendMonth)} label="This month" note={`On pace for ${money(h.spendProjected)}`} />
            <Stat
              value={d.spend.costPerRun30 === null ? "n/a" : money(d.spend.costPerRun30)}
              label="Per prompt run"
              note="Last 30 days"
            />
            <Stat
              value={d.spend.costPerActive30 === null ? "n/a" : money(d.spend.costPerActive30)}
              label="Per active member"
              note="All spend, 30 days, over members active in 30 days"
            />
          </div>
          <div className="ins-charts">
            <InsightBars
              title="API spend by month"
              format={money}
              bars={d.spend.months.map((m) => ({
                label: monthLabel(m.month).split(" ")[0],
                value: m.runCost + m.otherCost,
                tip: `${monthLabel(m.month)}: ${money(m.runCost + m.otherCost)} (${m.runs} runs)`,
              }))}
            />
          </div>
          {d.spend.byPurpose.length ? (
            <table className="admin-table ins-num">
              <thead>
                <tr>
                  <th>Last 30 days</th>
                  <th>Calls</th>
                  <th>Cost</th>
                </tr>
              </thead>
              <tbody>
                {d.spend.byPurpose.map((p) => (
                  <tr key={p.purpose}>
                    <td>{p.purpose.replace(/_/g, " ")}</td>
                    <td>{p.calls}</td>
                    <td>{money(p.cost)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}
        </section>

        <section className="admin-block">
          <p className="section-label">People to nudge</p>
          <p className="aside">
            Members who signed up 3 or more days ago and never ran a prompt, and members who ran prompts but have been
            quiet for 14 days or more.
          </p>
          {d.nudges.length ? (
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Member</th>
                  <th>Why</th>
                  <th>Since</th>
                </tr>
              </thead>
              <tbody>
                {d.nudges.map((n) => (
                  <tr key={n.id}>
                    <td>
                      {n.name}
                      {n.email ? (
                        <>
                          <br />
                          <a className="ins-email" href={`mailto:${n.email}`}>
                            {n.email}
                          </a>
                        </>
                      ) : null}
                    </td>
                    <td>{n.reason}</td>
                    <td>{shortDay(n.since)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="aside">Nobody right now.</p>
          )}
        </section>

        <section className="admin-block">
          <p className="section-label">Members</p>
          <p className="aside">Most recently active first.</p>
          <div className="ins-scroll">
            <table className="admin-table ins-num ins-members">
              <thead>
                <tr>
                  <th>Member</th>
                  <th>Joined</th>
                  <th>Phase</th>
                  <th>Last active</th>
                  <th>Runs</th>
                  <th>30 days</th>
                  <th>Weeks logged</th>
                  <th>Resume</th>
                  <th>Research</th>
                </tr>
              </thead>
              <tbody>
                {d.members.map((m) => (
                  <tr key={m.id}>
                    <td>
                      {m.name}
                      {m.isAdmin ? <span className="ins-tag">Admin</span> : null}
                      {m.email ? (
                        <>
                          <br />
                          <a className="ins-email" href={`mailto:${m.email}`}>
                            {m.email}
                          </a>
                        </>
                      ) : null}
                    </td>
                    <td>{shortDay(m.joined)}</td>
                    <td>{m.phase}</td>
                    <td>{ago(m.lastActive)}</td>
                    <td>{m.runs}</td>
                    <td>{m.runs30}</td>
                    <td>{m.weeksLogged}</td>
                    <td>{m.resume}</td>
                    <td>{m.researchConsent ? "Yes" : "No"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </>
  );
}
