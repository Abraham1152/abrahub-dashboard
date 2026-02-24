-- Add anon read policies for systeme tables

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'systeme_tags' AND policyname = 'Anon can view systeme_tags'
  ) THEN
    CREATE POLICY "Anon can view systeme_tags"
      ON systeme_tags FOR SELECT
      TO anon
      USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'systeme_contacts_daily' AND policyname = 'Anon can view systeme_contacts_daily'
  ) THEN
    CREATE POLICY "Anon can view systeme_contacts_daily"
      ON systeme_contacts_daily FOR SELECT
      TO anon
      USING (true);
  END IF;
END $$;
