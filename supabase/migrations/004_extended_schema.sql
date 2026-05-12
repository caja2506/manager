-- ══════════════════════════════════════════════════════════════
-- AutoBOM Pro — Extended Schema (Phase 1.5)
-- Migration: 004_extended_schema.sql
-- Date: 2026-05-11
-- ══════════════════════════════════════════════════════════════
--
-- Tables added in this migration:
--   - notifications
--   - task_comments
--   - milestones
--   - work_areas
--   - score_snapshots
--   - daily_score_logs
-- ══════════════════════════════════════════════════════════════

-- ══════════════════════════════════════════════
-- NOTIFICATIONS
-- ══════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firestore_id TEXT UNIQUE,
  user_id TEXT NOT NULL REFERENCES users(id),
  type TEXT NOT NULL DEFAULT 'info',
  title TEXT DEFAULT '',
  message TEXT DEFAULT '',
  read BOOLEAN DEFAULT false,
  link TEXT DEFAULT '',
  -- Context references
  task_id UUID REFERENCES tasks(id),
  project_id UUID REFERENCES projects(id),
  triggered_by TEXT REFERENCES users(id),
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(user_id) WHERE read = false;


-- ══════════════════════════════════════════════
-- TASK COMMENTS (Firestore: tasks/{id}/comments)
-- ══════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS task_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firestore_id TEXT UNIQUE,
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  text TEXT NOT NULL DEFAULT '',
  user_id TEXT REFERENCES users(id),
  user_name TEXT DEFAULT '',
  edited BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_comments_task ON task_comments(task_id);
CREATE INDEX IF NOT EXISTS idx_comments_user ON task_comments(user_id);


-- ══════════════════════════════════════════════
-- MILESTONES (Firestore: milestones)
-- ══════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firestore_id TEXT UNIQUE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT '',
  description TEXT DEFAULT '',
  status TEXT DEFAULT 'active'
    CHECK (status IN ('active', 'completed', 'cancelled')),
  start_date TEXT,
  due_date TEXT,
  completed_date TEXT,
  -- Scoring
  score NUMERIC DEFAULT 0,
  traffic_light TEXT DEFAULT 'gray',
  traffic_light_override TEXT,
  traffic_light_override_reason TEXT,
  traffic_light_override_by TEXT,
  traffic_light_override_at TIMESTAMPTZ,
  traffic_light_override_expires TIMESTAMPTZ,
  -- Metadata
  sort_order INT DEFAULT 0,
  created_by TEXT REFERENCES users(id),
  updated_by TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_milestones_project ON milestones(project_id);

-- Now add FK from tasks.milestone_id to milestones
-- (was declared as bare UUID in 001, now add the constraint)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_tasks_milestone'
  ) THEN
    ALTER TABLE tasks
      ADD CONSTRAINT fk_tasks_milestone
      FOREIGN KEY (milestone_id) REFERENCES milestones(id);
  END IF;
END $$;


-- ══════════════════════════════════════════════
-- WORK AREAS (Firestore: workAreas)
-- ══════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS work_areas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firestore_id TEXT UNIQUE,
  milestone_id UUID REFERENCES milestones(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id),
  name TEXT NOT NULL DEFAULT '',
  description TEXT DEFAULT '',
  -- Task filter
  task_filter JSONB DEFAULT '{}'::jsonb,
  task_type_ids UUID[] DEFAULT '{}',
  -- Scoring
  score NUMERIC DEFAULT 0,
  traffic_light TEXT DEFAULT 'gray',
  traffic_light_override TEXT,
  traffic_light_override_reason TEXT,
  traffic_light_override_by TEXT,
  traffic_light_override_at TIMESTAMPTZ,
  traffic_light_override_expires TIMESTAMPTZ,
  -- Metadata
  sort_order INT DEFAULT 0,
  created_by TEXT REFERENCES users(id),
  updated_by TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_work_areas_milestone ON work_areas(milestone_id);
CREATE INDEX IF NOT EXISTS idx_work_areas_project ON work_areas(project_id);

