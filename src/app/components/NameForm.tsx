"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { callApi } from "@/lib/client-api";

// The member's first and last name. The home page greets them by first name.

export default function NameForm({ first, last }: { first: string; last: string }) {
  const router = useRouter();
  const [firstName, setFirstName] = useState(first);
  const [lastName, setLastName] = useState(last);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");

  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setNote("");
    const r = await callApi("POST", "/api/profile/name", { firstName, lastName });
    setBusy(false);
    setNote(r.ok ? "Saved." : r.message);
    if (r.ok) router.refresh();
  }

  return (
    <form className="inline-form name-form" onSubmit={save}>
      <label className="field">
        <span>First name</span>
        <input
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
          maxLength={60}
          autoComplete="given-name"
        />
      </label>
      <label className="field">
        <span>Last name</span>
        <input
          value={lastName}
          onChange={(e) => setLastName(e.target.value)}
          maxLength={60}
          autoComplete="family-name"
        />
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
