"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, type FormEvent } from "react";
import CopyButton from "./CopyButton";
import { callApi } from "@/lib/client-api";

// The bullet bank: add bullets (one per line), then edit, copy, or remove
// them, grouped by role. Lines over the character limit are flagged, not
// refused, so a long bullet can be saved now and tightened later.

export type BulletRow = {
  id: number;
  text: string;
  role: string | null;
  company: string | null;
  tags: string | null;
};

function lines(text: string): string[] {
  return text
    .split("\n")
    .map((l) => l.replace(/^\s*(?:[•\-*–·▪◦]|\d+[.)])\s*/, "").trim())
    .filter(Boolean);
}

function Count({ n, max }: { n: number; max: number }) {
  return <span className={n > max ? "char-count over" : "char-count"}>{n}</span>;
}

function MetaFields({
  role,
  company,
  tags,
  setRole,
  setCompany,
  setTags,
}: {
  role: string;
  company: string;
  tags: string;
  setRole: (v: string) => void;
  setCompany: (v: string) => void;
  setTags: (v: string) => void;
}) {
  return (
    <div className="field-row">
      <label className="field">
        <span>Role</span>
        <input value={role} onChange={(e) => setRole(e.target.value)} list="bank-roles" placeholder="Marketing Ops Manager" />
      </label>
      <label className="field">
        <span>Company</span>
        <input value={company} onChange={(e) => setCompany(e.target.value)} list="bank-companies" placeholder="Acme" />
      </label>
      <label className="field">
        <span>Tags</span>
        <input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="lead scoring, automation" />
      </label>
    </div>
  );
}

function BulletItem({ b, max }: { b: BulletRow; max: number }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(b.text);
  const [role, setRole] = useState(b.role ?? "");
  const [company, setCompany] = useState(b.company ?? "");
  const [tags, setTags] = useState(b.tags ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const r = await callApi("PATCH", `/api/bullets/${b.id}`, { text, role, company, tags });
    setBusy(false);
    if (!r.ok) return setError(r.message);
    setEditing(false);
    router.refresh();
  }

  async function remove() {
    if (!window.confirm("Remove this bullet from your bank?")) return;
    setBusy(true);
    const r = await callApi("DELETE", `/api/bullets/${b.id}`);
    setBusy(false);
    if (!r.ok) return setError(r.message);
    router.refresh();
  }

  if (editing) {
    return (
      <li className="bank-item editing">
        <form className="bank-edit" onSubmit={save}>
          <label className="field">
            <span>
              Bullet <Count n={text.trim().length} max={max} />
            </span>
            <textarea value={text} onChange={(e) => setText(e.target.value)} rows={2} />
          </label>
          <MetaFields {...{ role, company, tags, setRole, setCompany, setTags }} />
          {error ? <p className="form-error">{error}</p> : null}
          <div className="row-actions">
            <button type="submit" className="primary-button inline" disabled={busy}>
              {busy ? "Saving" : "Save"}
            </button>
            <button type="button" className="text-button" onClick={() => setEditing(false)} disabled={busy}>
              Cancel
            </button>
          </div>
        </form>
      </li>
    );
  }

  const tagList = b.tags ? b.tags.split(",").map((t) => t.trim()) : [];
  return (
    <li className="bank-item">
      <div className="bank-main">
        <p className="bank-text">{b.text}</p>
        {tagList.length ? (
          <p className="chips">
            {tagList.map((t) => (
              <span key={t} className="chip">
                {t}
              </span>
            ))}
          </p>
        ) : null}
        {error ? <p className="inline-error">{error}</p> : null}
      </div>
      <div className="bank-side">
        <Count n={b.text.length} max={max} />
        <div className="row-actions">
          <CopyButton text={b.text} className="text-button" />
          <button type="button" className="text-button" onClick={() => setEditing(true)}>
            Edit
          </button>
          <button type="button" className="text-button danger" onClick={remove} disabled={busy}>
            Remove
          </button>
        </div>
      </div>
    </li>
  );
}