-- Now add FK from tasks.area_id to work_areas
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_tasks_area'
  ) THEN
    ALTER TABLE tasks
      ADD CONSTRAINT fk_tasks_area
      FOREIGN KEY (area_id) REFERENCES work_areas(id);
  END IF;
END $$;


-- ══════════════════════════════════════════════
-- SCORE SNAPSHOTS (Firestore: scoreSnapshots)
-- ══════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS score_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firestore_id TEXT UNIQUE,
  milestone_id UUID REFERENCES milestones(id),
  project_id UUID REFERENCES projects(id),
  snapshot_type TEXT DEFAULT 'scheduled',
  -- Milestone-level scores
  milestone_score NUMERIC DEFAULT 0,
  milestone_traffic_light TEXT DEFAULT 'gray',
  milestone_status TEXT DEFAULT 'active',
  -- Area scores (JSONB array)
  area_scores JSONB DEFAULT '[]'::jsonb,
  -- Locks and penalties
  active_locks JSONB DEFAULT '[]'::jsonb,
  active_penalties JSONB DEFAULT '{}'::jsonb,
  -- Trend
  trend TEXT DEFAULT 'stable',
  change_reason TEXT DEFAULT '',
  comment TEXT,
  -- Metadata
  triggered_by TEXT DEFAULT 'system',
  captured_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_snapshots_milestone ON score_snapshots(milestone_id);
CREATE INDEX IF NOT EXISTS idx_snapshots_project ON score_snapshots(project_id);
CREATE INDEX IF NOT EXISTS idx_snapshots_date ON score_snapshots(captured_at);


-- ══════════════════════════════════════════════
-- DAILY SCORE LOGS (Firestore: dailyScoreLogs)
-- ══════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS daily_score_logs (
  id TEXT PRIMARY KEY,  -- deterministic: userId_YYYYMMDD
  user_id TEXT NOT NULL REFERENCES users(id),
  display_name TEXT DEFAULT '',
  team_role TEXT,
  -- Temporal
  date DATE NOT NULL,
  date_key TEXT,             -- 'YYYY-MM-DD' for display
  week_number INT,
  month INT,                 -- YYYYMM as number
  year INT,
  day_of_week INT,           -- 1=Mon ... 7=Sun
  -- Score
  score NUMERIC NOT NULL DEFAULT 0
    CHECK (score >= 0 AND score <= 100),
  level_code INT DEFAULT 2
    CHECK (level_code IN (1, 2, 3, 4)),
  level_label TEXT DEFAULT 'regular',
  -- Dimensions & metrics (flexible JSONB)
  dimensions JSONB DEFAULT '{}'::jsonb,
  raw_metrics JSONB DEFAULT '{}'::jsonb,
  -- Delta vs previous day
  delta JSONB DEFAULT '{"score": 0, "directionCode": 0}'::jsonb,
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT now(),
  version INT DEFAULT 1,
  generated_by INT DEFAULT 0   -- 0=client, 1=server
);

CREATE INDEX IF NOT EXISTS idx_score_logs_user ON daily_score_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_score_logs_date ON daily_score_logs(date);
CREATE INDEX IF NOT EXISTS idx_score_logs_user_date ON daily_score_logs(user_id, date);
CREATE INDEX IF NOT EXISTS idx_score_logs_month ON daily_score_logs(month);

-- Unique constraint for dedup
CREATE UNIQUE INDEX IF NOT EXISTS idx_score_logs_dedup ON daily_score_logs(user_id, date);


-- ══════════════════════════════════════════════
-- TRIGGERS: auto-update updated_at on new tables
-- ══════════════════════════════════════════════

DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN
    SELECT unnest(ARRAY[
      'notifications', 'milestones', 'work_areas'
    ])
  LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS trg_%s_updated_at ON %I',
      tbl, tbl
    );
    EXECUTE format(
      'CREATE TRIGGER trg_%s_updated_at
       BEFORE UPDATE ON %I
       FOR EACH ROW EXECUTE FUNCTION update_updated_at()',
      tbl, tbl
    );
  END LOOP;
END;
$$;
