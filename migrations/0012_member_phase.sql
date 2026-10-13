-- 0012_member_phase.sql
-- Home tailors itself to where the member is (2026-10-13). The member picks
-- their phase once ("Where are you in your search?") and can change it from
-- Home; when a checkpoint looks met, Home suggests moving on and they confirm.
ALTER TABLE members ADD COLUMN current_phase TEXT;
ALTER TABLE members ADD COLUMN phase_set_at TEXT;
-- The phase whose "move on" suggestion the member dismissed with Not yet.
-- Cleared whenever the phase changes.
ALTER TABLE members ADD COLUMN nudge_snoozed TEXT;
