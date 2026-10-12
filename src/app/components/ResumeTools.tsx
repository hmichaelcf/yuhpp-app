"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { callApi } from "@/lib/client-api";
import { maskMonth, showMonth } from "@/lib/months";
import { appPath } from "@/lib/paths";
import type { ResumeData, ResumeReference } from "@/lib/resume-shape";

// The working parts of the resume page: start from an upload, fill in the
// details, fix roles missing a title or dates, check the fit, and publish.

// ---------- start from the uploaded resume ----------

export function ImportButton({ again = false }: { again?: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function run() {
    setBusy(true);
    setError("");
    setMessage("");
    const r = await callApi("POST", "/api/resume/import");
    setBusy(false);
    if (!r.ok) {
      setError(r.message);
      return;
    }
    const d = r.data as { rolesAdded?: number; bulletsAdded?: number; rolesKept?: number; rolesWithoutBullets?: number };
    const parts = [
      d.rolesAdded ? `${d.rolesAdded} ${d.rolesAdded === 1 ? "role" : "roles"} and ${d.bulletsAdded} bullets added` : "",
      d.rolesKept ? `${d.rolesKept} already in your bullet bank, left as they were` : "",
      d.rolesWithoutBullets ? `${d.rolesWithoutBullets} with no bullets skipped` : "",
    ].filter(Boolean);
    setMessage(parts.length ? `${parts.join("; ")}.` : "Your details were read in.");
    router.refresh();
  }

  return (
    <div className="resume-import">
      <button
        type="button"
        className={again ? "text-button" : "primary-button inline"}
        onClick={run}
        disabled={busy}
      >
        {busy ? "Reading your resume" : again ? "Read in my uploaded resume again" : "Start from my uploaded resume"}
      </button>
      {message ? (
        <p className="form-hint" role="status">
          {message}
        </p>
      ) : null}
      {error ? <p className="form-error">{error}</p> : null}
    </div>
  );
}

// ---------- details ----------

const asLines = (items: string[]) => items.join("\n");

export function ResumeEditor({ data }: { data: ResumeData }) {
  const router = useRouter();
  const [f, setF] = useState(() => ({
    name: data.name ?? "",
    h1: data.headline[0] ?? "",
    h2: data.headline[1] ?? "",
    h3: data.headline[2] ?? "",
    email: data.contact.email ?? "",
    phone: data.contact.phone ?? "",
    location: data.contact.location ?? "",
    skills: asLines(data.skills),
    leadership: asLines(data.leadership),
    tools: asLines(data.tools),
    interests: asLines(data.interests),
    school: data.education.school ?? "",
    degree: data.education.degree ?? "",
    schoolLocation: data.education.location ?? "",
  }));
  const [refs, setRefs] = useState<ResumeReference[]>(() => {
    const list = [...data.references];
    while (list.length < 3) list.push({ name: "", relationship: "", company: "" });
    return list;
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  const set = (key: keyof typeof f) => (e: { target: { value: string } }) => {
    setSaved(false);
    setF((x) => ({ ...x, [key]: e.target.value }));
  };
  const setRef = (i: number, key: keyof ResumeReference) => (e: { target: { value: string } }) => {
    setSaved(false);
    setRefs((list) => list.map((r, j) => (j === i ? { ...r, [key]: e.target.value } : r)));
  };

  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const r = await callApi("PUT", "/api/resume", {
      name: f.name,
      headline: [f.h1, f.h2, f.h3],
      email: f.email,
      phone: f.phone,
      location: f.location,
      skills: f.skills,
      leadership: f.leadership,
      tools: f.tools,
      interests: f.interests,
      school: f.school,
      degree: f.degree,
      schoolLocation: f.schoolLocation,
      references: refs.filter((x) => x.name.trim()),
    });
    setBusy(false);
    if (!r.ok) {
      setError(r.message);
      return;
    }
    setSaved(true);
    router.refresh();
  }

  return (
    <form className="resume-editor" onSubmit={save}>
      <fieldset>
        <legend>Top of page 1</legend>
        <label className="field">
          <span>Your name</span>
          <input value={f.name} onChange={set("name")} autoComplete="name" />
        </label>
        <div className="field-row">
          <label className="field">
            <span>Keyword 1</span>
            <input value={f.h1} onChange={set("h1")} />
          </label>
          <label className="field">
            <span>Keyword 2</span>
            <input value={f.h2} onChange={set("h2")} />
          </label>
          <label className="field">
            <span>Keyword 3</span>
            <input value={f.h3} onChange={set("h3")} />
          </label>
        </div>
        <div className="field-row">
          <label className="field">
            <span>Email</span>
            <input type="email" value={f.email} onChange={set("email")} autoComplete="email" />
          </label>
          <label className="field">
            <span>Phone</span>
            <input type="tel" value={f.phone} onChange={set("phone")} autoComplete="tel" />
          </label>
          <label className="field">
            <span>Location</span>
            <input value={f.location} onChange={set("location")} placeholder="City, State" />
          </label>
        </div>
      </fieldset>

      <fieldset>
        <legend>Side column, one entry per line</legend>
        <div className="field-row two">
          <label className="field">
            <span>Skills &amp; knowledge</span>
            <textarea rows={7} value={f.skills} onChange={set("skills")} />
          </label>
          <label className="field">
            <span>Leadership</span>
            <textarea rows={7} value={f.leadership} onChange={set("leadership")} />
          </label>
        </div>
        <div className="field-row two">
          <label className="field">
            <span>Tools</span>
            <textarea rows={6} value={f.tools} onChange={set("tools")} />
          </label>
          <label className="field">
            <span>Interests, up to five</span>
            <textarea rows={6} value={f.interests} onChange={set("interests")} />
          </label>
        </div>
      </fieldset>

      <fieldset>
        <legend>Education</legend>
        <div className="field-row">
          <label className="field">
            <span>School</span>
            <input value={f.school} onChange={set("school")} />
          </label>
          <label className="field">
            <span>Degree and area of study</span>
            <input value={f.degree} onChange={set("degree")} />
          </label>
          <label className="field">
            <span>Location</span>
            <input value={f.schoolLocation} onChange={set("schoolLocation")} />
          </label>
        </div>
      </fieldset>

      <fieldset>
        <legend>References, optional</legend>
        {refs.map((r, i) => (
          <div className="field-row" key={i}>
            <label className="field">
              <span>Name</span>
              <input value={r.name} onChange={setRef(i, "name")} />
            </label>
            <label className="field">
              <span>Relationship</span>
              <input value={r.relationship ?? ""} onChange={setRef(i, "relationship")} placeholder="Former manager" />
            </label>
            <label className="field">
              <span>Company</span>
              <input value={r.company ?? ""} onChange={setRef(i, "company")} />
            </label>
          </div>
        ))}
      </fieldset>

      {error ? <p className="form-error">{error}</p> : null}
      <div className="row-actions">
        <button type="submit" className="primary-button inline" disabled={busy}>
          {busy ? "Saving" : "Save details"}
        </button>
        {saved ? (
          <span className="form-hint" role="status">
            Saved to your draft.
          </span>
        ) : null}
      </div>
    </form>
  );
}

// ---------- roles missing a title or dates ----------

type RoleGap = {
  id: number;
  company: string | null;
  title: string | null;
  start: string | null;
  end: string | null;
  current: boolean;
};

function RoleGapForm({ role }: { role: RoleGap }) {
  const router = useRouter();
  const [title, setTitle] = useState(role.title ?? "");
  const [company, setCompany] = useState(role.company ?? "");
  const [start, setStart] = useState(showMonth(role.start));
  const [end, setEnd] = useState(showMonth(role.end));
  const [current, setCurrent] = useState(role.current);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const r = await callApi("PATCH", `/api/experiences/${role.id}`, { role: title, company, start, end, current });
    setBusy(false);
    if (!r.ok) setError(r.message);
    else router.refresh();
  }

  return (
    <form className="role-gap" onSubmit={save}>
      <p className="role-gap-name">{role.company || role.title || "One role"}</p>
      <div className="field-row">
        <label className="field">
          <span>Title</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} />
        </label>
        <label className="field">
          <span>Company</span>
          <input value={company} onChange={(e) => setCompany(e.target.value)} />
        </label>
        <label className="field">
          <span>Start</span>
          <input
            value={start}
            onChange={(e) => setStart(maskMonth(e.target.value))}
            placeholder="MM/YYYY"
            inputMode="numeric"
          />
        </label>
      </div>
      <div className="field-row dates">
        <label className="field">
          <span>End</span>
          <input
            value={current ? "" : end}
            onChange={(e) => setEnd(maskMonth(e.target.value))}
            placeholder={current ? "Present" : "MM/YYYY"}
            inputMode="numeric"
            disabled={current}
          />
        </label>
        <label className="check-row present">
          <input type="checkbox" checked={current} onChange={(e) => setCurrent(e.target.checked)} />
          <span>I work here now</span>
        </label>
        <div className="row-actions">
          <button type="submit" className="primary-button inline" disabled={busy}>
            {busy ? "Saving" : "Save role"}
          </button>
        </div>
      </div>
      {error ? <p className="form-error">{error}</p> : null}
    </form>
  );
}

