-- Knowledge base for AI consultant
CREATE TABLE IF NOT EXISTS ai_knowledge_base (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  content text NOT NULL,
  char_count integer GENERATED ALWAYS AS (length(content)) STORED,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE ai_knowledge_base ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_read_knowledge" ON ai_knowledge_base FOR SELECT TO anon USING (true);
CREATE POLICY "anon_insert_knowledge" ON ai_knowledge_base FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon_delete_knowledge" ON ai_knowledge_base FOR DELETE TO anon USING (true);
