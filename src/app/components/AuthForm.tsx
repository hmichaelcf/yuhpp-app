"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { loadMemberstack } from "@/lib/memberstack-client";
import { appPath } from "@/lib/paths";

type Mode = "signin" | "signup";

const SESSION_ERRORS: Record<string, string> = {
  invalid_token: "Your sign-in could not be confirmed. Please try again.",
  missing_token: "Your sign-in could not be confirmed. Please try again.",
  auth_unavailable: "Sign-in is temporarily unavailable. Please try again in a minute.",
  not_configured: "Sign-in is not set up yet on this server.",
};

/** Swaps a Memberstack sign-in for a Yuhpp session. Returns an error message or null. */
async function startSession(token: string, consent: { terms: boolean; research: boolean }) {
  const res = await fetch(appPath("/api/session"), {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ consentTerms: consent.terms, consentResearch: consent.research }),
  }).catch(() => null);
  if (!res) return "We could not reach Yuhpp. Check your connection and try again.";
  if (res.ok) return null;
  const body = (await res.json().catch(() => ({}))) as { error?: string };
  return SESSION_ERRORS[body.error ?? ""] ?? "Something went wrong signing you in. Please try again.";
}

export default function AuthForm() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [terms, setTerms] = useState(false);
  const [research, setResearch] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // If Memberstack still remembers this browser, skip the form.
  useEffect(() => {
    let cancelled = false;
    loadMemberstack()
      .then(async ({ ms }) => {
        const token = ms.getMemberCookie();
        if (!token || cancelled) return;
        const failure = await startSession(token, { terms: false, research: false });
        if (!failure && !cancelled) {
          router.replace("/");
          router.refresh();
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [router]);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (mode === "signup" && !terms) {
      setError("Please accept the terms to create your account.");
      return;
    }
    setBusy(true);
    try {
      const { ms, formatError } = await loadMemberstack();
      try {
        if (mode === "signup") {
          await ms.signupMemberEmailPassword({ email, password });
        } else {
          await ms.loginMemberEmailPassword({ email, password });
        }
      } catch (err) {
        setError(formatError(err));
        return;
      }
      const token = ms.getMemberCookie();
      if (!token) {
        setError("Your sign-in could not be confirmed. Please try again.");
        return;
      }
      const failure = await startSession(token, { terms, research });
      if (failure) {
        setError(failure);
        return;
      }
      router.replace("/");
      router.refresh();
    } catch {
      setError("Sign-in could not load. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  async function forgotPassword() {
    try {
      const { ms } = await loadMemberstack();
      await ms.openModal("FORGOT_PASSWORD");
    } catch {
      setError("Password reset could not open. Please try again.");
    }
  }

  const signup = mode === "signup";

  return (
    <div className="auth">
      <div className="auth-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={!signup}
          className={!signup ? "auth-tab on" : "auth-tab"}
          onClick={() => {
            setMode("signin");
            setError(null);
          }}
        >
          Sign in
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={signup}
          className={signup ? "auth-tab on" : "auth-tab"}
          onClick={() => {
            setMode("signup");
            setError(null);
          }}
        >
          Create account
        </button>
      </div>

      <form className="auth-form" onSubmit={submit} noValidate>
        <label className="field">
          <span>Email</span>
          <input
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <label className="field">
          <span>Password</span>
          <input
            type="password"
            autoComplete={signup ? "new-password" : "current-password"}
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>

        {signup ? (
          <div className="consents">
            <label className="check-row">
              <input type="checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)} />
              <span>
                I agree to the{" "}
                <a href="/terms" target="_blank" rel="noreferrer">
                  Terms
                </a>{" "}
                and{" "}
                <a href="/privacy" target="_blank" rel="noreferrer">
                  Privacy Policy
                </a>
                .
              </span>
            </label>
            <label className="check-row">
              <input
                type="checkbox"
                checked={research}
                onChange={(e) => setResearch(e.target.checked)}
              />
              <span>
                Optional: Yuhpp may use my anonymized, aggregated results (like how many
                applications led to interviews) for research and reporting.
              </span>
            </label>
          </div>
        ) : null}

        {error ? (
          <p className="form-error" role="alert">
            {error}
          </p>
        ) : null}

        <button type="submit" className="primary-button" disabled={busy}>
          {busy ? "One moment" : signup ? "Create account" : "Sign in"}
        </button>

        {!signup ? (
          <button type="button" className="text-button" onClick={forgotPassword}>
            Forgot your password?
          </button>
        ) : null}
      </form>
    </div>
  );
}
