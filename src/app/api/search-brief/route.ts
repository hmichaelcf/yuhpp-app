import { NextResponse } from "next/server";
import { badInput, jsonBody, signedOut } from "@/lib/api";
import { BRIEF_LIMITS } from "@/lib/brief-shape";
import { bindings } from "@/lib/cloudflare";
import { loadDraft } from "@/lib/resume-record";
import { addBriefTitle, readBrief, saveBrief } from "@/lib/search-brief";
import { currentMember } from "@/lib/session";
import { loadSettings } from "@/lib/settings";
import { InputProblem, field } from "@/lib/workspace";

export const dynamic = "force-dynamic";

/**
 * PUT /app/api/search-brief
 * { titlesStrong, titlesStretch, level, location, industries, keywords, postedWithinDays }
 * Saves the whole brief from the Phase 03 form.
 */
export async function PUT(request: Request) {
  const member = await currentMember();
  if (!member) return signedOut();
  const body = await jsonBody(request);
  try {
    const brief = readBrief(body);
    const { DB } = await bindings();
    await saveBrief(DB, member.id, brief);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return badInput(e);
  }
}

/**
 * POST /app/api/search-brief  { title, kind: "strong" | "stretch" }
 * Adds one title, from a run's "Add to brief" button.
 */
export async function POST(request: Request) {
  const member = await currentMember();
  if (!member) return signedOut();
  const body = await jsonBody(request);
  try {
    const title = field(body.title, BRIEF_LIMITS.item, "The title");
    if (!title) throw new InputProblem("The title is empty.");
    const kind = body.kind === "stretch" ? "stretch" : "strong";
    const { DB } = await bindings();
    const [settings, draft] = await Promise.all([loadSettings(DB), loadDraft(DB, member.id, member.email)]);
    const result = await addBriefTitle(
      DB,
      member.id,
      settings,
      { location: draft.data.contact.location, tools: draft.data.tools },
      title,
      kind,
    );
    if (result === "full") {
      throw new InputProblem(`Your brief already has ${BRIEF_LIMITS.titles} ${kind} titles. Remove one first.`);
    }
    return NextResponse.json({ ok: true, result });
  } catch (e) {
    return badInput(e);
  }
}
