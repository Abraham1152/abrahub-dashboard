-- Fix tasks table for Kanban board
-- Drop ALL existing policies first, then alter column, then recreate

-- Drop all existing policies on tasks table
DROP POLICY IF EXISTS "Assigned user or creator can update task" ON tasks;
DROP POLICY IF EXISTS "Admin or assigned can delete tasks" ON tasks;
DROP POLICY IF EXISTS "All can view tasks" ON tasks;
DROP POLICY IF EXISTS "All can insert tasks" ON tasks;
DROP POLICY IF EXISTS "Admin can insert tasks" ON tasks;
DROP POLICY IF EXISTS "Admin can delete tasks" ON tasks;

-- Drop foreign key and change assigned_to to TEXT
ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_assigned_to_fkey;
ALTER TABLE tasks ALTER COLUMN assigned_to TYPE TEXT USING assigned_to::TEXT;

-- Recreate all policies for authenticated
CREATE POLICY "Authenticated can view tasks" ON tasks
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated can insert tasks" ON tasks
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated can update tasks" ON tasks
  FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated can delete tasks" ON tasks
  FOR DELETE TO authenticated USING (true);

-- Anon policies
CREATE POLICY "Anon can view tasks" ON tasks
  FOR SELECT TO anon USING (true);

CREATE POLICY "Anon can insert tasks" ON tasks
  FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "Anon can update tasks" ON tasks
  FOR UPDATE TO anon USING (true);

CREATE POLICY "Anon can delete tasks" ON tasks
  FOR DELETE TO anon USING (true);
