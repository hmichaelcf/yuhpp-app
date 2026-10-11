-- 0008_story_company.sql
-- Story bank: each story records the company it happened at, so the bank can
-- list stories as "Company | Story name" under each theme. Optional, and
-- existing stories keep working without one.

ALTER TABLE stories ADD COLUMN company TEXT;
