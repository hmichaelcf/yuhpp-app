-- 0009_story_bank_runs.sql
-- Prompts that ask for stories read the member's story bank in every run.
-- This caps how much of the bank one run reads, so a very large bank cannot
-- crowd out the conversation. Complete stories go in first; any story left
-- out is named to the run so it can ask for it. 60,000 characters holds
-- roughly 40 typical stories.

INSERT INTO settings (key, value, description) VALUES
  ('story_bank_max_chars', '60000', 'Prompt runs: most characters of the story bank one run reads (complete stories go in first)');

-- What each run last read from the story bank: for each story, a fingerprint
-- of its text and its label, as JSON. On the next message the run compares
-- the bank with it, so it can be told which stories were added, edited, or
-- removed since then.
ALTER TABLE runs ADD COLUMN story_bank_seen TEXT;
