-- Email Agent tables
CREATE TABLE IF NOT EXISTS email_tasks (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at timestamptz DEFAULT now(),
  email_from text NOT NULL,
  email_subject text NOT NULL,
  tipo text NOT NULL,
  description text,
  email_sent text,
  precisa_acao boolean DEFAULT false,
  status text DEFAULT 'pending'
);

CREATE TABLE IF NOT EXISTS email_feedbacks (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at timestamptz DEFAULT now(),
  email_from text NOT NULL,
  motivo text,
  feedback text NOT NULL
);

ALTER TABLE email_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_feedbacks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read email_tasks" ON email_tasks FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert email_tasks" ON email_tasks FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update email_tasks" ON email_tasks FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Service role full access email_tasks" ON email_tasks FOR ALL TO service_role USING (true);

CREATE POLICY "Authenticated users can read email_feedbacks" ON email_feedbacks FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert email_feedbacks" ON email_feedbacks FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Service role full access email_feedbacks" ON email_feedbacks FOR ALL TO service_role USING (true);
