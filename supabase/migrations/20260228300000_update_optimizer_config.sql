-- =============================================
-- Update Optimizer Config with ABRAhub Strategy Targets
-- =============================================

UPDATE ads_optimization_config SET
  target_cpa = 100.00,
  min_roas = 2.00,
  max_cpa_multiplier = 3.00,
  min_daily_budget = 30.00,
  max_daily_budget = 53.00,
  budget_increase_pct = 20.00,
  budget_decrease_pct = 30.00,
  approval_mode_enabled = true,
  updated_at = now();
