"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import CopyButton from "./CopyButton";
import { callApi } from "@/lib/client-api";
import { BLOCK_TARGETS, type BlockKind } from "@/lib/resume-prompts";

// Output blocks in a run's reply. A step that writes into the resume or the
// search brief ends its reply with fenced blocks (```yuhpp-skills and so on;
// the rules are in frame.ts). Each block renders here as a card with the
// buttons that save it: "Use in my resume", "Replace in resume", "Add to
// brief", "Save company".

export type BlockContext = {
  runId: string;
  bulletMax: number;
  /** The resume draft, for steps that write resume sections. */
  draft?: {
    skills: string[];
    leadership: string[];
    bullets: { id: number; text: string; roleId: number | null }[];
    roles: { id: number; label: string; company: string | null }[];
  };
  /** Titles already in the search brief. */
  briefTitles?: string[];
  /** Companies already saved. */
  companies?: string[];
};

const KINDS: BlockKind[] = ["skills", "leadership", "bullets", "titles", "companies"];

/** "language-yuhpp-skills" becomes "skills". */
export function blockKindOf(className: unknown): BlockKind | null {
  const names = Array.isArray(className) ? className : typeof className === "string" ? className.split(" ") : [];
  for (const n of names) {
    const m = typeof n === "string" ? n.match(/^language-yuhpp-([a-z]+)$/) : null;
    if (m && (KINDS as string[]).includes(m[1])) return m[1] as BlockKind;
  }
  return null;
}

function lines(text: string): string[] {
  return text
    .split("\n")
    .map((l) => l.replace(/^\s*(?:[•\-*·]|\d+[.)])\s+/, "").trim())
    .filter(Boolean);
}

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

function Check() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true" className="yb-check">
      <path d="M3 8.5 L6.5 12 L13 4.5" />
    </svg>
  );
}

function Head({ kind, count, children }: { kind: BlockKind; count: number; children?: React.ReactNode }) {
  return (
    <div className="yb-head">
      <p className="yb-label">
        {kind === "titles" || kind === "companies" ? "For your search" : "For your resume"} &middot; {BLOCK_TARGETS[kind]}
        {count ? ` · ${count}` : ""}
      </p>
      <div className="yb-actions">{children}</div>
    </div>
  );
}

/**
 * The message right after a save: what changed and a link to see it. Shown
 * only for saves made on this page, not for items saved earlier.
 */
function SavedNote({ text, href, link }: { text: string; href: string; link: string }) {
  return (
    <p className="yb-saved" role="status">
      <Check />
      <span>
        {text} <Link href={href}>{link} &rarr;</Link>
      </span>
    </p>
  );
}

const RESUME_NOTE = { href: "/resume", link: "See your resume" };

// ---------- Skills & knowledge, Leadership ----------

function ListBlock({
  kind,
  items,
  ctx,
  final,
}: {
  kind: "skills" | "leadership";
  items: string[];
  ctx: BlockContext;
  final: boolean;
}) {
  const current = ctx.draft?.[kind] ?? [];
  const already = items.length > 0 && items.length === current.length && items.every((x, i) => same(x, current[i]));
  const [state, setState] = useState<"" | "busy" | "saved">(already ? "saved" : "");
  const [justSaved, setJustSaved] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  async function save() {
    setState("busy");
    setError("");
    const r = await callApi("PUT", "/api/resume", { [kind]: items });
    if (r.ok) {
      setState("saved");
      setJustSaved(true);
      // The page re-reads the draft, so later blocks compare against it.
      router.refresh();
    }
    else {
      setState("");
      setError(r.message);
    }
  }

  return (
    <section className="yb">
      <Head kind={kind} count={items.length}>
        <CopyButton text={items.join("\n")} className="text-button" />
        {state === "saved" ? (
          <span className="yb-done" role="status">
            <Check />
            In your resume draft
          </span>
        ) : (
          <button type="button" className="primary-button inline" onClick={save} disabled={!final || state === "busy"}>
            {!final ? "Writing" : state === "busy" ? "Saving" : "Use in my resume"}
          </button>
        )}
      </Head>
      <ul className="yb-list">
        {items.map((x) => (
          <li key={x}>{x}</li>
        ))}
      </ul>
      {error ? <p className="inline-error yb-error">{error}</p> : null}
      {justSaved ? (
        <SavedNote text={`${BLOCK_TARGETS[kind]} is in your resume.`} {...RESUME_NOTE} />
      ) : state === "saved" ? (
        <p className="yb-foot">
          Already in your resume. <Link href="/resume">See your resume</Link>
        </p>
      ) : null}
    </section>
  );
}

