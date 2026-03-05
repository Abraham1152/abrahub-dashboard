-- =============================================
-- Ads Traffic Engine: Kill & Scale, Sandbox, Analytics
-- =============================================

-- 1. Add campaign management columns
ALTER TABLE ads_campaigns ADD COLUMN IF NOT EXISTS campaign_tag text DEFAULT 'untagged';
ALTER TABLE ads_campaigns ADD COLUMN IF NOT EXISTS creative_theme text;
ALTER TABLE ads_campaigns ADD COLUMN IF NOT EXISTS frequency numeric(8,2) DEFAULT 0;
ALTER TABLE ads_campaigns ADD COLUMN IF NOT EXISTS video_thumbstop_rate numeric(8,4) DEFAULT 0;
ALTER TABLE ads_campaigns ADD COLUMN IF NOT EXISTS post_id text;

-- 2. Add new optimizer config columns for kill & scale rules
ALTER TABLE ads_optimization_config ADD COLUMN IF NOT EXISTS kill_min_spend numeric(12,2) DEFAULT 20.00;
ALTER TABLE ads_optimization_config ADD COLUMN IF NOT EXISTS kill_min_ctr numeric(8,4) DEFAULT 0.5;
ALTER TABLE ads_optimization_config ADD COLUMN IF NOT EXISTS kill_max_frequency numeric(8,2) DEFAULT 4.0;
ALTER TABLE ads_optimization_config ADD COLUMN IF NOT EXISTS kill_frequency_days integer DEFAULT 7;
ALTER TABLE ads_optimization_config ADD COLUMN IF NOT EXISTS scale_increase_pct numeric(5,2) DEFAULT 20.00;
ALTER TABLE ads_optimization_config ADD COLUMN IF NOT EXISTS scale_interval_hours integer DEFAULT 48;
ALTER TABLE ads_optimization_config ADD COLUMN IF NOT EXISTS scale_max_cpa_pct numeric(5,2) DEFAULT 100;
ALTER TABLE ads_optimization_config ADD COLUMN IF NOT EXISTS sandbox_min_spend_pct numeric(5,2) DEFAULT 10;
ALTER TABLE ads_optimization_config ADD COLUMN IF NOT EXISTS sandbox_test_days integer DEFAULT 7;
ALTER TABLE ads_optimization_config ADD COLUMN IF NOT EXISTS approval_mode_enabled boolean DEFAULT true;

-- 3. Automation rules table (custom kill/scale rules)
CREATE TABLE IF NOT EXISTS ads_automation_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_type text NOT NULL CHECK (rule_type IN ('kill', 'scale')),
  name text NOT NULL,
  conditions jsonb NOT NULL DEFAULT '{}',
  action_config jsonb NOT NULL DEFAULT '{}',
  enabled boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE ads_automation_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_read_automation_rules" ON ads_automation_rules FOR SELECT TO anon USING (true);
CREATE POLICY "anon_write_automation_rules" ON ads_automation_rules FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon_update_automation_rules" ON ads_automation_rules FOR UPDATE TO anon USING (true);
CREATE POLICY "anon_delete_automation_rules" ON ads_automation_rules FOR DELETE TO anon USING (true);
CREATE POLICY "auth_all_automation_rules" ON ads_automation_rules FOR ALL TO authenticated USING (true);

-- 4. Automation execution log
CREATE TABLE IF NOT EXISTS ads_automation_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id uuid REFERENCES ads_automation_rules(id) ON DELETE SET NULL,
  rule_name text,
  rule_type text NOT NULL,
  campaign_id text NOT NULL,
  campaign_name text,
  action_taken text NOT NULL,
  details jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE ads_automation_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_read_automation_log" ON ads_automation_log FOR SELECT TO anon USING (true);
CREATE POLICY "anon_insert_automation_log" ON ads_automation_log FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "auth_all_automation_log" ON ads_automation_log FOR ALL TO authenticated USING (true);

-- 5. Insert default kill & scale rules
INSERT INTO ads_automation_rules (rule_type, name, conditions, action_config) VALUES
  ('kill', 'Low CTR Kill', '{"metric": "ctr", "operator": "<", "value": 0.5, "min_spend": 20}', '{"action": "pause", "reason": "CTR abaixo de 0.5% com gasto > R$20 - falha em capturar atenção"}'),
  ('kill', '2x CPA Zero Conv', '{"metric": "cpa_multiplier", "operator": ">", "value": 2, "min_conversions": 0}', '{"action": "pause", "reason": "Gasto > 2x CPA alvo sem conversões - queimando caixa"}'),
  ('kill', 'High Frequency', '{"metric": "frequency", "operator": ">", "value": 4, "period_days": 7}', '{"action": "pause", "reason": "Frequência > 4 em 7 dias para público frio - fadiga criativa"}'),
  ('scale', 'Winner Scale 20%', '{"metric": "cpa", "operator": "<", "value_ref": "target_cpa", "min_conversions": 3, "min_days_active": 4}', '{"action": "increase_budget", "pct": 20, "interval_hours": 48, "reason": "CPA abaixo do alvo com 3+ conversões - escalando 20%"}'),
  ('scale', 'High ROAS Scale', '{"metric": "roas", "operator": ">", "value": 3, "min_spend": 50}', '{"action": "increase_budget", "pct": 30, "interval_hours": 72, "reason": "ROAS > 3x com gasto significativo - escalando 30%"}');

-- 6. Business metrics table (MER, NC%, phantom growth tracking)
CREATE TABLE IF NOT EXISTS ads_business_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date date NOT NULL UNIQUE,
  total_revenue numeric(14,2) DEFAULT 0,
  total_ad_spend numeric(14,2) DEFAULT 0,
  mer numeric(8,4) DEFAULT 0,
  new_customers integer DEFAULT 0,
  returning_customers integer DEFAULT 0,
  nc_percentage numeric(8,2) DEFAULT 0,
  nc_revenue numeric(14,2) DEFAULT 0,
  nc_roas numeric(8,4) DEFAULT 0,
  avg_order_value numeric(12,2) DEFAULT 0,
  avg_order_value_new numeric(12,2) DEFAULT 0,
  avg_order_value_returning numeric(12,2) DEFAULT 0,
  phantom_growth_alert boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE ads_business_metrics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_read_business_metrics" ON ads_business_metrics FOR SELECT TO anon USING (true);
CREATE POLICY "anon_insert_business_metrics" ON ads_business_metrics FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "auth_all_business_metrics" ON ads_business_metrics FOR ALL TO authenticated USING (true);
