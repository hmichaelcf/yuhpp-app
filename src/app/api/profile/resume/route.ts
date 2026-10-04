import { NextResponse } from "next/server";
import { ClaudeError } from "@/lib/claude";
import { bindings } from "@/lib/cloudflare";
import {
  ResumeProblem,
  logApiUsage,
  pdfReadsToday,
  readResume,
  removeResumes,
  saveResume,
  uploadKind,
} from "@/lib/resumes";
import { currentMember } from "@/lib/session";
import { loadSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

/**
 * POST /app/api/profile/resume
 * Multipart form with either "file" (PDF, .docx, .txt, .md) or "text"
 * (pasted). Saves the text as the member's current resume.
 */
export async function POST(request: Request) {
  const member = await currentMember();
  if (!member) return NextResponse.json({ error: "signed_out" }, { status: 401 });

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  const pasted = form?.get("text");
  const hasFile = !!file && typeof file !== "string" && file.size > 0;
  const hasText = typeof pasted === "string" && pasted.trim().length > 0;
  if (!hasFile && !hasText) {
    return NextResponse.json(
      { error: "empty", message: "Choose a file or paste your resume text." },
      { status: 400 },
    );
  }

  const { DB } = await bindings();
  const settings = await loadSettings(DB);
  // Reading a PDF is a paid call, so it has a daily limit per member.
  if (hasFile && uploadKind(file as File) === "pdf") {
    const limit = settings.number("resume_pdf_reads_daily", 10);
    if ((await pdfReadsToday(DB, member.id)) >= limit) {
      return NextResponse.json(
        {
          error: "pdf_limit",
          message: "You have uploaded several PDFs today. Upload a Word file or paste the text instead, or try again tomorrow.",
        },
        { status: 429 },
      );
    }
  }
  const work = async (): Promise<Record<string, unknown>> => {
    try {
      const read = await readResume(
        { file: hasFile ? (file as File) : null, pasted: hasText ? (pasted as string) : null },
        settings,
        (usage) =>
          logApiUsage(DB, {
            memberId: member.id,
            purpose: "resume_pdf",
            model: usage.model,
            inputTokens: usage.inputTokens,
            outputTokens: usage.outputTokens,
            cost:
              (usage.inputTokens * settings.number("price_extract_input_per_mtok", 1) +
                usage.outputTokens * settings.number("price_extract_output_per_mtok", 5)) /
              1_000_000,
          }),
      );
      await saveResume(DB, member.id, read);
      return { ok: true, chars: read.text.length };
    } catch (e) {
      if (e instanceof ResumeProblem) return { error: "unreadable", message: e.message };
      if (e instanceof ClaudeError) {
        return {
          error: e.code,
          message: "The PDF could not be read right now. Try again, or upload a Word file.",
        };
      }
      console.error("Resume save failed:", e);
      return { error: "failed", message: "Your resume could not be saved. Please try again." };
    }
  };

  return keepAliveJson(work);
}

/**
 * Reading a PDF can take longer than the 20 seconds Webflow Cloud allows a
 * silent response, so the result is streamed: a space right away and every
 * few seconds while the work runs (JSON ignores leading whitespace), then
 * the JSON. The status is always 200; the body's "ok" says how it went.
 */
function keepAliveJson(work: () => Promise<Record<string, unknown>>): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (text: string) => {
        try {
          controller.enqueue(encoder.encode(text));
        } catch {
          // The browser went away; finish the work anyway.
        }
      };
      send(" ");
      const timer = setInterval(() => send(" "), 5_000);
      try {
        send(JSON.stringify(await work()));
      } finally {
        clearInterval(timer);
        try {
          controller.close();
        } catch {
          // already closed
        }
      }
    },
  });
  return new Response(stream, {
    headers: {
      // event-stream tells proxies not to buffer the keepalive spaces.
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

/** DELETE /app/api/profile/resume  removes every saved version. */
export async function DELETE() {
  const member = await currentMember();
  if (!member) return NextResponse.json({ error: "signed_out" }, { status: 401 });
  const { DB } = await bindings();
  await removeResumes(DB, member.id);
  return NextResponse.json({ ok: true });
}
