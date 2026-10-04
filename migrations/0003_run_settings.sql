-- 0003_run_settings.sql
-- The model and its prices live in settings, so switching models or
-- updating prices needs no code change.
INSERT INTO settings (key, value, description) VALUES
  ('run_model', 'claude-sonnet-5-5', 'Model that runs prompts'),
  ('max_output_tokens', '8000', 'Longest reply per turn, in tokens'),
  ('price_input_per_mtok', '2', 'Run model: USD per million uncached input tokens'),
  ('price_output_per_mtok', '10', 'Run model: USD per million output tokens'),
  ('price_cache_write_per_mtok', '2.5', 'Run model: USD per million tokens written to the cache'),
  ('price_cache_read_per_mtok', '0.2', 'Run model: USD per million tokens read from the cache'),
  ('price_web_search_each', '0.01', 'USD per web search ($10 per 1,000)');
