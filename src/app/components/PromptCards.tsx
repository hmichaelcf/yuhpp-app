import Link from "next/link";
import StartRunButton from "./StartRunButton";
import { shortDate } from "@/lib/dates";
import { nameKey } from "@/lib/route-map";
import type { PromptActivity } from "@/lib/runs";
import { readsLabel, writesLabel } from "@/lib/resume-prompts";
import { readsStoryBank } from "@/lib/story-prompts";

// A numbered stack of prompt cards, styled like the guide's, with a Start
// button on each and a link back to the member's latest run of it.

export type CatalogEntry = { key: string; name: string; description: string };

export function catalogMap(rows: CatalogEntry[]): Map<string, CatalogEntry> {
  return new Map(rows.map((r) => [nameKey(r.name), r]));
}

export default function PromptCards({
  names,
  catalog,
  activity,
  loop = false,
  bankTag = true,
}: {
  names: string[];
  catalog: Map<string, CatalogEntry>;
  activity: Map<string, PromptActivity>;
  loop?: boolean;
  /** Mark prompts that read the story bank (off where the page already says so). */
  bankTag?: boolean;
}) {
  const items = names
    .map((n) => catalog.get(nameKey(n)))
    .filter((p): p is CatalogEntry => !!p);
  if (items.length === 0) {
    return <p className="aside">These prompts are not in the library yet.</p>;
  }
  return (
    <ol className={loop ? "cards loop" : "cards"}>
      {items.map((p, i) => {
        const act = activity.get(p.key);
        const writes = writesLabel(p.name);
        const reads = readsLabel(p.name);
        return (
          <li key={p.key} className={act ? "card has-run" : "card"}>
            <div className="card-head">
              <span className="card-num">{String(i + 1).padStart(2, "0")}</span>
              <span className="card-body">
                <span className="card-name">{p.name}</span>
                <span className="card-what">{p.description}</span>
                {bankTag && readsStoryBank(p.name) ? <span className="bank-tag">Reads your story bank</span> : null}
                {reads || writes ? (
                  <span className="flow-tags">
                    {reads ? <span className="flow-tag">Reads {reads}</span> : null}
                    {writes ? <span className="flow-tag writes">Saves to {writes}</span> : null}
                  </span>
                ) : null}
                {act ? (
                  <span className="card-last">
                    {act.count === 1 ? "Run once" : `Run ${act.count} times`}, last {shortDate(act.lastAt)}.{" "}
                    <Link href={`/run/${act.lastRunId}`}>
                      {act.status === "open" ? "Continue that run" : "Open that run"}
                    </Link>
                  </span>
                ) : null}
              </span>
              <StartRunButton promptKey={p.key} />
            </div>
          </li>
        );
      })}
    </ol>
  );
}
