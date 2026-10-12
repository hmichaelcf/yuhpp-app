"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { appPath } from "@/lib/paths";

const ERRORS: Record<string, string> = {
  cap_reached: "You have used this month's prompt runs. They reset on the 1st.",
  unknown_prompt: "That prompt is no longer in the library.",
  signed_out: "Your session ended. Sign in again to continue.",
};

/**
 * Starts a run of a prompt and opens it. With `storyId`, the run opens with a
 * first message that names that story from the member's bank, ready to send.
 */
export default function StartRunButton({
  promptKey,
  storyId,
  label = "Start",
  title,
  buttonClass = "primary-button inline",
  className = "start-run",
}: {
  promptKey: string;
  storyId?: number;
  label?: string;
  title?: string;
  buttonClass?: string;
  className?: string;
}) {
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
        setBusy(false);
        return;
      }
      // Stays "Starting" until the run page replaces this one.
      router.push(storyId ? `/run/${data.runId}?story=${storyId}` : `/run/${data.runId}`);
    } catch {
      setError("That did not start. Check your connection and try again.");
      setBusy(false);
    }
  }

  return (
    <div className={className}>
      <button type="button" className={buttonClass} onClick={start} disabled={busy} title={title}>
        {busy ? "Starting" : label}
      </button>
      {error ? <p className="inline-error">{error}</p> : null}
    </div>
  );
}
