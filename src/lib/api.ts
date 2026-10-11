import "server-only";
import { NextResponse } from "next/server";
import { InputProblem } from "./workspace";

// Small helpers shared by the workspace API routes.

/** Reads a JSON body; anything unreadable becomes an empty object. */
export async function jsonBody(request: Request): Promise<Record<string, unknown>> {
  const body = await request.json().catch(() => null);
  return body && typeof body === "object" && !Array.isArray(body) ? (body as Record<string, unknown>) : {};
}

/** A positive whole-number id from the URL, or null. */
export function rowId(raw: string): number | null {
  return /^\d{1,12}$/.test(raw) ? Number(raw) : null;
}

export function signedOut() {
  return NextResponse.json({ error: "signed_out", message: "Your session ended. Sign in again." }, { status: 401 });
}

export function notFound() {
  return NextResponse.json({ error: "not_found", message: "That item is no longer there." }, { status: 404 });
}

/** Turns an input problem into a 400 with a message for the member; rethrows anything else. */
export function badInput(e: unknown) {
  if (e instanceof InputProblem) {
    return NextResponse.json({ error: "bad_input", message: e.message }, { status: 400 });
  }
  throw e;
}
