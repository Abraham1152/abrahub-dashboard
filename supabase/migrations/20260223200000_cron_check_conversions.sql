-- Enable pg_net if not already enabled (pg_cron is pre-enabled on Supabase)
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Schedule check-conversions to run every 5 minutes
SELECT cron.schedule(
  'check-conversions-every-5min',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://jdodenbjohnqvhvldfqu.supabase.co/functions/v1/check-conversions',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impkb2RlbmJqb2hucXZodmxkZnF1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE2MjU3MzAsImV4cCI6MjA4NzIwMTczMH0.MR3yuR-a1vf84iDrw2wEZ0mS0-8y0LdG1lUjiK_mFec"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);
