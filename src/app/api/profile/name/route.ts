import { NextResponse } from "next/server";
import { badInput, jsonBody, signedOut } from "@/lib/api";
import { bindings } from "@/lib/cloudflare";
import { NAME_MAX, setName } from "@/lib/members";
import { currentMember } from "@/lib/session";
import { field } from "@/lib/workspace";

export const dynamic = "force-dynamic";

/**
 * POST /app/api/profile/name  { firstName, lastName }
 * Sets the member's first and last name. An empty field clears it.
 */
export async function POST(request: Request) {
  const member = await currentMember();
  if (!member) return signedOut();
  try {
    const body = await jsonBody(request);
    const firstName = field(body.firstName, NAME_MAX, "Your first name");
    const lastName = field(body.lastName, NAME_MAX, "Your last name");
    const { DB } = await bindings();
    await setName(DB, member.id, { firstName, lastName });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return badInput(e);
  }
}
