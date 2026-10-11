import { NextResponse } from "next/server";
import { badInput, jsonBody, signedOut } from "@/lib/api";
import { bindings } from "@/lib/cloudflare";
import { currentMember } from "@/lib/session";
import { addWeeks, currentWeek, deleteLog, isWeekStart, saveLog } from "@/lib/weekly";
import { COUNT_FIELDS, MAX_COUNT, emptyCounts } from "@/lib/weekly-fields";
import { InputProblem, field } from "@/lib/workspace";

export const dynamic = "force-dynamic";

/** Members can log this week and earlier weeks, never a future week. */
function checkWeek(value: unknown): string {
  if (!isWeekStart(value)) throw new InputProblem("Pick a week to log.");
  if (value > currentWeek()) throw new InputProblem("That week has not started yet.");
  if (value < addWeeks(currentWeek(), -104)) throw new InputProblem("That week is too far back.");
  return value;
}

/** PUT /app/api/weekly  { weekStart, counts: { applications, ... }, note? }  saves one week. */
export async function PUT(request: Request) {
  const member = await currentMember();
  if (!member) return signedOut();
  const body = await jsonBody(request);
  try {
    const weekStart = checkWeek(body.weekStart);
    const raw = (body.counts && typeof body.counts === "object" ? body.counts : {}) as Record<string, unknown>;
    const counts = emptyCounts();
    for (const f of COUNT_FIELDS) {
      const n = raw[f.key] === "" || raw[f.key] == null ? 0 : Number(raw[f.key]);
      if (!Number.isInteger(n) || n < 0 || n > MAX_COUNT) {
        throw new InputProblem(`${f.label} needs a whole number from 0 to ${MAX_COUNT}.`);
      }
      counts[f.key] = n;
    }
    const note = field(body.note, 280, "The focus note");
    const { DB } = await bindings();
    await saveLog(DB, member.id, weekStart, counts, note);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return badInput(e);
  }
}

/** DELETE /app/api/weekly?week=YYYY-MM-DD  removes one week's log. */
export async function DELETE(request: Request) {
  const member = await currentMember();
  if (!member) return signedOut();
  const week = new URL(request.url).searchParams.get("week");
  if (!isWeekStart(week)) return NextResponse.json({ error: "bad_input", message: "Pick a week." }, { status: 400 });
  const { DB } = await bindings();
  await deleteLog(DB, member.id, week);
  return NextResponse.json({ ok: true });
}
