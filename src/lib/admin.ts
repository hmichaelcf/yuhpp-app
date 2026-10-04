import "server-only";
import { notFound, redirect } from "next/navigation";
import { adminEmails } from "./config";
import type { Member } from "./members";
import { currentMember } from "./session";

/** True when the member is an admin, by flag or by the ADMIN_EMAILS variable. */
export function isAdmin(member: Member | null): boolean {
  if (!member) return false;
  if (member.is_admin === 1) return true;
  const email = member.email?.toLowerCase();
  return !!email && adminEmails().includes(email);
}

/**
 * For admin pages: sends signed-out visitors to sign in, and shows everyone
 * else a 404 so the admin area does not advertise itself.
 */
export async function requireAdminPage(): Promise<Member> {
  const member = await currentMember();
  if (!member) redirect("/login");
  if (!isAdmin(member)) notFound();
  return member;
}

/** For admin API routes: the admin member, or null (respond 404). */
export async function adminFromRequest(): Promise<Member | null> {
  const member = await currentMember();
  return isAdmin(member) ? member : null;
}
