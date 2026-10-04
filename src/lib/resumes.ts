import "server-only";
import { transcribeResumePdf } from "./claude";
import { docxText } from "./docx";
import type { Settings } from "./settings";

// The member's saved resume. Only text is kept: uploaded files are read and
// discarded. Every query filters by the member id from a verified session.

export type Resume = {
  id: number;
  file_name: string | null;
  source: "pdf" | "docx" | "text" | "paste";
  text: string;
  created_at: string;
};

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

/** A problem with an upload, worded for the member. */
export class ResumeProblem extends Error {}

type ReadResult = {
  text: string;
  source: Resume["source"];
  fileName: string | null;
};

export type ExtractUsage = { model: string; inputTokens: number; outputTokens: number };

export function uploadKind(file: File): "pdf" | "docx" | "text" | null {
  const name = file.name.toLowerCase();
  if (name.endsWith(".pdf") || file.type === "application/pdf") return "pdf";
  if (name.endsWith(".docx")) return "docx";
  if (name.endsWith(".txt") || name.endsWith(".md") || file.type.startsWith("text/")) return "text";
  return null;
}

/**
 * Turns an uploaded file or pasted text into resume text. `onUsage` is called
 * whenever a PDF was sent to Claude, even if the result is then rejected, so
 * every paid call gets logged.
 */
export async function readResume(
  input: { file?: File | null; pasted?: string | null },
  settings: Settings,
  onUsage: (usage: ExtractUsage) => Promise<void>,
): Promise<ReadResult> {
  const maxChars = settings.number("resume_max_chars", 30000);
  let result: ReadResult;

  if (input.file) {
    const file = input.file;
    if (file.size > MAX_UPLOAD_BYTES) {
      throw new ResumeProblem("That file is over 5 MB. A resume should be much smaller.");
    }
    const type = uploadKind(file);
    if (!type) {
      throw new ResumeProblem("Upload a PDF, a Word file (.docx), or a text file, or paste the text.");
    }
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (type === "pdf") {
      const model = settings.text("extract_model", "claude-haiku-4-5-20251001");
      const read = await transcribeResumePdf(bytes, model);
      await onUsage({ model, inputTokens: read.inputTokens, outputTokens: read.outputTokens });
      if (!read.text) {
        throw new ResumeProblem(
          "That file does not look like a resume. If it is one, try a Word file or paste the text.",
        );
      }
      if (read.cutOff) {
        throw new ResumeProblem(
          "That PDF is longer than a resume should be, so only part of it could be read. Try a shorter file or paste the text.",
        );
      }
      result = { text: read.text, source: "pdf", fileName: file.name };
    } else if (type === "docx") {
      let text: string;
      try {
        text = docxText(bytes);
      } catch (e) {
        throw new ResumeProblem((e as Error).message);
      }
      result = { text, source: "docx", fileName: file.name };
    } else {
      result = { text: new TextDecoder().decode(bytes), source: "text", fileName: file.name };
    }
  } else {
    result = { text: input.pasted ?? "", source: "paste", fileName: null };
  }

  result.text = result.text.replace(/\r\n?/g, "\n").trim();
  if (result.text.length < 200) {
    throw new ResumeProblem(
      "Very little text came through. If the file is a scanned image, paste the text instead.",
    );
  }
  if (result.text.length > maxChars) {
    throw new ResumeProblem(
      `That is longer than a resume should be (over ${maxChars.toLocaleString("en-US")} characters).`,
    );
  }
  return result;
}

/** "October 4, 2026" from a SQLite UTC timestamp, in Pacific time. */
export function savedOnDate(sqlite: string): string {
  return new Date(`${sqlite.replace(" ", "T")}Z`).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "America/Los_Angeles",
  });
}

const SOURCE_LABEL: Record<Resume["source"], string> = {
  pdf: "read from a PDF",
  docx: "read from a Word file",
  text: "read from a text file",
  paste: "pasted",
};

export function sourceLabel(source: Resume["source"]): string {
  return SOURCE_LABEL[source];
}

export async function currentResume(db: D1Database, memberId: string): Promise<Resume | null> {
  return db
    .prepare(
      `SELECT id, file_name, source, text, created_at FROM resumes
       WHERE member_id = ?1 AND is_current = 1 ORDER BY id DESC LIMIT 1`,
    )
    .bind(memberId)
    .first<Resume>();
}

/** Saves a new current resume; earlier versions are kept but no longer used. */
export async function saveResume(
  db: D1Database,
  memberId: string,
  r: { text: string; source: Resume["source"]; fileName: string | null },
): Promise<void> {
  await db.batch([
    db.prepare("UPDATE resumes SET is_current = 0 WHERE member_id = ?1").bind(memberId),
    db
      .prepare("INSERT INTO resumes (member_id, file_name, source, text) VALUES (?1, ?2, ?3, ?4)")
      .bind(memberId, r.fileName, r.source, r.text),
  ]);
}

/** Deletes every saved version of the member's resume. */
export async function removeResumes(db: D1Database, memberId: string): Promise<void> {
  await db.prepare("DELETE FROM resumes WHERE member_id = ?1").bind(memberId).run();
}

/** PDFs this member has had read in the last 24 hours. */
export async function pdfReadsToday(db: D1Database, memberId: string): Promise<number> {
  const row = await db
    .prepare(
      `SELECT COUNT(*) AS n FROM api_usage
       WHERE member_id = ?1 AND purpose = 'resume_pdf' AND created_at >= datetime('now', '-1 day')`,
    )
    .bind(memberId)
    .first<{ n: number }>();
  return row?.n ?? 0;
}

/** Records an API call that is not part of a prompt run (e.g. reading a PDF). */
export async function logApiUsage(
  db: D1Database,
  u: { memberId: string; purpose: string; model: string; inputTokens: number; outputTokens: number; cost: number },
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO api_usage (member_id, purpose, model, input_tokens, output_tokens, cost_usd)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6)`,
    )
    .bind(u.memberId, u.purpose, u.model, u.inputTokens, u.outputTokens, u.cost)
    .run();
}
