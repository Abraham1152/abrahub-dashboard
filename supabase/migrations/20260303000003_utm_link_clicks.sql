-- ============================================================
-- UTM Link Clicks — rastreia visitas com UTMs na landing page
-- ============================================================

CREATE TABLE IF NOT EXISTS utm_link_clicks (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  utm_source   TEXT,
  utm_medium   TEXT,
  utm_campaign TEXT,
  utm_content  TEXT,
  utm_term     TEXT,
  ref          TEXT,
  page_url     TEXT,
  clicked_at   TIMESTAMPTZ DEFAULT NOW()
);

-- Index para agrupar por campanha/source
CREATE INDEX IF NOT EXISTS idx_utm_clicks_source   ON utm_link_clicks(utm_source);
CREATE INDEX IF NOT EXISTS idx_utm_clicks_campaign ON utm_link_clicks(utm_campaign);
CREATE INDEX IF NOT EXISTS idx_utm_clicks_date     ON utm_link_clicks(clicked_at);

-- Anon pode inserir (visitantes da landing page não estão autenticados)
ALTER TABLE utm_link_clicks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_insert_utm_clicks" ON utm_link_clicks
  FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "auth_select_utm_clicks" ON utm_link_clicks
  FOR SELECT TO authenticated USING (true);
