-- ============================================================
-- UTM Email Captures — rastreia cadastros com atribuição UTM
-- ============================================================

CREATE TABLE IF NOT EXISTS utm_email_captures (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email        TEXT NOT NULL,
  utm_source   TEXT,
  utm_medium   TEXT,
  utm_campaign TEXT,
  utm_content  TEXT,
  utm_term     TEXT,
  ref          TEXT,
  page_url     TEXT,
  captured_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Index para agrupar por campanha/source
CREATE INDEX IF NOT EXISTS idx_utm_captures_source   ON utm_email_captures(utm_source);
CREATE INDEX IF NOT EXISTS idx_utm_captures_campaign ON utm_email_captures(utm_campaign);
CREATE INDEX IF NOT EXISTS idx_utm_captures_email    ON utm_email_captures(email);
CREATE INDEX IF NOT EXISTS idx_utm_captures_date     ON utm_email_captures(captured_at);

-- Anon pode inserir (visitantes não autenticados)
ALTER TABLE utm_email_captures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_insert_utm_captures" ON utm_email_captures
  FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "auth_select_utm_captures" ON utm_email_captures
  FOR SELECT TO authenticated USING (true);
