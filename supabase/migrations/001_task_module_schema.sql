-- ══════════════════════════════════════════════════════════════
-- AutoBOM Pro — Task Module Schema (Firestore → Supabase)
-- Migration: 001_task_module_schema.sql
-- Date: 2026-05-11
-- ══════════════════════════════════════════════════════════════
--
-- This migration creates the PostgreSQL schema for the Task Management
-- module, converting Firestore document collections to relational tables.
--
-- Naming convention: snake_case (Firestore camelCase → PostgreSQL snake_case)
-- ID strategy: Firebase UIDs for users (TEXT), UUID for everything else
-- ══════════════════════════════════════════════════════════════

-- ══════════════════════════════════════════════
-- GRUPO 1: CATÁLOGOS (sin dependencias)
-- ══════════════════════════════════════════════

-- users: Unified profile (Firestore: users/{uid})
-- ID is the Firebase Auth UID (TEXT), NOT a UUID.
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  photo_url TEXT DEFAULT '',
  rbac_role TEXT DEFAULT 'viewer'
    CHECK (rbac_role IN ('admin', 'editor', 'viewer')),
  team_role TEXT
    CHECK (team_role IS NULL OR team_role IN ('manager', 'team_lead', 'engineer', 'technician')),
  department TEXT DEFAULT 'Engineering',
  weekly_capacity_hours NUMERIC DEFAULT 40
    CHECK (weekly_capacity_hours >= 0 AND weekly_capacity_hours <= 168),
  reports_to TEXT REFERENCES users(id),
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by TEXT,
  updated_by TEXT
);

-- task_types: Configurable task categories (Firestore: taskTypes)
CREATE TABLE IF NOT EXISTS task_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firestore_id TEXT UNIQUE,         -- Original Firestore doc ID for migration
  name TEXT NOT NULL,
  icon TEXT DEFAULT 'Wrench',
  color TEXT DEFAULT 'indigo',
  active BOOLEAN DEFAULT true,
  sort_order INT DEFAULT 0,
  peer_review_required BOOLEAN DEFAULT false,
  peer_review_sections JSONB DEFAULT '[]'::jsonb,
  created_by TEXT REFERENCES users(id),
  updated_by TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- delay_causes: Configurable delay categories (Firestore: delayCauses)
CREATE TABLE IF NOT EXISTS delay_causes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firestore_id TEXT UNIQUE,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  active BOOLEAN DEFAULT true,
  sort_order INT DEFAULT 0,
  created_by TEXT REFERENCES users(id),
  updated_by TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- settings: Global key-value config (Firestore: settings)
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  description TEXT DEFAULT '',
  category TEXT DEFAULT 'general',
  updated_at TIMESTAMPTZ DEFAULT now(),
  updated_by TEXT
);


-- ══════════════════════════════════════════════
-- GRUPO 2: ENTIDADES PRINCIPALES
-- ══════════════════════════════════════════════

-- projects: Engineering projects (Firestore: projects)
CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firestore_id TEXT UNIQUE,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  client TEXT DEFAULT '',
  priority TEXT DEFAULT 'medium'
    CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  status TEXT DEFAULT 'planning'
    CHECK (status IN ('planning', 'active', 'on_hold', 'completed', 'cancelled')),
  owner_id TEXT REFERENCES users(id),
  team_member_ids TEXT[] DEFAULT '{}',
  start_date TEXT,
  due_date TEXT,
  completed_date TEXT,
  progress NUMERIC DEFAULT 0,
  bom_project_id TEXT,
  tags TEXT[] DEFAULT '{}',
  -- Risk (computed by riskService)
  risk_score NUMERIC DEFAULT 0,
  risk_level TEXT DEFAULT 'low',
  risk_factors TEXT[] DEFAULT '{}',
  risk_summary TEXT DEFAULT '',
  risk_updated_at TIMESTAMPTZ,
  -- Metadata
  created_by TEXT REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- project_stations: Stations per project (Firestore: projects/{id}/stations)
CREATE TABLE IF NOT EXISTS project_stations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firestore_id TEXT,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  indx INT DEFAULT 1,
  stn TEXT DEFAULT '',
  abbreviation TEXT DEFAULT '',
  description TEXT DEFAULT '',
  sort_order INT DEFAULT 0,
  active BOOLEAN DEFAULT true,
  created_by TEXT REFERENCES users(id),
  updated_by TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- tasks: Engineering tasks (Firestore: tasks)
