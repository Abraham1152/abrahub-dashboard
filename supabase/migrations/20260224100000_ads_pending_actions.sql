-- =============================================
-- ABRAhub Dashboard - AI Approval Cards (Phase 1)
-- Ads Pending Actions table for human-in-the-loop
-- =============================================

CREATE TABLE ads_pending_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id text NOT NULL,
  campaign_name text NOT NULL,
  action_type text NOT NULL CHECK (action_type IN ('pause', 'boost', 'adjust_budget')),
  ai_reasoning text NOT NULL,
  current_metrics jsonb DEFAULT '{}',
  proposed_changes jsonb DEFAULT '{}',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  resolved_at timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE ads_pending_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_read_pending" ON ads_pending_actions FOR SELECT TO anon USING (true);
CREATE POLICY "anon_insert_pending" ON ads_pending_actions FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon_update_pending" ON ads_pending_actions FOR UPDATE TO anon USING (true);
CREATE POLICY "auth_all_pending" ON ads_pending_actions FOR ALL TO authenticated USING (true);

-- Add approval_mode column to optimization config
ALTER TABLE ads_optimization_config ADD COLUMN IF NOT EXISTS approval_mode_enabled boolean DEFAULT true;
