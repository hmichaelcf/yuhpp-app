import { NextResponse } from "next/server";
import { badInput, jsonBody, notFound, rowId, signedOut } from "@/lib/api";
import { bindings } from "@/lib/cloudflare";
import { currentMember } from "@/lib/session";
import { LIMITS, deleteSearch, renameSearch, required } from "@/lib/workspace";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** PATCH /app/api/searches/[id]  { label } renames a saved search. */
export async function PATCH(request: Request, { params }: Ctx) {
  const member = await currentMember();
  if (!member) return signedOut();
  const id = rowId((await params).id);
  if (id === null) return notFound();
  try {
    const label = required((await jsonBody(request)).label, LIMITS.shortField, "The name");
    const { DB } = await bindings();
    if (!(await renameSearch(DB, member.id, id, label))) return notFound();
    return NextResponse.json({ ok: true });
  } catch (e) {
    return badInput(e);
  }
}

/** DELETE /app/api/searches/[id] */
export async function DELETE(_request: Request, { params }: Ctx) {
  const member = await currentMember();
  if (!member) return signedOut();
  const id = rowId((await params).id);
  if (id === null) return notFound();
  const { DB } = await bindings();
  if (!(await deleteSearch(DB, member.id, id))) return notFound();
  return NextResponse.json({ ok: true });
}
