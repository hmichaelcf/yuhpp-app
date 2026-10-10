"use client";

import { useState } from "react";

// Copies text to the clipboard and says so for a moment.

export default function CopyButton({
  text,
  label = "Copy",
  className = "copy",
}: {
  text: string;
  label?: string;
  className?: string;
}) {
  const [state, setState] = useState<"" | "done" | "failed">("");

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setState("done");
    } catch {
      setState("failed");
    }
    setTimeout(() => setState(""), 1600);
  }

  return (
    <button type="button" className={`${className}${state === "done" ? " done" : ""}`} onClick={copy}>
      {state === "done" ? "Copied" : state === "failed" ? "Select and copy" : label}
    </button>
  );
}