-- WORKFLOW ENFORCEMENT: status can ONLY be changed via transition_task_status()
CREATE TABLE IF NOT EXISTS tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firestore_id TEXT UNIQUE,
  project_id UUID REFERENCES projects(id),
  subproject_id TEXT,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  status TEXT DEFAULT 'backlog'
    CHECK (status IN ('backlog', 'pending', 'in_progress', 'validation', 'completed', 'blocked', 'cancelled')),
  priority TEXT DEFAULT 'medium'
    CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  task_type_id UUID REFERENCES task_types(id),
  milestone_id UUID,            -- FK added when milestones table is created
  area_id UUID,                 -- FK added when work_areas table is created
  counts_for_score BOOLEAN DEFAULT false,
  station_id UUID REFERENCES project_stations(id),
  assigned_by TEXT REFERENCES users(id),
  assigned_to TEXT REFERENCES users(id),
  estimated_hours NUMERIC DEFAULT 0,
  actual_hours NUMERIC DEFAULT 0,
  due_date TEXT,
  completed_date TEXT,
  blocked_reason TEXT DEFAULT '',
  tags TEXT[] DEFAULT '{}',
  sort_order INT DEFAULT 0,
  -- Gantt fields
  show_in_gantt BOOLEAN DEFAULT false,
  planned_start_date TEXT,
  planned_end_date TEXT,
  planned_duration_hours NUMERIC DEFAULT 0,
  percent_complete NUMERIC DEFAULT 0,
  milestone BOOLEAN DEFAULT false,
  summary_task BOOLEAN DEFAULT false,
  parent_task_id UUID REFERENCES tasks(id),
  gantt_view_mode_default TEXT,
  -- Network path (UNC)
  network_path TEXT DEFAULT '',
  -- WIP Enforcement — blocked time tracking
  blocked_at TIMESTAMPTZ,
  unblocked_at TIMESTAMPTZ,
  total_blocked_hours NUMERIC DEFAULT 0,
  blocked_by_user_id TEXT REFERENCES users(id),
  blocked_by_name TEXT,
  -- Peer Review
  peer_review_required BOOLEAN DEFAULT false,
  peer_review_status TEXT DEFAULT 'not_required'
    CHECK (peer_review_status IN ('not_required', 'requested', 'in_review', 'approved', 'changes_requested', 'waived')),
  peer_review_discipline TEXT,
  peer_review_cycles INT DEFAULT 0,
  current_peer_review_id UUID,
  last_peer_reviewer_id TEXT,
  last_peer_review_at TIMESTAMPTZ,
  -- Metadata
  created_by TEXT REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- subtasks: Task checklist items (Firestore: subtasks)
CREATE TABLE IF NOT EXISTS subtasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firestore_id TEXT UNIQUE,
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMPTZ,
  sort_order INT DEFAULT 0,
  created_by TEXT REFERENCES users(id),
  updated_by TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);


-- ══════════════════════════════════════════════
-- GRUPO 3: DATOS OPERATIVOS
-- ══════════════════════════════════════════════

