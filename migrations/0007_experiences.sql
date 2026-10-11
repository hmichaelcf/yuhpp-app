-- 0007_experiences.sql
-- Bullet bank: each role a member held becomes one experience row with its
-- role, company, and dates. Bullets point at it, so fixing a title or company
-- once fixes it for every bullet under that role, and the bank can sort roles
-- from most recent to oldest.
--
-- Months are stored as 'YYYY-MM'. is_current = 1 means the member still works
-- there (shown as "Present"), and end_month is then NULL.
--
-- bullets.role and bullets.company are kept for history but are no longer read
-- or written; experiences hold the role and company from here on.

CREATE TABLE experiences (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  member_id TEXT NOT NULL REFERENCES members(id),
  role TEXT,
  company TEXT,
  start_month TEXT,
  end_month TEXT,
  is_current INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_experiences_member ON experiences (member_id);

ALTER TABLE bullets ADD COLUMN experience_id INTEGER REFERENCES experiences(id);
CREATE INDEX idx_bullets_experience ON bullets (member_id, experience_id);

-- One experience for each role and company a member already has bullets
-- under (including bullets with neither), with no dates yet.
INSERT INTO experiences (member_id, role, company)
SELECT DISTINCT member_id, role, company FROM bullets;

UPDATE bullets SET experience_id = (
  SELECT e.id FROM experiences e
  WHERE e.member_id = bullets.member_id
    AND e.role IS bullets.role
    AND e.company IS bullets.company
  LIMIT 1
);