export default function BulletBank({ bullets, max }: { bullets: BulletRow[]; max: number }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [role, setRole] = useState("");
  const [company, setCompany] = useState("");
  const [tags, setTags] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [added, setAdded] = useState(0);

  const roles = useMemo(() => [...new Set(bullets.map((b) => b.role).filter((r): r is string => !!r))], [bullets]);
  const companies = useMemo(
    () => [...new Set(bullets.map((b) => b.company).filter((c): c is string => !!c))],
    [bullets],
  );
  const draft = lines(text);
  const overDraft = draft.filter((l) => l.length > max).length;

  const groups = useMemo(() => {
    const map = new Map<string, { role: string | null; company: string | null; items: BulletRow[] }>();
    for (const b of bullets) {
      const key = `${b.role ?? ""}\u0000${b.company ?? ""}`;
      if (!map.has(key)) map.set(key, { role: b.role, company: b.company, items: [] });
      map.get(key)!.items.push(b);
    }
    return [...map.values()];
  }, [bullets]);
  const overTotal = bullets.filter((b) => b.text.length > max).length;

  async function add(e: FormEvent) {
    e.preventDefault();
    if (!draft.length) return setError("Write or paste a bullet first.");
    setBusy(true);
    setError("");
    setAdded(0);
    const r = await callApi("POST", "/api/bullets", { text, role, company, tags });
    setBusy(false);
    if (!r.ok) return setError(r.message);
    setAdded(Number(r.data.added) || draft.length);
    setText("");
    router.refresh();
  }

  return (
    <>
      <datalist id="bank-roles">
        {roles.map((r) => (
          <option key={r} value={r} />
        ))}
      </datalist>
      <datalist id="bank-companies">
        {companies.map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>
      <form className="upload" onSubmit={add}>
        <label className="field">
          <span>Bullets, one per line</span>
          <textarea
            className="paste-box short"
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={4}
            placeholder={"Rebuilt lead scoring; MQL to SQL rate up 34%\nCut campaign launch time from 9 days to 3"}
          />
        </label>
        {draft.length ? (
          <p className="form-hint">
            {draft.length === 1 ? (
              <>
                1 bullet, <Count n={draft[0].length} max={max} /> of {max} characters.
              </>
            ) : (
              <>
                {draft.length} bullets.{" "}
                {overDraft ? `${overDraft} over ${max} characters.` : `All within ${max} characters.`}
              </>
            )}
          </p>
        ) : null}
        <MetaFields {...{ role, company, tags, setRole, setCompany, setTags }} />
        <div className="upload-row">
          <button type="submit" className="primary-button inline" disabled={busy}>
            {busy ? "Adding" : draft.length > 1 ? `Add ${draft.length} bullets` : "Add to bank"}
          </button>
        </div>
        {error ? (
          <div className="form-error" role="alert">
            <p>{error}</p>
          </div>
        ) : null}
        {added ? (
          <div className="sync-result" role="status">
            <p>
              <strong>Added {added === 1 ? "1 bullet" : `${added} bullets`}.</strong>
            </p>
          </div>
        ) : null}
      </form>

      {bullets.length ? (
        <>
          <p className="section-label">
            In your bank: {bullets.length} {bullets.length === 1 ? "bullet" : "bullets"}
            {overTotal ? `, ${overTotal} over ${max} characters` : ""}
          </p>
          {groups.map((g) => (
            <section key={`${g.role}|${g.company}`} className="bank-group">
              <h2 className="bank-heading">
                {g.role ?? "No role set"}
                {g.company ? <span className="bank-company">{g.company}</span> : null}
              </h2>
              <ul className="bank-list">
                {g.items.map((b) => (
                  <BulletItem key={b.id} b={b} max={max} />
                ))}
              </ul>
            </section>
          ))}
        </>
      ) : null}
    </>
  );
}
