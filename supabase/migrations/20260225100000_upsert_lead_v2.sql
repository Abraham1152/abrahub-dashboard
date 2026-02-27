-- Update upsert_lead function with automatic temperature/status classification
-- Temperature rules: 1 interaction=cold, 2-3=warm, 4+=hot (only when AI hasn't overridden)
-- Status rules: comment=new, dm=contacted (don't downgrade negotiating/converted)

DROP FUNCTION IF EXISTS upsert_lead(text, text, text, uuid);

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
    'cold',
    CASE WHEN p_source = 'dm' THEN 'contacted' ELSE 'new' END,
    now(), now()
  )
  ON CONFLICT (username) DO UPDATE SET
    ig_user_id = COALESCE(EXCLUDED.ig_user_id, instagram_leads.ig_user_id),
    interaction_count = instagram_leads.interaction_count + 1,
    last_interaction_at = now(),
    updated_at = now()
  RETURNING interaction_count, status INTO v_new_count, v_current_status;

  -- Auto-classify temperature based on interaction count
  -- Only if AI hasn't manually overridden (temperature_override = false)
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
