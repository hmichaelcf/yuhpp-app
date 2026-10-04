import { NextResponse } from "next/server";
import { bindings } from "@/lib/cloudflare";
import { ClaudeError, streamTurn, turnCost } from "@/lib/claude";
import { buildSystem, wantsWebSearch } from "@/lib/frame";
import {
  addMessage,
  deleteMessage,
  getRun,
  promptBodyForRun,
  recordTurn,
  runMessages,
  runsUsedThisMonth,
} from "@/lib/runs";
import { currentResume, savedOnDate } from "@/lib/resumes";
import { currentMember } from "@/lib/session";
import { loadSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

const MAX_MESSAGE_CHARS = 60_000;

/**
 * POST /app/api/runs/:id/messages  { content }
 * Adds the member's message to the run and streams Claude's reply back as
 * plain text. The prompt body is assembled here on the server and never
 * leaves it.
 */
export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const member = await currentMember();
  if (!member) return NextResponse.json({ error: "signed_out" }, { status: 401 });

  const { DB } = await bindings();
  const run = await getRun(DB, id, member.id);
  if (!run) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (run.status !== "open") return NextResponse.json({ error: "run_closed" }, { status: 409 });

  const body = (await request.json().catch(() => ({}))) as { content?: unknown };
  const content = typeof body.content === "string" ? body.content.trim() : "";
  if (!content) return NextResponse.json({ error: "empty" }, { status: 400 });
  if (content.length > MAX_MESSAGE_CHARS) {
    return NextResponse.json({ error: "too_long", max: MAX_MESSAGE_CHARS }, { status: 413 });
  }

  const settings = await loadSettings(DB);
  if (run.turns >= settings.number("max_turns_per_run", 40)) {
    return NextResponse.json({ error: "run_full" }, { status: 409 });
  }
  // The first turn is what makes a run count toward the monthly cap.
  if (run.turns === 0) {
    const cap = settings.number("run_cap_monthly", 75);
    if ((await runsUsedThisMonth(DB, member.id)) >= cap) {
      return NextResponse.json({ error: "cap_reached", cap }, { status: 429 });
    }
  }

  const promptBody = await promptBodyForRun(DB, run.prompt_id);
  if (!promptBody) return NextResponse.json({ error: "unknown_prompt" }, { status: 404 });

  const [history, resume] = await Promise.all([
    runMessages(DB, run.id),
    currentResume(DB, member.id),
  ]);
  const system = buildSystem(
    run.prompt_name,
    promptBody,
    new Date(),
    resume ? { text: resume.text, savedOn: savedOnDate(resume.created_at) } : null,
  );
  const userMessageId = await addMessage(DB, run.id, "user", content);
  const messages = [
    ...history.map((m) => ({ role: m.role, content: m.content })),
    { role: "user" as const, content },
  ];

  const encoder = new TextEncoder();
  let opened = false;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (text: string) => {
        try {
          controller.enqueue(encoder.encode(text));
        } catch {
          // The browser went away; keep going so the reply is still saved.
        }
      };
      let streamed = "";
      try {
        const result = await streamTurn({
          model: run.model,
          system,
          messages,
          maxTokens: settings.number("max_output_tokens", 8000),
          webSearch: wantsWebSearch(promptBody),
          maxSearches: settings.number("max_searches_per_run", 5),
          onText: (t) => {
            opened = true;
            streamed += t;
            send(t);
          },
        });

        let reply = result.text;
        if (result.sources.length > 0) {
          const list = result.sources.map((s) => `- [${s.title}](${s.url})`).join("\n");
          const tail = `\n\n**Sources**\n${list}`;
          reply += tail;
          send(tail);
        }
        if (result.stopReason === "max_tokens") {
          const tail = "\n\n*This reply hit the length limit. Send \"continue\" to get the rest.*";
          reply += tail;
          send(tail);
        }

        await addMessage(DB, run.id, "assistant", reply);
        await recordTurn(DB, run.id, {
          ...result.usage,
          cost: turnCost(result.usage, {
            input: settings.number("price_input_per_mtok", 2),
            output: settings.number("price_output_per_mtok", 10),
            cacheWrite: settings.number("price_cache_write_per_mtok", 2.5),
            cacheRead: settings.number("price_cache_read_per_mtok", 0.2),
            search: settings.number("price_web_search_each", 0.01),
          }),
        });
      } catch (e) {
        const code = e instanceof ClaudeError ? e.code : "upstream_error";
        if (!opened) {
          // Nothing reached the member: undo their message so a retry is clean.
          await deleteMessage(DB, userMessageId).catch(() => undefined);
          send(`\u0000ERROR:${code}`);
        } else {
          // Part of a reply arrived: keep it, mark it, and let them continue.
          const tail = "\n\n*The reply was cut off. Send \"continue\" to pick up where it stopped.*";
          send(tail);
          await addMessage(DB, run.id, "assistant", streamed + tail).catch(() => undefined);
        }
      } finally {
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
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Accel-Buffering": "no",
    },
  });
}
