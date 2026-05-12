-- ══════════════════════════════════════════════════════════════
-- AutoBOM Pro — TEMPORARY: Disable RLS for Testing
-- Migration: 009_temp_disable_rls.sql
-- ══════════════════════════════════════════════════════════════
-- 
-- ⚠️ TEMPORARY — Only for functional testing of the Supabase backend.
-- Re-enable RLS after Third-Party Auth + Auth Hook are verified.
-- ══════════════════════════════════════════════════════════════

ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE projects DISABLE ROW LEVEL SECURITY;
ALTER TABLE tasks DISABLE ROW LEVEL SECURITY;
ALTER TABLE subtasks DISABLE ROW LEVEL SECURITY;
ALTER TABLE time_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE task_types DISABLE ROW LEVEL SECURITY;
ALTER TABLE work_area_types DISABLE ROW LEVEL SECURITY;
ALTER TABLE milestone_types DISABLE ROW LEVEL SECURITY;
ALTER TABLE project_stations DISABLE ROW LEVEL SECURITY;
ALTER TABLE work_areas DISABLE ROW LEVEL SECURITY;
ALTER TABLE milestones DISABLE ROW LEVEL SECURITY;
ALTER TABLE delays DISABLE ROW LEVEL SECURITY;
ALTER TABLE delay_causes DISABLE ROW LEVEL SECURITY;
ALTER TABLE resource_assignments DISABLE ROW LEVEL SECURITY;
ALTER TABLE score_snapshots DISABLE ROW LEVEL SECURITY;
ALTER TABLE daily_score_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE settings DISABLE ROW LEVEL SECURITY;
ALTER TABLE task_block_history DISABLE ROW LEVEL SECURITY;
ALTER TABLE task_activity_log DISABLE ROW LEVEL SECURITY;
ALTER TABLE notifications DISABLE ROW LEVEL SECURITY;
ALTER TABLE comments DISABLE ROW LEVEL SECURITY;
ALTER TABLE project_risks DISABLE ROW LEVEL SECURITY;
ALTER TABLE peer_reviews DISABLE ROW LEVEL SECURITY;
ALTER TABLE peer_review_templates DISABLE ROW LEVEL SECURITY;

-- ══════════════════════════════════════════════════════════════
-- TO RE-ENABLE RLS (run after auth is verified):
-- ══════════════════════════════════════════════════════════════
-- ALTER TABLE users ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
-- ... (all tables above)
-- ══════════════════════════════════════════════════════════════
