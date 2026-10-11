"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import CopyButton from "./CopyButton";
import { callApi } from "@/lib/client-api";
import { groupByTheme, splitThemes, themeHeading, themeKey } from "@/lib/story-themes";

// The story bank. Adding a story: company, story name, the themes it covers,
// then Situation, Task, Action, and Result written as one section. Reading the
// bank: themes A to Z; open a theme to see "Company | Story name" for each
// story under it, and open a story to read it in full. One theme and one story
// are open at a time, so during an interview the member can go straight from
// the question's theme to the story that answers it.

export type StoryRow = {
  id: number;
  title: string;
  company: string | null;
  themes: string | null;
  situation: string | null;
  task: string | null;
  action: string | null;
  result: string | null;
};

type Draft = Omit<StoryRow, "id">;
type PartKey = "situation" | "task" | "action" | "result";

const PARTS: { key: PartKey; letter: string; label: string; hint: string }[] = [
  { key: "situation", letter: "S", label: "Situation", hint: "The context, in a line or two." },
  { key: "task", letter: "T", label: "Task", hint: "What you were responsible for." },
  { key: "action", letter: "A", label: "Action", hint: "What you did, specifically. Most of the story lives here." },
  { key: "result", letter: "R", label: "Result", hint: "What changed. Lead with the number if there is one." },
];

// The example themes STAR Story Scout names in its theme map, offered as
// one-tap picks next to the member's own themes.
const COMMON_THEMES = [
  "ownership",
  "influencing without authority",
  "dealing with ambiguity",
  "delivering results",
  "developing others",
];

const EMPTY: Draft = { title: "", company: "", themes: "", situation: "", task: "", action: "", result: "" };
const UNTAGGED = "__untagged";

function writtenParts(s: Draft): number {
  return PARTS.filter((p) => s[p.key]?.trim()).length;
}

/** "Upwork | Lead Scoring Overhaul", or just the name when there is no company. */
function storyLabel(s: Pick<Draft, "company" | "title">): string {
  return s.company?.trim() ? `${s.company.trim()} | ${s.title}` : s.title;
}

/** Plain text of a story, for pasting into a prompt or a document. */
function storyText(s: Draft): string {
  return [
    storyLabel(s),
    s.themes ? `Themes: ${s.themes}` : "",
    ...PARTS.map((p) => (s[p.key] ? `${p.label}: ${s[p.key]}` : "")),
  ]
    .filter(Boolean)
    .join("\n");
}

/** Adds the theme to a comma-separated list, or takes it out if it is there. */
function toggleTheme(current: string, name: string): string {
  const list = splitThemes(current);
  const key = themeKey(name);
  const has = list.some((t) => themeKey(t) === key);
  return (has ? list.filter((t) => themeKey(t) !== key) : [...list, name]).join(", ");
}

