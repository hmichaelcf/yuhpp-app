import { NextResponse } from "next/server";
import { badInput, jsonBody, signedOut } from "@/lib/api";
import { bindings } from "@/lib/cloudflare";
import { addCompany, readCompany } from "@/lib/search-brief";
import { currentMember } from "@/lib/session";

export const dynamic = "force-dynamic";

/**
 * POST /app/api/companies  { name, note?, where?, runId? }
 * Saves a company from Phase 03 research for Track B outreach. Saving the
 * same company twice keeps one.
 */
export async function POST(request: Request) {
  const member = await currentMember();
  if (!member) return signedOut();
  const body = await jsonBody(request);
  try {
    const company = readCompany(body);
    const { DB } = await bindings();
    const result = await addCompany(DB, member.id, company);
    return NextResponse.json({ ok: true, result });
  } catch (e) {
    return badInput(e);
  }
}
