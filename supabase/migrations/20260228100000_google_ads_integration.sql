-- =============================================
-- Google Ads Integration - Database Schema
-- =============================================

-- Google Ads Campaigns (mirrors ads_campaigns for Meta)
CREATE TABLE IF NOT EXISTS google_ads_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id text UNIQUE NOT NULL,
  customer_id text NOT NULL,
  name text NOT NULL,
  status text NOT NULL DEFAULT 'UNKNOWN',
  campaign_type text,
  bidding_strategy text,
  daily_budget numeric(12,2),
  impressions bigint DEFAULT 0,
  clicks bigint DEFAULT 0,
  cost numeric(12,2) DEFAULT 0,
  cpc numeric(10,4) DEFAULT 0,
  cpm numeric(10,4) DEFAULT 0,
  ctr numeric(8,4) DEFAULT 0,
  conversions numeric(12,2) DEFAULT 0,
  cost_per_conversion numeric(12,4) DEFAULT 0,
  conversion_rate numeric(8,4) DEFAULT 0,
  search_impression_share numeric(8,4),
  created_time timestamptz,
  updated_time timestamptz,
  last_synced_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- Google Ads Daily Snapshots (mirrors ads_daily for Meta)
CREATE TABLE IF NOT EXISTS google_ads_daily (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date date NOT NULL,
  customer_id text NOT NULL,
  total_cost numeric(12,2) DEFAULT 0,
  total_impressions bigint DEFAULT 0,
  total_clicks bigint DEFAULT 0,
  total_conversions numeric(12,2) DEFAULT 0,
  active_campaigns integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE(date, customer_id)
);

-- Google Ads OAuth/API config (single row pattern)
CREATE TABLE IF NOT EXISTS google_ads_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id text,
  client_id text,
  client_secret text,
  refresh_token text,
  developer_token text,
  is_connected boolean DEFAULT false,
  last_token_refresh timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Insert default empty config row
INSERT INTO google_ads_config (id) VALUES (gen_random_uuid());

-- Add platform column to shared tables for cross-platform support
ALTER TABLE ads_agent_actions ADD COLUMN IF NOT EXISTS platform text NOT NULL DEFAULT 'meta';
ALTER TABLE ads_pending_actions ADD COLUMN IF NOT EXISTS platform text NOT NULL DEFAULT 'meta';

-- RLS policies
ALTER TABLE google_ads_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE google_ads_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE google_ads_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_google_ads_campaigns" ON google_ads_campaigns FOR ALL TO authenticated USING (true);
CREATE POLICY "anon_read_google_ads_campaigns" ON google_ads_campaigns FOR SELECT TO anon USING (true);
CREATE POLICY "service_google_ads_campaigns" ON google_ads_campaigns FOR ALL TO service_role USING (true);

CREATE POLICY "auth_google_ads_daily" ON google_ads_daily FOR ALL TO authenticated USING (true);
CREATE POLICY "anon_read_google_ads_daily" ON google_ads_daily FOR SELECT TO anon USING (true);
CREATE POLICY "service_google_ads_daily" ON google_ads_daily FOR ALL TO service_role USING (true);

CREATE POLICY "auth_google_ads_config" ON google_ads_config FOR ALL TO authenticated USING (true);
CREATE POLICY "anon_read_google_ads_config" ON google_ads_config FOR SELECT TO anon USING (true);
CREATE POLICY "anon_update_google_ads_config" ON google_ads_config FOR UPDATE TO anon USING (true);
CREATE POLICY "service_google_ads_config" ON google_ads_config FOR ALL TO service_role USING (true);

-- Enable realtime for new tables
ALTER PUBLICATION supabase_realtime ADD TABLE google_ads_campaigns;
ALTER PUBLICATION supabase_realtime ADD TABLE google_ads_daily;
