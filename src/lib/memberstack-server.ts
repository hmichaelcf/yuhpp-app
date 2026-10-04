import "server-only";
import { requireSecret } from "./config";

// Talks to Memberstack's admin REST API from the server.
// Docs: https://developers.memberstack.com/admin-rest-api/verification
const ADMIN_API = "https://admin.memberstack.com";

export class MemberstackUnavailable extends Error {}

function headers(): HeadersInit {
  return {
    "X-API-KEY": requireSecret("MEMBERSTACK_SECRET_KEY"),
    "Content-Type": "application/json",
  };
}

/**
 * Verifies a member token from the browser.
 * Returns the member id (mem_...) when valid, null when the token is invalid.
 * Throws MemberstackUnavailable when Memberstack cannot be reached.
 */
export async function verifyMemberToken(token: string): Promise<string | null> {
  let res: Response;
  try {
    res = await fetch(`${ADMIN_API}/members/verify-token`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({ token }),
    });
  } catch {
    throw new MemberstackUnavailable("Memberstack could not be reached");
  }
  // Memberstack answers 400 for a bad or expired token. 401 or 403 means it
  // rejected our secret key, which is a setup problem, not the member's.
  if (res.status === 401 || res.status === 403 || res.status >= 500) {
    console.error(`Memberstack verify-token returned HTTP ${res.status}`);
    throw new MemberstackUnavailable(`Memberstack returned ${res.status}`);
  }
  if (!res.ok) {
    return null;
  }
  const body = (await res.json().catch(() => null)) as { data?: { id?: unknown } } | null;
  const id = body?.data?.id;
  return typeof id === "string" && id.startsWith("mem_") ? id : null;
}

/** The member's email, read from Memberstack rather than trusted from the browser. */
export async function fetchMemberEmail(memberId: string): Promise<string | null> {
  try {
    const res = await fetch(`${ADMIN_API}/members/${encodeURIComponent(memberId)}`, {
      headers: headers(),
    });
    if (!res.ok) return null;
    const body = (await res.json().catch(() => null)) as {
      data?: { auth?: { email?: unknown }; email?: unknown };
    } | null;
    const email = body?.data?.auth?.email ?? body?.data?.email;
    return typeof email === "string" ? email : null;
  } catch {
    return null;
  }
}
