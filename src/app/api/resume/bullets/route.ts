import { NextResponse } from "next/server";
import { badInput, jsonBody, notFound, signedOut } from "@/lib/api";
import { bindings } from "@/lib/cloudflare";
import { addBulletToRole, replaceBulletText } from "@/lib/resume-record";
import { currentMember } from "@/lib/session";
import { InputProblem, LIMITS, addBullets, field, required } from "@/lib/workspace";

export const dynamic = "force-dynamic";

/**
 * POST /app/api/resume/bullets
 * { action: "replace", id, text }                 replaces a bullet's text
 * { action: "add", experienceId, text }           adds a bullet under a role
 * { action: "add", company, text }                adds a bullet under a new
 *                                                 role at that company
 * How a run's "Replace in resume" and "Add to resume" buttons save. Bullets
 * live in the bullet bank, so the change shows there too.
 */
export async function POST(request: Request) {
  const member = await currentMember();
  if (!member) return signedOut();
  const body = await jsonBody(request);
  try {
    const text = required(body.text, LIMITS.bulletText, "The bullet");
    const { DB } = await bindings();
    if (body.action === "replace") {
      if (typeof body.id !== "number") throw new InputProblem("Which bullet?");
      const ok = await replaceBulletText(DB, member.id, body.id, text);
      return ok ? NextResponse.json({ ok: true }) : notFound();
    }
    if (body.action === "add") {
      if (typeof body.experienceId === "number") {
        const ok = await addBulletToRole(DB, member.id, body.experienceId, text);
        return ok ? NextResponse.json({ ok: true }) : notFound();
      }
      const company = field(body.company, LIMITS.shortField, "The company");
      if (!company) throw new InputProblem("Pick a role for this bullet.");
      await addBullets(DB, member.id, [text], {
        role: null,
        company,
        start: null,
        end: null,
        current: false,
        tags: null,
      });
      return NextResponse.json({ ok: true });
    }
    throw new InputProblem("Unknown action.");
  } catch (e) {
    return badInput(e);
  }
}
