import { NextResponse } from "next/server";
import { badInput, jsonBody, signedOut } from "@/lib/api";
import { bindings } from "@/lib/cloudflare";
import { readProfilePatch, saveProfile } from "@/lib/resume-record";
import { currentMember } from "@/lib/session";
import { InputProblem } from "@/lib/workspace";

export const dynamic = "force-dynamic";

/**
 * PUT /app/api/resume
 * { name?, headline?, email?, phone?, location?, skills?, leadership?, tools?,
 *   interests?, references?, school?, degree?, schoolLocation? }
 * Saves the parts of the resume draft that are sent; the rest stay as they
 * are. Lists are arrays of strings (or one entry per line). This is also how
 * "Use in my resume" on a run's Skills or Leadership block saves.
 */
export async function PUT(request: Request) {
  const member = await currentMember();
  if (!member) return signedOut();
  const body = await jsonBody(request);
  try {
    const patch = readProfilePatch(body);
    if (Object.keys(patch).length === 0) throw new InputProblem("Nothing to save.");
    const { DB } = await bindings();
    await saveProfile(DB, member.id, patch);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return badInput(e);
  }
}
