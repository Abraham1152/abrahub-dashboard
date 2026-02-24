-- Add authenticated role policies for ai_knowledge_base
CREATE POLICY "auth_read_knowledge" ON ai_knowledge_base FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_insert_knowledge" ON ai_knowledge_base FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_delete_knowledge" ON ai_knowledge_base FOR DELETE TO authenticated USING (true);
