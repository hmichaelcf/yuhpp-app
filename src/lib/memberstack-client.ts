"use client";

import { memberstackPublicKey } from "./public-config";

// Memberstack in the browser. Loaded on demand so it never runs on the server.

type MemberstackModule = typeof import("@memberstack/dom");
type MemberstackInstance = ReturnType<MemberstackModule["default"]["init"]>;

let loaded: Promise<{ ms: MemberstackInstance; formatError: (e: unknown) => string }> | null = null;

export function loadMemberstack() {
  if (!loaded) {
    loaded = import("@memberstack/dom").then((mod) => ({
      ms: mod.default.init({ publicKey: memberstackPublicKey() }),
      formatError: mod.formatErrorForUser,
    }));
  }
  return loaded;
}
