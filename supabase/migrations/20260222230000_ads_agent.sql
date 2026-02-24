-- Ads Agent: audit log of all actions (manual + automated)
CREATE TABLE IF NOT EXISTS ads_agent_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action_type text NOT NULL,
  campaign_id text,
  campaign_name text,
  source text NOT NULL DEFAULT 'manual',
  details jsonb DEFAULT '{}',
  status text NOT NULL DEFAULT 'success',
  error_message text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE ads_agent_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_read_ads_actions" ON ads_agent_actions FOR SELECT TO anon USING (true);
CREATE POLICY "anon_insert_ads_actions" ON ads_agent_actions FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "auth_all_ads_actions" ON ads_agent_actions FOR ALL TO authenticated USING (true);

-- Ads Optimization Config (single row)
CREATE TABLE IF NOT EXISTS ads_optimization_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target_cpa numeric(12,2) DEFAULT 50.00,
  min_roas numeric(8,2) DEFAULT 2.0,
  min_daily_budget numeric(12,2) DEFAULT 10.00,
  max_daily_budget numeric(12,2) DEFAULT 500.00,
  budget_increase_pct numeric(5,2) DEFAULT 20.00,
  budget_decrease_pct numeric(5,2) DEFAULT 30.00,
  min_spend_to_evaluate numeric(12,2) DEFAULT 20.00,
  min_impressions_to_evaluate integer DEFAULT 500,
  max_cpa_multiplier numeric(5,2) DEFAULT 2.0,
  pixel_id text,
  page_id text,
  auto_pause_enabled boolean DEFAULT false,
  auto_boost_enabled boolean DEFAULT false,
  optimizer_enabled boolean DEFAULT false,
  updated_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE ads_optimization_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_read_ads_config" ON ads_optimization_config FOR SELECT TO anon USING (true);
CREATE POLICY "anon_update_ads_config" ON ads_optimization_config FOR UPDATE TO anon USING (true);
CREATE POLICY "auth_all_ads_config" ON ads_optimization_config FOR ALL TO authenticated USING (true);

-- Insert default config
INSERT INTO ads_optimization_config (id) VALUES (gen_random_uuid());
