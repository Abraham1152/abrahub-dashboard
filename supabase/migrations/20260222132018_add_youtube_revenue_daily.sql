CREATE TABLE IF NOT EXISTS youtube_revenue_daily (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  channel_id text NOT NULL,
  date date NOT NULL,
  revenue numeric(12,2) DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE(channel_id, date)
);

ALTER TABLE youtube_revenue_daily ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_read" ON youtube_revenue_daily FOR SELECT TO anon USING (true);
CREATE POLICY "service_write" ON youtube_revenue_daily FOR ALL TO service_role USING (true);
