import { NextResponse } from "next/server";
import { badInput, jsonBody, signedOut } from "@/lib/api";
import { bindings } from "@/lib/cloudflare";
import { currentMember } from "@/lib/session";
import {
  InputProblem,
  LIMITS,
  addBullets,
  cleanTags,
  field,
  required,
  splitBulletLines,
} from "@/lib/workspace";

export const dynamic = "force-dynamic";

/**
 * POST /app/api/bullets  { text, role?, company?, tags? }
 * Adds one bullet per line of text, all under the same role and company.
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
    const meta = {
      role: field(body.role, LIMITS.shortField, "The role"),
      company: field(body.company, LIMITS.shortField, "The company"),
      tags: cleanTags(body.tags, "The tags"),
    };
    const { DB } = await bindings();
    const added = await addBullets(DB, member.id, lines, meta);
    return NextResponse.json({ ok: true, added });
  } catch (e) {
    return badInput(e);
  }
}
