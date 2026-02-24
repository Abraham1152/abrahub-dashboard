-- Fix YouTube tables RLS: add missing policies for both anon and authenticated

-- youtube_revenue_daily: add authenticated read (only had anon)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'youtube_revenue_daily' AND policyname = 'auth_read_youtube_revenue'
  ) THEN
    CREATE POLICY "auth_read_youtube_revenue"
      ON youtube_revenue_daily FOR SELECT
      TO authenticated
      USING (true);
  END IF;
END $$;

-- youtube_daily: add anon read (only had authenticated)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'youtube_daily' AND policyname = 'anon_read_youtube_daily'
  ) THEN
    CREATE POLICY "anon_read_youtube_daily"
      ON youtube_daily FOR SELECT
      TO anon
      USING (true);
  END IF;
END $$;

-- youtube_videos: ensure both roles can read
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'youtube_videos' AND policyname = 'anon_read_youtube_videos'
  ) THEN
    CREATE POLICY "anon_read_youtube_videos"
      ON youtube_videos FOR SELECT
      TO anon
      USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'youtube_videos' AND policyname = 'auth_read_youtube_videos'
  ) THEN
    CREATE POLICY "auth_read_youtube_videos"
      ON youtube_videos FOR SELECT
      TO authenticated
      USING (true);
  END IF;
END $$;
