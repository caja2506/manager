-- ══════════════════════════════════════════════════════════════
-- AutoBOM Pro — Task Module RLS Policies
-- Migration: 002_task_module_rls.sql
-- Date: 2026-05-11
-- ══════════════════════════════════════════════════════════════
--
-- Maps Firestore security rules (firestore.rules) to PostgreSQL
-- Row Level Security policies.
--
-- Firebase Auth UIDs are passed via Supabase JWT custom claims.
-- auth.uid() returns the Firebase UID (TEXT).
-- ══════════════════════════════════════════════════════════════


-- ══════════════════════════════════════════════
-- HELPER FUNCTIONS (mirror firestore.rules)
-- ══════════════════════════════════════════════

-- Get RBAC role for current user
-- NOTE: auth.uid() returns UUID, but our users.id is TEXT (Firebase UID)
-- so we cast auth.uid()::text everywhere.
CREATE OR REPLACE FUNCTION get_rbac_role()
RETURNS TEXT AS $$
  SELECT COALESCE(
    (SELECT rbac_role FROM public.users WHERE id = auth.uid()::text),
    'viewer'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Get team role for current user  
CREATE OR REPLACE FUNCTION get_team_role()
RETURNS TEXT AS $$
  SELECT team_role FROM public.users WHERE id = auth.uid()::text;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Is admin? (rbac_role = 'admin')
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
  SELECT get_rbac_role() = 'admin';
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Is editor? (rbac_role IN ('admin', 'editor'))
CREATE OR REPLACE FUNCTION is_editor()
RETURNS BOOLEAN AS $$
  SELECT get_rbac_role() IN ('admin', 'editor');
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Is engineer+? (team_role IN ('manager', 'team_lead', 'engineer'))
CREATE OR REPLACE FUNCTION is_engineer()
RETURNS BOOLEAN AS $$
  SELECT get_team_role() IN ('manager', 'team_lead', 'engineer');
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Is team lead+?
CREATE OR REPLACE FUNCTION is_team_lead()
RETURNS BOOLEAN AS $$
  SELECT get_team_role() IN ('manager', 'team_lead');
$$ LANGUAGE sql SECURITY DEFINER STABLE;


-- ══════════════════════════════════════════════
-- ENABLE RLS ON ALL TABLES
-- ══════════════════════════════════════════════

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE delay_causes ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_stations ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE subtasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE time_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE delays ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_dependencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE weekly_plan_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE resource_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_block_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE peer_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE peer_review_templates ENABLE ROW LEVEL SECURITY;


-- ══════════════════════════════════════════════
-- USERS — firestore.rules match /users/{userId}
-- ══════════════════════════════════════════════

-- READ: all authenticated
CREATE POLICY users_select ON users FOR SELECT
  TO authenticated USING (true);

-- INSERT: user can create own profile (no rbacRole escalation)
CREATE POLICY users_insert ON users FOR INSERT
  TO authenticated WITH CHECK (
    id = auth.uid()::text
    AND (rbac_role IS NULL OR rbac_role = 'viewer')
  );

-- UPDATE: admin can update anyone; user can update own non-privileged fields
-- Note: privilege field protection is enforced at the service layer + triggers
CREATE POLICY users_update ON users FOR UPDATE
  TO authenticated USING (
    is_admin() OR id = auth.uid()::text
  );

-- DELETE: admin only
CREATE POLICY users_delete ON users FOR DELETE
  TO authenticated USING (is_admin());


-- ══════════════════════════════════════════════
-- TASK_TYPES — firestore.rules match /taskTypes/{docId}
-- admin-only write
-- ══════════════════════════════════════════════

CREATE POLICY task_types_select ON task_types FOR SELECT
  TO authenticated USING (true);

CREATE POLICY task_types_insert ON task_types FOR INSERT
  TO authenticated WITH CHECK (is_admin());

CREATE POLICY task_types_update ON task_types FOR UPDATE
  TO authenticated USING (is_admin());

CREATE POLICY task_types_delete ON task_types FOR DELETE
  TO authenticated USING (is_admin());


-- ══════════════════════════════════════════════
-- DELAY_CAUSES — admin-only write
-- ══════════════════════════════════════════════

CREATE POLICY delay_causes_select ON delay_causes FOR SELECT
  TO authenticated USING (true);

CREATE POLICY delay_causes_insert ON delay_causes FOR INSERT
  TO authenticated WITH CHECK (is_admin());

CREATE POLICY delay_causes_update ON delay_causes FOR UPDATE
  TO authenticated USING (is_admin());

CREATE POLICY delay_causes_delete ON delay_causes FOR DELETE
  TO authenticated USING (is_admin());


-- ══════════════════════════════════════════════
-- SETTINGS — admin-only write
-- ══════════════════════════════════════════════

CREATE POLICY settings_select ON settings FOR SELECT
  TO authenticated USING (true);

CREATE POLICY settings_mod ON settings FOR ALL
  TO authenticated USING (is_admin()) WITH CHECK (is_admin());


-- ══════════════════════════════════════════════
-- PROJECTS — editor+ write, admin delete
-- ══════════════════════════════════════════════

CREATE POLICY projects_select ON projects FOR SELECT
  TO authenticated USING (true);

CREATE POLICY projects_insert ON projects FOR INSERT
  TO authenticated WITH CHECK (is_editor());

CREATE POLICY projects_update ON projects FOR UPDATE
  TO authenticated USING (is_editor());

CREATE POLICY projects_delete ON projects FOR DELETE
  TO authenticated USING (is_admin());


-- ══════════════════════════════════════════════
-- PROJECT_STATIONS — editor+ write
-- ══════════════════════════════════════════════

CREATE POLICY stations_select ON project_stations FOR SELECT
  TO authenticated USING (true);

CREATE POLICY stations_insert ON project_stations FOR INSERT
  TO authenticated WITH CHECK (is_editor());

CREATE POLICY stations_update ON project_stations FOR UPDATE
  TO authenticated USING (is_editor());

CREATE POLICY stations_delete ON project_stations FOR DELETE
  TO authenticated USING (is_admin());


-- ══════════════════════════════════════════════
-- TASKS — editor+ write; status BLOCKED from client
-- Status changes go through transition_task_status() RPC
-- ══════════════════════════════════════════════

CREATE POLICY tasks_select ON tasks FOR SELECT
  TO authenticated USING (true);

CREATE POLICY tasks_insert ON tasks FOR INSERT
  TO authenticated WITH CHECK (is_editor());

-- UPDATE: editor+ can update, but status field is protected
-- (enforced by trigger, not policy — policy allows the update,
--  trigger rejects if status changed directly)
CREATE POLICY tasks_update ON tasks FOR UPDATE
  TO authenticated USING (is_editor());

CREATE POLICY tasks_delete ON tasks FOR DELETE
  TO authenticated USING (is_admin());


-- ══════════════════════════════════════════════
-- SUBTASKS — editor+ create/update, admin delete
-- ══════════════════════════════════════════════

CREATE POLICY subtasks_select ON subtasks FOR SELECT
  TO authenticated USING (true);

CREATE POLICY subtasks_insert ON subtasks FOR INSERT
  TO authenticated WITH CHECK (is_editor());

CREATE POLICY subtasks_update ON subtasks FOR UPDATE
  TO authenticated USING (is_editor());

CREATE POLICY subtasks_delete ON subtasks FOR DELETE
  TO authenticated USING (is_admin());


-- ══════════════════════════════════════════════
-- TIME_LOGS — source of truth for hours
-- Create: authenticated; Update/Delete: owner, admin, or engineer+
-- ══════════════════════════════════════════════

CREATE POLICY time_logs_select ON time_logs FOR SELECT
  TO authenticated USING (true);

CREATE POLICY time_logs_insert ON time_logs FOR INSERT
  TO authenticated WITH CHECK (true);

CREATE POLICY time_logs_update ON time_logs FOR UPDATE
  TO authenticated USING (
    user_id = auth.uid()::text
    OR is_admin()
    OR is_engineer()
  );

CREATE POLICY time_logs_delete ON time_logs FOR DELETE
  TO authenticated USING (
    user_id = auth.uid()::text
    OR is_admin()
    OR is_engineer()
  );


-- ══════════════════════════════════════════════
-- DELAYS — create: authenticated; update: creator or admin
-- ══════════════════════════════════════════════

CREATE POLICY delays_select ON delays FOR SELECT
  TO authenticated USING (true);

CREATE POLICY delays_insert ON delays FOR INSERT
  TO authenticated WITH CHECK (true);

CREATE POLICY delays_update ON delays FOR UPDATE
  TO authenticated USING (
    created_by = auth.uid()::text OR is_admin()
  );

CREATE POLICY delays_delete ON delays FOR DELETE
  TO authenticated USING (is_admin());


-- ══════════════════════════════════════════════
-- TASK_DEPENDENCIES — editor+ write
-- ══════════════════════════════════════════════

CREATE POLICY deps_select ON task_dependencies FOR SELECT
  TO authenticated USING (true);

CREATE POLICY deps_insert ON task_dependencies FOR INSERT
  TO authenticated WITH CHECK (is_editor());

CREATE POLICY deps_update ON task_dependencies FOR UPDATE
  TO authenticated USING (is_editor());

CREATE POLICY deps_delete ON task_dependencies FOR DELETE
  TO authenticated USING (is_admin());


-- ══════════════════════════════════════════════
-- WEEKLY_PLAN_ITEMS — create: auth + must be own;
-- update/delete: creator or admin
-- ══════════════════════════════════════════════

CREATE POLICY wpi_select ON weekly_plan_items FOR SELECT
  TO authenticated USING (true);

CREATE POLICY wpi_insert ON weekly_plan_items FOR INSERT
  TO authenticated WITH CHECK (
    created_by = auth.uid()::text
  );

CREATE POLICY wpi_update ON weekly_plan_items FOR UPDATE
  TO authenticated USING (
    created_by = auth.uid()::text OR is_admin()
  );

CREATE POLICY wpi_delete ON weekly_plan_items FOR DELETE
  TO authenticated USING (
    created_by = auth.uid()::text OR is_admin()
  );


-- ══════════════════════════════════════════════
-- RESOURCE_ASSIGNMENTS — editor+ write
-- ══════════════════════════════════════════════

CREATE POLICY ra_select ON resource_assignments FOR SELECT
  TO authenticated USING (true);

CREATE POLICY ra_insert ON resource_assignments FOR INSERT
  TO authenticated WITH CHECK (is_editor());

CREATE POLICY ra_update ON resource_assignments FOR UPDATE
  TO authenticated USING (is_editor());

CREATE POLICY ra_delete ON resource_assignments FOR DELETE
  TO authenticated USING (is_admin());


-- ══════════════════════════════════════════════
-- TASK_ACTIVITY_LOG — append-only from client
-- ══════════════════════════════════════════════

CREATE POLICY activity_select ON task_activity_log FOR SELECT
  TO authenticated USING (true);

CREATE POLICY activity_insert ON task_activity_log FOR INSERT
  TO authenticated WITH CHECK (true);

CREATE POLICY activity_update ON task_activity_log FOR UPDATE
  TO authenticated USING (is_admin());

CREATE POLICY activity_delete ON task_activity_log FOR DELETE
  TO authenticated USING (is_admin());


-- ══════════════════════════════════════════════
-- TASK_BLOCK_HISTORY — append-only
-- ══════════════════════════════════════════════

CREATE POLICY block_hist_select ON task_block_history FOR SELECT
  TO authenticated USING (true);

CREATE POLICY block_hist_insert ON task_block_history FOR INSERT
  TO authenticated WITH CHECK (true);

CREATE POLICY block_hist_update ON task_block_history FOR UPDATE
  TO authenticated USING (is_admin());

CREATE POLICY block_hist_delete ON task_block_history FOR DELETE
  TO authenticated USING (is_admin());


-- ══════════════════════════════════════════════
-- PEER_REVIEWS — read: all auth; create: editor+; update: admin
-- ══════════════════════════════════════════════

CREATE POLICY pr_select ON peer_reviews FOR SELECT
  TO authenticated USING (true);

CREATE POLICY pr_insert ON peer_reviews FOR INSERT
  TO authenticated WITH CHECK (is_editor());

CREATE POLICY pr_update ON peer_reviews FOR UPDATE
  TO authenticated USING (is_admin());

CREATE POLICY pr_delete ON peer_reviews FOR DELETE
  TO authenticated USING (is_admin());


-- ══════════════════════════════════════════════
-- PEER_REVIEW_TEMPLATES — read: all; write: team_lead+ or admin
-- ══════════════════════════════════════════════

CREATE POLICY prt_select ON peer_review_templates FOR SELECT
  TO authenticated USING (true);

CREATE POLICY prt_insert ON peer_review_templates FOR INSERT
  TO authenticated WITH CHECK (is_team_lead() OR is_admin());

CREATE POLICY prt_update ON peer_review_templates FOR UPDATE
  TO authenticated USING (is_team_lead() OR is_admin());

CREATE POLICY prt_delete ON peer_review_templates FOR DELETE
  TO authenticated USING (is_admin());
