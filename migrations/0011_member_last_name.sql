-- 0011_member_last_name.sql
-- Sign-up now asks for first and last name (2026-10-12). first_name was
-- added in 0005; this adds last_name. Members who joined before this change
-- have no last name until they add it on their profile.
ALTER TABLE members ADD COLUMN last_name TEXT;
