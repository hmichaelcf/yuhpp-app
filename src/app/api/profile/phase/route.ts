import { NextResponse } from "next/server";
import { jsonBody, signedOut } from "@/lib/api";
import { bindings } from "@/lib/cloudflare";
import { setPhase, snoozeNudge } from "@/lib/members";
import { isPhase } from "@/lib/phases";
import { currentMember } from "@/lib/session";

export const dynamic = "force-dynamic";

/**
 * POST /app/api/profile/phase
 * { phase }          sets where the member is on the route.
 * { snooze: true }   "Not yet": hides the move-on suggestion until the phase changes.
 */
export async function POST(request: Request) {
  const member = await currentMember();
  if (!member) return signedOut();
  const body = await jsonBody(request);
  const { DB } = await bindings();
  if (body.snooze === true) {
    await snoozeNudge(DB, member.id);
    return NextResponse.json({ ok: true });
  }
  if (!isPhase(body.phase)) {
    return NextResponse.json({ error: "bad_input", message: "Pick a phase." }, { status: 400 });
  }
  await setPhase(DB, member.id, body.phase);
  return NextResponse.json({ ok: true });
}
