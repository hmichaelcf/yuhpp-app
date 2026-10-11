"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import CopyButton from "./CopyButton";
import { callApi } from "@/lib/client-api";

// The story bank: STAR stories with a short name and the themes each one
// covers. A story counts as developed once all four parts are filled in.

export type StoryRow = {
  id: number;
  title: string;
  themes: string | null;
  situation: string | null;
  task: string | null;
  action: string | null;
  result: string | null;
};

type Draft = Omit<StoryRow, "id">;

const PARTS = [
  { key: "situation", label: "Situation", hint: "The context, in a line or two." },
  { key: "task", label: "Task", hint: "What you were responsible for." },
  { key: "action", label: "Action", hint: "What you did, specifically. Most of the story lives here." },
  { key: "result", label: "Result", hint: "What changed. Lead with the number if there is one." },
] as const;

const EMPTY: Draft = { title: "", themes: "", situation: "", task: "", action: "", result: "" };

function missingParts(s: Draft): string[] {
  return PARTS.filter((p) => !s[p.key]?.trim()).map((p) => p.label);
}

/** Plain text of a story, for pasting into a prompt or a document. */
function storyText(s: Draft): string {
  return [
    s.title,
    s.themes ? `Themes: ${s.themes}` : "",
    ...PARTS.map((p) => (s[p.key] ? `${p.label}: ${s[p.key]}` : "")),
  ]
    .filter(Boolean)
    .join("\n");
}

function StoryForm({
  initial,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial: Draft;
  submitLabel: string;
  onSubmit: (d: Draft) => Promise<string | null>;
  onCancel?: () => void;
}) {
  const [d, setD] = useState<Draft>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const set = (k: keyof Draft, v: string) => setD((x) => ({ ...x, [k]: v }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!d.title?.trim()) return setError("Give the story a short name first.");
    setBusy(true);
    setError("");
    const problem = await onSubmit(d);
    setBusy(false);
    if (problem) setError(problem);
    else if (!onCancel) setD(EMPTY);
  }

  return (
    <form className="upload story-form" onSubmit={submit}>
      <div className="field-row two">
        <label className="field">
          <span>Story name</span>
          <input
            value={d.title}
            onChange={(e) => set("title", e.target.value)}
            placeholder="Lead Scoring Overhaul"
            maxLength={120}
          />
        </label>
        <label className="field">
          <span>Themes it covers</span>
          <input
            value={d.themes ?? ""}
            onChange={(e) => set("themes", e.target.value)}
            placeholder="ownership, delivering results"
          />
        </label>
      </div>
      {PARTS.map((p) => (
        <label key={p.key} className="field">
          <span>
            {p.label} <em className="field-hint">{p.hint}</em>
          </span>
          <textarea value={d[p.key] ?? ""} onChange={(e) => set(p.key, e.target.value)} rows={p.key === "action" ? 4 : 2} />
        </label>
      ))}
      {error ? (
        <div className="form-error" role="alert">
          <p>{error}</p>
        </div>
      ) : null}
      <div className="upload-row">
        <button type="submit" className="primary-button inline" disabled={busy}>
          {busy ? "Saving" : submitLabel}
        </button>
        {onCancel ? (
          <button type="button" className="text-button" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
        ) : null}
      </div>
    </form>
  );
}

function StoryCard({ s }: { s: StoryRow }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState("");
  const missing = missingParts(s);
  const themes = s.themes ? s.themes.split(",").map((t) => t.trim()) : [];

  async function remove() {
    if (!window.confirm(`Remove "${s.title}" from your story bank?`)) return;
    const r = await callApi("DELETE", `/api/stories/${s.id}`);
    if (!r.ok) return setError(r.message);
    router.refresh();
  }

  if (editing) {
    return (
      <li className="story editing">
        <StoryForm
          initial={s}
          submitLabel="Save story"
          onCancel={() => setEditing(false)}
          onSubmit={async (d) => {
            const r = await callApi("PATCH", `/api/stories/${s.id}`, d);
            if (!r.ok) return r.message;
            setEditing(false);
            router.refresh();
            return null;
          }}
        />
      </li>
    );
  }

  return (
    <li className="story">
      <details>
        <summary>
          <span className={missing.length ? "story-dot" : "story-dot done"} aria-hidden="true" />
          <span className="story-head">
            <span className="story-title">{s.title}</span>
            <span className="story-meta">
              {missing.length ? `Missing: ${missing.join(", ")}` : "Developed"}
            </span>
          </span>
          {themes.length ? (
            <span className="chips">
              {themes.map((t) => (
                <span key={t} className="chip">
                  {t}
                </span>
              ))}
            </span>
          ) : null}
        </summary>
        <dl className="star">
          {PARTS.map((p) => (
            <div key={p.key}>
              <dt>{p.label}</dt>
              <dd>{s[p.key] || <span className="empty">Not written yet</span>}</dd>
            </div>
          ))}
        </dl>
        {error ? <p className="inline-error">{error}</p> : null}
        <div className="row-actions story-actions">
          <CopyButton text={storyText(s)} label="Copy story" className="text-button" />
          <button type="button" className="text-button" onClick={() => setEditing(true)}>
            Edit
          </button>
          <button type="button" className="text-button danger" onClick={remove}>
            Remove
          </button>
        </div>
      </details>
    </li>
  );
}

export default function StoryBank({ stories }: { stories: StoryRow[] }) {
  const router = useRouter();
  const [adding, setAdding] = useState(stories.length === 0);

  return (
    <>
      {adding ? (
        <StoryForm
          initial={EMPTY}
          submitLabel="Add to story bank"
          onCancel={stories.length ? () => setAdding(false) : undefined}
          onSubmit={async (d) => {
            const r = await callApi("POST", "/api/stories", d);
            if (!r.ok) return r.message;
            setAdding(false);
            router.refresh();
            return null;
          }}
        />
      ) : (
        <p>
          <button type="button" className="primary-button inline" onClick={() => setAdding(true)}>
            Add a story
          </button>
        </p>
      )}

      {stories.length ? (
        <p className="section-label">
          In your bank: {stories.length} {stories.length === 1 ? "story" : "stories"}
        </p>
      ) : null}
      {stories.length ? (
        <ul className="story-list">
          {stories.map((s) => (
            <StoryCard key={s.id} s={s} />
          ))}
        </ul>
      ) : null}
    </>
  );
}
