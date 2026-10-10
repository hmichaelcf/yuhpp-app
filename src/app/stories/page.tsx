import { redirect } from "next/navigation";
import AppShell from "../components/AppShell";
import PromptCards, { catalogMap } from "../components/PromptCards";
import StoryBank from "../components/StoryBank";
import { isAdmin } from "@/lib/admin";
import { bindings } from "@/lib/cloudflare";
import { activityByPrompt, promptCatalog } from "@/lib/runs";
import { currentMember } from "@/lib/session";
import { loadSettings } from "@/lib/settings";
import { isDeveloped, listStories, storyThemes } from "@/lib/workspace";

export const dynamic = "force-dynamic";

export const metadata = { title: "STAR stories | Yuhpp" };

export default async function StoriesPage() {
  const member = await currentMember();
  if (!member) redirect("/login");

  const { DB } = await bindings();
  const [settings, stories, catalog, activity] = await Promise.all([
    loadSettings(DB),
    listStories(DB, member.id),
    promptCatalog(DB),
    activityByPrompt(DB, member.id),
  ]);
  const min = settings.number("story_bank_target_min", 6);
  const max = settings.number("story_bank_target_max", 8);
  const developed = stories.filter(isDeveloped).length;
  const themes = storyThemes(stories);
  const pct = Math.min(developed / min, 1) * 100;

  return (
    <AppShell admin={isAdmin(member)} active="positioning">
      <p className="eyebrow">Workspace</p>
      <h1 className="panel-title">STAR stories</h1>
      <p className="purpose">
        Your story bank. Build it before you apply at volume, so you are not{" "}
        <em>building it under interview pressure,</em> one panel at a time.
      </p>

      <div className="progress-card">
        <div className="progress-top">
          <span className="progress-big">
            {developed}
            <small> of {min}</small>
          </span>
          <span className="progress-caption">
            developed stories, across {themes.length} {themes.length === 1 ? "theme" : "themes"}.
            Checkpoint 02 asks for {min} to {max}, covering distinct themes.
          </span>
        </div>
        <div className="progress-track wide" aria-hidden="true">
          <div className="progress-fill" style={{ width: `${pct}%` }} />
        </div>
        {themes.length ? (
          <p className="chips">
            {themes.map((t) => (
              <span key={t} className="chip">
                {t}
              </span>
            ))}
          </p>
        ) : (
          <p className="form-hint">Tag each story with the themes it covers to see your spread here.</p>
        )}
      </div>

      <section className="home-block">
        <StoryBank
          stories={stories.map(({ id, title, themes, situation, task, action, result }) => ({
            id,
            title,
            themes,
            situation,
            task,
            action,
            result,
          }))}
        />
      </section>

      <section className="home-block">
        <p className="section-label">Prompts that find and shape stories</p>
        <PromptCards
          names={["STAR Story Scout", "Experience Story Builder", "STAR Story Shaper", "STAR to Bullet Converter"]}
          catalog={catalogMap(catalog)}
          activity={activity}
        />
      </section>
    </AppShell>
  );
}
