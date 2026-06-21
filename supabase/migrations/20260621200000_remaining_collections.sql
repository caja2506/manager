-- ══════════════════════════════════════════════════════════════
-- AutoBOM Pro — Remaining Operational Tables (Firestore Migration)
-- Migration: 20260621200000_remaining_collections.sql
-- Date: 2026-06-21
-- ══════════════════════════════════════════════════════════════

-- 1. OPERATION INCIDENTS
CREATE TABLE IF NOT EXISTS operation_incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id TEXT REFERENCES tasks(id) ON DELETE SET NULL,
  reported_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  description TEXT NOT NULL,
  severity TEXT DEFAULT 'warning',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. OPERATIONAL RISK FLAGS
CREATE TABLE IF NOT EXISTS operational_risk_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kpi_name TEXT NOT NULL,
  value NUMERIC NOT NULL,
  threshold NUMERIC NOT NULL,
  severity TEXT NOT NULL,
  is_deteriorating BOOLEAN DEFAULT false,
  justification TEXT NOT NULL,
  suggested_action TEXT NOT NULL,
  scope TEXT NOT NULL DEFAULT 'global', -- 'global', 'user', 'routine', 'role'
  entity_id TEXT NOT NULL DEFAULT 'global',
  period_start TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_risk_flags_period ON operational_risk_flags(period_start);
CREATE INDEX IF NOT EXISTS idx_risk_flags_severity ON operational_risk_flags(severity);

-- 3. OPERATIONAL RECOMMENDATIONS
CREATE TABLE IF NOT EXISTS operational_recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL,
  priority TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  metric_backing TEXT,
  suggested_actions TEXT[] DEFAULT '{}',
  scope TEXT NOT NULL DEFAULT 'global',
  entity_id TEXT NOT NULL DEFAULT 'global',
  period_start TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_recs_period ON operational_recommendations(period_start);

-- 4. ANALYTICS REFRESH LOGS
CREATE TABLE IF NOT EXISTS analytics_refresh_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period_type TEXT NOT NULL,
  period_start TEXT NOT NULL,
  period_end TEXT NOT NULL,
  completed_at TIMESTAMPTZ DEFAULT now(),
  latency_ms INTEGER DEFAULT 0,
  snapshot_writes INTEGER DEFAULT 0,
  risk_flags_generated INTEGER DEFAULT 0,
  recommendations_generated INTEGER DEFAULT 0,
  trend_summary JSONB DEFAULT '{}'::jsonb,
  scorecard_count INTEGER DEFAULT 0,
  data_counts JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 5. MANAGEMENT EXECUTIVE BRIEFS
CREATE TABLE IF NOT EXISTS management_briefs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL DEFAULT 'weekly',
  generated_by TEXT NOT NULL DEFAULT 'gemini',
  model TEXT,
  content JSONB DEFAULT '{}'::jsonb,
  snapshot_data JSONB DEFAULT '{}'::jsonb,
  week_of TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 6. OPTIMIZATION HISTORY
CREATE TABLE IF NOT EXISTS optimization_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT now(),
  period_type TEXT NOT NULL,
  data_counts JSONB DEFAULT '{}'::jsonb,
  workloads JSONB DEFAULT '{}'::jsonb,
  bottlenecks JSONB DEFAULT '{}'::jsonb,
  recommendations JSONB DEFAULT '{}'::jsonb,
  score NUMERIC DEFAULT 0,
  latency_ms INTEGER DEFAULT 0
);

-- Enable RLS on all tables
ALTER TABLE operation_incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE operational_risk_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE operational_recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_refresh_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE management_briefs ENABLE ROW LEVEL SECURITY;
ALTER TABLE optimization_history ENABLE ROW LEVEL SECURITY;

-- Create RLS Policies
CREATE POLICY "Allow authenticated read for operation_incidents" ON operation_incidents FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Allow editors write for operation_incidents" ON operation_incidents FOR ALL USING (is_editor());

CREATE POLICY "Allow authenticated read for operational_risk_flags" ON operational_risk_flags FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Allow editors write for operational_risk_flags" ON operational_risk_flags FOR ALL USING (is_editor());

CREATE POLICY "Allow authenticated read for operational_recommendations" ON operational_recommendations FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Allow editors write for operational_recommendations" ON operational_recommendations FOR ALL USING (is_editor());

CREATE POLICY "Allow authenticated read for analytics_refresh_logs" ON analytics_refresh_logs FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Allow editors write for analytics_refresh_logs" ON analytics_refresh_logs FOR ALL USING (is_editor());

CREATE POLICY "Allow authenticated read for management_briefs" ON management_briefs FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Allow editors write for management_briefs" ON management_briefs FOR ALL USING (is_editor());

CREATE POLICY "Allow authenticated read for optimization_history" ON optimization_history FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Allow editors write for optimization_history" ON optimization_history FOR ALL USING (is_editor());

-- Enable Realtime for the tables that require UI subscription
ALTER PUBLICATION supabase_realtime ADD TABLE public.operation_incidents;
ALTER PUBLICATION supabase_realtime ADD TABLE public.operational_risk_flags;
ALTER PUBLICATION supabase_realtime ADD TABLE public.operational_recommendations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.analytics_refresh_logs;
ALTER PUBLICATION supabase_realtime ADD TABLE public.management_briefs;
ALTER PUBLICATION supabase_realtime ADD TABLE public.optimization_history;
