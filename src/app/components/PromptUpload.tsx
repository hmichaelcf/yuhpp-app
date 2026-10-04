"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
import { appPath } from "@/lib/paths";

type SyncResult = {
  rowsRead: number;
  added: string[];
  changed: string[];
  unchanged: number;
  retired: string[];
};

export default function PromptUpload() {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [problems, setProblems] = useState<string[]>([]);
  const [result, setResult] = useState<SyncResult | null>(null);

  async function upload(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setProblems([]);
    setResult(null);
    const file = input.current?.files?.[0];
    if (!file) {
      setProblems(["Choose the CSV file first."]);
      return;
    }
    setBusy(true);
    const body = new FormData();
    body.append("file", file);
    try {
      const res = await fetch(appPath("/api/admin/prompts"), { method: "POST", body });
      const data = (await res.json().catch(() => ({}))) as {
        result?: SyncResult;
        problems?: string[];
      };
      if (!res.ok || !data.result) {
        setProblems(data.problems ?? ["The upload did not go through. Please try again."]);
        return;
      }
      setResult(data.result);
      if (input.current) input.current.value = "";
      router.refresh();
    } catch {
      setProblems(["The upload did not go through. Check your connection and try again."]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="upload" onSubmit={upload}>
      <ol className="steps">
        <li>
          Open the <strong>yuhpp_prompts</strong> Google Sheet.
        </li>
        <li>
          Choose <strong>File &gt; Download &gt; Comma Separated Values (.csv)</strong>.
        </li>
        <li>Pick that file below and click Sync prompts.</li>
      </ol>
      <div className="upload-row">
        <input ref={input} type="file" accept=".csv,text/csv" aria-label="Prompt sheet CSV" />
        <button type="submit" className="primary-button inline" disabled={busy}>
          {busy ? "Syncing" : "Sync prompts"}
        </button>
      </div>

      {problems.length > 0 ? (
        <div className="form-error" role="alert">
          <p>Nothing was changed.</p>
          <ul>
            {problems.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {result ? (
        <div className="sync-result" role="status">
          <p>
            <strong>Synced {result.rowsRead} prompts.</strong> {result.added.length} added,{" "}
            {result.changed.length} updated, {result.unchanged} unchanged,{" "}
            {result.retired.length} retired.
          </p>
          {result.added.length > 0 ? <p>Added: {result.added.join(", ")}</p> : null}
          {result.changed.length > 0 ? <p>Updated: {result.changed.join(", ")}</p> : null}
          {result.retired.length > 0 ? <p>Retired: {result.retired.join(", ")}</p> : null}
        </div>
      ) : null}
    </form>
  );
}
