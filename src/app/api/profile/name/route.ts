import { NextResponse } from "next/server";
import { badInput, jsonBody, signedOut } from "@/lib/api";
import { bindings } from "@/lib/cloudflare";
import { setFirstName } from "@/lib/members";
import { currentMember } from "@/lib/session";
import { field } from "@/lib/workspace";

export const dynamic = "force-dynamic";

/** POST /app/api/profile/name  { firstName }  sets the name the workspace greets them by; empty clears it. */
export async function POST(request: Request) {
  const member = await currentMember();
  if (!member) return signedOut();
  try {
    const firstName = field((await jsonBody(request)).firstName, 40, "Your first name");
    const { DB } = await bindings();
    await setFirstName(DB, member.id, firstName);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return badInput(e);
  }
}
