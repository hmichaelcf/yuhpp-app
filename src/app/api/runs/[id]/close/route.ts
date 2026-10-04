import { NextResponse } from "next/server";
import { bindings } from "@/lib/cloudflare";
import { closeRun } from "@/lib/runs";
import { currentMember } from "@/lib/session";

export const dynamic = "force-dynamic";

/** POST /app/api/runs/:id/close  marks a run finished. */
export async function POST(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const member = await currentMember();
  if (!member) return NextResponse.json({ error: "signed_out" }, { status: 401 });
  const { DB } = await bindings();
  const closed = await closeRun(DB, id, member.id);
  return closed
    ? NextResponse.json({ ok: true })
    : NextResponse.json({ error: "not_found" }, { status: 404 });
}
