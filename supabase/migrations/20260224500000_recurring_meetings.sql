-- Add recurring_weekly flag to meetings
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS recurring_weekly boolean DEFAULT false;
