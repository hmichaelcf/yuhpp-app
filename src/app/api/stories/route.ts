import { NextResponse } from "next/server";
import { badInput, jsonBody, signedOut } from "@/lib/api";
import { bindings } from "@/lib/cloudflare";
import { currentMember } from "@/lib/session";
import { addStory, readStory } from "@/lib/workspace";

export const dynamic = "force-dynamic";

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
