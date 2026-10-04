"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { appPath } from "@/lib/paths";

const ERRORS: Record<string, string> = {
  cap_reached: "You have used this month's prompt runs. They reset on the 1st.",
  unknown_prompt: "That prompt is no longer in the library.",
  signed_out: "Your session ended. Sign in again to continue.",
};

export default function StartRunButton({ promptKey }: { promptKey: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(appPath("/api/runs"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ promptKey }),
      });
      const data = (await res.json().catch(() => ({}))) as { runId?: string; error?: string };
      if (!res.ok || !data.runId) {
        setError(ERRORS[data.error ?? ""] ?? "That did not start. Please try again.");
        return;
      }
      router.push(`/run/${data.runId}`);
    } catch {
      setError("That did not start. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="start-run">
      <button type="button" className="primary-button inline" onClick={start} disabled={busy}>
        {busy ? "Starting" : "Start"}
      </button>
      {error ? <p className="inline-error">{error}</p> : null}
    </div>
  );
}
