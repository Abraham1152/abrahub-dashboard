-- Campanhas de Ads (Meta/Facebook)
CREATE TABLE ads_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id text UNIQUE NOT NULL,
  account_id text NOT NULL,
  name text NOT NULL,
  status text NOT NULL DEFAULT 'UNKNOWN',
  objective text,
  daily_budget numeric(12,2),
  lifetime_budget numeric(12,2),
  impressions bigint DEFAULT 0,
  clicks bigint DEFAULT 0,
  reach bigint DEFAULT 0,
  spend numeric(12,2) DEFAULT 0,
  cpc numeric(10,4) DEFAULT 0,
  cpm numeric(10,4) DEFAULT 0,
  ctr numeric(8,4) DEFAULT 0,
  conversions integer DEFAULT 0,
  cost_per_result numeric(12,4) DEFAULT 0,
  created_time timestamptz,
  updated_time timestamptz,
  last_synced_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- Snapshot diario de metricas por conta
CREATE TABLE ads_daily (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date date NOT NULL,
  account_id text NOT NULL,
  total_spend numeric(12,2) DEFAULT 0,
  total_impressions bigint DEFAULT 0,
  total_clicks bigint DEFAULT 0,
  total_reach bigint DEFAULT 0,
  total_conversions integer DEFAULT 0,
  active_campaigns integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE(date, account_id)
);

-- RLS
ALTER TABLE ads_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE ads_daily ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_ads_campaigns" ON ads_campaigns FOR ALL TO authenticated USING (true);
CREATE POLICY "auth_ads_daily" ON ads_daily FOR ALL TO authenticated USING (true);
