import Link from "next/link";
import { redirect } from "next/navigation";
import Masthead from "./components/Masthead";
import { isAdmin } from "@/lib/admin";
import { bindings } from "@/lib/cloudflare";
import { recentRuns, runsUsedThisMonth } from "@/lib/runs";
import { currentMember } from "@/lib/session";
import { loadSettings } from "@/lib/settings";

// Signed-in home. Becomes the dashboard in later phases.
export const dynamic = "force-dynamic";

const COMING = [
  { phase: "Phase 2", text: "Onboarding: your direction, resume, and story bank." },
  { phase: "Phase 3", text: "Your jobs: constraint check, Match Meter, and applying." },
  { phase: "Phase 4", text: "Interviews: a prep stack for each round type." },
  { phase: "Phase 5", text: "Your weekly review and the practice loop." },
];

function when(sqlite: string): string {
  return new Date(`${sqlite.replace(" ", "T")}Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "America/Los_Angeles",
  });
}

export default async function Home() {
  const member = await currentMember();
  if (!member) {
    redirect("/login");
  }

  const { DB } = await bindings();
  const [settings, used, runs] = await Promise.all([
    loadSettings(DB),
    runsUsedThisMonth(DB, member.id),
    recentRuns(DB, member.id),
  ]);
  const cap = settings.number("run_cap_monthly", 75);
  const left = Math.max(cap - used, 0);

  return (
    <>
      <Masthead signedIn admin={isAdmin(member)} />
      <main className="page">
        <p className="eyebrow">Signed in</p>
        <h1 className="title">
          Welcome to <em>your workspace.</em>
        </h1>
        <p className="lede">
          You are signed in as <strong>{member.email ?? "a Yuhpp member"}</strong>. You have{" "}
          <strong>
            {left} of {cap}
          </strong>{" "}
          prompt runs left this month.
        </p>
        <p>
          <Link href="/prompts" className="primary-button inline link-button">
            Run a prompt
          </Link>
        </p>

        {runs.length > 0 ? (
          <section className="admin-block">
            <p className="section-label">Your recent runs</p>
            <ul className="checks">
              {runs.map((r) => (
                <li key={r.id} className={r.status === "open" ? "check ok" : "check pending"}>
                  <span className="dot" aria-hidden="true" />
                  <span className="label">
                    <Link href={`/run/${r.id}`}>{r.prompt_name}</Link>
                  </span>
                  <span className="detail">
                    {r.status === "open" ? "In progress" : "Finished"}, {when(r.created_at)}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section className="admin-block">
          <p className="section-label">What is coming</p>
          <ul className="checks">
            {COMING.map((item) => (
              <li key={item.phase} className="check pending">
                <span className="dot" aria-hidden="true" />
                <span className="label">{item.phase}</span>
                <span className="detail">{item.text}</span>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </>
  );
}
