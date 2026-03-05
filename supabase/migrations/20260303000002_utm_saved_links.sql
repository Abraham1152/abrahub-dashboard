-- ============================================================
-- UTM Builder — Shared saved links and products (team-wide)
-- ============================================================

CREATE TABLE IF NOT EXISTS utm_saved_products (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label       TEXT NOT NULL,
  url         TEXT NOT NULL,
  platform    TEXT NOT NULL DEFAULT 'other',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS utm_saved_links (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label       TEXT NOT NULL,
  url         TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- RLS: any authenticated user can read/write/delete (shared team library)
ALTER TABLE utm_saved_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE utm_saved_links    ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_all_utm_saved_products" ON utm_saved_products
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "auth_all_utm_saved_links" ON utm_saved_links
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
