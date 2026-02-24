-- 1. Products catalog table
CREATE TABLE IF NOT EXISTS products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  price_brl numeric(10,2) NOT NULL,
  payment_link text NOT NULL,
  payment_source text DEFAULT 'kiwify' CHECK (payment_source IN ('kiwify', 'stripe')),
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read products" ON products FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated write products" ON products FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access products" ON products FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 2. Add agent_type to human_agent_config
ALTER TABLE human_agent_config ADD COLUMN IF NOT EXISTS agent_type text DEFAULT 'support' CHECK (agent_type IN ('support', 'sales'));

-- 3. Add conversion tracking columns to instagram_leads
ALTER TABLE instagram_leads ADD COLUMN IF NOT EXISTS customer_email text;
ALTER TABLE instagram_leads ADD COLUMN IF NOT EXISTS tracked_link_sent boolean DEFAULT false;
ALTER TABLE instagram_leads ADD COLUMN IF NOT EXISTS tracked_product_id uuid REFERENCES products(id);
ALTER TABLE instagram_leads ADD COLUMN IF NOT EXISTS converted_at timestamptz;
ALTER TABLE instagram_leads ADD COLUMN IF NOT EXISTS conversion_value numeric(10,2);
