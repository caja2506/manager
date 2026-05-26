-- =============================================
-- ARIA Phase 5 — Write Audit Log Table
-- =============================================
-- This table records every write operation performed by ARIA
-- for full traceability and audit compliance.
--
-- Run this in Supabase SQL Editor or via CLI:
-- npx supabase db query --db-url "postgresql://..." < sql/agent_write_log.sql
-- =============================================

CREATE TABLE IF NOT EXISTS agent_write_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    tool_name TEXT NOT NULL,          -- 'createTask', 'addTaskComment', etc.
    target_id TEXT,                   -- taskId or commentId affected
    payload JSONB NOT NULL DEFAULT '{}',  -- Full request + response payload
    confirmed_at TIMESTAMPTZ,        -- When the user confirmed
    executed_at TIMESTAMPTZ,         -- When the write was executed
    reverted_at TIMESTAMPTZ,         -- If the action was reverted (future)
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for querying by user
CREATE INDEX IF NOT EXISTS idx_agent_write_log_user_id ON agent_write_log(user_id);

-- Index for querying by tool
CREATE INDEX IF NOT EXISTS idx_agent_write_log_tool_name ON agent_write_log(tool_name);

-- RLS policy: service role has full access (agent uses service role key)
ALTER TABLE agent_write_log ENABLE ROW LEVEL SECURITY;

-- Allow service role full access (used by Cloud Functions)
CREATE POLICY IF NOT EXISTS "service_role_full_access" ON agent_write_log
    FOR ALL USING (true) WITH CHECK (true);

COMMENT ON TABLE agent_write_log IS 'Audit trail for all ARIA agent write operations';
