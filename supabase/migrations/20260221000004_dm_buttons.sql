-- Add dm_buttons column to instagram_automations
ALTER TABLE instagram_automations ADD COLUMN IF NOT EXISTS dm_buttons jsonb DEFAULT '[]'::jsonb;
