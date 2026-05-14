-- ============================================================
-- ARIA Agent — Database Schema
-- ============================================================
-- Tables for persistent memory, conversation history, and
-- proactive nudge tracking.
-- Run against Supabase via: npx supabase db query --db-url <URL>
-- ============================================================

-- ── 1. Agent Memory ──
-- Stores facts, preferences, and context about each user.
-- The agent uses these to personalize conversations.
CREATE TABLE IF NOT EXISTS agent_memory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    memory_type TEXT NOT NULL CHECK (memory_type IN ('fact', 'preference', 'context', 'interaction_summary')),
    category TEXT,
    content TEXT NOT NULL,
    importance INTEGER DEFAULT 5 CHECK (importance BETWEEN 1 AND 10),
    source TEXT DEFAULT 'conversation',
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_memory_user ON agent_memory(user_id);
CREATE INDEX IF NOT EXISTS idx_agent_memory_type ON agent_memory(user_id, memory_type);

-- ── 2. Agent Conversations ──
-- Stores recent conversation messages per chat for context window.
-- Periodically compacted into summaries by the agent.
CREATE TABLE IF NOT EXISTS agent_conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    chat_id TEXT NOT NULL UNIQUE,
    messages JSONB NOT NULL DEFAULT '[]'::jsonb,
    summary TEXT,
    message_count INTEGER DEFAULT 0,
    last_interaction_at TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_conv_chat ON agent_conversations(chat_id);
CREATE INDEX IF NOT EXISTS idx_agent_conv_user ON agent_conversations(user_id);

-- ── 3. Agent Nudges ──
-- Anti-spam tracker: records when each proactive nudge was sent.
-- Prevents the agent from being annoying.
CREATE TABLE IF NOT EXISTS agent_nudges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    rule_key TEXT NOT NULL,
    target_id TEXT,
    sent_at TIMESTAMPTZ DEFAULT now(),
    message_preview TEXT,
    responded BOOLEAN DEFAULT false,
    responded_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_agent_nudges_user_rule ON agent_nudges(user_id, rule_key);
CREATE INDEX IF NOT EXISTS idx_agent_nudges_lookup ON agent_nudges(user_id, rule_key, target_id);

-- ── 4. Agent Config ──
-- Per-user agent preferences (intensity, active hours, etc.)
CREATE TABLE IF NOT EXISTS agent_config (
    user_id TEXT PRIMARY KEY,
    agent_enabled BOOLEAN DEFAULT true,
    intensity TEXT DEFAULT 'normal' CHECK (intensity IN ('gentle', 'normal', 'insistent')),
    active_hours_start INTEGER DEFAULT 7,
    active_hours_end INTEGER DEFAULT 18,
    timezone TEXT DEFAULT 'America/Costa_Rica',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
