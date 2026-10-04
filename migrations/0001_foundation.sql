-- 0001_foundation.sql
-- Phase 1 foundation tables. Later phases add tables (cycles, profiles,
-- stories, opportunities, rounds, ...) in new migration files.
-- Migrations are additive: never edit or delete a migration once deployed.

-- Institutions and beta groups. Every member can belong to one.
CREATE TABLE cohorts (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  organization TEXT,
  starts_on TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- One row per account. id is the Memberstack member id (mem_...).
CREATE TABLE members (
  id TEXT PRIMARY KEY,
  email TEXT,
  cohort_id TEXT REFERENCES cohorts(id),
  is_admin INTEGER NOT NULL DEFAULT 0,
  consent_terms_at TEXT,
  consent_research_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_seen_at TEXT
);

-- Tunable values. Gate thresholds and caps live here, not in code.
CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  description TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO settings (key, value, description) VALUES
  ('run_cap_monthly', '75', 'Prompt runs per member per calendar month'),
  ('max_turns_per_run', '40', 'Turns before a run closes'),
  ('max_searches_per_run', '5', 'Web searches allowed in one run'),
  ('g3_apply_min', '7.0', 'G3: Match Meter score at or above which a job is applied to as-is'),
  ('g3_quick_wins_min', '5.5', 'G3: lowest score that may apply after quick wins (map v1.4 value; pending final decision)'),
  ('strategic_exceptions_per_week', '2', 'G3: below-threshold applications allowed per week, each needing a referral attempt'),
  ('ghosted_after_days', '21', 'G5: days without a response before a job counts as ghosted'),
  ('intel_brief_max_age_days', '14', 'Round ready: days before an Interview Intel Brief should be refreshed');

-- Each CSV upload of the yuhpp_prompts sheet.
CREATE TABLE prompt_syncs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  synced_by TEXT REFERENCES members(id),
  rows_read INTEGER NOT NULL,
  added INTEGER NOT NULL,
  changed INTEGER NOT NULL,
  unchanged INTEGER NOT NULL,
  synced_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Versioned prompt text. A changed prompt gets a new version row; old
-- versions stay so every run can point at the exact text it used.
CREATE TABLE prompts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key TEXT NOT NULL,
  version INTEGER NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  body TEXT NOT NULL,
  body_hash TEXT NOT NULL,
  stage TEXT,
  category TEXT,
  is_current INTEGER NOT NULL DEFAULT 1,
  sync_id INTEGER REFERENCES prompt_syncs(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (key, version)
);
CREATE INDEX idx_prompts_current ON prompts (key, is_current);

-- One prompt session, from first message to save.
CREATE TABLE runs (
  id TEXT PRIMARY KEY,
  member_id TEXT NOT NULL REFERENCES members(id),
  prompt_id INTEGER NOT NULL REFERENCES prompts(id),
  status TEXT NOT NULL DEFAULT 'open',
  model TEXT NOT NULL,
  turns INTEGER NOT NULL DEFAULT 0,
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  cache_read_tokens INTEGER NOT NULL DEFAULT 0,
  cache_write_tokens INTEGER NOT NULL DEFAULT 0,
  web_searches INTEGER NOT NULL DEFAULT 0,
  cost_usd REAL NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_runs_member_created ON runs (member_id, created_at);

-- Every turn of a run.
CREATE TABLE messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id TEXT NOT NULL REFERENCES runs(id),
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_messages_run ON messages (run_id, id);