export function RoleGaps({ roles }: { roles: RoleGap[] }) {
  if (roles.length === 0) return null;
  return (
    <div className="role-gaps">
      {roles.map((r) => (
        <RoleGapForm key={r.id} role={r} />
      ))}
    </div>
  );
}

// ---------- fit check ----------

/**
 * Measures the preview: anything that runs past its space on the page
 * (into the page number, or into Education on page 2) is named so the
 * member can trim bullets or move a role before they print.
 */
export function FitCheck() {
  const ref = useRef<HTMLParagraphElement>(null);
  const [problems, setProblems] = useState<string[] | null>(null);

  useEffect(() => {
    const doc = ref.current?.closest(".resume-preview-wrap")?.querySelector(".rp-doc");
    if (!doc) return;
    const measure = () => {
      const pages = doc.querySelectorAll<HTMLElement>(".rp-page");
      const out: string[] = [];
      const bottom = (page: HTMLElement, sel: string) => {
        const el = page.querySelector<HTMLElement>(sel);
        return el ? (el.offsetTop + el.offsetHeight) / page.offsetHeight : 0;
      };
      // Page heights are 792pt; the page number starts near 759pt, Education at 589.6pt.
      if (pages[0]) {
        if (bottom(pages[0], ".rp-left") > 750 / 792) out.push("Page 1 experience runs into the page number.");
        if (bottom(pages[0], ".rp-right") > 750 / 792) out.push("The side column on page 1 runs long.");
      }
      if (pages[1]) {
        if (bottom(pages[1], ".rp-left") > 580 / 792) out.push("Page 2 experience runs into Education.");
        if (bottom(pages[1], ".rp-right") > 750 / 792) out.push("The side column on page 2 runs long.");
      }
      setProblems(out);
    };
    measure();
    document.fonts?.ready.then(measure).catch(() => undefined);
  }, []);

  return (
    <p ref={ref} className={problems && problems.length ? "fit-check warn" : "fit-check"} role="status">
      {problems === null
        ? "Checking the fit"
        : problems.length
          ? `${problems.join(" ")} Trim bullets in your bullet bank or leave a role off.`
          : "Fits on two pages."}
    </p>
  );
}

