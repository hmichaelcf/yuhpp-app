-- 0005_workspace.sql
-- The member's workspace: what they are working on between prompt runs.
-- Every table is keyed by member_id, and every query filters by the member
-- id from a verified session.

-- What the home page greets them by. Optional; set on the profile page.
ALTER TABLE members ADD COLUMN first_name TEXT;

-- Bullet bank: resume bullets kept outside any one resume, so a future
-- feature can assemble a new resume from the bank.
CREATE TABLE bullets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  member_id TEXT NOT NULL REFERENCES members(id),
  text TEXT NOT NULL,
  role TEXT,
  company TEXT,
  tags TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_bullets_member ON bullets (member_id, updated_at);

-- Story bank: STAR stories, each with a short name and the themes it covers.
CREATE TABLE stories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  member_id TEXT NOT NULL REFERENCES members(id),
  title TEXT NOT NULL,
  themes TEXT,
  situation TEXT,
  task TEXT,
  action TEXT,
  result TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_stories_member ON stories (member_id, updated_at);

-- Saved job searches, usually the queries Smart Job Search Builder writes.
-- run_id records the run a search was saved from, when there was one.
CREATE TABLE saved_searches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  member_id TEXT NOT NULL REFERENCES members(id),
  label TEXT NOT NULL,
  query TEXT NOT NULL,
  run_id TEXT REFERENCES runs(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_saved_searches_member ON saved_searches (member_id, created_at);

-- Weekly numbers: one row per member per week (week_start is the Monday,
-- YYYY-MM-DD). The counts match the Weekly Pipeline Review prompt.
CREATE TABLE weekly_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  member_id TEXT NOT NULL REFERENCES members(id),
  week_start TEXT NOT NULL,
  applications INTEGER NOT NULL DEFAULT 0,
  outreach INTEGER NOT NULL DEFAULT 0,
  replies INTEGER NOT NULL DEFAULT 0,
  referrals INTEGER NOT NULL DEFAULT 0,
  recruiter_screens INTEGER NOT NULL DEFAULT 0,
  hm_rounds INTEGER NOT NULL DEFAULT 0,
  panels INTEGER NOT NULL DEFAULT 0,
  offers INTEGER NOT NULL DEFAULT 0,
  rejections INTEGER NOT NULL DEFAULT 0,
  note TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (member_id, week_start)
);

INSERT INTO settings (key, value, description) VALUES
  ('metric_min_sample', '10', 'Weekly review: a conversion rate counts as meaningful once the earlier stage has at least this many'),
  ('story_bank_target_min', '6', 'Checkpoint 02: fewest developed stories in the story bank'),
  ('story_bank_target_max', '8', 'Checkpoint 02: most developed stories the story bank aims for'),
  ('bullet_max_chars', '75', 'Bullet bank: longest bullet, in characters, before it is flagged'),
  ('community_invite_url', 'https://chat.whatsapp.com/KdWdwIwLi9K3pSt2IwRbrM', 'Good company: the WhatsApp community invite link');
