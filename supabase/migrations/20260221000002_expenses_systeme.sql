-- =============================================
-- Monthly Expenses (editable spreadsheet)
-- =============================================
CREATE TABLE IF NOT EXISTS monthly_expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  month text NOT NULL,              -- '2026-02'
  name text NOT NULL,
  description text,
  category text DEFAULT 'tool',     -- 'tool', 'salary', 'tax', 'prolabore', 'other'
  price_usd numeric(10,2),
  price_brl numeric(10,2) NOT NULL DEFAULT 0,
  responsible text,                 -- 'Rodrigo', 'Monge', 'Zanella', 'Atlas', etc.
  is_recurring boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(month, name)
);

CREATE INDEX IF NOT EXISTS idx_expenses_month ON monthly_expenses(month);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON monthly_expenses(category);

ALTER TABLE monthly_expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth users can view expenses" ON monthly_expenses FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth users can insert expenses" ON monthly_expenses FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth users can update expenses" ON monthly_expenses FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Auth users can delete expenses" ON monthly_expenses FOR DELETE TO authenticated USING (true);

-- =============================================
-- Systeme.io Tags (cached)
-- =============================================
CREATE TABLE IF NOT EXISTS systeme_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tag_id bigint UNIQUE NOT NULL,
  name text NOT NULL,
  contact_count int DEFAULT 0,
  last_synced_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE systeme_tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth users can view systeme_tags" ON systeme_tags FOR SELECT TO authenticated USING (true);

-- =============================================
-- Systeme.io Contacts Daily Snapshot
-- =============================================
CREATE TABLE IF NOT EXISTS systeme_contacts_daily (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date date NOT NULL,
  total_contacts int DEFAULT 0,
  new_contacts int DEFAULT 0,
  tag_breakdown jsonb DEFAULT '{}',  -- { "tag_name": count, ... }
  created_at timestamptz DEFAULT now(),
  UNIQUE(date)
);

ALTER TABLE systeme_contacts_daily ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth users can view systeme_contacts_daily" ON systeme_contacts_daily FOR SELECT TO authenticated USING (true);
