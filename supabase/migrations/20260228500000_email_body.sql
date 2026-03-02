-- Add email_body column to store the original received email content
ALTER TABLE email_tasks ADD COLUMN IF NOT EXISTS email_body TEXT DEFAULT '';
