"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import CopyButton from "./CopyButton";
import { callApi } from "@/lib/client-api";

// Saved job searches: copy one, run it on Google in a new tab, rename it, or
// remove it. Searches usually arrive here from a Smart Job Search Builder run.

export type SearchRow = {
  id: number;
  label: string;
  query: string;
  run_id: string | null;
  saved: string;
};

const google = (q: string) => `https://www.google.com/search?q=${encodeURIComponent(q)}`;

function SearchItem({ s }: { s: SearchRow }) {
  const router = useRouter();
  const [renaming, setRenaming] = useState(false);
  const [label, setLabel] = useState(s.label);
  const [error, setError] = useState("");

  async function rename(e: FormEvent) {
    e.preventDefault();
    const r = await callApi("PATCH", `/api/searches/${s.id}`, { label });
    if (!r.ok) return setError(r.message);
    setRenaming(false);
    setError("");
    router.refresh();
  }

  async function remove() {
    if (!window.confirm(`Remove the saved search "${s.label}"?`)) return;
    const r = await callApi("DELETE", `/api/searches/${s.id}`);
    if (!r.ok) return setError(r.message);
    router.refresh();
  }

  return (
    <li className="search-item">
      <div className="search-head">
        {renaming ? (
          <form className="inline-form" onSubmit={rename}>
            <input value={label} onChange={(e) => setLabel(e.target.value)} maxLength={120} aria-label="Search name" autoFocus />
            <button type="submit" className="text-button">
              Save
            </button>
            <button type="button" className="text-button" onClick={() => setRenaming(false)}>
              Cancel
            </button>
          </form>
        ) : (
          <span className="search-label">{s.label}</span>
        )}
        <span className="search-saved">
          Saved {s.saved}
          {s.run_id ? (
            <>
              {" "}
              from <Link href={`/run/${s.run_id}`}>a run</Link>
            </>
          ) : null}
        </span>
      </div>
      <pre className="query">{s.query}</pre>
      {error ? <p className="inline-error">{error}</p> : null}
      <div className="row-actions">
        <a className="copy" href={google(s.query)} target="_blank" rel="noreferrer">
          Search on Google
        </a>
        <CopyButton text={s.query} className="text-button" />
        <button type="button" className="text-button" onClick={() => setRenaming(true)}>
          Rename
        </button>
        <button type="button" className="text-button danger" onClick={remove}>
          Remove
        </button>
      </div>
    </li>
  );
}

export default function SavedSearches({ searches }: { searches: SearchRow[] }) {
  const router = useRouter();
  const [label, setLabel] = useState("");
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);

  async function add(e: FormEvent) {
    e.preventDefault();
    if (!query.trim()) return setError("Paste the search first.");
    setBusy(true);
    setError("");
    const r = await callApi("POST", "/api/searches", { label, query });
    setBusy(false);
    if (!r.ok) return setError(r.message);
    if (r.data.result === "exists") return setError("That search is already saved.");
    setLabel("");
    setQuery("");
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      {searches.length ? (
        <ul className="search-list">
          {searches.map((s) => (
            <SearchItem key={s.id} s={s} />
          ))}
        </ul>
      ) : null}

      {open ? (
        <form className="upload" onSubmit={add}>
          <label className="field">
            <span>The search</span>
            <textarea
              className="paste-box short mono"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              rows={3}
              placeholder={'site:jobs.lever.co ("Revenue Operations Manager" OR "RevOps Manager") -intern'}
            />
          </label>
          <label className="field">
            <span>Name (optional)</span>
            <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Lever, RevOps Manager" maxLength={120} />
          </label>
          {error ? (
            <div className="form-error" role="alert">
              <p>{error}</p>
            </div>
          ) : null}
          <div className="upload-row">
            <button type="submit" className="primary-button inline" disabled={busy}>
              {busy ? "Saving" : "Save search"}
            </button>
            <button type="button" className="text-button" onClick={() => setOpen(false)}>
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <p>
          <button type="button" className="text-button" onClick={() => setOpen(true)}>
            + Paste a search yourself
          </button>
        </p>
      )}
    </>
  );
}
