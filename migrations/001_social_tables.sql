-- =============================================
-- ABRAhub Dashboard - Social & Sync Tables
-- Run this in the Supabase SQL Editor
-- =============================================

-- YouTube Daily Metrics
CREATE TABLE youtube_daily (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  channel_id TEXT NOT NULL,
  subscribers INT DEFAULT 0,
  total_views BIGINT DEFAULT 0,
  total_videos INT DEFAULT 0,
  views_gained INT DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(date, channel_id)
);

-- YouTube Videos
CREATE TABLE youtube_videos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  published_at TIMESTAMP WITH TIME ZONE,
  view_count BIGINT DEFAULT 0,
  like_count INT DEFAULT 0,
  comment_count INT DEFAULT 0,
  thumbnail_url TEXT,
  last_synced_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Instagram Daily Metrics
CREATE TABLE instagram_daily (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  account_id TEXT NOT NULL,
  followers INT DEFAULT 0,
  follows INT DEFAULT 0,
  media_count INT DEFAULT 0,
  reach INT DEFAULT 0,
  impressions INT DEFAULT 0,
  profile_views INT DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(date, account_id)
);

-- Instagram Posts
CREATE TABLE instagram_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  media_id TEXT NOT NULL UNIQUE,
  media_type TEXT CHECK (media_type IN ('IMAGE', 'VIDEO', 'CAROUSEL_ALBUM', 'REEL')),
  caption TEXT,
  permalink TEXT,
  timestamp TIMESTAMP WITH TIME ZONE,
  like_count INT DEFAULT 0,
  comments_count INT DEFAULT 0,
  reach INT DEFAULT 0,
  impressions INT DEFAULT 0,
  saves INT DEFAULT 0,
  shares INT DEFAULT 0,
  thumbnail_url TEXT,
  last_synced_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Sync Log (operational visibility)
CREATE TABLE sync_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service TEXT NOT NULL CHECK (service IN ('stripe', 'kiwify', 'youtube', 'instagram', 'churn')),
  status TEXT NOT NULL CHECK (status IN ('running', 'success', 'error')),
  records_processed INT DEFAULT 0,
  error_message TEXT,
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- =============================================
-- Row Level Security
-- =============================================

ALTER TABLE youtube_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE youtube_videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE instagram_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE instagram_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_log ENABLE ROW LEVEL SECURITY;

-- YouTube RLS
CREATE POLICY "Authenticated can view youtube daily" ON youtube_daily
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated can view youtube videos" ON youtube_videos
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Instagram RLS
CREATE POLICY "Authenticated can view instagram daily" ON instagram_daily
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated can view instagram posts" ON instagram_posts
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Sync Log RLS
CREATE POLICY "Authenticated can view sync log" ON sync_log
  FOR SELECT USING (auth.uid() IS NOT NULL);
