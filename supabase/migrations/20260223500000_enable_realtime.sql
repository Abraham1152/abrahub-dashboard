-- Enable Realtime for human agent tables
ALTER PUBLICATION supabase_realtime ADD TABLE human_agent_conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE human_agent_messages;
