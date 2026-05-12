-- ══════════════════════════════════════════════════════════════
-- AutoBOM Pro — Enable Realtime on Core Tables
-- Migration: 008_enable_realtime.sql
-- ══════════════════════════════════════════════════════════════
--
-- Adds tables to the supabase_realtime publication so that
-- clients can subscribe to INSERT/UPDATE/DELETE events.
--
-- Only tables that need live updates are included:
--   - tasks, subtasks (kanban, task details)
--   - time_logs (active timers)
--   - notifications (bell icon)
--   - delays (blocking alerts)
--   - weekly_plan_items (planner board)
--   - projects (project list)
--   - task_comments (live comments)
--   - daily_score_logs (dashboard score)
--   - resource_assignments (team assignments)
-- ══════════════════════════════════════════════════════════════

-- First, drop all tables from the publication to avoid "already member" errors
-- then re-add them cleanly.

-- Drop existing publication members (safe — ignores if not members)
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN
    SELECT unnest(ARRAY[
      'tasks', 'subtasks', 'time_logs', 'notifications',
      'delays', 'weekly_plan_items', 'projects', 'task_comments',
      'daily_score_logs', 'resource_assignments', 'users',
      'peer_reviews', 'settings'
    ])
  LOOP
    BEGIN
      EXECUTE format('ALTER PUBLICATION supabase_realtime DROP TABLE IF EXISTS public.%I', tbl);
    EXCEPTION WHEN OTHERS THEN
      -- table might not be a member, skip
      NULL;
    END;
  END LOOP;
END $$;

-- Add core tables to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.tasks;
ALTER PUBLICATION supabase_realtime ADD TABLE public.subtasks;
ALTER PUBLICATION supabase_realtime ADD TABLE public.time_logs;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.delays;
ALTER PUBLICATION supabase_realtime ADD TABLE public.weekly_plan_items;
ALTER PUBLICATION supabase_realtime ADD TABLE public.projects;
ALTER PUBLICATION supabase_realtime ADD TABLE public.task_comments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.daily_score_logs;
ALTER PUBLICATION supabase_realtime ADD TABLE public.resource_assignments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.users;
ALTER PUBLICATION supabase_realtime ADD TABLE public.peer_reviews;
ALTER PUBLICATION supabase_realtime ADD TABLE public.settings;
