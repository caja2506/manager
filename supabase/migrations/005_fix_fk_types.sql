-- ══════════════════════════════════════════════════════════════
-- AutoBOM Pro — Fix Extended Schema (Phase 1.5b)
-- Fix FK type mismatches: tasks.id and projects.id are TEXT
-- ══════════════════════════════════════════════════════════════

-- ═══════ NOTIFICATIONS (fix: task_id and project_id must be TEXT) ═══════
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firestore_id TEXT UNIQUE,
  user_id TEXT NOT NULL REFERENCES users(id),
  type TEXT NOT NULL DEFAULT 'info',
  title TEXT DEFAULT '',
  message TEXT DEFAULT '',
  read BOOLEAN DEFAULT false,
  link TEXT DEFAULT '',
  task_id TEXT,
  project_id TEXT,
  triggered_by TEXT REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(user_id) WHERE read = false;

-- ═══════ TASK COMMENTS (fix: task_id must be TEXT) ═══════
CREATE TABLE IF NOT EXISTS task_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firestore_id TEXT UNIQUE,
  task_id TEXT NOT NULL,
  text TEXT NOT NULL DEFAULT '',
  user_id TEXT REFERENCES users(id),
  user_name TEXT DEFAULT '',
  edited BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_comments_task ON task_comments(task_id);
CREATE INDEX IF NOT EXISTS idx_comments_user ON task_comments(user_id);

-- ═══════ FIX: triggers for notifications ═══════
DROP TRIGGER IF EXISTS trg_notifications_updated_at ON notifications;
CREATE TRIGGER trg_notifications_updated_at BEFORE UPDATE ON notifications FOR EACH ROW EXECUTE FUNCTION update_updated_at();
