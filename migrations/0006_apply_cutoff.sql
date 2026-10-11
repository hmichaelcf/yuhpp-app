-- 0006_apply_cutoff.sql
-- Checkpoint 04 decision (2026-10-10): one cutoff. A Match Meter score of 7.0
-- or more means apply; anything under 7.0 means skip. There is no longer an
-- "apply after quick wins" band, so its lower edge now equals the apply line.
UPDATE settings
SET value = '7.0',
    description = 'G3: lower edge of the old "apply after quick wins" band. Set equal to g3_apply_min: under that score, skip (decided 2026-10-10)',
    updated_at = datetime('now')
WHERE key = 'g3_quick_wins_min';
