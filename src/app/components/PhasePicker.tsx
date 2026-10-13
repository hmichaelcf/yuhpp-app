"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { callApi } from "@/lib/client-api";
import { PHASE_IDS, PHASE_INFO, WHERE_LINES, phaseLabel, type PhaseId } from "@/lib/phases";

// "Where are you in your search?": asked once of new members, and again
// whenever they choose Change where I am. Saves the phase and returns Home.

export default function PhasePicker({ current }: { current: PhaseId | null }) {
  const router = useRouter();
  const [line, setLine] = useState<number | null>(null);
  const [direct, setDirect] = useState<PhaseId | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const picked: PhaseId | null = direct ?? (line !== null ? WHERE_LINES[line].phase : null);

  async function save() {
    if (!picked) return;
    setBusy(true);
    setError("");
    const r = await callApi("POST", "/api/profile/phase", { phase: picked });
    if (!r.ok) {
      setBusy(false);
      setError(r.message);
      return;
    }
    router.replace("/");
    router.refresh();
  }

  return (
    <div className="where">
      <fieldset className="where-lines">
        <legend className="sr-only">Pick the line that sounds most like your week</legend>
        {WHERE_LINES.map((w, i) => {
          const on = line === i && !direct;
          return (
            <button
              key={w.q}
              type="button"
              className={on ? "where-line on" : "where-line"}
              aria-pressed={on}
              onClick={() => {
                setLine(i);
                setDirect(null);
              }}
            >
              <span className="where-radio" aria-hidden="true" />
              <span className="where-q">{w.q}</span>
              <span className="where-a">{phaseLabel(w.phase)}</span>
            </button>
          );
        })}
      </fieldset>

      <div className="where-direct">
        <p className="where-direct-label">Or pick the phase yourself</p>
        <div className="where-chips">
          {PHASE_IDS.map((id) => {
            const on = picked === id;
            return (
              <button
                key={id}
                type="button"
                className={on ? "where-chip on" : "where-chip"}
                aria-pressed={on}
                onClick={() => {
                  setDirect(id);
                  setLine(null);
                }}
              >
                <span className="where-chip-code">{PHASE_INFO[id].code}</span>
                {PHASE_INFO[id].name}
                {current === id ? <span className="where-chip-now">Now</span> : null}
              </button>
            );
          })}
        </div>
      </div>

      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}

      <div className="where-go">
        <button type="button" className="primary-button inline" onClick={save} disabled={!picked || busy}>
          {busy ? "Saving" : picked ? `Continue to ${phaseLabel(picked)}` : "Pick one to continue"}
        </button>
        <span className="form-hint">Not sure? Start at 01 Direction. Most people who skip it end up coming back.</span>
      </div>
    </div>
  );
}
