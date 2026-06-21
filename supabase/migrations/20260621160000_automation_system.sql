-- ══════════════════════════════════════════════════════════════
-- AutoBOM Pro — Automation Operations & AI Governance Schema
-- Migration: 20260621160000_automation_system.sql
-- Date: 2026-06-21
-- ══════════════════════════════════════════════════════════════

-- 1. AI GOVERNANCE
CREATE TABLE IF NOT EXISTS ai_governance (
  capability TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL,
  constraints JSONB DEFAULT '{}'::jsonb,
  enabled BOOLEAN DEFAULT true,
  settings_flag TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. AI EXECUTIONS LOG
CREATE TABLE IF NOT EXISTS ai_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feature_type TEXT NOT NULL,
  source_type TEXT NOT NULL,
  status TEXT DEFAULT 'success',
  latency_ms INTEGER DEFAULT 0,
  confidence_score NUMERIC DEFAULT 1.0,
  confidence_action TEXT,
  input_tokens INTEGER DEFAULT 0,
  output_tokens INTEGER DEFAULT 0,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_executions_feature ON ai_executions(feature_type);
CREATE INDEX IF NOT EXISTS idx_ai_executions_created ON ai_executions(created_at DESC);

-- 3. AUTOMATION ROUTINES
CREATE TABLE IF NOT EXISTS automation_routines (
  key TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  enabled BOOLEAN DEFAULT true,
  dry_run BOOLEAN DEFAULT false,
  debug_mode BOOLEAN DEFAULT false,
  allowed_roles TEXT[] DEFAULT '{}',
  channel TEXT,
  provider TEXT,
  schedule_type TEXT,
  delay_minutes INTEGER DEFAULT 0,
  grace_period_minutes INTEGER DEFAULT 0,
  personality_mode TEXT,
  priority TEXT,
  last_run_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 4. AUTOMATION RUN LOGS
CREATE TABLE IF NOT EXISTS automation_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  routine_key TEXT NOT NULL REFERENCES automation_routines(key) ON DELETE CASCADE,
  status TEXT DEFAULT 'completed',
  triggered_by TEXT DEFAULT 'system',
  started_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  duration_ms INTEGER DEFAULT 0,
  error_message TEXT,
  details JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_automation_runs_routine ON automation_runs(routine_key);
CREATE INDEX IF NOT EXISTS idx_automation_runs_created ON automation_runs(created_at DESC);

-- 5. DAILY AUTOMATION METRICS
CREATE TABLE IF NOT EXISTS automation_metrics_daily (
  id TEXT PRIMARY KEY, -- deterministic YYYY-MM-DD
  date DATE NOT NULL UNIQUE,
  total_executions INTEGER DEFAULT 0,
  successful_executions INTEGER DEFAULT 0,
  failed_executions INTEGER DEFAULT 0,
  avg_latency_ms INTEGER DEFAULT 0,
  details JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 6. TELEGRAM DELIVERIES LOG
CREATE TABLE IF NOT EXISTS telegram_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id TEXT,
  user_id TEXT REFERENCES users(id),
  message_type TEXT,
  message_preview TEXT,
  status TEXT DEFAULT 'success',
  error_message TEXT,
  sent_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tg_deliveries_chat ON telegram_deliveries(chat_id);
CREATE INDEX IF NOT EXISTS idx_tg_deliveries_created ON telegram_deliveries(created_at DESC);

-- 7. TELEGRAM BOT SESSIONS
CREATE TABLE IF NOT EXISTS telegram_sessions (
  chat_id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id),
  username TEXT,
  first_name TEXT,
  last_name TEXT,
  step TEXT,
  state_data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 8. TELEGRAM LINK CODES
CREATE TABLE IF NOT EXISTS telegram_link_codes (
  code TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  email TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 9. TELEGRAM REPORTS
CREATE TABLE IF NOT EXISTS telegram_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES users(id),
  report_type TEXT NOT NULL,
  content TEXT NOT NULL,
  sent_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 10. TELEGRAM ESCALATIONS
CREATE TABLE IF NOT EXISTS telegram_escalations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id TEXT REFERENCES projects(id) ON DELETE CASCADE,
  task_id TEXT REFERENCES tasks(id) ON DELETE CASCADE,
  reason TEXT,
  escalated_to TEXT,
  resolved BOOLEAN DEFAULT false,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 11. TELEGRAM BOT LOGS
CREATE TABLE IF NOT EXISTS telegram_bot_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  level TEXT DEFAULT 'info',
  message TEXT NOT NULL,
  details JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Triggers for updated_at fields
CREATE TRIGGER trg_ai_governance_updated_at BEFORE UPDATE ON ai_governance FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_automation_routines_updated_at BEFORE UPDATE ON automation_routines FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_telegram_sessions_updated_at BEFORE UPDATE ON telegram_sessions FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Enable RLS on all tables
ALTER TABLE ai_governance ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_routines ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_metrics_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE telegram_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE telegram_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE telegram_link_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE telegram_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE telegram_escalations ENABLE ROW LEVEL SECURITY;
ALTER TABLE telegram_bot_logs ENABLE ROW LEVEL SECURITY;

-- Create basic RLS policies (allow authenticated read, editors read/write)
-- Note: is_editor() is defined in 002_task_module_rls.sql

CREATE POLICY "Allow authenticated read for ai_governance" ON ai_governance FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Allow editors write for ai_governance" ON ai_governance FOR ALL USING (is_editor());

CREATE POLICY "Allow authenticated read for ai_executions" ON ai_executions FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Allow editors write for ai_executions" ON ai_executions FOR ALL USING (is_editor());

CREATE POLICY "Allow authenticated read for automation_routines" ON automation_routines FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Allow editors write for automation_routines" ON automation_routines FOR ALL USING (is_editor());

CREATE POLICY "Allow authenticated read for automation_runs" ON automation_runs FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Allow editors write for automation_runs" ON automation_runs FOR ALL USING (is_editor());

CREATE POLICY "Allow authenticated read for automation_metrics_daily" ON automation_metrics_daily FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Allow editors write for automation_metrics_daily" ON automation_metrics_daily FOR ALL USING (is_editor());

CREATE POLICY "Allow authenticated read for telegram_deliveries" ON telegram_deliveries FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Allow editors write for telegram_deliveries" ON telegram_deliveries FOR ALL USING (is_editor());

CREATE POLICY "Allow authenticated read for telegram_sessions" ON telegram_sessions FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Allow editors write for telegram_sessions" ON telegram_sessions FOR ALL USING (is_editor());

CREATE POLICY "Allow authenticated read for telegram_link_codes" ON telegram_link_codes FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Allow editors write for telegram_link_codes" ON telegram_link_codes FOR ALL USING (is_editor());

CREATE POLICY "Allow authenticated read for telegram_reports" ON telegram_reports FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Allow editors write for telegram_reports" ON telegram_reports FOR ALL USING (is_editor());

CREATE POLICY "Allow authenticated read for telegram_escalations" ON telegram_escalations FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Allow editors write for telegram_escalations" ON telegram_escalations FOR ALL USING (is_editor());

CREATE POLICY "Allow authenticated read for telegram_bot_logs" ON telegram_bot_logs FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Allow editors write for telegram_bot_logs" ON telegram_bot_logs FOR ALL USING (is_editor());

-- Enable Realtime for the tables that require UI subscription
ALTER PUBLICATION supabase_realtime ADD TABLE public.ai_governance;
ALTER PUBLICATION supabase_realtime ADD TABLE public.ai_executions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.automation_routines;
ALTER PUBLICATION supabase_realtime ADD TABLE public.automation_runs;
ALTER PUBLICATION supabase_realtime ADD TABLE public.automation_metrics_daily;
ALTER PUBLICATION supabase_realtime ADD TABLE public.telegram_deliveries;
