-- ============================================
-- Human Agent: Atendente IA para Instagram DMs
-- ============================================

-- Configuracao do agente IA (singleton)
CREATE TABLE human_agent_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  is_active boolean DEFAULT false,
  agent_name text DEFAULT 'Assistente ABRAhub',
  system_prompt text DEFAULT 'Voce e um assistente virtual da ABRAhub Studio. Responda de forma amigavel, profissional e objetiva. Use as informacoes da base de conhecimento para responder. Se nao souber a resposta, diga que vai encaminhar para um atendente humano.',
  knowledge_base text DEFAULT '',
  max_history_messages integer DEFAULT 10,
  gemini_model text DEFAULT 'gemini-2.0-flash',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Conversas (uma thread por usuario do Instagram)
CREATE TABLE human_agent_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ig_user_id text UNIQUE NOT NULL,
  ig_username text,
  status text DEFAULT 'active',
  messages_count integer DEFAULT 0,
  last_message_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- Mensagens individuais (incoming e outgoing)
CREATE TABLE human_agent_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid REFERENCES human_agent_conversations(id) ON DELETE CASCADE,
  ig_user_id text NOT NULL,
  direction text NOT NULL,
  message_text text NOT NULL,
  ig_message_id text,
  status text DEFAULT 'sent',
  error_message text,
  created_at timestamptz DEFAULT now()
);

-- Inserir config padrao
INSERT INTO human_agent_config (id) VALUES (gen_random_uuid());

-- RLS
ALTER TABLE human_agent_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE human_agent_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE human_agent_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_agent_config" ON human_agent_config FOR ALL TO authenticated USING (true);
CREATE POLICY "auth_agent_convos" ON human_agent_conversations FOR ALL TO authenticated USING (true);
CREATE POLICY "auth_agent_msgs" ON human_agent_messages FOR ALL TO authenticated USING (true);

-- Indices
CREATE INDEX idx_agent_msgs_convo ON human_agent_messages(conversation_id);
CREATE INDEX idx_agent_msgs_user ON human_agent_messages(ig_user_id);
CREATE INDEX idx_agent_convos_user ON human_agent_conversations(ig_user_id);
CREATE INDEX idx_agent_msgs_created ON human_agent_messages(created_at);
