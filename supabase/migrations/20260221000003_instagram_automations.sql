-- Instagram Automation tables for Insta Ninja feature

CREATE TABLE IF NOT EXISTS instagram_automations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  media_id text NOT NULL,
  media_permalink text,
  media_caption text,
  media_thumbnail text,
  is_active boolean DEFAULT true,
  keywords text[] NOT NULL DEFAULT '{}',
  reply_comments text[] DEFAULT '{}',
  dm_message text,
  dm_link text,
  respond_to_all boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS instagram_processed_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id text UNIQUE NOT NULL,
  automation_id uuid REFERENCES instagram_automations(id) ON DELETE CASCADE,
  commenter_username text,
  comment_text text,
  action_taken text,
  status text DEFAULT 'success',
  error_message text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE instagram_automations ENABLE ROW LEVEL SECURITY;
ALTER TABLE instagram_processed_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_all_automations" ON instagram_automations FOR ALL TO authenticated USING (true);
CREATE POLICY "auth_all_processed" ON instagram_processed_comments FOR ALL TO authenticated USING (true);
