-- 0010_resume_record.sql
-- The resume becomes structured: Phase 02 builds it section by section, the
-- member publishes it in the Yuhpp resume template, and Phase 03 reads it
-- together with a search brief.
--
-- Roles and bullets already live in `experiences` and `bullets` (the bullet
-- bank). Everything else on the template lives in `resume_profiles`, one row
-- per member. Lists are stored as JSON arrays of strings.

PRAGMA defer_foreign_keys = true;

-- Saved resumes gain a fifth source, 'built' (published from the resume
-- record), and keep the published record itself so it can be shown and
-- printed later exactly as published. SQLite cannot change a CHECK
-- constraint in place, so the table is rebuilt with every row kept.
CREATE TABLE resumes_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  member_id TEXT NOT NULL REFERENCES members(id),
  file_name TEXT,
  source TEXT NOT NULL CHECK (source IN ('pdf', 'docx', 'text', 'paste', 'built')),
  text TEXT NOT NULL,
  record TEXT,
  is_current INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
INSERT INTO resumes_new (id, member_id, file_name, source, text, is_current, created_at)
  SELECT id, member_id, file_name, source, text, is_current, created_at FROM resumes;
DROP TABLE resumes;
ALTER TABLE resumes_new RENAME TO resumes;
CREATE INDEX idx_resumes_member_current ON resumes (member_id, is_current);

-- Everything on the template besides roles and bullets.
CREATE TABLE resume_profiles (
  member_id TEXT PRIMARY KEY REFERENCES members(id),
  full_name TEXT,
  headline TEXT,          -- JSON: up to three keywords
  email TEXT,
  phone TEXT,
  location TEXT,
  skills TEXT,            -- JSON: Skills & knowledge (Resume Value Builder writes 12)
  leadership TEXT,        -- JSON: Leadership (Resume Value Builder writes 5)
  tools TEXT,             -- JSON
  interests TEXT,         -- JSON: up to five
  reference_list TEXT,    -- JSON: [{ "name", "relationship", "company" }]
  school TEXT,
  degree TEXT,
  school_location TEXT,
  use_own_file INTEGER NOT NULL DEFAULT 0, -- 1: the member keeps their uploaded file as their resume
  imported_at TEXT,       -- when sections were last read from an uploaded resume
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- What each run last read of the resume, as a fingerprint, so the next turn
-- can say the resume changed in between.
ALTER TABLE runs ADD COLUMN resume_seen TEXT;

-- The search brief: what every Phase 03 search starts from.
CREATE TABLE search_briefs (
  member_id TEXT PRIMARY KEY REFERENCES members(id),
  titles_strong TEXT,     -- JSON
  titles_stretch TEXT,    -- JSON
  level TEXT,
  location TEXT,
  industries TEXT,
  keywords TEXT,          -- JSON
  posted_within_days INTEGER,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Companies saved from Phase 03 research; Track B starts from them.
CREATE TABLE target_companies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  member_id TEXT NOT NULL REFERENCES members(id),
  name TEXT NOT NULL,
  note TEXT,
  where_to_look TEXT,
  run_id TEXT REFERENCES runs(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_target_companies_member ON target_companies (member_id, created_at);

INSERT INTO settings (key, value, description) VALUES
  ('search_posted_within_days', '7', 'Search brief: posting window in days when the member has not set one (matches the weekly review)'),
  ('resume_imports_daily', '5', 'Times each member can read an uploaded resume into resume sections per day (a paid call)'),
  ('target_companies_in_frame', '25', 'Track B prompts: most saved companies one run reads');
