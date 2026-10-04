import "server-only";

// Server-side configuration.
//
// Secret values are read in this file and nowhere else. Only the server-side
// integration modules (memberstack-server.ts, and later the Claude client)
// receive them, through requireSecret(). Nothing returns a secret to the
// browser, logs it, or stores it.

import { BASE_PATH } from "./paths";
import { memberstackMode } from "./public-config";

export const SECRET_NAMES = ["ANTHROPIC_API_KEY", "MEMBERSTACK_SECRET_KEY"] as const;
export type SecretName = (typeof SECRET_NAMES)[number];

/** True when the secret is set and non-empty. Never exposes the value. */
export function hasSecret(name: SecretName): boolean {
  const value = process.env[name];
  return typeof value === "string" && value.trim().length > 0;
}

/** The secret's value, for integration modules only. Throws if missing. */
export function requireSecret(name: SecretName): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is not set`);
  }
  return value;
}

/**
 * Admin emails from the ADMIN_EMAILS variable (comma-separated). Not a
 * secret, but kept out of the code so no personal email lives in the repo.
 */
export function adminEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter((e) => e.includes("@"));
}

export type SetupCheck = {
  label: string;
  ok: boolean;
  detail: string;
};

/** Configuration checks, shown on /app/status and /app/api/health. */
export function setupChecks(): SetupCheck[] {
  const anthropic = hasSecret("ANTHROPIC_API_KEY");
  const memberstack = hasSecret("MEMBERSTACK_SECRET_KEY");
  // Locally the app runs at the root, so an empty base path is correct there.
  // Deployed, it must match the mount path or plain links and fetch() break.
  const local = process.env.NODE_ENV === "development";
  const mountOk = local ? true : BASE_PATH.startsWith("/") && BASE_PATH.length > 1;
  return [
    {
      label: "Mount path",
      ok: mountOk,
      detail: BASE_PATH
        ? BASE_PATH
        : local
          ? "/ (local development)"
          : "Missing: add NEXT_PUBLIC_BASE_PATH=/app",
    },
    {
      label: "Anthropic API key",
      ok: anthropic,
      detail: anthropic ? "Set" : "Missing: add ANTHROPIC_API_KEY as a secret",
    },
    {
      label: "Memberstack secret key",
      ok: memberstack,
      detail: memberstack ? "Set" : "Missing: add MEMBERSTACK_SECRET_KEY as a secret",
    },
    {
      label: "Memberstack mode",
      ok: true,
      detail: memberstackMode() === "sandbox" ? "Sandbox (test mode)" : "Live",
    },
    {
      label: "Admin access",
      ok: adminEmails().length > 0,
      detail:
        adminEmails().length > 0
          ? `${adminEmails().length} admin email${adminEmails().length === 1 ? "" : "s"} set`
          : "Missing: add ADMIN_EMAILS",
    },
  ];
}
