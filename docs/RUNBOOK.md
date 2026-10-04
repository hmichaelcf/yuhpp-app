# Runbook

Plain-language steps for running the Yuhpp app. Open this repo in Claude Code
and ask it to help with any of these.

## Check that the app is healthy

Open yuhpp.com/app/api/health. `"status": "ready"` means the app is deployed,
the mount path is set, and both secrets are set. `"waiting_for_secrets"` means
something is missing; the status page at yuhpp.com/app shows which.

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
