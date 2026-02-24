-- Enable Realtime for revenue and financial tables
ALTER PUBLICATION supabase_realtime ADD TABLE revenue_transactions;
ALTER PUBLICATION supabase_realtime ADD TABLE financial_daily;
ALTER PUBLICATION supabase_realtime ADD TABLE ads_campaigns;
ALTER PUBLICATION supabase_realtime ADD TABLE ads_daily;
