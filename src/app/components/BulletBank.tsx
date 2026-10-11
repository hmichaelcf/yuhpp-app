"use client";

import { useRouter } from "next/navigation";
import { useId, useMemo, useState, type FormEvent, type KeyboardEvent, type ReactNode } from "react";
import CopyButton from "./CopyButton";
import { callApi } from "@/lib/client-api";
import { dateRange, maskMonth, readWorkDates, showMonth } from "@/lib/months";

// The bullet bank: add bullets (one per line) under a role, company, and
// dates, then edit, copy, move, or remove them. Roles are listed from most
// recent to oldest (the server sorts them). Clicking a role's heading fixes
// its title, company, or dates for every bullet under it. Lines over the
// character limit are flagged, not refused, so a long bullet can be saved now
// and tightened later.

export type ExperienceRow = {
  id: number;
  role: string | null;
  company: string | null;
  start: string | null; // YYYY-MM
  end: string | null; // YYYY-MM
  current: boolean;
};

export type BulletRow = {
  id: number;
  text: string;
  tags: string | null;
  experienceId: number | null;
};

function lines(text: string): string[] {
  return text
    .split("\n")
    .map((l) => l.replace(/^\s*(?:[•\-*–·▪◦]|\d+[.)])\s*/, "").trim())
    .filter(Boolean);
}

const same = (a: string | null | undefined, b: string | null | undefined) =>
  (a ?? "").trim().toLowerCase() === (b ?? "").trim().toLowerCase();

function roleLabel(x: ExperienceRow): string {
  if (x.role && x.company) return `${x.role}, ${x.company}`;
  return x.role || x.company || "No role set";
}

function Count({ n, max }: { n: number; max: number }) {
  return <span className={n > max ? "char-count over" : "char-count"}>{n}</span>;
}

type Dates = { start: string; end: string; current: boolean };

function DateFields({ dates, setDates }: { dates: Dates; setDates: (d: Dates) => void }) {
  const id = useId();
  return (
    <div className="field-row dates">
      <label className="field">
        <span>Start</span>
        <input
          value={dates.start}
          onChange={(e) => setDates({ ...dates, start: maskMonth(e.target.value) })}
          inputMode="numeric"
          placeholder="MM/YYYY"
          maxLength={7}
          autoComplete="off"
        />
      </label>
      <label className="field">
        <span>End</span>
        <input
          value={dates.current ? "Present" : dates.end}
          onChange={(e) => setDates({ ...dates, end: maskMonth(e.target.value) })}
          inputMode="numeric"
          placeholder="MM/YYYY"
          maxLength={7}
          autoComplete="off"
          disabled={dates.current}
        />
      </label>
      <label className="check-row present" htmlFor={`${id}-present`}>
        <input
          id={`${id}-present`}
          type="checkbox"
          checked={dates.current}
          onChange={(e) => setDates({ ...dates, current: e.target.checked })}
        />
        <span>Present. I work here now.</span>
      </label>
    </div>
  );
}

function RoleFields({
  role,
  company,
  setRole,
  setCompany,
  children,
}: {
  role: string;
  company: string;
  setRole: (v: string) => void;
  setCompany: (v: string) => void;
  children?: ReactNode;
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
      {children}
    </div>
  );
}

function cancelOnEscape(cancel: () => void) {
  return (e: KeyboardEvent) => {
    if (e.key === "Escape") cancel();
  };
}

// ---------- one bullet ----------

