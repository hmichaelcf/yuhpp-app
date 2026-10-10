import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import AppShell from "../../components/AppShell";
import PromptCards, { catalogMap } from "../../components/PromptCards";
import Rich from "../../components/Rich";
import { isAdmin } from "@/lib/admin";
import { bindings } from "@/lib/cloudflare";
import { PHASES, phaseBySlug, type Block, type Table } from "@/lib/route-map";
import { activityByPrompt, promptCatalog } from "@/lib/runs";
import { currentMember } from "@/lib/session";
import { loadSettings, type Settings } from "@/lib/settings";

// One phase of the route: the guide's copy, with every prompt runnable here.

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const phase = phaseBySlug(slug);
  return { title: phase ? `${phase.title} | Yuhpp` : "Yuhpp" };
}

const one = (n: number) => n.toFixed(1);

/** Checkpoint 04's table, built from the thresholds in settings. */
function applyTable(settings: Settings): Table {
  const apply = settings.number("g3_apply_min", 7.0);
  const quick = settings.number("g3_quick_wins_min", 5.5);
  return {
    head: ["Score", "What you do"],
    rows: [
      { a: `${one(apply)} and up`, b: "Apply. Attempt a referral first.", tone: "go" },
      {
        a: `${one(quick)} to ${one(apply - 0.1)}`,
        b: "Apply only after running the Quick Wins from the Match Meter output, or if you have a referral.",
      },
      { a: `Under ${one(quick)}`, b: "Skip.", tone: "stop" },
      { a: "Constraint miss", b: "Skip, whatever the score says.", tone: "stop" },
    ],
  };
}

function RuleTable({ table }: { table: Table }) {
  return (
    <table className="rule-table">
      <thead>
        <tr>
          <th>{table.head[0]}</th>
          <th>{table.head[1]}</th>
        </tr>
      </thead>
      <tbody>
        {table.rows.map((r) => (
          <tr key={r.a} className={r.tone === "go" ? "go" : r.tone === "stop" ? "stopr" : undefined}>
            <td>{r.a}</td>
            <td>{r.b}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default async function PhasePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const phase = phaseBySlug(slug);
  if (!phase) notFound();

  const member = await currentMember();
  if (!member) redirect("/login");

  const { DB } = await bindings();
  const [settings, catalogRows, activity] = await Promise.all([
    loadSettings(DB),
    promptCatalog(DB),
    activityByPrompt(DB, member.id),
  ]);
  const catalog = catalogMap(catalogRows);
  const fill = (text: string) =>
    text.replace("{exceptions}", String(settings.number("strategic_exceptions_per_week", 2)));

  const render = (b: Block, i: number) => {
    switch (b.t) {
      case "purpose":
        return (
          <p key={i} className="purpose">
            <Rich text={fill(b.v)} />
          </p>
        );
      case "label":
        return (
          <p key={i} className="section-label">
            {b.v}
          </p>
        );
      case "prompts":
        return (
          <div key={i}>
            {b.note ? <p className="rstack-note">{b.note}</p> : null}
            <PromptCards names={b.names} catalog={catalog} activity={activity} loop={b.loop} />
          </div>
        );
      case "aside":
        return (
          <p key={i} className="aside">
            <Rich text={fill(b.v)} />
          </p>
        );
      case "note":
        return (
          <div key={i} className={`note ${b.tone}`}>
            <p>
              <Rich text={fill(b.v)} />
            </p>
          </div>
        );
      case "table":
        return <RuleTable key={i} table={b.table} />;
      case "checklist":
        return (
          <div key={i} className="gate plainbox">
            <ul>
              {b.items.map((x) => (
                <li key={x}>
                  <Rich text={x} />
                </li>
              ))}
            </ul>
          </div>
        );
      case "gate":
        return (
          <div key={i} className={phase.loop ? "gate loop" : "gate"}>
            <p className="gate-eyebrow">{b.num}</p>
            <h3>{b.title}</h3>
            <p>{b.body}</p>
            {b.criteria ? (
              <ul>
                {b.criteria.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
            ) : null}
            {b.table ? <RuleTable table={b.table === "apply" ? applyTable(settings) : b.table} /> : null}
          </div>
        );
    }
  };

  const index = PHASES.indexOf(phase);
  const prev = PHASES[index - 1];
  const next = PHASES[index + 1];

  return (
    <AppShell admin={isAdmin(member)} active={phase.stop}>
      <section className="panel">
        <p className={phase.loop ? "eyebrow loop" : "eyebrow"}>{phase.code}</p>
        <h1 className="panel-title">{phase.title}</h1>
        {phase.blocks.map(render)}
        <nav className="panel-nav" aria-label="Phases">
          {prev ? (
            <Link className="nav-btn" href={`/phase/${prev.slug}`}>
              <small>&larr; Back</small>
              <b>{prev.title}</b>
            </Link>
          ) : (
            <span />
          )}
          {next ? (
            <Link className="nav-btn next" href={`/phase/${next.slug}`}>
              <small>Next &rarr;</small>
              <b>{next.title}</b>
            </Link>
          ) : null}
        </nav>
      </section>
    </AppShell>
  );
}
