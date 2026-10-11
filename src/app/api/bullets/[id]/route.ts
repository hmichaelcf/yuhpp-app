import { NextResponse } from "next/server";
import { badInput, jsonBody, notFound, rowId, signedOut } from "@/lib/api";
import { bindings } from "@/lib/cloudflare";
import { currentMember } from "@/lib/session";
import { InputProblem, LIMITS, cleanTags, deleteBullet, required, updateBullet } from "@/lib/workspace";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** PATCH /app/api/bullets/[id]  { text, tags?, experienceId } (experienceId moves it to another role) */
export async function PATCH(request: Request, { params }: Ctx) {
  const member = await currentMember();
  if (!member) return signedOut();
  const id = rowId((await params).id);
  if (id === null) return notFound();
  const body = await jsonBody(request);
  try {
    const bullet = {
      text: required(body.text, LIMITS.bulletText, "The bullet").replace(/\s*\n\s*/g, " "),
      tags: cleanTags(body.tags, "The tags"),
      experienceId: Number(body.experienceId),
    };
    if (!Number.isInteger(bullet.experienceId) || bullet.experienceId < 1) {
      throw new InputProblem("Pick the role this bullet belongs to.");
    }
    const { DB } = await bindings();
    if (!(await updateBullet(DB, member.id, id, bullet))) return notFound();
    return NextResponse.json({ ok: true });
  } catch (e) {
    return badInput(e);
  }
}

/** DELETE /app/api/bullets/[id] */
export async function DELETE(_request: Request, { params }: Ctx) {
  const member = await currentMember();
  if (!member) return signedOut();
  const id = rowId((await params).id);
  if (id === null) return notFound();
  const { DB } = await bindings();
  if (!(await deleteBullet(DB, member.id, id))) return notFound();
  return NextResponse.json({ ok: true });
}
