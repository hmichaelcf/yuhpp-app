import { NextResponse } from "next/server";
import { bindings } from "@/lib/cloudflare";
import { createRun, currentPrompt, runsUsedThisMonth } from "@/lib/runs";
import { currentMember } from "@/lib/session";
import { loadSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

/** POST /app/api/runs  { promptKey }  starts a run of a registered prompt. */
export async function POST(request: Request) {
  const member = await currentMember();
  if (!member) return NextResponse.json({ error: "signed_out" }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as { promptKey?: unknown };
  if (typeof body.promptKey !== "string") {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const { DB } = await bindings();
  const prompt = await currentPrompt(DB, body.promptKey);
  if (!prompt) return NextResponse.json({ error: "unknown_prompt" }, { status: 404 });

  const settings = await loadSettings(DB);
  const cap = settings.number("run_cap_monthly", 75);
  if ((await runsUsedThisMonth(DB, member.id)) >= cap) {
    return NextResponse.json({ error: "cap_reached", cap }, { status: 429 });
  }

  const runId = await createRun(DB, member.id, prompt.id, settings.text("run_model", "claude-sonnet-5-5"));
  return NextResponse.json({ runId });
}
