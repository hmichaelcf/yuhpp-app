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

- **Phase 0 (current):** a status page at yuhpp.com/app and a health check at
  yuhpp.com/app/api/health. Exit test: both load on the live domain and show
  both secrets as set.
- **Phase 1 (next):** Memberstack login, the SQLite schema, prompt sync from the
  sheet, the chat engine, run caps, an admin usage page.
- Later phases: onboarding, application loop, interview loop, weekly review and
  practice, beta launch. See the build spec.

## Architecture

- **Webflow site (yuhpp.com):** homepage, /guide, legal pages, sign-up and
  login pages. Built in Webflow, not in this repo.
- **This repo:** one Next.js 16 app (App Router, React 19) deployed on Webflow
  Cloud, which runs it on Cloudflare Workers through OpenNext. It is mounted at
  `/app` on yuhpp.com and deploys automatically on every push to `main`.
- **Memberstack:** accounts and plans. From Phase 1 the app verifies each
  member's token on the server.
- **Claude API:** called only from server code. Sonnet 5.5 runs prompts;
  Haiku 4.5 extracts structured results.
- **Storage (from Phase 1):** Webflow Cloud SQLite for workspace data, object
  storage for resume files, key-value for run counters.
- **Prompts:** the canonical text lives in the Google Sheet `yuhpp_prompts`. It
  is synced into the database as versioned rows. Prompt text is never stored in
  this repo and never sent to the browser.

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

1. **Secrets:** never commit, log, or return a secret value. Read secrets only
   in `src/lib/config.ts`; everything else asks whether one is set.
2. **Prompt privacy:** prompt bodies never reach the browser. The client sees a
   prompt's name and description only.
3. **Registered prompts only:** no free-form chat endpoint. Only prompts in the
   registry can run, with per-member run caps.
4. **Not a practice service:** no recording, no audio transcription, no AI mock
   interviews, and the model never plays the interviewer. The practice loop
   builds kits and diagnoses answers users paste in.
5. **Copy:** no em dashes in any user-facing text. Never invent metrics,
   facts, or testimonials.
6. **Member scoping (from Phase 1):** every database query filters by the
   member id taken from the verified Memberstack token, never from the request.
7. **Thresholds are data (from Phase 1):** gate thresholds, run caps, and
   exception caps live in the settings table, not as constants in code.

## Repo layout

```
src/app/            pages and API routes (App Router)
  page.tsx          /app: Phase 0 status page
  api/health/       /app/api/health: deployment and secrets check
  globals.css       design tokens shared with the public guide
src/lib/
  config.ts         the only place secrets are read
  paths.ts          appPath(): mount-path prefix for <a> and fetch()
docs/RUNBOOK.md     how to deploy, change keys, roll back
webflow.json        tells Webflow Cloud this is a Next.js app
```

## Working loop

1. Make the change on a branch, or on `staging` once it exists. `main` is
   production and deploys on every push.
2. Run `npm run lint` and `npm run build` before pushing. Both must pass.
3. Tell Michael what changed and exactly what to click to verify it.
