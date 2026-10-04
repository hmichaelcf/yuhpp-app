# Runbook

Plain-language steps for running the Yuhpp app. Open this repo in Claude Code
and ask it to help with any of these.

## Check that the app is healthy

Open yuhpp.com/app/status for a readable view, or yuhpp.com/app/api/health for
JSON. `"status": "ready"` means the app is deployed, configured, and its
database and session store are working. Anything else, and the status page
shows which check failed.

## Sign-in is not working

1. Open yuhpp.com/app/status. Every row should be teal.
2. If the sign-in form says "temporarily unavailable", Memberstack either
   could not be reached or rejected the secret key. In Webflow Cloud, open the
   app's **Runtime logs** and look for "Memberstack verify-token returned HTTP".
   401 or 403 means `MEMBERSTACK_SECRET_KEY` is wrong: copy it again from
   Memberstack's Dev Tools page (test mode key while in sandbox).
3. The public key and the secret key must come from the same mode: both test
   (`pk_sb_` and `sk_sb_`) or both live.

## Deploy a change

Every push to `main` deploys automatically. Watch it in Webflow Cloud under the
app's production environment. When it finishes, run the health check above.

## Add or change an environment variable

1. In Webflow Cloud, open the app's production environment, then Environment
   Variables.
2. Add or edit the variable. Toggle **Secret** on for anything that is a key.
3. Variables apply on the next deploy. On the Deployments tab, click
   **Deploy latest commit** to redeploy without a code change.

## Rotate a key (if one may have leaked)

1. Create a new key in the provider (Anthropic Console or Memberstack).
2. Replace the value in Webflow Cloud's Environment Variables, then click
   **Deploy latest commit**.
3. Run the health check, then delete the old key at the provider.

## Roll back a bad deploy

Ask Claude Code to revert the commit that caused the problem and push to `main`.
Webflow Cloud deploys the reverted code like any other change.

## Never

- Paste a secret key into a chat, an issue, a commit, or a document.
- Set `basePath` or `assetPrefix` in `next.config.ts`.
