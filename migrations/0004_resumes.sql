-- 0004_resumes.sql
-- Saved resumes (text only; the original file is never stored) and a log of
-- API calls that are not prompt runs, such as reading an uploaded PDF.

CREATE TABLE resumes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  member_id TEXT NOT NULL REFERENCES members(id),
  file_name TEXT,
  source TEXT NOT NULL CHECK (source IN ('pdf', 'docx', 'text', 'paste')),
  text TEXT NOT NULL,
  is_current INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_resumes_member_current ON resumes (member_id, is_current);

CREATE TABLE api_usage (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  member_id TEXT REFERENCES members(id),
  purpose TEXT NOT NULL,
  model TEXT NOT NULL,
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  cost_usd REAL NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_api_usage_created ON api_usage (created_at);

INSERT INTO settings (key, value, description) VALUES
  ('extract_model', 'claude-haiku-4-5-20251001', 'Model that reads uploaded PDFs into text'),
  ('price_extract_input_per_mtok', '1', 'Extract model: USD per million input tokens'),
  ('price_extract_output_per_mtok', '5', 'Extract model: USD per million output tokens'),
  ('resume_max_chars', '30000', 'Longest resume text accepted, in characters'),
  ('resume_pdf_reads_daily', '10', 'Resume PDFs each member can have read per day');

CREATE INDEX idx_api_usage_member ON api_usage (member_id, purpose, created_at);
