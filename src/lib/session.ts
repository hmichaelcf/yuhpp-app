import "server-only";
import { cookies } from "next/headers";
import { bindings } from "./cloudflare";
import { getMember, type Member } from "./members";
import { BASE_PATH } from "./paths";

// Our own session, created after Memberstack verifies a member's token.
// The browser holds only a random session id in an HttpOnly cookie; the
// member id it maps to lives in the SESSIONS store and expires on its own.

export const SESSION_COOKIE = "yuhpp_session";
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

type SessionRecord = { memberId: string; createdAt: string };

function key(sessionId: string): string {
  return `session:${sessionId}`;
}

export function cookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: BASE_PATH || "/",
    maxAge,
  };
}

function newSessionId(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Stores a new session for a verified member and returns its id. */
export async function createSession(memberId: string): Promise<string> {
  const { SESSIONS } = await bindings();
  const sessionId = newSessionId();
  const record: SessionRecord = { memberId, createdAt: new Date().toISOString() };
  await SESSIONS.put(key(sessionId), JSON.stringify(record), {
    expirationTtl: SESSION_TTL_SECONDS,
  });
  return sessionId;
}

export async function destroySession(sessionId: string): Promise<void> {
  const { SESSIONS } = await bindings();
  await SESSIONS.delete(key(sessionId));
}

/** The signed-in member for this request, or null. */
export async function currentMember(): Promise<Member | null> {
  const store = await cookies();
  const sessionId = store.get(SESSION_COOKIE)?.value;
  if (!sessionId || !/^[0-9a-f]{64}$/.test(sessionId)) return null;
  const { SESSIONS, DB } = await bindings();
  const raw = await SESSIONS.get(key(sessionId));
  if (!raw) return null;
  let record: SessionRecord;
  try {
    record = JSON.parse(raw) as SessionRecord;
  } catch {
    return null;
  }
  return getMember(DB, record.memberId);
}
