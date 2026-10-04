import { redirect } from "next/navigation";
import Masthead from "../components/Masthead";
import StartRunButton from "../components/StartRunButton";
import { isAdmin } from "@/lib/admin";
import { bindings } from "@/lib/cloudflare";
import { promptCatalog } from "@/lib/runs";
import { currentMember } from "@/lib/session";

export const dynamic = "force-dynamic";

export const metadata = { title: "Prompts | Yuhpp" };

const STAGE_ORDER = ["Pre Interview", "Interview", "Post Interview", "Offer"];

export default async function PromptsPage() {
  const member = await currentMember();
  if (!member) redirect("/login");

  const { DB } = await bindings();
  const prompts = await promptCatalog(DB);
  const stages = [
    ...STAGE_ORDER,
    ...Array.from(new Set(prompts.map((p) => p.stage ?? "Other"))).filter((s) => !STAGE_ORDER.includes(s)),
  ];

  return (
    <>
      <Masthead signedIn admin={isAdmin(member)} />
      <main className="page">
        <p className="eyebrow">Prompts</p>
        <h1 className="title">
          Run any step <em>of the method.</em>
        </h1>
        <p className="lede">
          For now every prompt is open here. In the next phases, your workspace will put the right
          one in front of you for each job and each round.
        </p>

        {prompts.length === 0 ? (
          <p className="aside">The prompt library has not been loaded yet.</p>
        ) : (
          stages.map((stage) => {
            const group = prompts.filter((p) => (p.stage ?? "Other") === stage);
            if (group.length === 0) return null;
            return (
              <section key={stage} className="admin-block">
                <p className="section-label">{stage}</p>
                <ul className="prompt-list">
                  {group.map((p) => (
                    <li key={p.key} className="prompt-item">
                      <div className="prompt-text">
                        <span className="prompt-name">{p.name}</span>
                        <span className="prompt-desc">{p.description}</span>
                      </div>
                      <StartRunButton promptKey={p.key} />
                    </li>
                  ))}
                </ul>
              </section>
            );
          })
        )}
      </main>
    </>
  );
}
