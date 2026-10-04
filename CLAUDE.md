# Yuhpp app

The logged-in web app for Yuhpp, The Job Search System. Job seekers run all 37
prompts of the methodology in one workspace, and the app tracks each job they
pursue through the gates defined in methodology map v1.4.

**Who maintains this:** Michael Fountain, who does not write code. He works on
this repo through Claude Code. Explain every change in plain words: what
changed, why, and what he should click to check it.

Build spec (decisions, data model, prompt engine, gates, phases):
https://claude.ai/code/artifact/ec5dc14b-50cc-4241-945a-872c330beb3e

## Where things stand

- **Phase 0 (done):** deployed at yuhpp.com/app with all checks passing.
- **Phase 1 (current), in three pieces:**
  1. Storage and login (done in code): SQLite and the session store, sign-up
     and sign-in at /app/login, signed-in home at /app, status at /app/status.
  2. Admin page and prompt sync by CSV upload (next).
  3. Chat engine, run caps, and cost tracking. Phase 1 exit: any prompt runs
     end to end with its cost logged.
- Later phases: onboarding, application loop, interview loop, weekly review and
  practice, beta launch. See the build spec.

## Decisions made after the build spec

- **Login lives inside the app** at /app/login, not on the Webflow site. The
  Memberstack script stays off public pages, so its test mode badge never shows
  to visitors. The Webflow homepage links to /app/login.
- **Prompt sync is a CSV upload** on an admin-only page: File > Download > CSV
  from the `yuhpp_prompts` sheet. No Google credentials; prompt text never
  becomes public.

## Architecture

- **Webflow site (yuhpp.com):** homepage, /guide, legal pages (/terms,
  /privacy). Built in Webflow, not in this repo.
- **This repo:** one Next.js 16 app (App Router, React 19) deployed on Webflow
  Cloud, which runs it on Cloudflare Workers through OpenNext. It is mounted at
  `/app` on yuhpp.com and deploys automatically on every push to `main`.
- **Login and sessions:** the browser signs in with Memberstack
  (`src/lib/memberstack-client.ts`), then posts the Memberstack token to
  `/app/api/session`. The server verifies it with Memberstack's admin API
  (`src/lib/memberstack-server.ts`), upserts the member row, and sets our own
  HttpOnly `yuhpp_session` cookie. The cookie holds only a random id; the
  member id lives in the SESSIONS key-value store for 7 days
  (`src/lib/session.ts`). Server code gets the member with `currentMember()`.
- **Claude API:** called only from server code. Sonnet 5.5 runs prompts;
  Haiku 4.5 extracts structured results.
- **Storage:** Webflow Cloud SQLite (binding `DB`) for workspace data, and
  key-value (binding `SESSIONS`) for sessions. Declared in `wrangler.json`;
  access them through `bindings()` in `src/lib/cloudflare.ts`. Object storage
  for resume files arrives in Phase 2.
- **Prompts:** the canonical text lives in the Google Sheet `yuhpp_prompts`. It
  is synced into the `prompts` table as versioned rows. Prompt text is never
  stored in this repo and never sent to the browser.

## Webflow Cloud rules

- Never set `basePath` or `assetPrefix` in `next.config.ts`. Webflow Cloud
  sets both from the mount path.
- `<Link>`, `<Image>` and the router get the `/app` prefix automatically. Plain
  `<a>` tags and `fetch()` calls to this app's own routes must use `appPath()`
  from `src/lib/paths.ts`.
- npm only, Node 22 or later.
- Webflow Cloud ignores the `build` script and runs its own OpenNext Cloudflare
  build. Code must work on Cloudflare Workers (no filesystem writes, no
  long-running processes).
- Storage bindings (SQLite, KV, object storage) must be declared in
  `wrangler.json` before they can be used.
- **Database changes are migration files** in `migrations/`, numbered in order
  (`0001_foundation.sql`, `0002_...`). Webflow Cloud applies new ones on deploy.
  Migrations are additive: never edit or delete one that has been pushed; write
  a new one instead. Test locally with
  `npx wrangler d1 migrations apply DB --local`.
- Environment variable changes only take effect on the next deploy.

## Environment variables

| Name | Secret | What it is |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | Yes | Anthropic Console API key |
| `MEMBERSTACK_SECRET_KEY` | Yes | Memberstack secret key |
| `NEXT_PUBLIC_BASE_PATH` | No | The mount path, `/app`. Webflow Cloud does not reliably provide it at build time, and plain links and `fetch()` need it. |
| `NEXT_PUBLIC_MEMBERSTACK_PUBLIC_KEY` | No | Optional; falls back to the sandbox key in `src/lib/config.ts`. Set to the live key at launch. |

Set them in Webflow Cloud > the environment > Environment Variables, with
Secret toggled on for the secret ones, then click **Deploy latest commit**.
Local development uses `.env.local` (copy `.env.example`; never commit it).

## Product rules (never break these)

1. **Secrets:** never commit, log, or return a secret value. Secrets are read
   only in `src/lib/config.ts`. Integration modules (`memberstack-server.ts`,
   later the Claude client) get them through `requireSecret()`; everything else
   asks `hasSecret()`. Files that touch secrets start with `import "server-only"`.
2. **Prompt privacy:** prompt bodies never reach the browser. The client sees a
   prompt's name and description only.
3. **Registered prompts only:** no free-form chat endpoint. Only prompts in the
   registry can run, with per-member run caps.
4. **Not a practice service:** no recording, no audio transcription, no AI mock
   interviews, and the model never plays the interviewer. The practice loop
   builds kits and diagnoses answers users paste in.
5. **Copy:** no em dashes in any user-facing text. Never invent metrics,
   facts, or testimonials.
6. **Member scoping:** every database query that reads member data filters by
   the member id from `currentMember()` (a verified session), never from the
   request.
7. **Thresholds are data:** gate thresholds, run caps, and exception caps live
   in the `settings` table, not as constants in code.

## Repo layout

```
src/app/                pages and API routes (App Router)
  page.tsx              /app: signed-in home (redirects to /login if signed out)
  login/page.tsx        /app/login: sign in and create account
  status/page.tsx       /app/status: configuration and storage checks
  api/health/           /app/api/health: the same checks as JSON
  api/session/          /app/api/session: POST starts a session, DELETE ends it
  components/           Masthead, AuthForm, SignOutButton
  globals.css           design tokens shared with the public guide
src/lib/
  config.ts             the only place secrets are read (server only)
  public-config.ts      browser-safe values (Memberstack public key)
  cloudflare.ts         bindings() for DB and SESSIONS, storage checks
  memberstack-server.ts verify tokens, fetch member email (server only)
  memberstack-client.ts load Memberstack in the browser
  members.ts            member rows
  session.ts            create, read, and end sessions
  paths.ts              appPath(): mount-path prefix for <a> and fetch()
migrations/             numbered SQL migrations, applied on deploy
wrangler.json           storage bindings
docs/RUNBOOK.md         how to deploy, change keys, roll back, fix sign-in
webflow.json            tells Webflow Cloud this is a Next.js app
```

## Working loop

1. Make the change on a branch, or on `staging` once it exists. `main` is
   production and deploys on every push.
2. Run `npm run lint` and `npm run build` before pushing. Both must pass.
3. Tell Michael what changed and exactly what to click to verify it.
