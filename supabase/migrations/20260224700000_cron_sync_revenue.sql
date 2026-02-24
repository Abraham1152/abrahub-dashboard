-- Schedule sync-stripe every 10 minutes
SELECT cron.schedule(
  'sync-stripe-every-10min',
  '*/10 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://jdodenbjohnqvhvldfqu.supabase.co/functions/v1/sync-stripe',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impkb2RlbmJqb2hucXZodmxkZnF1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE2MjU3MzAsImV4cCI6MjA4NzIwMTczMH0.MR3yuR-a1vf84iDrw2wEZ0mS0-8y0LdG1lUjiK_mFec"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);

-- Schedule sync-kiwify every 10 minutes (offset by 5min to spread load)
SELECT cron.schedule(
  'sync-kiwify-every-10min',
  '5-55/10 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://jdodenbjohnqvhvldfqu.supabase.co/functions/v1/sync-kiwify',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impkb2RlbmJqb2hucXZodmxkZnF1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE2MjU3MzAsImV4cCI6MjA4NzIwMTczMH0.MR3yuR-a1vf84iDrw2wEZ0mS0-8y0LdG1lUjiK_mFec"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);

-- Schedule sync-ads every 15 minutes
SELECT cron.schedule(
  'sync-ads-every-15min',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://jdodenbjohnqvhvldfqu.supabase.co/functions/v1/sync-ads',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impkb2RlbmJqb2hucXZodmxkZnF1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE2MjU3MzAsImV4cCI6MjA4NzIwMTczMH0.MR3yuR-a1vf84iDrw2wEZ0mS0-8y0LdG1lUjiK_mFec"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);
