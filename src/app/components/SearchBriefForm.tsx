"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { POSTING_WINDOWS, windowLabel, type SearchBrief } from "@/lib/brief-shape";
import { callApi } from "@/lib/client-api";
import type { TargetCompany } from "@/lib/search-brief";

// The search brief on the Search and outreach page: what every Phase 03 run
// starts from, shown as a summary with an Edit button, plus the companies
// saved from research for Track B.

function Chips({ items, outline = false }: { items: string[]; outline?: boolean }) {
  return (
    <span className="brief-chips">
      {items.map((t) => (
        <span key={t} className={outline ? "brief-chip outline" : "brief-chip"}>
          {t}
        </span>
      ))}
    </span>
  );
}

export function SearchBriefForm({ brief }: { brief: SearchBrief }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [f, setF] = useState(() => ({
    titlesStrong: brief.titlesStrong.join("\n"),
    titlesStretch: brief.titlesStretch.join("\n"),
    level: brief.level ?? "",
    location: brief.location ?? "",
    industries: brief.industries ?? "",
    keywords: brief.keywords.join(", "),
    postedWithinDays: String(brief.postedWithinDays),
  }));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const set = (key: keyof typeof f) => (e: { target: { value: string } }) => setF((x) => ({ ...x, [key]: e.target.value }));

  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const r = await callApi("PUT", "/api/search-brief", { ...f, postedWithinDays: Number(f.postedWithinDays) });
    setBusy(false);
    if (!r.ok) {
      setError(r.message);
      return;
    }
    setEditing(false);
    router.refresh();
  }

  if (!editing) {
    const none = <span className="brief-empty">Not set</span>;
    return (
      <div>
        {!brief.saved ? (
          <p className="form-hint brief-hint">
            Suggested from your resume. Add your target titles from Job Title Navigator and save, and every search run
            starts from them.
          </p>
        ) : null}
        <dl className="brief-list">
          <div>
            <dt>Target titles</dt>
            <dd>
              {brief.titlesStrong.length || brief.titlesStretch.length ? (
                <>
                  {brief.titlesStrong.length ? (
                    <span className="brief-group">
                      <span className="brief-kind">Strong</span>
                      <Chips items={brief.titlesStrong} />
                    </span>
                  ) : null}
                  {brief.titlesStretch.length ? (
                    <span className="brief-group">
                      <span className="brief-kind">Stretch</span>
                      <Chips items={brief.titlesStretch} outline />
                    </span>
                  ) : null}
                </>
              ) : (
                none
              )}
            </dd>
          </div>
          <div>
            <dt>Level</dt>
            <dd>{brief.level || none}</dd>
          </div>
          <div>
            <dt>Location</dt>
            <dd>{brief.location || none}</dd>
          </div>
          <div>
            <dt>Industries</dt>
            <dd>{brief.industries || none}</dd>
          </div>
          <div>
            <dt>Posted within</dt>
            <dd>{windowLabel(brief.postedWithinDays).replace(/^the /, "The ")}</dd>
          </div>
          <div>
            <dt>Keywords</dt>
            <dd>{brief.keywords.length ? brief.keywords.join(", ") : none}</dd>
          </div>
        </dl>
        <div className="row-actions">
          <button type="button" className="copy" onClick={() => setEditing(true)}>
            Edit brief
          </button>
        </div>
      </div>
    );
  }

  return (
    <form className="brief-form" onSubmit={save}>
      <div className="field-row two">
        <label className="field">
          <span>
            Strong match titles<span className="field-hint">one per line</span>
          </span>
          <textarea rows={4} value={f.titlesStrong} onChange={set("titlesStrong")} />
        </label>
        <label className="field">
          <span>
            Stretch titles<span className="field-hint">one per line</span>
          </span>
          <textarea rows={4} value={f.titlesStretch} onChange={set("titlesStretch")} />
        </label>
      </div>
      <div className="field-row two">
        <label className="field">
          <span>Level</span>
          <input value={f.level} onChange={set("level")} placeholder="Manager to senior manager" />
        </label>
        <label className="field">
          <span>Location and work model</span>
          <input value={f.location} onChange={set("location")} placeholder="Chicago, or remote in the US" />
        </label>
      </div>
      <div className="field-row two">
        <label className="field">
          <span>Industries</span>
          <input value={f.industries} onChange={set("industries")} placeholder="B2B software, healthcare" />
        </label>
        <label className="field">
          <span>Posted within</span>
          <select value={f.postedWithinDays} onChange={set("postedWithinDays")}>
            {POSTING_WINDOWS.map((d) => (
              <option key={d} value={String(d)}>
                {windowLabel(d).replace(/^the /, "The ")}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="field">
        <span>
          Keywords<span className="field-hint">separated by commas</span>
        </span>
        <input value={f.keywords} onChange={set("keywords")} />
      </label>
      {error ? <p className="form-error">{error}</p> : null}
      <div className="row-actions">
        <button type="submit" className="primary-button inline" disabled={busy}>
          {busy ? "Saving" : "Save brief"}
        </button>
        <button type="button" className="text-button" onClick={() => setEditing(false)}>
          Cancel
        </button>
      </div>
    </form>
  );
}

export function CompanyList({ companies }: { companies: TargetCompany[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<number | null>(null);
  const [error, setError] = useState("");

  async function remove(id: number) {
    setBusy(id);
    setError("");
    const r = await callApi("DELETE", `/api/companies/${id}`);
    setBusy(null);
    if (!r.ok) setError(r.message);
    else router.refresh();
  }

  if (companies.length === 0) {
    return (
      <p className="aside">
        None yet. Run Job Search Assistance Process and save the companies worth reaching out to; Networking Target
        Finder starts from this list.
      </p>
    );
  }
  return (
    <>
      <ul className="company-list">
        {companies.map((c) => (
          <li key={c.id}>
            <div>
              <p className="company-name">{c.name}</p>
              {c.note ? <p className="company-note">{c.note}</p> : null}
              {c.where_to_look ? <p className="company-where">Where to look: {c.where_to_look}</p> : null}
              {c.run_id ? (
                <p className="company-where">
                  <Link href={`/run/${c.run_id}`}>From this run</Link>
                </p>
              ) : null}
            </div>
            <button type="button" className="text-button danger" onClick={() => remove(c.id)} disabled={busy === c.id}>
              {busy === c.id ? "Removing" : "Remove"}
            </button>
          </li>
        ))}
      </ul>
      {error ? <p className="form-error">{error}</p> : null}
    </>
  );
}
