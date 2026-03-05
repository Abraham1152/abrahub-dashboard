-- ============================================================
-- UTM Tracking — Add attribution columns to instagram_leads
-- ============================================================

ALTER TABLE instagram_leads
  ADD COLUMN IF NOT EXISTS utm_source   TEXT,
  ADD COLUMN IF NOT EXISTS utm_medium   TEXT,
  ADD COLUMN IF NOT EXISTS utm_campaign TEXT,
  ADD COLUMN IF NOT EXISTS utm_term     TEXT,
  ADD COLUMN IF NOT EXISTS utm_content  TEXT,
  ADD COLUMN IF NOT EXISTS utm_ref      TEXT;

-- Index for filtering/grouping by source
CREATE INDEX IF NOT EXISTS idx_instagram_leads_utm_source ON instagram_leads(utm_source);
