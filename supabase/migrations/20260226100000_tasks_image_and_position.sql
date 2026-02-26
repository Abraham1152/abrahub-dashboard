-- Add image_url column to tasks for screenshot attachments
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS image_url text;

-- Change position to real to support fractional positions for card-level drag sorting
ALTER TABLE tasks ALTER COLUMN position TYPE real;