function Chevron() {
  return (
    <svg className="chev" width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
      <path d="M2.5 4.5 6 8l3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ---------- the form ----------

function StoryForm({
  initial,
  submitLabel,
  companies,
  themeOptions,
  onSubmit,
  onCancel,
}: {
  initial: Draft;
  submitLabel: string;
  companies: string[];
  themeOptions: string[];
  onSubmit: (d: Draft) => Promise<string | null>;
  onCancel?: () => void;
}) {
  const [d, setD] = useState<Draft>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const uid = useId();
  const set = (k: keyof Draft, v: string) => setD((x) => ({ ...x, [k]: v }));
  const chosen = new Set(splitThemes(d.themes).map(themeKey));
  const written = writtenParts(d);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!d.title?.trim()) return setError("Give the story a short name first.");
    setBusy(true);
    setError("");
    const problem = await onSubmit(d);
    setBusy(false);
    if (problem) setError(problem);
  }

  return (
    <form className="story-form" onSubmit={submit}>
      <div className="field-row story-ident">
        <label className="field">
          <span>Company</span>
          <input
            value={d.company ?? ""}
            onChange={(e) => set("company", e.target.value)}
            list={`${uid}-companies`}
            placeholder="Acme"
            maxLength={120}
            autoComplete="off"
          />
        </label>
        <label className="field">
          <span>Story name</span>
          <input
            value={d.title}
            onChange={(e) => set("title", e.target.value)}
            placeholder="Lead Scoring Overhaul"
            maxLength={120}
          />
        </label>
      </div>
      {companies.length ? (
        <datalist id={`${uid}-companies`}>
          {companies.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
      ) : null}

      <div className="theme-field">
        <label className="field">
          <span>
            Themes it covers <em className="field-hint">Separate with commas, or tap a theme below.</em>
          </span>
          <input
            value={d.themes ?? ""}
            onChange={(e) => set("themes", e.target.value)}
            placeholder="ownership, delivering results"
          />
        </label>
        {themeOptions.length ? (
          <div className="theme-picks" role="group" aria-label="Add or remove a theme">
            {themeOptions.map((name) => {
              const on = chosen.has(themeKey(name));
              return (
                <button
                  key={name}
                  type="button"
                  className="theme-pick"
                  aria-pressed={on}
                  onClick={() => set("themes", toggleTheme(d.themes ?? "", name))}
                >
                  {name}
                </button>
              );
            })}
          </div>
        ) : null}
      </div>

      <div className="star-compose" role="group" aria-labelledby={`${uid}-star`}>
        <div className="star-compose-head">
          <span id={`${uid}-star`} className="star-compose-title">
            The story
          </span>
          <span className="star-compose-count">
            {written === 4 ? "All four parts written" : `${written} of 4 parts written`}
          </span>
        </div>
        <ol className="star-spine">
          {PARTS.map((p) => (
            <li key={p.key} className={`star-step${d[p.key]?.trim() ? " filled" : ""}`}>
              <span className="star-letter" aria-hidden="true">
                {p.letter}
              </span>
              <label className="star-step-body">
                <span className="star-step-label">
                  {p.label}
                  <em className="star-step-hint">{p.hint}</em>
                </span>
                <textarea
                  className={p.key === "action" ? "tall" : undefined}
                  value={d[p.key] ?? ""}
                  onChange={(e) => set(p.key, e.target.value)}
                  rows={p.key === "action" ? 4 : 2}
                />
              </label>
            </li>
          ))}
        </ol>
      </div>

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

// ---------- one story, opened ----------

function StoryRead({ s, onEdit, onRemoved }: { s: StoryRow; onEdit: () => void; onRemoved: () => void }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const themes = splitThemes(s.themes).map(themeHeading);

  async function remove() {
    if (!window.confirm(`Remove "${storyLabel(s)}" from your story bank?`)) return;
    const r = await callApi("DELETE", `/api/stories/${s.id}`);
    if (!r.ok) return setError(r.message);
    onRemoved();
    router.refresh();
  }

  return (
    <div className="story-read">
      <dl className="star-spine read">
        {PARTS.map((p) => (
          <div key={p.key} className={`star-step${s[p.key] ? " filled" : ""}`}>
            <dt>
              <span className="star-letter" aria-hidden="true">
                {p.letter}
              </span>
              <span className="star-step-label">{p.label}</span>
            </dt>
            <dd>{s[p.key] || <span className="empty">Not written yet</span>}</dd>
          </div>
        ))}
      </dl>
      <div className="story-foot">
        {themes.length ? (
          <p className="story-themes">
            <span className="story-themes-label">Answers</span>
            {themes.map((t) => (
              <span key={t} className="chip">
                {t}
              </span>
            ))}
          </p>
        ) : null}
        {error ? <p className="inline-error">{error}</p> : null}
        <div className="row-actions">
          <CopyButton text={storyText(s)} label="Copy story" className="text-button" />
          <button type="button" className="text-button" onClick={onEdit}>
            Edit
          </button>
          <button type="button" className="text-button danger" onClick={remove}>
            Remove
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------- the bank ----------

export default function StoryBank({ stories, companies }: { stories: StoryRow[]; companies: string[] }) {
  const router = useRouter();
  const uid = useId();
  const { groups, untagged } = groupByTheme(stories);
  const sections = [
    ...groups,
    ...(untagged.length ? [{ key: UNTAGGED, name: "No theme yet", stories: untagged }] : []),
  ];

  const [adding, setAdding] = useState(stories.length === 0);
  // With a single theme there is nothing to choose between, so it starts open.
  const [openTheme, setOpenTheme] = useState<string | null>(sections.length === 1 ? sections[0].key : null);
  const [openStory, setOpenStory] = useState<string | null>(null); // "themeKey:storyId"
  const [editing, setEditing] = useState<string | null>(null);

  // Opening one item closes the one above it, which moves things on the page.
  // After each change, bring what was just opened back into view.
  const nodes = useRef(new Map<string, HTMLElement>());
  const scrollTo = useRef<string | null>(null);
  useEffect(() => {
    const key = scrollTo.current;
    const el = key ? nodes.current.get(key) : null;
    if (!el) return;
    scrollTo.current = null;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({ block: "nearest", behavior: reduce ? "auto" : "smooth" });
  });
  const track = (key: string) => (el: HTMLElement | null) => {
    if (el) nodes.current.set(key, el);
    else nodes.current.delete(key);
  };

  const themeOptions = (() => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const name of [...groups.map((g) => g.name), ...COMMON_THEMES.map(themeHeading)]) {
      const k = themeKey(name);
      if (!seen.has(k)) {
        seen.add(k);
        out.push(name);
      }
    }
    return out;
  })();

  function toggleThemeOpen(key: string) {
    const next = openTheme === key ? null : key;
    setOpenTheme(next);
    setOpenStory(null);
    setEditing(null);
    if (next) scrollTo.current = `theme:${next}`;
  }

  function toggleStoryOpen(key: string) {
    const next = openStory === key ? null : key;
    setOpenStory(next);
    setEditing(null);
    if (next) scrollTo.current = `story:${next}`;
  }

  /** Opens a story that was just saved, under its first theme (or the one it was already open under). */
  function reveal(id: number, themes: string | null, preferTheme: string | null = null) {
    const keys = splitThemes(themes).map(themeKey);
    const theme = preferTheme && keys.includes(preferTheme) ? preferTheme : (keys[0] ?? UNTAGGED);
    setOpenTheme(theme);
    setOpenStory(`${theme}:${id}`);
    setEditing(null);
    scrollTo.current = `story:${theme}:${id}`;
  }

  const developedCount = stories.filter((s) => writtenParts(s) === 4).length;

  return (
    <>
      {adding ? (
        <div className="story-new">
          <p className="section-label">New story</p>
          <StoryForm
            initial={EMPTY}
            submitLabel="Add to story bank"
            companies={companies}
            themeOptions={themeOptions}
            onCancel={stories.length ? () => setAdding(false) : undefined}
            onSubmit={async (d) => {
              const r = await callApi("POST", "/api/stories", d);
              if (!r.ok) return r.message;
              setAdding(false);
              if (typeof r.data.id === "number") reveal(r.data.id, d.themes);
              router.refresh();
              return null;
            }}
          />
        </div>
      ) : null}

      {stories.length ? (
        <div className="bank-head">
          <p className="section-label">
            Your story bank
            <span className="bank-head-count">
              {stories.length} {stories.length === 1 ? "story" : "stories"}, {developedCount} developed
            </span>
          </p>
          {!adding ? (
            <button type="button" className="primary-button inline" onClick={() => setAdding(true)}>
              Add a story
            </button>
          ) : null}
        </div>
      ) : null}

      {sections.length ? (
        <ul className="theme-list">
          {sections.map((g) => {
            const open = openTheme === g.key;
            const panelId = `${uid}-t-${g.key}`;
            return (
              <li key={g.key} className={`theme${open ? " open" : ""}${g.key === UNTAGGED ? " untagged" : ""}`}>
                <h2 className="theme-heading">
                  <button
                    ref={track(`theme:${g.key}`)}
                    type="button"
                    className="theme-toggle"
                    aria-expanded={open}
                    aria-controls={panelId}
                    onClick={() => toggleThemeOpen(g.key)}
                  >
                    <span className="theme-name">{g.name}</span>
                    <span className="theme-count">
                      {g.stories.length} {g.stories.length === 1 ? "story" : "stories"}
                    </span>
                    <Chevron />
                  </button>
                </h2>
                <div id={panelId} className="theme-panel" hidden={!open}>
                  {g.key === UNTAGGED ? (
                    <p className="theme-note">Add a theme to these so they show up under the questions they answer.</p>
                  ) : null}
                  <ul className="theme-stories">
                    {g.stories.map((s) => {
                      const key = `${g.key}:${s.id}`;
                      const isOpen = openStory === key;
                      const written = writtenParts(s);
                      const storyPanel = `${uid}-s-${key}`;
                      return (
                        <li key={s.id} ref={track(`story:${key}`)} className={`story-item${isOpen ? " open" : ""}`}>
                          <button
                            type="button"
                            className="story-toggle"
                            aria-expanded={isOpen}
                            aria-controls={storyPanel}
                            onClick={() => toggleStoryOpen(key)}
                          >
                            <span className={written === 4 ? "story-dot done" : "story-dot"} aria-hidden="true" />
                            <span className="story-label">
                              {s.company ? (
                                <>
                                  <span className="story-company">{s.company}</span>
                                  <span className="story-sep">
                                    <span aria-hidden="true">|</span>
                                    <span className="sr-only">, </span>
                                  </span>
                                </>
                              ) : null}
                              <span className="story-name">{s.title}</span>
                            </span>
                            {written < 4 ? <span className="story-todo">{written} of 4 written</span> : null}
                            <Chevron />
                          </button>
                          <div id={storyPanel} className="story-panel" hidden={!isOpen}>
                            {isOpen && editing === key ? (
                              <StoryForm
                                initial={s}
                                submitLabel="Save story"
                                companies={companies}
                                themeOptions={themeOptions}
                                onCancel={() => setEditing(null)}
                                onSubmit={async (d) => {
                                  const r = await callApi("PATCH", `/api/stories/${s.id}`, d);
                                  if (!r.ok) return r.message;
                                  reveal(s.id, d.themes, g.key);
                                  router.refresh();
                                  return null;
                                }}
                              />
                            ) : isOpen ? (
                              <StoryRead
                                s={s}
                                onEdit={() => setEditing(key)}
                                onRemoved={() => {
                                  setOpenStory(null);
                                  setEditing(null);
                                }}
                              />
                            ) : null}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}
    </>
  );
}
