import { NextResponse } from "next/server";
import { badInput, jsonBody, signedOut } from "@/lib/api";
import { bindings } from "@/lib/cloudflare";
import { currentMember } from "@/lib/session";
import { loadSettings } from "@/lib/settings";
import { bankSummary, storyBankMaxChars } from "@/lib/story-frame";
import { addStory, listStories, readStory } from "@/lib/workspace";

export const dynamic = "force-dynamic";

/**
 * GET /app/api/stories  the bank as a run page shows it: the stories a run
 * reads and the counts. An open run page asks again when the member comes
 * back to it, so a story added in another tab shows up without a reload.
 */
export async function GET() {
  const member = await currentMember();
  if (!member) return signedOut();
  const { DB } = await bindings();
  const [stories, settings] = await Promise.all([listStories(DB, member.id), loadSettings(DB)]);
  return NextResponse.json(
    { ok: true, bank: bankSummary(stories, storyBankMaxChars(settings)) },
    { headers: { "Cache-Control": "no-store" } },
  );
}

/** POST /app/api/stories  { title, company?, themes?, situation?, task?, action?, result? } */
export async function POST(request: Request) {
  const member = await currentMember();
  if (!member) return signedOut();
  try {
    const story = readStory(await jsonBody(request));
    const { DB } = await bindings();
    const id = await addStory(DB, member.id, story);
    return NextResponse.json({ ok: true, id });
  } catch (e) {
    return badInput(e);
  }
}
