/// <reference types="@cloudflare/workers-types" />

// Storage bindings declared in wrangler.json, as the app sees them.
declare global {
  interface CloudflareEnv {
    DB: D1Database;
    SESSIONS: KVNamespace;
  }
}

export {};