// ---------- Bullets ----------

type BulletRow = {
  key: string;
  text: string;
  /** The bullet this replaces, when it still exists in the draft. */
  replaceId: number | null;
  original: string | null;
  /** Where an added bullet goes by default: a role id, or "new" for a new role at `company`. */
  defaultRole: string;
  company: string | null;
};

function parseBullets(text: string, ctx: BlockContext): BulletRow[] {
  const draft = ctx.draft;
  const seen = new Set<number>();
  const roleFor = (company: string | null, fallbackRoleId: number | null): string => {
    if (fallbackRoleId) return String(fallbackRoleId);
    const match = company ? draft?.roles.find((r) => r.company && same(r.company, company)) : undefined;
    if (match) return String(match.id);
    if (company) return "new";
    return draft?.roles[0] ? String(draft.roles[0].id) : "";
  };
  return lines(text).map((line, i) => {
    const replace = line.match(/^b(\d+)\s*\|\s*(.+)$/i);
    if (replace) {
      const id = Number(replace[1]);
      const found = draft?.bullets.find((b) => b.id === id);
      const body = replace[2].trim();
      if (found && !seen.has(id)) {
        seen.add(id);
        return { key: `${i}`, text: body, replaceId: id, original: found.text, defaultRole: "", company: null };
      }
      // A second line for the same bullet (a split) is a new bullet under the same role.
      return { key: `${i}`, text: body, replaceId: null, original: null, defaultRole: roleFor(null, found?.roleId ?? null), company: null };
    }
    const add = line.match(/^new\s*\|\s*([^|]*)\|\s*(.+)$/i);
    const company = add ? add[1].trim() || null : null;
    const body = add ? add[2].trim() : line;
    return { key: `${i}`, text: body, replaceId: null, original: null, defaultRole: roleFor(company, null), company };
  });
}

function BulletLine({
  row,
  ctx,
  final,
  onSaved,
}: {
  row: BulletRow;
  ctx: BlockContext;
  final: boolean;
  onSaved: (kind: "replaced" | "added") => void;
}) {
  const roles = ctx.draft?.roles ?? [];
  // Already saved: a replacement whose new text is in place, or an added bullet already in the draft.
  const already =
    row.replaceId !== null
      ? row.original === row.text
      : (ctx.draft?.bullets ?? []).some((b) => same(b.text, row.text));
  const [state, setState] = useState<"" | "busy" | "done">(already ? "done" : "");
  const [role, setRole] = useState(row.defaultRole);
  const [error, setError] = useState("");
  const router = useRouter();
  const over = row.text.length > ctx.bulletMax;

  async function save() {
    setState("busy");
    setError("");
    const body =
      row.replaceId !== null
        ? { action: "replace", id: row.replaceId, text: row.text }
        : role === "new"
          ? { action: "add", company: row.company, text: row.text }
          : { action: "add", experienceId: Number(role), text: row.text };
    const r = await callApi("POST", "/api/resume/bullets", body);
    if (r.ok) {
      setState("done");
      onSaved(row.replaceId !== null ? "replaced" : "added");
      router.refresh();
    }
    else {
      setState("");
      setError(r.message);
    }
  }

  const canAdd = row.replaceId !== null || role !== "";
  return (
    <li className="yb-row">
      <div className="yb-texts">
        {row.original && row.original !== row.text ? <p className="yb-old">{row.original}</p> : null}
        <p className="yb-new">
          {row.text} <span className={over ? "char-count over" : "char-count"}>{row.text.length}</span>
        </p>
        {error ? <p className="inline-error yb-error">{error}</p> : null}
      </div>
      <div className="yb-row-actions">
        {state === "done" ? (
          <span className="yb-done" role="status">
            <Check />
            {row.replaceId !== null ? "Replaced" : "Added"}
          </span>
        ) : (
          <>
            {row.replaceId === null ? (
              <label className="yb-role">
                <span className="sr-only">Role for this bullet</span>
                <select value={role} onChange={(e) => setRole(e.target.value)} disabled={!final || state === "busy"}>
                  {roles.map((r) => (
                    <option key={r.id} value={String(r.id)}>
                      {r.label}
                    </option>
                  ))}
                  {row.company && !roles.some((r) => r.company && same(r.company, row.company!)) ? (
                    <option value="new">New role at {row.company}</option>
                  ) : null}
                  {roles.length === 0 && !row.company ? <option value="">Add a role in your bullet bank first</option> : null}
                </select>
              </label>
            ) : null}
            <button
              type="button"
              className="copy"
              onClick={save}
              disabled={!final || state === "busy" || !canAdd}
            >
              {state === "busy" ? "Saving" : row.replaceId !== null ? "Replace in resume" : "Add to resume"}
            </button>
          </>
        )}
      </div>
    </li>
  );
}

