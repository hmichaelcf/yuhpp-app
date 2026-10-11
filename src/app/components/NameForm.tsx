"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { callApi } from "@/lib/client-api";

// The first name the workspace greets the member by.

export default function NameForm({ initial }: { initial: string }) {
  const router = useRouter();
  const [name, setName] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");

  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setNote("");
    const r = await callApi("POST", "/api/profile/name", { firstName: name });
    setBusy(false);
    setNote(r.ok ? "Saved." : r.message);
    if (r.ok) router.refresh();
  }

  return (
    <form className="inline-form name-form" onSubmit={save}>
      <label className="field">
        <span>First name</span>
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} autoComplete="given-name" />
      </label>
      <button type="submit" className="primary-button inline" disabled={busy}>
        {busy ? "Saving" : "Save"}
      </button>
      {note ? (
        <span className="form-hint" role="status">
          {note}
        </span>
      ) : null}
    </form>
  );
}
