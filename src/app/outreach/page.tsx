import { redirect } from "next/navigation";
import AppShell from "../components/AppShell";
import PromptCards, { catalogMap } from "../components/PromptCards";
import SavedSearches from "../components/SavedSearches";
import { isAdmin } from "@/lib/admin";
import { bindings } from "@/lib/cloudflare";
import { shortDate } from "@/lib/dates";
import { activityByPrompt, promptCatalog } from "@/lib/runs";
import { currentMember } from "@/lib/session";
import { listSearches } from "@/lib/workspace";

export const dynamic = "force-dynamic";

export const metadata = { title: "Outreach | Yuhpp" };

export default async function OutreachPage() {
  const member = await currentMember();
  if (!member) redirect("/login");

  const { DB } = await bindings();
  const [searches, catalog, activity] = await Promise.all([
    listSearches(DB, member.id),
    promptCatalog(DB),
    activityByPrompt(DB, member.id),
  ]);
  const map = catalogMap(catalog);

  return (
    <AppShell admin={isAdmin(member)} active="search">
      <p className="eyebrow">Workspace</p>
      <h1 className="panel-title">Outreach</h1>
      <p className="purpose">
        Your saved searches, ready to run again whenever you check for new postings, next to the
        prompts that find roles and the people who can refer you.
      </p>

      <section className="home-block">
        <p className="section-label">Saved searches</p>
        {searches.length === 0 ? (
          <div className="note calm">
            <p>
              <strong>Nothing saved yet.</strong> Run Smart Job Search Builder below. Every search it
              writes has a <strong>Save search</strong> button, and saved searches land here.
            </p>
          </div>
        ) : null}
        <SavedSearches
          searches={searches.map((s) => ({
            id: s.id,
            label: s.label,
            query: s.query,
            run_id: s.run_id,
            saved: shortDate(s.created_at),
          }))}
        />
      </section>

      <section className="home-block">
        <p className="section-label">Track A: finding roles</p>
        <PromptCards names={["Smart Job Search Builder", "Job Search Assistance Process"]} catalog={map} activity={activity} />
        <p className="section-label">Track B: finding people</p>
        <PromptCards
          names={["Networking Target Finder", "LinkedIn Outreach Strategist", "Referral Draft Builder"]}
          catalog={map}
          activity={activity}
        />
      </section>
    </AppShell>
  );
}
