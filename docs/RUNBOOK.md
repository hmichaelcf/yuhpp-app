# Runbook

Plain-language steps for running the Yuhpp app. Open this repo in Claude Code
and ask it to help with any of these.

## Check that the app is healthy

Open yuhpp.com/app/status for a readable view, or yuhpp.com/app/api/health for
JSON. `"status": "ready"` means the app is deployed, configured, and its
database and session store are working. Anything else, and the status page
shows which check failed.

## Sync the prompt library after editing the sheet

1. Open the `yuhpp_prompts` Google Sheet and choose
   **File > Download > Comma Separated Values (.csv)**.
2. Sign in at yuhpp.com/app, click **Admin** at the top, and upload that file
   under Prompt library.
3. The result lists what was added, updated, and retired. Edited prompts get a
   new version; the old version is kept. If the file is wrong, nothing changes.

Renaming a prompt in the sheet counts as retiring the old name and adding a
new one, so its version history starts over.

## Prompt runs are failing

- **Every prompt fails with "rejected the app's key":** `ANTHROPIC_API_KEY` is
  wrong or was deleted in the Anthropic Console. Create a new key, replace it in
  Webflow Cloud, and click **Deploy latest commit**.
- **Only research prompts fail** (Interview Intel Brief, Company Fit Crafter,
  and others that use web search): web search may be switched off for your
  Anthropic organization. Check platform.claude.com/settings/capabilities.
- **"Busy right now":** the AI service is overloaded or rate limited. Wait and
  retry. If it keeps happening, check the Console's usage limits.
- **"The connection dropped before the reply finished":** the browser lost the
  connection mid-reply (a network blip, a laptop going to sleep). Refresh the
  run page; if the reply did not finish, send the message again.
- For anything else, open the app's **Runtime logs** in Webflow Cloud and look
  for lines starting "Claude API returned HTTP" or "Prompt run failed".

## A member's resume did not read correctly

- The Profile page shows the exact text Yuhpp read. If a PDF came out garbled
  or empty (common with scanned or image-only PDFs), have them upload the Word
  file or paste the text instead.
- "Does not look like a resume" means the PDF reader decided the file was
  something else. A Word file or pasted text skips that check.
- "Uploaded several PDFs today" is the daily limit (`resume_pdf_reads_daily`,
  10 by default). Pasting or a Word file still works.
- If every PDF fails with "could not be read right now", check the Runtime
  logs for lines starting "Claude API returned HTTP ... reading a PDF".
- Removing a resume on the Profile page deletes every saved version. Uploaded
  files are never stored, so there is nothing else to delete.

## Change the run cap, model, or prices

These live in the `settings` table (visible on the Admin page), along with the
resume limits and the model that reads PDFs (`extract_model`). Ask Claude Code
to change one; it adds a small migration that updates the row, and the change
applies on the next deploy.

## Give someone admin access

Add their email to `ADMIN_EMAILS` in Webflow Cloud (comma-separated, e.g.
`a@example.com,b@example.com`), then click **Deploy latest commit**.

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
