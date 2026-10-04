import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { bindings } from "@/lib/cloudflare";
import { hasSecret } from "@/lib/config";
import { fetchMemberEmail, MemberstackUnavailable, verifyMemberToken } from "@/lib/memberstack-server";
import { upsertMember } from "@/lib/members";
import {
  SESSION_COOKIE,
  SESSION_TTL_SECONDS,
  cookieOptions,
  createSession,
  destroySession,
} from "@/lib/session";

export const dynamic = "force-dynamic";

/**
 * POST /app/api/session
 * Exchanges a Memberstack token (Authorization: Bearer ...) for a Yuhpp
 * session cookie. Body: { consentTerms?: boolean, consentResearch?: boolean }
 */
export async function POST(request: Request) {
  if (!hasSecret("MEMBERSTACK_SECRET_KEY")) {
    return NextResponse.json({ error: "not_configured" }, { status: 503 });
  }

  const auth = request.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!token) {
    return NextResponse.json({ error: "missing_token" }, { status: 401 });
  }

  let memberId: string | null;
  try {
    memberId = await verifyMemberToken(token);
  } catch (e) {
    if (e instanceof MemberstackUnavailable) {
      return NextResponse.json({ error: "auth_unavailable" }, { status: 502 });
    }
    throw e;
  }
  if (!memberId) {
    return NextResponse.json({ error: "invalid_token" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    consentTerms?: unknown;
    consentResearch?: unknown;
  };
  const { DB } = await bindings();
  await upsertMember(DB, {
    id: memberId,
    email: await fetchMemberEmail(memberId),
    consentTerms: body.consentTerms === true,
    consentResearch: body.consentResearch === true,
  });

  const sessionId = await createSession(memberId);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, sessionId, cookieOptions(SESSION_TTL_SECONDS));
  return res;
}

/** DELETE /app/api/session: signs out of Yuhpp. */
export async function DELETE() {
  const store = await cookies();
  const sessionId = store.get(SESSION_COOKIE)?.value;
  if (sessionId) {
    await destroySession(sessionId).catch(() => undefined);
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, "", cookieOptions(0));
  return res;
}
