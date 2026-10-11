import { NextResponse } from "next/server";
import { badInput, jsonBody, notFound, rowId, signedOut } from "@/lib/api";
import { bindings } from "@/lib/cloudflare";
import { currentMember } from "@/lib/session";
import { deleteStory, readStory, updateStory } from "@/lib/workspace";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** PATCH /app/api/stories/[id]  the whole story, as for POST */
export async function PATCH(request: Request, { params }: Ctx) {
  const member = await currentMember();
  if (!member) return signedOut();
  const id = rowId((await params).id);
  if (id === null) return notFound();
  try {
    const story = readStory(await jsonBody(request));
    const { DB } = await bindings();
    if (!(await updateStory(DB, member.id, id, story))) return notFound();
    return NextResponse.json({ ok: true });
  } catch (e) {
    return badInput(e);
  }
}

/** DELETE /app/api/stories/[id] */
export async function DELETE(_request: Request, { params }: Ctx) {
  const member = await currentMember();
  if (!member) return signedOut();
  const id = rowId((await params).id);
  if (id === null) return notFound();
  const { DB } = await bindings();
  if (!(await deleteStory(DB, member.id, id))) return notFound();
  return NextResponse.json({ ok: true });
}
