// Server-side configuration.
//
// Secret values are read in this file and nowhere else, and they are never
// returned to the browser. Other code asks whether a secret is set, never
// what it is.

import { BASE_PATH } from "./paths";

// The Memberstack public key is safe to commit: it ships in page source.
// This is the sandbox (test mode) key. At launch, set
// NEXT_PUBLIC_MEMBERSTACK_PUBLIC_KEY to the live key in Webflow Cloud.
const SANDBOX_MEMBERSTACK_PUBLIC_KEY = "pk_sb_65b31d81606f719c1a57";

export const SECRET_NAMES = ["ANTHROPIC_API_KEY", "MEMBERSTACK_SECRET_KEY"] as const;
export type SecretName = (typeof SECRET_NAMES)[number];

/** True when the secret is set and non-empty. Never exposes the value. */
export function hasSecret(name: SecretName): boolean {
  const value = process.env[name];
  return typeof value === "string" && value.trim().length > 0;
}

export function memberstackPublicKey(): string {
  return process.env.NEXT_PUBLIC_MEMBERSTACK_PUBLIC_KEY || SANDBOX_MEMBERSTACK_PUBLIC_KEY;
}

export function memberstackMode(): "sandbox" | "live" {
  return memberstackPublicKey().startsWith("pk_sb_") ? "sandbox" : "live";
}

export type SetupCheck = {
  label: string;
  ok: boolean;
  detail: string;
};

/** The Phase 0 deployment checks, shown on the status page and /api/health. */
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
  ];
}
