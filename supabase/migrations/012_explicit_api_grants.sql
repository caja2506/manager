-- ══════════════════════════════════════════════════════════════
-- AutoBOM Pro — Explicit Data API Grants for Supabase
-- Migration: 012_explicit_api_grants.sql
-- Date: 2026-05-13
-- ══════════════════════════════════════════════════════════════
--
-- Supabase is changing default behavior:
--   - May 30, 2026: New projects won't auto-expose public tables
--   - October 30, 2026: Enforced on ALL existing projects
--
-- This migration adds explicit GRANT statements to every table
-- so that supabase-js (PostgREST) can continue accessing them
-- after the enforcement date.
--
-- Roles:
--   anon:          SELECT only (public read for login page, etc.)
--   authenticated: Full CRUD (the app's primary role)
--   service_role:  Full CRUD (server-side / Edge Functions)
-- ══════════════════════════════════════════════════════════════


-- ══════════════════════════════════════════════
-- COMPLETE TABLE LIST (28 tables)
-- ══════════════════════════════════════════════

-- We use a DO block to loop over all tables and apply grants
-- consistently. This is idempotent — safe to run multiple times.

DO $$
DECLARE
  tbl TEXT;
BEGIN
  -- ─── TABLES WITH FULL CRUD FOR authenticated + service_role ───
  FOR tbl IN
    SELECT unnest(ARRAY[
      -- Core catalogs
      'users',
      'task_types',
      'delay_causes',
      'settings',
      -- Engineering projects
      'projects',
      'project_stations',
      -- Tasks & subtasks
      'tasks',
      'subtasks',
      -- Time tracking
      'time_logs',
      -- Delays
      'delays',
      -- Dependencies
      'task_dependencies',
      -- Weekly planner
      'weekly_plan_items',
      -- Resource assignments
      'resource_assignments',
      -- Activity & block history
      'task_activity_log',
      'task_block_history',
      -- Peer reviews
      'peer_reviews',
      'peer_review_templates',
      -- Notifications
      'notifications',
      -- Comments
      'task_comments',
      -- Milestones & work areas
      'milestones',
      'work_areas',
      -- Score & analytics
      'score_snapshots',
      'daily_score_logs',
      -- Audit & compliance (created in migration 011)
      'audit_findings',
      'audit_events',
      'analytics_snapshots'
    ])
  LOOP
    -- Check if table exists before granting
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = tbl
    ) THEN
      -- anon: read-only access
      EXECUTE format('GRANT SELECT ON public.%I TO anon', tbl);

      -- authenticated: full CRUD
      EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', tbl);

      -- service_role: full CRUD (for Edge Functions / server operations)
      EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO service_role', tbl);

      RAISE NOTICE 'Granted API access on: %', tbl;
    ELSE
      RAISE NOTICE 'Table % does not exist, skipping', tbl;
    END IF;
  END LOOP;
END $$;


-- ══════════════════════════════════════════════
-- GRANT USAGE ON SEQUENCES
-- ══════════════════════════════════════════════
-- Required for INSERT operations with auto-generated IDs

GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO anon;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO service_role;


-- ══════════════════════════════════════════════
-- GRANT SCHEMA USAGE
-- ══════════════════════════════════════════════
-- Ensure roles can see the public schema at all

GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO service_role;


-- ══════════════════════════════════════════════
-- GRANT EXECUTE ON RPC FUNCTIONS
-- ══════════════════════════════════════════════
-- Our stored procedure for task status transitions

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc
    WHERE proname = 'transition_task_status'
  ) THEN
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.transition_task_status TO authenticated';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.transition_task_status TO service_role';
    RAISE NOTICE 'Granted EXECUTE on transition_task_status';
  END IF;
END $$;


-- ══════════════════════════════════════════════
-- VERIFICATION
-- ══════════════════════════════════════════════
-- Run this query to verify grants are in place:
--
-- SELECT grantee, table_name, privilege_type
-- FROM information_schema.role_table_grants
-- WHERE table_schema = 'public'
--   AND grantee IN ('anon', 'authenticated', 'service_role')
-- ORDER BY table_name, grantee, privilege_type;
