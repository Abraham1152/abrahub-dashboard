-- Add AdSense revenue column to financial_daily
ALTER TABLE financial_daily ADD COLUMN IF NOT EXISTS revenue_adsense numeric DEFAULT 0;
