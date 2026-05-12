-- Fix milestone/work_area FK constraints and add triggers
-- tasks.milestone_id is TEXT, milestones.id is UUID — skip these FK constraints
-- Instead, just add the triggers for the successfully created tables

-- Trigger for milestones
DROP TRIGGER IF EXISTS trg_milestones_updated_at ON milestones;
CREATE TRIGGER trg_milestones_updated_at BEFORE UPDATE ON milestones FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Trigger for work_areas
DROP TRIGGER IF EXISTS trg_work_areas_updated_at ON work_areas;
CREATE TRIGGER trg_work_areas_updated_at BEFORE UPDATE ON work_areas FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Also need tables for migration script: settings, peer_review_templates, peer_reviews, resource_assignments
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value JSONB DEFAULT '{}'::jsonb,
  description TEXT DEFAULT '',
  category TEXT DEFAULT 'general',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS peer_review_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firestore_id TEXT UNIQUE,
  name TEXT NOT NULL DEFAULT '',
  discipline TEXT,
  active BOOLEAN DEFAULT true,
  items JSONB DEFAULT '[]'::jsonb,
  created_by TEXT REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS peer_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firestore_id TEXT UNIQUE,
  task_id TEXT,
  project_id TEXT,
  cycle INT DEFAULT 1,
  requested_by TEXT REFERENCES users(id),
  reviewer_id TEXT REFERENCES users(id),
  discipline TEXT,
  status TEXT DEFAULT 'requested',
  checklist_items JSONB DEFAULT '[]'::jsonb,
  decision TEXT,
  summary TEXT DEFAULT '',
  waived_by TEXT,
  waive_reason TEXT,
  requested_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_peer_reviews_task ON peer_reviews(task_id);
CREATE INDEX IF NOT EXISTS idx_peer_reviews_reviewer ON peer_reviews(reviewer_id);
CREATE INDEX IF NOT EXISTS idx_peer_reviews_status ON peer_reviews(status);
