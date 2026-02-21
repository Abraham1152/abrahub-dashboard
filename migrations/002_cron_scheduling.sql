-- =============================================
-- ABRAhub Dashboard - Cron Scheduling
-- Run this in Supabase SQL Editor AFTER deploying Edge Functions
-- =============================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Stripe sync: every 6 hours
SELECT cron.schedule(
  'sync-stripe',
  '0 */6 * * *',
  $$
  SELECT net.http_post(
    url := 'https://jdodenbjohnqvhvldfqu.supabase.co/functions/v1/sync-stripe',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impkb2RlbmJqb2hucXZodmxkZnF1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE2MjU3MzAsImV4cCI6MjA4NzIwMTczMH0.MR3yuR-a1vf84iDrw2wEZ0mS0-8y0LdG1lUjiK_mFec"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);

-- Kiwify sync: every 6 hours (offset by 1 hour)
SELECT cron.schedule(
  'sync-kiwify',
  '0 1,7,13,19 * * *',
  $$
  SELECT net.http_post(
    url := 'https://jdodenbjohnqvhvldfqu.supabase.co/functions/v1/sync-kiwify',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impkb2RlbmJqb2hucXZodmxkZnF1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE2MjU3MzAsImV4cCI6MjA4NzIwMTczMH0.MR3yuR-a1vf84iDrw2wEZ0mS0-8y0LdG1lUjiK_mFec"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);

-- YouTube sync: every 12 hours
SELECT cron.schedule(
  'sync-youtube',
  '0 3,15 * * *',
  $$
  SELECT net.http_post(
    url := 'https://jdodenbjohnqvhvldfqu.supabase.co/functions/v1/sync-youtube',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impkb2RlbmJqb2hucXZodmxkZnF1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE2MjU3MzAsImV4cCI6MjA4NzIwMTczMH0.MR3yuR-a1vf84iDrw2wEZ0mS0-8y0LdG1lUjiK_mFec"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);

-- Instagram sync: every 12 hours
SELECT cron.schedule(
  'sync-instagram',
  '0 4,16 * * *',
  $$
  SELECT net.http_post(
    url := 'https://jdodenbjohnqvhvldfqu.supabase.co/functions/v1/sync-instagram',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impkb2RlbmJqb2hucXZodmxkZnF1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE2MjU3MzAsImV4cCI6MjA4NzIwMTczMH0.MR3yuR-a1vf84iDrw2wEZ0mS0-8y0LdG1lUjiK_mFec"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);

-- Churn calculation: daily at 02:00 UTC
SELECT cron.schedule(
  'sync-churn',
  '0 2 * * *',
  $$
  SELECT net.http_post(
    url := 'https://jdodenbjohnqvhvldfqu.supabase.co/functions/v1/sync-churn',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impkb2RlbmJqb2hucXZodmxkZnF1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE2MjU3MzAsImV4cCI6MjA4NzIwMTczMH0.MR3yuR-a1vf84iDrw2wEZ0mS0-8y0LdG1lUjiK_mFec"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);