-- time_logs: Source of truth for hours (Firestore: timeLogs)
-- An "active timer" = row with end_time IS NULL
CREATE TABLE IF NOT EXISTS time_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firestore_id TEXT UNIQUE,
  task_id UUID REFERENCES tasks(id),
  project_id UUID REFERENCES projects(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  start_time TIMESTAMPTZ,
  end_time TIMESTAMPTZ,
  total_hours NUMERIC DEFAULT 0,
  total_hours_gross NUMERIC,
  break_hours_deducted NUMERIC DEFAULT 0,
  overtime BOOLEAN DEFAULT false,
  overtime_hours NUMERIC DEFAULT 0,
  notes TEXT DEFAULT '',
  -- Denormalized fields (for display, not source of truth)
  task_title TEXT DEFAULT '',
  project_name TEXT DEFAULT '',
  display_name TEXT DEFAULT '',
  source TEXT DEFAULT 'manual'
    CHECK (source IN ('manual', 'planner_auto', 'kanban_auto', 'open_day', 'legacy')),
  auto_stopped BOOLEAN DEFAULT false,
  -- Metadata
  created_by TEXT REFERENCES users(id),
  updated_by TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- delays: Reported delays (Firestore: delays)
CREATE TABLE IF NOT EXISTS delays (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firestore_id TEXT UNIQUE,
  project_id UUID REFERENCES projects(id),
  task_id UUID REFERENCES tasks(id),
  cause_id UUID REFERENCES delay_causes(id),
  cause_name TEXT DEFAULT '',
  comment TEXT DEFAULT '',
  impact TEXT DEFAULT '',
  resolved BOOLEAN DEFAULT false,
  resolved_at TIMESTAMPTZ,
  created_by TEXT REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- task_dependencies: Gantt links (Firestore: taskDependencies)
CREATE TABLE IF NOT EXISTS task_dependencies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firestore_id TEXT UNIQUE,
  predecessor_task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  successor_task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  type TEXT DEFAULT 'FS'
    CHECK (type IN ('FS', 'FF', 'SS', 'SF')),
  lag_hours NUMERIC DEFAULT 0,
  project_id UUID REFERENCES projects(id),
  created_by TEXT REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  -- Prevent duplicate dependencies
  UNIQUE (predecessor_task_id, successor_task_id)
);

-- weekly_plan_items: Planner time blocks (Firestore: weeklyPlanItems)
CREATE TABLE IF NOT EXISTS weekly_plan_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firestore_id TEXT UNIQUE,
  task_id UUID REFERENCES tasks(id),
  assigned_to TEXT REFERENCES users(id),
  week_start_date TEXT NOT NULL,       -- 'YYYY-MM-DD' (Monday)
  start_date_time TIMESTAMPTZ,
  end_date_time TIMESTAMPTZ,
  planned_hours NUMERIC DEFAULT 0
    CHECK (planned_hours >= 0),
  notes TEXT DEFAULT '',
  -- Metadata
  created_by TEXT NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- resource_assignments: Engineer → Technician mapping (Firestore: resourceAssignments)
CREATE TABLE IF NOT EXISTS resource_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firestore_id TEXT UNIQUE,
  technician_id TEXT NOT NULL REFERENCES users(id),
  engineer_id TEXT NOT NULL REFERENCES users(id),
  start_date TIMESTAMPTZ DEFAULT now(),
  end_date TIMESTAMPTZ,
  active BOOLEAN DEFAULT true,
  reason TEXT DEFAULT 'default',
  created_by TEXT REFERENCES users(id),
  updated_by TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);


-- ══════════════════════════════════════════════
-- GRUPO 4: SUB-COLECCIONES → TABLAS CON FK
-- ══════════════════════════════════════════════

-- task_activity_log: Task event history (Firestore: tasks/{id}/activityLog)
-- Replaces sub-collection + collectionGroup queries with a flat table.
CREATE TABLE IF NOT EXISTS task_activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  description TEXT DEFAULT '',
  user_id TEXT REFERENCES users(id),
  user_name TEXT,
  "timestamp" TIMESTAMPTZ DEFAULT now(),
  date TEXT,                    -- 'YYYY-MM-DD' local for date filtering
  meta JSONB DEFAULT '{}'::jsonb
);

-- task_block_history: WIP enforcement tracking (Firestore: tasks/{id}/blockHistory)
CREATE TABLE IF NOT EXISTS task_block_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  blocked_at TIMESTAMPTZ,
  unblocked_at TIMESTAMPTZ,
  duration_hours NUMERIC DEFAULT 0,
  blocked_reason TEXT DEFAULT '',
  blocked_by_user_id TEXT REFERENCES users(id),
  blocked_by_name TEXT,
  unblocked_by_user_id TEXT,
  type TEXT DEFAULT 'manual'
    CHECK (type IN ('manual', 'wip_switch')),
  task_switched_to UUID REFERENCES tasks(id),
  assigned_to TEXT REFERENCES users(id)
);

