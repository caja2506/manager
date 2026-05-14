-- ══════════════════════════════════════════════════════════════
-- AutoBOM Pro — Audit, Analytics & User Preferences
-- Migration: 011_audit_and_analytics.sql
-- Date: 2026-05-13
-- ══════════════════════════════════════════════════════════════
--
-- Creates missing tables for the audit/compliance system and
-- adds the 'theme' column to users for dark/light persistence.
--
-- Tables:
--   - audit_findings   (individual audit results)
--   - audit_events     (audit run log)
--   - analytics_snapshots (compliance trend data)
--
-- Column additions:
--   - users.theme TEXT ('dark'|'light')
-- ══════════════════════════════════════════════════════════════


-- ══════════════════════════════════════════════
-- 1. AUDIT FINDINGS
-- ══════════════════════════════════════════════
-- Individual findings from automated audit runs.
-- Written by auditPersistence.js → persistAuditResults()
-- Read by auditPersistence.js → fetchRecentFindings()

CREATE TABLE IF NOT EXISTS audit_findings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_run_id TEXT NOT NULL,
  -- Classification
  severity TEXT DEFAULT 'medium'
    CHECK (severity IN ('critical', 'high', 'medium', 'low', 'info')),
  category TEXT DEFAULT '',
  rule TEXT DEFAULT '',
  -- Description
  title TEXT DEFAULT '',
  description TEXT DEFAULT '',
  suggestion TEXT DEFAULT '',
  -- Entity reference
  entity_type TEXT DEFAULT '',
  entity_id TEXT DEFAULT '',
  entity_name TEXT DEFAULT '',
  -- Resolution
  status TEXT DEFAULT 'open'
    CHECK (status IN ('open', 'resolved', 'dismissed', 'acknowledged')),
  resolution TEXT DEFAULT '',
  resolved_by TEXT,
  resolved_at TIMESTAMPTZ,
  -- Extra data
  details JSONB DEFAULT '{}'::jsonb,
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_findings_run ON audit_findings(audit_run_id);
CREATE INDEX IF NOT EXISTS idx_audit_findings_status ON audit_findings(status);
CREATE INDEX IF NOT EXISTS idx_audit_findings_severity ON audit_findings(severity);
CREATE INDEX IF NOT EXISTS idx_audit_findings_created ON audit_findings(created_at DESC);


-- ══════════════════════════════════════════════
-- 2. AUDIT EVENTS
-- ══════════════════════════════════════════════
-- Log of audit run executions (each run = one event).
-- Written by auditPersistence.js → persistAuditResults()
-- Read by auditPersistence.js → fetchAuditHistory()
-- Read by useDailyBriefingData.js line 538

CREATE TABLE IF NOT EXISTS audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL DEFAULT 'audit_run',
  entity_type TEXT DEFAULT 'system',
  entity_id TEXT DEFAULT '',
  user_id TEXT DEFAULT 'system',
  "timestamp" TIMESTAMPTZ DEFAULT now(),
  source TEXT DEFAULT 'client_audit'
    CHECK (source IN ('client_audit', 'server_audit', 'manual', 'scheduled')),
  correlation_id TEXT DEFAULT '',
  -- Rich details: scores, findings summary, data snapshot
  details JSONB DEFAULT '{}'::jsonb,
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_events_type ON audit_events(event_type);
CREATE INDEX IF NOT EXISTS idx_audit_events_timestamp ON audit_events("timestamp" DESC);
CREATE INDEX IF NOT EXISTS idx_audit_events_correlation ON audit_events(correlation_id);


-- ══════════════════════════════════════════════
-- 3. ANALYTICS SNAPSHOTS
-- ══════════════════════════════════════════════
-- Point-in-time metric snapshots for trend analysis.
-- Scoped by 'compliance', 'performance', etc.
-- Written by auditPersistence.js → persistAuditResults()
-- Read by auditPersistence.js → fetchComplianceHistory()

CREATE TABLE IF NOT EXISTS analytics_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scope TEXT NOT NULL DEFAULT 'compliance',
  entity_id TEXT DEFAULT 'department',
  snapshot_date DATE NOT NULL DEFAULT CURRENT_DATE,
  -- Flexible metrics (varies by scope)
  metrics JSONB DEFAULT '{}'::jsonb,
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by TEXT DEFAULT 'system'
);

CREATE INDEX IF NOT EXISTS idx_analytics_scope ON analytics_snapshots(scope);
CREATE INDEX IF NOT EXISTS idx_analytics_date ON analytics_snapshots(snapshot_date);
CREATE INDEX IF NOT EXISTS idx_analytics_scope_date ON analytics_snapshots(scope, snapshot_date);


-- ══════════════════════════════════════════════
-- 4. ADD THEME COLUMN TO USERS
-- ══════════════════════════════════════════════
-- Persists user's dark/light mode preference.
-- Used by ThemeContext.jsx (read on login, write on toggle)

ALTER TABLE users ADD COLUMN IF NOT EXISTS theme TEXT DEFAULT 'dark'
  CHECK (theme IN ('dark', 'light'));


-- ══════════════════════════════════════════════
-- 5. TRIGGERS: auto-update timestamps
-- ══════════════════════════════════════════════
-- audit_findings and audit_events are append-only, no updated_at needed.
-- analytics_snapshots is also append-only.
-- No triggers required for these tables.


-- ══════════════════════════════════════════════
-- 6. RLS (matches current state: disabled per 009)
-- ══════════════════════════════════════════════
-- RLS is currently disabled across all tables (migration 009).
-- When RLS is re-enabled, add these policies:
--
-- audit_findings: SELECT for authenticated, INSERT for admin/system
-- audit_events:   SELECT for authenticated, INSERT for admin/system
-- analytics_snapshots: SELECT for authenticated, INSERT for admin/system
--
-- For now, just ensure RLS is disabled (consistent with other tables):

ALTER TABLE audit_findings DISABLE ROW LEVEL SECURITY;
ALTER TABLE audit_events DISABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_snapshots DISABLE ROW LEVEL SECURITY;


-- ══════════════════════════════════════════════
-- VERIFICATION QUERIES (run manually to confirm)
-- ══════════════════════════════════════════════
-- SELECT table_name FROM information_schema.tables 
-- WHERE table_schema = 'public' 
-- AND table_name IN ('audit_findings', 'audit_events', 'analytics_snapshots')
-- ORDER BY table_name;
--
-- SELECT column_name, data_type, column_default 
-- FROM information_schema.columns 
-- WHERE table_name = 'users' AND column_name = 'theme';
