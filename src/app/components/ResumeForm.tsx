"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
import { appPath } from "@/lib/paths";

// Upload or paste a resume. The server reads it into text, saves the text,
// and discards the file; the page then shows exactly what was read.

export default function ResumeForm({ hasResume }: { hasResume: boolean }) {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<"file" | "paste">("file");
  const [pasted, setPasted] = useState("");
  const [busy, setBusy] = useState<"" | "reading" | "saving" | "removing">("");
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setSaved(false);
    const body = new FormData();
    if (mode === "file") {
      const file = fileInput.current?.files?.[0];
      if (!file) {
        setError("Choose your resume file first.");
        return;
      }
      body.append("file", file);
      setBusy(file.name.toLowerCase().endsWith(".pdf") ? "reading" : "saving");
    } else {
      if (!pasted.trim()) {
        setError("Paste your resume text first.");
        return;
      }
      body.append("text", pasted);
      setBusy("saving");
    }
    try {
      const res = await fetch(appPath("/api/profile/resume"), { method: "POST", body });
      // The body may start with keepalive spaces; JSON parsing ignores them.
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; message?: string };
      if (!res.ok || !data.ok) {
        setError(data.message ?? "Your resume could not be saved. Please try again.");
        return;
      }
      setSaved(true);
      setPasted("");
      if (fileInput.current) fileInput.current.value = "";
      router.refresh();
    } catch {
      setError("Your resume could not be saved. Check your connection and try again.");
    } finally {
      setBusy("");
    }
  }

  async function remove() {
    if (!window.confirm("Remove your saved resume? Prompts will ask you to paste it instead.")) return;
    setError("");
    setSaved(false);
    setBusy("removing");
    try {
      const res = await fetch(appPath("/api/profile/resume"), { method: "DELETE" });
      if (!res.ok) {
        setError("Your resume could not be removed. Please try again.");
        return;
      }
      router.refresh();
    } catch {
      setError("Your resume could not be removed. Check your connection and try again.");
    } finally {
      setBusy("");
    }
  }

  const label =
    busy === "reading"
      ? "Reading your PDF"
      : busy === "saving"
        ? "Saving"
        : hasResume
          ? "Replace resume"
          : "Save resume";

  return (
    <form className="upload" onSubmit={save}>
      <div className="mode-switch" role="tablist" aria-label="How to add your resume">
        <button
          type="button"
          role="tab"
          aria-selected={mode === "file"}
          className={mode === "file" ? "auth-tab on" : "auth-tab"}
          onClick={() => setMode("file")}
        >
          Upload a file
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === "paste"}
          className={mode === "paste" ? "auth-tab on" : "auth-tab"}
          onClick={() => setMode("paste")}
        >
          Paste the text
        </button>
      </div>

      {mode === "file" ? (
        <>
          <p className="form-hint">
            A PDF or Word file (.docx) works best. A PDF takes a few seconds to read.
          </p>
          <input
            ref={fileInput}
            type="file"
            accept=".pdf,.docx,.txt,.md,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
            aria-label="Resume file"
          />
        </>
      ) : (
        <textarea
          className="paste-box"
          value={pasted}
          onChange={(e) => setPasted(e.target.value)}
          placeholder="Paste the full text of your resume here."
          rows={12}
          aria-label="Resume text"
        />
      )}

      <div className="upload-row">
        <button type="submit" className="primary-button inline" disabled={busy !== ""}>
          {label}
        </button>
        {hasResume ? (
          <button type="button" className="text-button" onClick={remove} disabled={busy !== ""}>
            {busy === "removing" ? "Removing" : "Remove saved resume"}
          </button>
        ) : null}
      </div>

      {error ? (
        <div className="form-error" role="alert">
          <p>{error}</p>
        </div>
      ) : null}
      {saved ? (
        <div className="sync-result" role="status">
          <p>
            <strong>Saved.</strong> Check the text below to make sure everything came through
            correctly.
          </p>
        </div>
      ) : null}
    </form>
  );
}