// ---------- publish ----------

export function PublishPanel({
  blockers,
  useOwnFile,
  hasUpload,
  unpublished,
}: {
  blockers: string[];
  useOwnFile: boolean;
  hasUpload: boolean;
  unpublished: boolean;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<"publish" | "own_file">(useOwnFile ? "own_file" : "publish");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");

  async function go() {
    setBusy(true);
    setError("");
    setDone("");
    const r = await callApi("POST", "/api/resume/publish", { mode });
    setBusy(false);
    if (!r.ok) {
      setError(r.message);
      return;
    }
    setDone(
      mode === "publish"
        ? `Published as v${String(r.data.version ?? "")}. Every run reads this version now.`
        : "Your uploaded file stays your resume. Searches still use your search brief.",
    );
    router.refresh();
  }

  const blocked = mode === "publish" && blockers.length > 0;
  // Nothing to do: the published version is current, or the member already keeps their file.
  const nothingNew = mode === "publish" ? !unpublished && !useOwnFile : useOwnFile;

  return (
    <div className="publish-panel">
      <div role="radiogroup" aria-label="How your searches use your resume" className="publish-choices">
        <label className={mode === "publish" ? "publish-choice on" : "publish-choice"}>
          <input type="radio" name="mode" checked={mode === "publish"} onChange={() => setMode("publish")} />
          <span>
            <b>Make this my resume</b>
            <span>Every run reads this version, and you download it as a PDF in the Yuhpp template.</span>
          </span>
        </label>
        <label className={mode === "own_file" ? "publish-choice on" : "publish-choice"}>
          <input
            type="radio"
            name="mode"
            checked={mode === "own_file"}
            onChange={() => setMode("own_file")}
            disabled={!hasUpload}
          />
          <span>
            <b>Keep my own file</b>
            <span>
              {hasUpload
                ? "Your upload stays your resume. Searches still get your search brief: target titles, location, and keywords."
                : "Save a file under Profile first to choose this."}
            </span>
          </span>
        </label>
      </div>

      {blocked ? (
        <div className="form-error">
          <p>Fill these in to publish:</p>
          <ul>
            {blockers.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {error ? <p className="form-error">{error}</p> : null}
      {done ? (
        <p className="form-hint" role="status">
          {done}
        </p>
      ) : null}

      <div className="row-actions">
        <button type="button" className="primary-button inline" onClick={go} disabled={busy || blocked || nothingNew}>
          {busy
            ? "Saving"
            : mode === "publish"
              ? nothingNew
                ? "Published"
                : "Publish resume"
              : nothingNew
                ? "Keeping your file"
                : "Keep my file"}
        </button>
        <a className="copy" href={appPath("/resume/print?print=1")} target="_blank" rel="noreferrer">
          Download PDF
        </a>
      </div>
    </div>
  );
}
