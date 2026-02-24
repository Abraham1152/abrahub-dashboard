-- Add done_at column to track when a task was marked as done
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS done_at timestamptz;

-- Set done_at for existing done tasks (use created_at as fallback)
UPDATE tasks SET done_at = now() WHERE status = 'done' AND done_at IS NULL;
