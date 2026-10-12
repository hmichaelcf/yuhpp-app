import { NextResponse } from "next/server";
import { signedOut } from "@/lib/api";
import { ClaudeError, readResumeSections } from "@/lib/claude";
import { bindings } from "@/lib/cloudflare";
import { keepAliveJson } from "@/lib/keepalive";
import { applyImport } from "@/lib/resume-import";
import { loadProfile } from "@/lib/resume-record";
import { logApiUsage } from "@/lib/resumes";
import { currentMember } from "@/lib/session";
import { loadSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

/**
 * POST /app/api/resume/import
 * Reads the member's latest uploaded resume into the resume draft: roles and
 * bullets into the bullet bank, and contact details, skills, tools, interests,
 * and education into empty profile fields. Nothing already there is changed.
 * A paid call to a small model, logged in api_usage and capped per day.
 */
export async function POST() {
  const member = await currentMember();
  if (!member) return signedOut();
  const { DB } = await bindings();

  const upload = await DB.prepare(
    "SELECT id, text FROM resumes WHERE member_id = ?1 AND source != 'built' ORDER BY id DESC LIMIT 1",
  )
    .bind(member.id)
    .first<{ id: number; text: string }>();
  if (!upload) {
    return NextResponse.json(
      { error: "no_upload", message: "Save your resume under Profile first, then start from it here." },
      { status: 400 },
    );
  }

  const settings = await loadSettings(DB);
  const limit = settings.number("resume_imports_daily", 5);
  const used = await DB.prepare(
    `SELECT COUNT(*) AS n FROM api_usage
     WHERE member_id = ?1 AND purpose = 'resume_import' AND created_at >= datetime('now', '-1 day')`,
  )
    .bind(member.id)
    .first<{ n: number }>();
  if ((used?.n ?? 0) >= limit) {
    return NextResponse.json(
      { error: "import_limit", message: "You have read your resume in several times today. Try again tomorrow." },
      { status: 429 },
    );
  }

  return keepAliveJson(async () => {
    try {
      const model = settings.text("extract_model", "claude-haiku-4-5-20251001");
      const read = await readResumeSections(upload.text, model);
      await logApiUsage(DB, {
        memberId: member.id,
        purpose: "resume_import",
        model,
        inputTokens: read.inputTokens,
        outputTokens: read.outputTokens,
        cost:
          (read.inputTokens * settings.number("price_extract_input_per_mtok", 1) +
            read.outputTokens * settings.number("price_extract_output_per_mtok", 5)) /
          1_000_000,
      });
      if (!read.data) {
        return { error: "unreadable", message: "Your resume could not be read into sections. Try again in a moment." };
      }
      const result = await applyImport(DB, member.id, read.data, await loadProfile(DB, member.id));
      return { ok: true, ...result };
    } catch (e) {
      if (e instanceof ClaudeError) {
        return { error: e.code, message: "Your resume could not be read right now. Try again in a moment." };
      }
      console.error("Resume import failed:", e);
      return { error: "failed", message: "Your resume could not be read. Please try again." };
    }
  });
}
