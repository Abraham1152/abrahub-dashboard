-- Table to persist Meta tokens in DB (instead of only env vars)
CREATE TABLE IF NOT EXISTS meta_token_config (
  token_type TEXT PRIMARY KEY,       -- 'ads' | 'instagram'
  access_token TEXT NOT NULL,
  expires_at TIMESTAMPTZ,            -- NULL = never expires (permanent page token)
  last_refreshed_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE meta_token_config ENABLE ROW LEVEL SECURITY;

-- Only service role can read/write tokens
CREATE POLICY "service_only" ON meta_token_config
  USING (false)
  WITH CHECK (false);

-- Schedule weekly auto-refresh every Sunday at 2am UTC
SELECT cron.schedule(
  'refresh-meta-tokens-weekly',
  '0 2 * * 0',
  $$
  SELECT net.http_post(
    url := 'https://jdodenbjohnqvhvldfqu.supabase.co/functions/v1/refresh-meta-token',
    headers := json_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY' LIMIT 1)
    )::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);
