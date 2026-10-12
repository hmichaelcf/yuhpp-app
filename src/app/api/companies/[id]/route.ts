import { NextResponse } from "next/server";
import { notFound, rowId, signedOut } from "@/lib/api";
import { bindings } from "@/lib/cloudflare";
import { deleteCompany } from "@/lib/search-brief";
import { currentMember } from "@/lib/session";

export const dynamic = "force-dynamic";

/** DELETE /app/api/companies/[id]  removes one saved company. */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const member = await currentMember();
  if (!member) return signedOut();
  const id = rowId((await params).id);
  if (id === null) return notFound();
  const { DB } = await bindings();
  const ok = await deleteCompany(DB, member.id, id);
  return ok ? NextResponse.json({ ok: true }) : notFound();
}
