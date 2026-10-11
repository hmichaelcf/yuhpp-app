import { NextResponse } from "next/server";
import { badInput, jsonBody, notFound, rowId, signedOut } from "@/lib/api";
import { bindings } from "@/lib/cloudflare";
import { currentMember } from "@/lib/session";
import { experienceFields, updateExperience } from "@/lib/workspace";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/**
 * PATCH /app/api/experiences/[id]  { role?, company?, start?, end?, current? }
 * Fixes a role's title, company, or dates in the bullet bank. Every bullet
 * under the role follows. Matching another role's title and company merges
 * the two.
 */
export async function PATCH(request: Request, { params }: Ctx) {
  const member = await currentMember();
  if (!member) return signedOut();
  const id = rowId((await params).id);
  if (id === null) return notFound();
  const body = await jsonBody(request);
  try {
    const { DB } = await bindings();
    const result = await updateExperience(DB, member.id, id, experienceFields(body));
    if (!result.found) return notFound();
    return NextResponse.json({ ok: true, merged: result.merged });
  } catch (e) {
    return badInput(e);
  }
}
