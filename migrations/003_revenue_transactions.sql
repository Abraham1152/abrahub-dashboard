-- =============================================
-- ABRAhub Dashboard - Revenue Transactions Table
-- Run this in Supabase SQL Editor
-- =============================================

-- Individual revenue transactions for granular breakdowns
CREATE TABLE IF NOT EXISTS revenue_transactions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  date date NOT NULL,
  source text NOT NULL CHECK (source IN ('stripe', 'kiwify')),
  transaction_id text UNIQUE NOT NULL,
  product_name text,
  amount numeric(10,2) NOT NULL DEFAULT 0,
  type text NOT NULL DEFAULT 'one_time' CHECK (type IN ('recurring', 'annual', 'one_time')),
  status text NOT NULL DEFAULT 'paid',
  customer_email text,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- Indexes for fast querying
CREATE INDEX IF NOT EXISTS idx_rev_tx_date ON revenue_transactions(date);
CREATE INDEX IF NOT EXISTS idx_rev_tx_source ON revenue_transactions(source);
CREATE INDEX IF NOT EXISTS idx_rev_tx_type ON revenue_transactions(type);
CREATE INDEX IF NOT EXISTS idx_rev_tx_product ON revenue_transactions(product_name);
CREATE INDEX IF NOT EXISTS idx_rev_tx_date_source ON revenue_transactions(date, source);

-- RLS
ALTER TABLE revenue_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view revenue_transactions"
  ON revenue_transactions FOR SELECT
  TO authenticated
  USING (true);
