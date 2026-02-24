-- 1. Drop ALL existing check constraints on status column FIRST
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'tasks'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) LIKE '%status%'
  LOOP
    EXECUTE format('ALTER TABLE tasks DROP CONSTRAINT %I', r.conname);
  END LOOP;
END $$;

-- 2. Migrate old statuses to new ones (now unconstrained)
UPDATE tasks SET status = 'todo' WHERE status = 'in_progress';
UPDATE tasks SET status = 'doing' WHERE status = 'review';

-- 3. Add new check constraint with new statuses
ALTER TABLE tasks ADD CONSTRAINT tasks_status_check
  CHECK (status IN ('backlog', 'todo', 'doing', 'blocked', 'done'));

-- 4. Add position column for manual ordering within columns
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS position integer DEFAULT 0;

-- Set initial positions based on creation order
WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY assigned_to, status ORDER BY created_at) as rn
  FROM tasks
)
UPDATE tasks SET position = ranked.rn FROM ranked WHERE tasks.id = ranked.id;

-- 5. Create meetings table for agenda
CREATE TABLE IF NOT EXISTS meetings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  meeting_date date NOT NULL,
  meeting_time time NOT NULL,
  duration_minutes integer DEFAULT 60,
  location text,
  created_by text,
  created_at timestamptz DEFAULT now()
);

-- 6. Create meeting participants table
CREATE TABLE IF NOT EXISTS meeting_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id uuid NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  participant_name text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(meeting_id, participant_name)
);

-- RLS for meetings
ALTER TABLE meetings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "meetings_auth_all" ON meetings;
CREATE POLICY "meetings_auth_all" ON meetings FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "meetings_anon_all" ON meetings;
CREATE POLICY "meetings_anon_all" ON meetings FOR ALL TO anon USING (true) WITH CHECK (true);

-- RLS for meeting_participants
ALTER TABLE meeting_participants ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "mp_auth_all" ON meeting_participants;
CREATE POLICY "mp_auth_all" ON meeting_participants FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "mp_anon_all" ON meeting_participants;
CREATE POLICY "mp_anon_all" ON meeting_participants FOR ALL TO anon USING (true) WITH CHECK (true);
