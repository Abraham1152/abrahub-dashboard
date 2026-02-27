-- Instagram Leads table + upsert_lead RPC function
-- This table may already exist (created manually), so use IF NOT EXISTS

CREATE TABLE IF NOT EXISTS instagram_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username text NOT NULL,
  ig_user_id text,
  source text DEFAULT 'automation_comment' CHECK (source IN ('automation_comment', 'dm', 'manual')),
  source_automation_id uuid REFERENCES instagram_automations(id) ON DELETE SET NULL,
  temperature text DEFAULT 'warm' CHECK (temperature IN ('hot', 'warm', 'cold')),
  temperature_override boolean DEFAULT false,
  status text DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'negotiating', 'converted', 'lost')),
  interaction_count integer DEFAULT 1,
  first_interaction_at timestamptz DEFAULT now(),
  last_interaction_at timestamptz DEFAULT now(),
  tags text[] DEFAULT '{}',
  notes text,
  customer_email text,
  tracked_link_sent boolean DEFAULT false,
  tracked_product_id uuid REFERENCES products(id) ON DELETE SET NULL,
  converted_at timestamptz,
  conversion_value numeric(10,2),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Unique constraint on username (upsert key)
CREATE UNIQUE INDEX IF NOT EXISTS instagram_leads_username_idx ON instagram_leads(username);

-- RLS
ALTER TABLE instagram_leads ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'instagram_leads' AND policyname = 'auth_all_leads') THEN
    CREATE POLICY "auth_all_leads" ON instagram_leads FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'instagram_leads' AND policyname = 'service_all_leads') THEN
    CREATE POLICY "service_all_leads" ON instagram_leads FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

-- Drop existing function (may have different return type)
DROP FUNCTION IF EXISTS upsert_lead(text, text, text, uuid);
DROP FUNCTION IF EXISTS upsert_lead(text, text, text);
DROP FUNCTION IF EXISTS upsert_lead;

-- upsert_lead function: insert new lead or update existing one
-- Auto-classifies temperature based on interaction_count (when not overridden by AI)
-- Auto-sets status based on source (comment=new, dm=contacted)
CREATE OR REPLACE FUNCTION upsert_lead(
  p_username text,
  p_ig_user_id text DEFAULT NULL,
  p_source text DEFAULT 'automation_comment',
  p_source_automation_id uuid DEFAULT NULL
) RETURNS void AS $$
DECLARE
  v_new_count integer;
  v_new_temp text;
  v_current_status text;
BEGIN
  INSERT INTO instagram_leads (
    username, ig_user_id, source, source_automation_id,
    interaction_count, temperature, status,
    first_interaction_at, last_interaction_at
  )
  VALUES (
    p_username, p_ig_user_id, p_source, p_source_automation_id,
    1,
    'cold',  -- first interaction = cold
    CASE WHEN p_source = 'dm' THEN 'contacted' ELSE 'new' END,
    now(), now()
  )
  ON CONFLICT (username) DO UPDATE SET
    ig_user_id = COALESCE(EXCLUDED.ig_user_id, instagram_leads.ig_user_id),
    interaction_count = instagram_leads.interaction_count + 1,
    last_interaction_at = now(),
    updated_at = now()
  RETURNING interaction_count, status INTO v_new_count, v_current_status;

  -- Auto-classify temperature based on interaction count (only if AI hasn't overridden)
  IF v_new_count IS NOT NULL THEN
    IF v_new_count >= 4 THEN
      v_new_temp := 'hot';
    ELSIF v_new_count >= 2 THEN
      v_new_temp := 'warm';
    ELSE
      v_new_temp := 'cold';
    END IF;

    UPDATE instagram_leads
    SET temperature = v_new_temp, updated_at = now()
    WHERE username = p_username
      AND temperature_override = false;

    -- Auto-upgrade status: new → contacted when DM interaction happens
    IF p_source = 'dm' AND v_current_status = 'new' THEN
      UPDATE instagram_leads
      SET status = 'contacted', updated_at = now()
      WHERE username = p_username;
    END IF;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
