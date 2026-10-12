import { NextResponse } from "next/server";
import { jsonBody, signedOut } from "@/lib/api";
import { bindings } from "@/lib/cloudflare";
import { keepOwnFile, loadDraft, publishDraft } from "@/lib/resume-record";
import { publishBlockers } from "@/lib/resume-shape";
import { currentMember } from "@/lib/session";

export const dynamic = "force-dynamic";

/**
 * POST /app/api/resume/publish  { mode: "publish" | "own_file" }
 * "publish": the draft becomes the resume every run reads (a new saved
 * version, source "built"). Needs a name, and a company, title, and start
 * date on every role.
 * "own_file": the member's latest upload stays their resume; runs still get
 * the search brief built from the draft.
 */
export async function POST(request: Request) {
  const member = await currentMember();
  if (!member) return signedOut();
  const body = await jsonBody(request);
  const { DB } = await bindings();

  if (body.mode === "own_file") {
    const kept = await keepOwnFile(DB, member.id);
    if (!kept) {
      return NextResponse.json(
        { error: "no_upload", message: "There is no uploaded file to keep. Save one under Profile first." },
        { status: 400 },
      );
    }
    return NextResponse.json({ ok: true, mode: "own_file" });
  }

  if (body.mode !== "publish") {
    return NextResponse.json({ error: "bad_input", message: "Choose how to use your resume." }, { status: 400 });
  }
  const draft = await loadDraft(DB, member.id, member.email);
  const blockers = publishBlockers(draft.data);
  if (blockers.length) {
    return NextResponse.json(
      { error: "incomplete", message: `Fill these in first: ${blockers.join("; ")}.`, blockers },
      { status: 400 },
    );
  }
  const version = await publishDraft(DB, member.id, draft.data);
  return NextResponse.json({ ok: true, mode: "publish", version });
}
