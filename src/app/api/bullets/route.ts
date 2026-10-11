import { NextResponse } from "next/server";
import { badInput, jsonBody, signedOut } from "@/lib/api";
import { bindings } from "@/lib/cloudflare";
import { currentMember } from "@/lib/session";
import {
  InputProblem,
  LIMITS,
  addBullets,
  cleanTags,
  experienceFields,
  required,
  splitBulletLines,
} from "@/lib/workspace";

export const dynamic = "force-dynamic";

/**
 * POST /app/api/bullets  { text, role?, company?, tags?, start?, end?, current? }
 * Adds one bullet per line of text, all under the same role and company.
 * start and end are MM/YYYY; current: true means the member still works there.
 */
export async function POST(request: Request) {
  const member = await currentMember();
  if (!member) return signedOut();
  const body = await jsonBody(request);
  try {
    const text = required(body.text, LIMITS.bulletText * LIMITS.bulletsPerSave, "The bullet");
    const lines = splitBulletLines(text);
    if (lines.length === 0) throw new InputProblem("The bullet is empty.");
    if (lines.length > LIMITS.bulletsPerSave) {
      throw new InputProblem(`Add up to ${LIMITS.bulletsPerSave} bullets at a time.`);
    }
    const long = lines.find((l) => l.length > LIMITS.bulletText);
    if (long) throw new InputProblem(`One line is over ${LIMITS.bulletText} characters. Is it two bullets?`);
    const meta = { ...experienceFields(body), tags: cleanTags(body.tags, "The tags") };
    const { DB } = await bindings();
    const added = await addBullets(DB, member.id, lines, meta);
    return NextResponse.json({ ok: true, added });
  } catch (e) {
    return badInput(e);
  }
}
