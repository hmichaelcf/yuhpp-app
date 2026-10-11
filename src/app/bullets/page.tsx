import { redirect } from "next/navigation";
import AppShell from "../components/AppShell";
import BulletBank from "../components/BulletBank";
import PromptCards, { catalogMap } from "../components/PromptCards";
import { isAdmin } from "@/lib/admin";
import { bindings } from "@/lib/cloudflare";
import { activityByPrompt, promptCatalog } from "@/lib/runs";
import { currentMember } from "@/lib/session";
import { loadSettings } from "@/lib/settings";
import { listBullets, listExperiences } from "@/lib/workspace";

export const dynamic = "force-dynamic";

export const metadata = { title: "Bullet bank | Yuhpp" };

export default async function BulletsPage() {
  const member = await currentMember();
  if (!member) redirect("/login");

  const { DB } = await bindings();
  const [settings, bullets, experiences, catalog, activity] = await Promise.all([
    loadSettings(DB),
    listBullets(DB, member.id),
    listExperiences(DB, member.id),
    promptCatalog(DB),
    activityByPrompt(DB, member.id),
  ]);
  const max = settings.number("bullet_max_chars", 75);

  return (
    <AppShell admin={isAdmin(member)} active="positioning">
      <p className="eyebrow">Workspace</p>
      <h1 className="panel-title">Bullet bank</h1>
      <p className="purpose">
        Every resume bullet you have written, kept in one place and sorted by role from most recent
        to oldest, so the strongest
        ones are ready <em>whenever you tailor a resume.</em>
      </p>
      <p className="aside">
        Paste several at once, one per line. Anything over {max} characters is flagged so you can
        tighten it later. Click a role&apos;s heading to fix its title, company, or dates.
      </p>

      <section className="home-block">
        <BulletBank
          bullets={bullets.map(({ id, text, tags, experience_id }) => ({ id, text, tags, experienceId: experience_id }))}
          experiences={experiences.map((x) => ({
            id: x.id,
            role: x.role,
            company: x.company,
            start: x.start_month,
            end: x.end_month,
            current: x.is_current === 1,
          }))}
          max={max}
        />
      </section>

      <section className="home-block">
        <p className="section-label">Prompts that write and tighten bullets</p>
        <PromptCards
          names={["Resume Bullet Refinement", "Experience Story Builder", "Resume Growth Advisor"]}
          catalog={catalogMap(catalog)}
          activity={activity}
        />
      </section>
    </AppShell>
  );
}
