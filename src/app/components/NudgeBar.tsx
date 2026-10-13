"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { callApi } from "@/lib/client-api";

// Home's suggestion to move on when a checkpoint looks met. The member
// decides: Move to sets the next phase; Not yet hides it until the phase changes.

export default function NudgeBar({
  title,
  body,
  nextId,
  nextLabel,
}: {
  title: string;
  body: string;
  nextId: string;
  nextLabel: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function send(payload: Record<string, unknown>) {
    setBusy(true);
    setError("");
    const r = await callApi("POST", "/api/profile/phase", payload);
    setBusy(false);
    if (!r.ok) return setError(r.message);
    router.refresh();
  }

  return (
    <section className="nudge" aria-label="Suggestion">
      <span className="nudge-mark" aria-hidden="true" />
      <p className="nudge-text">
        <strong>{title}</strong> {body}
      </p>
      <div className="nudge-actions">
        <button type="button" className="primary-button inline" onClick={() => send({ phase: nextId })} disabled={busy}>
          Move to {nextLabel}
        </button>
        <button type="button" className="text-button" onClick={() => send({ snooze: true })} disabled={busy}>
          Not yet
        </button>
      </div>
      {error ? <p className="inline-error">{error}</p> : null}
    </section>
  );
}
