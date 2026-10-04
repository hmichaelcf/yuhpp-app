// Values that are safe in the browser. Nothing secret belongs in this file.

// The Memberstack public key ships in page source by design.
// This is the sandbox (test mode) key. At launch, set
// NEXT_PUBLIC_MEMBERSTACK_PUBLIC_KEY to the live key in Webflow Cloud.
const SANDBOX_MEMBERSTACK_PUBLIC_KEY = "pk_sb_65b31d81606f719c1a57";

export function memberstackPublicKey(): string {
  return process.env.NEXT_PUBLIC_MEMBERSTACK_PUBLIC_KEY || SANDBOX_MEMBERSTACK_PUBLIC_KEY;
}

export function memberstackMode(): "sandbox" | "live" {
  return memberstackPublicKey().startsWith("pk_sb_") ? "sandbox" : "live";
}
