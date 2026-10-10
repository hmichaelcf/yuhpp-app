"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { callApi } from "@/lib/client-api";
import { COUNT_FIELDS, MAX_COUNT, type Counts } from "@/lib/weekly-fields";

// Log one week's numbers. Picking a week that is already logged loads its
// numbers so they can be corrected.

export type LoggedWeek = Counts & { note: string | null };

type Values = Record<string, string>;

function toValues(log: LoggedWeek | undefined): Values {
  const v: Values = { note: log?.note ?? "" };
  for (const f of COUNT_FIELDS) v[f.key] = log ? String(log[f.key]) : "";
  return v;
}

export default function WeeklyForm({
  weeks,
  logged,
  initialWeek,
}: {
  weeks: { value: string; label: string }[];
  logged: Record<string, LoggedWeek>;
  initialWeek: string;
}) {
  const router = useRouter();
  const [week, setWeek] = useState(initialWeek);
  const [values, setValues] = useState<Values>(toValues(logged[initialWeek]));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const exists = !!logged[week];

  function pick(w: string) {
    setWeek(w);
    setValues(toValues(logged[w]));
    setError("");
    setSaved(false);
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setSaved(false);
    const counts = Object.fromEntries(COUNT_FIELDS.map((f) => [f.key, values[f.key] === "" ? 0 : Number(values[f.key])]));
    const r = await callApi("PUT", "/api/weekly", { weekStart: week, counts, note: values.note });
    setBusy(false);
    if (!r.ok) return setError(r.message);
    setSaved(true);
    router.refresh();
  }

  async function clear() {
    if (!window.confirm("Remove the numbers logged for this week?")) return;
    setBusy(true);
    const r = await callApi("DELETE", `/api/weekly?week=${week}`);
    setBusy(false);
    if (!r.ok) return setError(r.message);
    setValues(toValues(undefined));
    router.refresh();
  }

  return (
    <form className="upload weekly-form" onSubmit={save}>
      <label className="field week-pick">
        <span>Week</span>
        <select value={week} onChange={(e) => pick(e.target.value)}>
          {weeks.map((w) => (
            <option key={w.value} value={w.value}>
              {w.label}
              {logged[w.value] ? " (logged)" : ""}
            </option>
          ))}
        </select>
      </label>
      <p className="form-hint">Counts for this week only. Estimates are fine; no tracking means no diagnosis.</p>
      <div className="count-grid">
        {COUNT_FIELDS.map((f) => (
          <label key={f.key} className="field">
            <span>{f.label}</span>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              max={MAX_COUNT}
              step={1}
              value={values[f.key]}
              placeholder="0"
              onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
            />
          </label>
        ))}
      </div>
      <label className="field">
        <span>Focus for next week (optional)</span>
        <input
          value={values.note}
          onChange={(e) => setValues((v) => ({ ...v, note: e.target.value }))}
          maxLength={280}
          placeholder="Two referral asks before applying"
        />
      </label>
      {error ? (
        <div className="form-error" role="alert">
          <p>{error}</p>
        </div>
      ) : null}
      {saved ? (
        <div className="sync-result" role="status">
          <p>
            <strong>Saved.</strong> Your progress below is updated.
          </p>
        </div>
      ) : null}
      <div className="upload-row">
        <button type="submit" className="primary-button inline" disabled={busy}>
          {busy ? "Saving" : exists ? "Update this week" : "Log this week"}
        </button>
        {exists ? (
          <button type="button" className="text-button danger" onClick={clear} disabled={busy}>
            Remove this week
          </button>
        ) : null}
      </div>
    </form>
  );
}