function BulletsBlock({ text, ctx, final }: { text: string; ctx: BlockContext; final: boolean }) {
  const rows = useMemo(() => parseBullets(text, ctx), [text, ctx]);
  const [saved, setSaved] = useState({ replaced: 0, added: 0 });
  const onSaved = useCallback(
    (kind: "replaced" | "added") => setSaved((s) => ({ ...s, [kind]: s[kind] + 1 })),
    [],
  );
  const savedText = [
    saved.replaced ? `${saved.replaced} ${saved.replaced === 1 ? "bullet" : "bullets"} replaced` : "",
    saved.added ? `${saved.added} added` : "",
  ]
    .filter(Boolean)
    .join(", ");
  return (
    <section className="yb">
      <Head kind="bullets" count={rows.length}>
        <CopyButton text={rows.map((r) => r.text).join("\n")} className="text-button" />
      </Head>
      <ul className="yb-rows">
        {rows.map((r) => (
          <BulletLine key={`${r.key}-${r.text}`} row={r} ctx={ctx} final={final} onSaved={onSaved} />
        ))}
      </ul>
      {savedText ? (
        <SavedNote text={`${savedText.charAt(0).toUpperCase()}${savedText.slice(1)} in your resume.`} {...RESUME_NOTE} />
      ) : (
        <p className="yb-foot">
          Bullets save to your <Link href="/bullets">bullet bank</Link>, which is where your resume&apos;s experience
          comes from.
        </p>
      )}
    </section>
  );
}

// ---------- Titles ----------

function TitleChip({
  title,
  kind,
  inBrief,
  final,
  onSaved,
}: {
  title: string;
  kind: "strong" | "stretch";
  inBrief: boolean;
  final: boolean;
  onSaved: () => void;
}) {
  const [state, setState] = useState<"" | "busy" | "done">(inBrief ? "done" : "");
  const [error, setError] = useState("");
  async function add() {
    setState("busy");
    setError("");
    const r = await callApi("POST", "/api/search-brief", { title, kind });
    if (r.ok) {
      setState("done");
      onSaved();
    }
    else {
      setState("");
      setError(r.message);
    }
  }
  return (
    <li className="yb-row">
      <div className="yb-texts">
        <p className="yb-new">
          <b>{title}</b> <span className="yb-kind">{kind === "strong" ? "Strong match" : "Stretch"}</span>
        </p>
        {error ? <p className="inline-error yb-error">{error}</p> : null}
      </div>
      <div className="yb-row-actions">
        {state === "done" ? (
          <span className="yb-done" role="status">
            <Check />
            In your brief
          </span>
        ) : (
          <button type="button" className="copy" onClick={add} disabled={!final || state === "busy"}>
            {state === "busy" ? "Adding" : kind === "strong" ? "Add to brief" : "Add as stretch"}
          </button>
        )}
      </div>
    </li>
  );
}

