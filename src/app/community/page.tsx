import Link from "next/link";
import { redirect } from "next/navigation";
import AppShell from "../components/AppShell";
import CopyButton from "../components/CopyButton";
import { isAdmin } from "@/lib/admin";
import { bindings } from "@/lib/cloudflare";
import { currentMember } from "@/lib/session";
import { loadSettings } from "@/lib/settings";
import { listLogs } from "@/lib/weekly";
import { weeklyNumberLine } from "@/lib/weekly-fields";

// Good company: the WhatsApp community, and the member's weekly number ready
// to post there. The invite link lives in settings (community_invite_url).

export const dynamic = "force-dynamic";

export const metadata = { title: "Good company | Yuhpp" };

export default async function CommunityPage() {
  const member = await currentMember();
  if (!member) redirect("/login");

  const { DB } = await bindings();
  const [settings, logs] = await Promise.all([loadSettings(DB), listLogs(DB, member.id)]);
  const invite = settings.text("community_invite_url", "");
  const latest = logs[0];
  const line = latest ? weeklyNumberLine(latest.week_start, latest, latest.note) : null;

  return (
    <AppShell admin={isAdmin(member)} active="community">
      <p className="eyebrow">Runs alongside</p>
      <h1 className="panel-title">Good company</h1>
      <p className="purpose">
        The weekly cadence is easier to keep <em>when other people are keeping it too.</em>
      </p>
      <p className="aside">
        Good company is the Yuhpp community on WhatsApp, built around one ritual: The Weekly Number.
        Once a week, members post the one-line log from their weekly review.
      </p>

      {invite ? (
        <p>
          <a className="primary-button inline link-button" href={invite} target="_blank" rel="noreferrer">
            Join on WhatsApp
          </a>
        </p>
      ) : null}

      <section className="home-block">
        <p className="section-label">Your weekly number</p>
        {line ? (
          <div className="number-card">
            <p className="number-line">{line}</p>
            <div className="row-actions">
              <CopyButton text={line} label="Copy the line" />
            </div>
          </div>
        ) : (
          <p className="aside">
            Log your first week in the <Link href="/weekly">weekly review</Link> and your line appears
            here, ready to post.
          </p>
        )}
      </section>
    </AppShell>
  );
}
