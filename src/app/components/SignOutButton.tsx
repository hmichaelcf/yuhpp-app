"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { loadMemberstack } from "@/lib/memberstack-client";
import { appPath } from "@/lib/paths";

export default function SignOutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function signOut() {
    setBusy(true);
    await fetch(appPath("/api/session"), { method: "DELETE" }).catch(() => undefined);
    try {
      const { ms } = await loadMemberstack();
      await ms.logout();
    } catch {
      // Our session is already gone; a Memberstack hiccup should not block sign-out.
    }
    router.replace("/login");
    router.refresh();
  }

  return (
    <button type="button" className="text-button" onClick={signOut} disabled={busy}>
      {busy ? "Signing out" : "Sign out"}
    </button>
  );
}
