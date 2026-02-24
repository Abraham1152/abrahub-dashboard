-- Fix RLS: allow anon to read revenue_transactions (dashboard uses anon key)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'revenue_transactions' AND policyname = 'Anon users can view revenue_transactions'
  ) THEN
    CREATE POLICY "Anon users can view revenue_transactions"
      ON revenue_transactions FOR SELECT
      TO anon
      USING (true);
  END IF;
END $$;