function TitlesBlock({ text, ctx, final }: { text: string; ctx: BlockContext; final: boolean }) {
  const titles = lines(text).map((l) => {
    const m = l.match(/^(strong|stretch)\s*\|\s*(.+)$/i);
    return m ? { kind: m[1].toLowerCase() as "strong" | "stretch", title: m[2].trim() } : { kind: "strong" as const, title: l };
  });
  const existing = ctx.briefTitles ?? [];
  const [added, setAdded] = useState(0);
  const onSaved = useCallback(() => setAdded((n) => n + 1), []);
  return (
    <section className="yb">
      <Head kind="titles" count={titles.length} />
      <ul className="yb-rows">
        {titles.map((t) => (
          <TitleChip
            key={`${t.kind}-${t.title}`}
            title={t.title}
            kind={t.kind}
            inBrief={existing.some((x) => same(x, t.title))}
            final={final}
            onSaved={onSaved}
          />
        ))}
      </ul>
      {added ? (
        <SavedNote
          text={`${added} ${added === 1 ? "title" : "titles"} added to your search brief.`}
          href="/phase/search#brief"
          link="See your brief"
        />
      ) : (
        <p className="yb-foot">
          Titles go into your <Link href="/phase/search#brief">search brief</Link>, which next week&apos;s searches start
          from.
        </p>
      )}
    </section>
  );
}

// ---------- Companies ----------

function CompanyRow({
  name,
  note,
  where,
  saved,
  runId,
  final,
  onSaved,
}: {
  name: string;
  note: string | null;
  where: string | null;
  saved: boolean;
  runId: string;
  final: boolean;
  onSaved: () => void;
}) {
  const [state, setState] = useState<"" | "busy" | "done">(saved ? "done" : "");
  const [error, setError] = useState("");
  async function save() {
    setState("busy");
    setError("");
    const r = await callApi("POST", "/api/companies", { name, note, where, runId });
    if (r.ok) {
      setState("done");
      onSaved();
    }
    else {
      setState("");
      setError(r.message);
    }
  }
  return (
    <li className="yb-row">
      <div className="yb-texts">
        <p className="yb-new">
          <b>{name}</b>
          {note ? <span className="yb-note"> {note}</span> : null}
        </p>
        {where ? <p className="yb-sub">Where to look: {where}</p> : null}
        {error ? <p className="inline-error yb-error">{error}</p> : null}
      </div>
      <div className="yb-row-actions">
        {state === "done" ? (
          <span className="yb-done" role="status">
            <Check />
            Saved
          </span>
        ) : (
          <button type="button" className="copy" onClick={save} disabled={!final || state === "busy"}>
            {state === "busy" ? "Saving" : "Save company"}
          </button>
        )}
      </div>
    </li>
  );
}

function CompaniesBlock({ text, ctx, final }: { text: string; ctx: BlockContext; final: boolean }) {
  const rows = lines(text).map((l) => {
    const [name, note, where] = l.split("|").map((p) => p.trim());
    return { name, note: note || null, where: where || null };
  });
  const saved = ctx.companies ?? [];
  const [added, setAdded] = useState(0);
  const onSaved = useCallback(() => setAdded((n) => n + 1), []);
  return (
    <section className="yb">
      <Head kind="companies" count={rows.length} />
      <ul className="yb-rows">
        {rows
          .filter((r) => r.name)
          .map((r) => (
            <CompanyRow
              key={r.name}
              {...r}
              saved={saved.some((s) => same(s, r.name))}
              runId={ctx.runId}
              final={final}
              onSaved={onSaved}
            />
          ))}
      </ul>
      {added ? (
        <SavedNote
          text={`${added} ${added === 1 ? "company" : "companies"} saved for Track B outreach.`}
          href="/phase/search#companies"
          link="See your list"
        />
      ) : (
        <p className="yb-foot">
          Saved companies are where Track B starts: <Link href="/phase/search#companies">see your list</Link>.
        </p>
      )}
    </section>
  );
}

export default function RunBlock({
  kind,
  text,
  ctx,
  final,
}: {
  kind: BlockKind;
  text: string;
  ctx: BlockContext;
  /** False while the reply is still streaming in. */
  final: boolean;
}) {
  if (kind === "skills" || kind === "leadership") return <ListBlock kind={kind} items={lines(text)} ctx={ctx} final={final} />;
  if (kind === "bullets") return <BulletsBlock text={text} ctx={ctx} final={final} />;
  if (kind === "titles") return <TitlesBlock text={text} ctx={ctx} final={final} />;
  return <CompaniesBlock text={text} ctx={ctx} final={final} />;
}
