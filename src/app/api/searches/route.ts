import { NextResponse } from "next/server";
import { badInput, jsonBody, signedOut } from "@/lib/api";
import { bindings } from "@/lib/cloudflare";
import { currentMember } from "@/lib/session";
import { LIMITS, addSearch, defaultSearchLabel, field, required } from "@/lib/workspace";

export const dynamic = "force-dynamic";

/**
 * POST /app/api/searches  { query, label?, runId? }
 * Saves a job search. runId is the run it came from, kept only if the run
 * belongs to this member.
 */
export async function POST(request: Request) {
  const member = await currentMember();
  if (!member) return signedOut();
  const body = await jsonBody(request);
  try {
    const query = required(body.query, LIMITS.searchQuery, "The search");
    const label = field(body.label, LIMITS.shortField, "The name") ?? defaultSearchLabel(query).slice(0, LIMITS.shortField);
    const runId = typeof body.runId === "string" && /^run_[0-9a-f]{24}$/.test(body.runId) ? body.runId : null;
    const { DB } = await bindings();
    const result = await addSearch(DB, member.id, { label, query, runId });
    return NextResponse.json({ ok: true, result });
  } catch (e) {
    return badInput(e);
  }
}
