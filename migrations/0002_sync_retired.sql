-- 0002_sync_retired.sql
-- Record how many prompts each sync retired (removed from the sheet).
ALTER TABLE prompt_syncs ADD COLUMN retired INTEGER NOT NULL DEFAULT 0;
