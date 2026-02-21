-- Users Table
CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  full_name TEXT,
  role TEXT CHECK (role IN ('admin', 'partner')) DEFAULT 'partner',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tasks (Kanban Board)
CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  status TEXT CHECK (status IN ('backlog', 'in_progress', 'review', 'done')) DEFAULT 'backlog',
  assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
  priority TEXT CHECK (priority IN ('low', 'medium', 'high')) DEFAULT 'medium',
  due_date DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Task Comments
CREATE TABLE task_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  comment TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Financial Daily Records
CREATE TABLE financial_daily (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  revenue_stripe DECIMAL(10, 2) DEFAULT 0,
  revenue_kiwify DECIMAL(10, 2) DEFAULT 0,
  refunds DECIMAL(10, 2) DEFAULT 0,
  fees DECIMAL(10, 2) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(date)
);

-- Financial Snapshot (Monthly Summary)
CREATE TABLE financial_snapshot (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  year_month TEXT NOT NULL,
  total_revenue DECIMAL(12, 2),
  stripe_revenue DECIMAL(12, 2),
  kiwify_revenue DECIMAL(12, 2),
  total_refunds DECIMAL(12, 2),
  net_revenue DECIMAL(12, 2),
  ticket_average DECIMAL(10, 2),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(year_month)
);

-- Churn Metrics
CREATE TABLE churn_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  total_customers INT,
  new_customers INT,
  churned_customers INT,
  churn_percentage DECIMAL(5, 2),
  ltv_estimated DECIMAL(12, 2),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(date)
);

-- Alerts System
CREATE TABLE alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_type TEXT NOT NULL,
  severity TEXT CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  title TEXT NOT NULL,
  message TEXT,
  triggered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  resolved_at TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN DEFAULT TRUE
);

-- Decisions Log (Strategic Decisions)
CREATE TABLE decisions_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  decision TEXT NOT NULL,
  reason TEXT,
  decided_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  decided_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  result_observed TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- OKRs (Quarterly Objectives)
CREATE TABLE okrs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quarter TEXT NOT NULL,
  category TEXT CHECK (category IN ('revenue', 'growth', 'product', 'operations')),
  title TEXT NOT NULL,
  target_value DECIMAL(12, 2),
  current_value DECIMAL(12, 2) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Documents Management
CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  folder_name TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size INT,
  uploaded_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Stripe Events Log
CREATE TABLE stripe_events_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id TEXT NOT NULL UNIQUE,
  event_type TEXT NOT NULL,
  data JSONB,
  processed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Kiwify Events Log
CREATE TABLE kiwify_events_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id TEXT NOT NULL UNIQUE,
  event_type TEXT NOT NULL,
  data JSONB,
  processed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Row Level Security (RLS)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE financial_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE decisions_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE okrs ENABLE ROW LEVEL SECURITY;

-- RLS Policies (Admin/Partner can view all, but can only modify their own tasks)
CREATE POLICY "Users can read all users" ON users
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admin can update all users" ON users
  FOR UPDATE USING (
    (SELECT role FROM users WHERE id = auth.uid()) = 'admin'
  );

CREATE POLICY "All can view tasks" ON tasks
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Assigned user or creator can update task" ON tasks
  FOR UPDATE USING (
    (SELECT role FROM users WHERE id = auth.uid()) = 'admin'
    OR assigned_to = auth.uid()
  );

CREATE POLICY "All can view financial data" ON financial_daily
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admin only can modify financial data" ON financial_daily
  FOR ALL USING ((SELECT role FROM users WHERE id = auth.uid()) = 'admin');