function BulletItem({ b, max, experiences }: { b: BulletRow; max: number; experiences: ExperienceRow[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(b.text);
  const [tags, setTags] = useState(b.tags ?? "");
  const [experienceId, setExperienceId] = useState(b.experienceId ?? experiences[0]?.id ?? 0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function cancel() {
    setText(b.text);
    setTags(b.tags ?? "");
    setExperienceId(b.experienceId ?? experiences[0]?.id ?? 0);
    setError("");
    setEditing(false);
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const r = await callApi("PATCH", `/api/bullets/${b.id}`, { text, tags, experienceId });
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
        <form className="bank-edit" onSubmit={save} onKeyDown={cancelOnEscape(cancel)}>
          <label className="field">
            <span>
              Bullet <Count n={text.trim().length} max={max} />
            </span>
            <textarea value={text} onChange={(e) => setText(e.target.value)} rows={2} autoFocus />
          </label>
          <div className="field-row two">
            <label className="field">
              <span>Role</span>
              <select value={experienceId} onChange={(e) => setExperienceId(Number(e.target.value))}>
                {experiences.map((x) => (
                  <option key={x.id} value={x.id}>
                    {roleLabel(x)}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Tags</span>
              <input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="lead scoring, automation" />
            </label>
          </div>
          {error ? <p className="form-error">{error}</p> : null}
          <div className="row-actions">
            <button type="submit" className="primary-button inline" disabled={busy}>
              {busy ? "Saving" : "Save"}
            </button>
            <button type="button" className="text-button" onClick={cancel} disabled={busy}>
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

// ---------- one role's heading ----------

function ExperienceHeading({ x }: { x: ExperienceRow }) {
  const router = useRouter();
  const saved = () => ({ start: showMonth(x.start), end: showMonth(x.end), current: x.current });
  const [editing, setEditing] = useState(false);
  const [role, setRole] = useState(x.role ?? "");
  const [company, setCompany] = useState(x.company ?? "");
  const [dates, setDates] = useState<Dates>(saved);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function open() {
    setRole(x.role ?? "");
    setCompany(x.company ?? "");
    setDates(saved());
    setError("");
    setEditing(true);
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    const checked = readWorkDates(dates.start, dates.end, dates.current);
    if (!checked.ok) return setError(checked.message);
    setBusy(true);
    setError("");
    const r = await callApi("PATCH", `/api/experiences/${x.id}`, { role, company, ...dates });
    setBusy(false);
    if (!r.ok) return setError(r.message);
    setEditing(false);
    router.refresh();
  }

  if (editing) {
    return (
      <form className="bank-role-edit" onSubmit={save} onKeyDown={cancelOnEscape(() => setEditing(false))}>
        <RoleFields {...{ role, company, setRole, setCompany }} />
        <DateFields dates={dates} setDates={setDates} />
        <p className="form-hint">
          Changes apply to every bullet under this role. If the role and company match another one in
          your bank, the two are combined.
        </p>
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
    );
  }

  const range = dateRange(x.start, x.end, x.current);
  return (
    <div className="bank-heading-row">
      <button type="button" className="bank-heading-button" onClick={open} title="Edit role, company, and dates">
        <h2 className="bank-heading">
          {x.role ?? "No role set"}
          {x.company ? <span className="bank-company">{x.company}</span> : null}
        </h2>
      </button>
      <span className={range ? "bank-dates" : "bank-dates missing"}>{range || "No dates yet"}</span>
      <button type="button" className="text-button" onClick={open}>
        Edit
      </button>
    </div>
  );
}

// ---------- the bank ----------

export default function BulletBank({
  bullets,
  experiences,
  max,
}: {
  bullets: BulletRow[];
  experiences: ExperienceRow[];
  max: number;
}) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [role, setRole] = useState("");
  const [company, setCompany] = useState("");
  const [tags, setTags] = useState("");
  const [dates, setDates] = useState<Dates>({ start: "", end: "", current: false });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [added, setAdded] = useState(0);

  const roles = useMemo(
    () => [...new Set(experiences.map((x) => x.role).filter((r): r is string => !!r))],
    [experiences],
  );
  const companies = useMemo(
    () => [...new Set(experiences.map((x) => x.company).filter((c): c is string => !!c))],
    [experiences],
  );
  const draft = lines(text);
  const overDraft = draft.filter((l) => l.length > max).length;

  // Experiences in the server's order (most recent first), each with its bullets.
  const groups = useMemo(() => {
    const byExperience = new Map<number, BulletRow[]>();
    for (const b of bullets) {
      if (b.experienceId == null) continue;
      if (!byExperience.has(b.experienceId)) byExperience.set(b.experienceId, []);
      byExperience.get(b.experienceId)!.push(b);
    }
    return experiences
      .filter((x) => byExperience.has(x.id))
      .map((x) => ({ experience: x, items: byExperience.get(x.id)! }));
  }, [bullets, experiences]);
  const overTotal = bullets.filter((b) => b.text.length > max).length;

  const match = experiences.find((x) => same(x.role, role) && same(x.company, company));
  const datesTyped = dates.start.trim() !== "" || dates.end.trim() !== "" || dates.current;

  async function add(e: FormEvent) {
    e.preventDefault();
    if (!draft.length) return setError("Write or paste a bullet first.");
    const checked = readWorkDates(dates.start, dates.end, dates.current);
    if (!checked.ok) return setError(checked.message);
    setBusy(true);
    setError("");
    setAdded(0);
    const r = await callApi("POST", "/api/bullets", { text, role, company, tags, ...dates });
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
        <RoleFields {...{ role, company, setRole, setCompany }}>
          <label className="field">
            <span>Tags</span>
            <input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="lead scoring, automation" />
          </label>
        </RoleFields>
        <DateFields dates={dates} setDates={setDates} />
        {match && (role.trim() || company.trim()) ? (
          <p className="form-hint">
            {datesTyped
              ? `These go under your saved ${roleLabel(match)}, and its dates change to the ones above.`
              : `These go under your saved ${roleLabel(match)}${
                  dateRange(match.start, match.end, match.current)
                    ? ` (${dateRange(match.start, match.end, match.current)})`
                    : ""
                }. Leave the dates blank to keep them.`}
          </p>
        ) : null}
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
          {groups.map(({ experience, items }) => (
            <section key={experience.id} className="bank-group">
              <ExperienceHeading
                key={`${experience.id}-${experience.role}-${experience.company}-${experience.start}-${experience.end}-${experience.current}`}
                x={experience}
              />
              <ul className="bank-list">
                {items.map((b) => (
                  <BulletItem key={`${b.id}-${b.experienceId}`} b={b} max={max} experiences={experiences} />
                ))}
              </ul>
            </section>
          ))}
        </>
      ) : null}
    </>
  );
}