-- peer_reviews: Peer review documents (Firestore: peerReviews)
CREATE TABLE IF NOT EXISTS peer_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firestore_id TEXT UNIQUE,
  task_id UUID REFERENCES tasks(id),
  project_id UUID REFERENCES projects(id),
  cycle INT DEFAULT 1,
  requested_by TEXT REFERENCES users(id),
  reviewer_id TEXT REFERENCES users(id),
  discipline TEXT,
  status TEXT DEFAULT 'requested'
    CHECK (status IN ('requested', 'in_review', 'approved', 'changes_requested', 'waived')),
  checklist_items JSONB DEFAULT '[]'::jsonb,
  decision TEXT,
  summary TEXT DEFAULT '',
  waived_by TEXT,
  waive_reason TEXT,
  requested_at TIMESTAMPTZ DEFAULT now(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- peer_review_templates: Review checklists per discipline (Firestore: peerReviewTemplates)
CREATE TABLE IF NOT EXISTS peer_review_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firestore_id TEXT UNIQUE,
  name TEXT NOT NULL,
  discipline TEXT,
  task_type_id UUID REFERENCES task_types(id),
  active BOOLEAN DEFAULT true,
  items JSONB DEFAULT '[]'::jsonb,
  created_by TEXT REFERENCES users(id),
  updated_by TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);


-- ══════════════════════════════════════════════
-- ÍNDICES
-- ══════════════════════════════════════════════

-- Tasks
CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned ON tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_milestone ON tasks(milestone_id);
CREATE INDEX IF NOT EXISTS idx_tasks_type ON tasks(task_type_id);

-- Subtasks
CREATE INDEX IF NOT EXISTS idx_subtasks_task ON subtasks(task_id);

-- Time logs
CREATE INDEX IF NOT EXISTS idx_time_logs_task ON time_logs(task_id);
CREATE INDEX IF NOT EXISTS idx_time_logs_user ON time_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_time_logs_project ON time_logs(project_id);
CREATE INDEX IF NOT EXISTS idx_time_logs_open ON time_logs(user_id) WHERE end_time IS NULL;

-- Delays
CREATE INDEX IF NOT EXISTS idx_delays_task ON delays(task_id);
CREATE INDEX IF NOT EXISTS idx_delays_project ON delays(project_id);
CREATE INDEX IF NOT EXISTS idx_delays_unresolved ON delays(project_id) WHERE resolved = false;

-- Weekly plan
CREATE INDEX IF NOT EXISTS idx_weekly_plan_week ON weekly_plan_items(week_start_date);
CREATE INDEX IF NOT EXISTS idx_weekly_plan_user ON weekly_plan_items(assigned_to);

-- Activity log
CREATE INDEX IF NOT EXISTS idx_activity_task ON task_activity_log(task_id);
CREATE INDEX IF NOT EXISTS idx_activity_date ON task_activity_log(date);

-- Resource assignments
CREATE INDEX IF NOT EXISTS idx_resource_active ON resource_assignments(active) WHERE active = true;
CREATE INDEX IF NOT EXISTS idx_resource_tech ON resource_assignments(technician_id);
CREATE INDEX IF NOT EXISTS idx_resource_eng ON resource_assignments(engineer_id);

-- Dependencies
CREATE INDEX IF NOT EXISTS idx_deps_predecessor ON task_dependencies(predecessor_task_id);
CREATE INDEX IF NOT EXISTS idx_deps_successor ON task_dependencies(successor_task_id);

-- Stations
CREATE INDEX IF NOT EXISTS idx_stations_project ON project_stations(project_id);

-- Peer reviews
CREATE INDEX IF NOT EXISTS idx_peer_reviews_task ON peer_reviews(task_id);
CREATE INDEX IF NOT EXISTS idx_peer_reviews_reviewer ON peer_reviews(reviewer_id);


-- ══════════════════════════════════════════════
-- TRIGGER: auto-update updated_at
-- ══════════════════════════════════════════════

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to all tables with updated_at
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN
    SELECT unnest(ARRAY[
      'users', 'task_types', 'delay_causes',
      'projects', 'project_stations', 'tasks', 'subtasks',
      'time_logs', 'weekly_plan_items', 'resource_assignments',
      'peer_review_templates'
    ])
  LOOP
    EXECUTE format(
      'CREATE TRIGGER trg_%s_updated_at
       BEFORE UPDATE ON %I
       FOR EACH ROW EXECUTE FUNCTION update_updated_at()',
      tbl, tbl
    );
  END LOOP;
END;
$$;
