-- ══════════════════════════════════════════════════════════════
-- AutoBOM Pro — Task Status Transition Stored Procedure
-- Migration: 003_transition_task_status.sql
-- Date: 2026-05-11
-- ══════════════════════════════════════════════════════════════
--
-- Replaces Cloud Function `transitionTaskStatus`.
-- Provides atomic status transitions with audit trail.
-- Uses SECURITY DEFINER to bypass RLS for status field updates.
-- ══════════════════════════════════════════════════════════════


-- ══════════════════════════════════════════════
-- VALID STATUS TRANSITIONS
-- ══════════════════════════════════════════════
-- Maps the workflow from taskModel.js:
--   backlog → pending, in_progress, cancelled
--   pending → in_progress, blocked, cancelled
--   in_progress → validation, blocked, completed, cancelled
--   validation → in_progress, completed, blocked
--   blocked → pending, in_progress
--   completed → in_progress (reopen)
--   cancelled → backlog (reopen)

CREATE OR REPLACE FUNCTION transition_task_status(
  p_task_id UUID,
  p_new_status TEXT,
  p_user_id TEXT,
  p_user_name TEXT DEFAULT '',
  p_force BOOLEAN DEFAULT false,
  p_blocked_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_task RECORD;
  v_valid_transitions JSONB;
  v_allowed TEXT[];
  v_now TIMESTAMPTZ := now();
  v_local_date TEXT := to_char(v_now AT TIME ZONE 'America/Monterrey', 'YYYY-MM-DD');
BEGIN
  -- 1. Lock the task row for update
  SELECT * INTO v_task
  FROM tasks
  WHERE id = p_task_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Task not found'
    );
  END IF;

  -- 2. Define valid transitions
  v_valid_transitions := '{
    "backlog": ["pending", "in_progress", "cancelled"],
    "pending": ["in_progress", "blocked", "cancelled"],
    "in_progress": ["validation", "blocked", "completed", "cancelled"],
    "validation": ["in_progress", "completed", "blocked"],
    "blocked": ["pending", "in_progress"],
    "completed": ["in_progress"],
    "cancelled": ["backlog"]
  }'::jsonb;

  -- 3. Validate transition (unless forced)
  IF NOT p_force THEN
    SELECT array_agg(value::text) INTO v_allowed
    FROM jsonb_array_elements_text(
      COALESCE(v_valid_transitions -> v_task.status, '[]'::jsonb)
    );

    IF v_allowed IS NULL OR NOT (p_new_status = ANY(v_allowed)) THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', format('Invalid transition: %s → %s', v_task.status, p_new_status),
        'currentStatus', v_task.status,
        'allowedTransitions', COALESCE(v_valid_transitions -> v_task.status, '[]'::jsonb)
      );
    END IF;
  END IF;

  -- 4. Build the update
  UPDATE tasks SET
    status = p_new_status,
    updated_at = v_now,
    -- Set completed_date when moving to completed
    completed_date = CASE
      WHEN p_new_status = 'completed' THEN to_char(v_now, 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
      WHEN v_task.status = 'completed' AND p_new_status != 'completed' THEN NULL
      ELSE completed_date
    END,
    -- Set blocked fields
    blocked_reason = CASE
      WHEN p_new_status = 'blocked' THEN COALESCE(p_blocked_reason, blocked_reason)
      WHEN v_task.status = 'blocked' AND p_new_status != 'blocked' THEN ''
      ELSE blocked_reason
    END,
    blocked_at = CASE
      WHEN p_new_status = 'blocked' THEN v_now
      ELSE blocked_at
    END,
    unblocked_at = CASE
      WHEN v_task.status = 'blocked' AND p_new_status != 'blocked' THEN v_now
      ELSE unblocked_at
    END
  WHERE id = p_task_id;

  -- 5. Insert activity log entry (atomic audit trail)
  INSERT INTO task_activity_log (
    task_id, type, description, user_id, user_name, "timestamp", date
  ) VALUES (
    p_task_id,
    'status_changed',
    format('Estado: %s → %s', v_task.status, p_new_status),
    p_user_id,
    p_user_name,
    v_now,
    v_local_date
  );

  -- 6. If moving to blocked, record in block history
  IF p_new_status = 'blocked' THEN
    INSERT INTO task_block_history (
      task_id, blocked_at, blocked_reason,
      blocked_by_user_id, blocked_by_name, assigned_to
    ) VALUES (
      p_task_id, v_now, COALESCE(p_blocked_reason, ''),
      p_user_id, p_user_name, v_task.assigned_to
    );
  END IF;

  -- 7. If unblocking, close the open block history entry
  IF v_task.status = 'blocked' AND p_new_status != 'blocked' THEN
    UPDATE task_block_history SET
      unblocked_at = v_now,
      unblocked_by_user_id = p_user_id,
      duration_hours = EXTRACT(EPOCH FROM (v_now - blocked_at)) / 3600.0
    WHERE task_id = p_task_id
      AND unblocked_at IS NULL;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'previousStatus', v_task.status,
    'newStatus', p_new_status,
    'taskId', p_task_id
  );
END;
$$;


-- ══════════════════════════════════════════════
-- TRIGGER: Prevent direct status changes
-- ══════════════════════════════════════════════
-- Only the transition_task_status() function (SECURITY DEFINER)
-- should change the status field. Direct client UPDATEs are blocked.

CREATE OR REPLACE FUNCTION protect_task_status()
RETURNS TRIGGER AS $$
BEGIN
  -- Allow if the caller is the function owner (SECURITY DEFINER context)
  -- or if it's a new row (INSERT)
  IF TG_OP = 'INSERT' THEN
    RETURN NEW;
  END IF;

  -- Check if status is being changed
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    -- Only allow if called from a SECURITY DEFINER function
    -- We check by looking at the current_setting for a flag
    IF current_setting('app.allow_status_change', true) IS DISTINCT FROM 'true' THEN
      RAISE EXCEPTION 'Status changes must go through transition_task_status(). Direct updates to status are not allowed.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Update transition_task_status to set the flag
CREATE OR REPLACE FUNCTION transition_task_status(
  p_task_id UUID,
  p_new_status TEXT,
  p_user_id TEXT,
  p_user_name TEXT DEFAULT '',
  p_force BOOLEAN DEFAULT false,
  p_blocked_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_task RECORD;
  v_valid_transitions JSONB;
  v_allowed TEXT[];
  v_now TIMESTAMPTZ := now();
  v_local_date TEXT := to_char(v_now AT TIME ZONE 'America/Monterrey', 'YYYY-MM-DD');
BEGIN
  -- Set flag to allow status change through trigger
  PERFORM set_config('app.allow_status_change', 'true', true);

  -- 1. Lock the task row
  SELECT * INTO v_task FROM tasks WHERE id = p_task_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Task not found');
  END IF;

  -- 2. Valid transitions map
  v_valid_transitions := '{
    "backlog": ["pending", "in_progress", "cancelled"],
    "pending": ["in_progress", "blocked", "cancelled"],
    "in_progress": ["validation", "blocked", "completed", "cancelled"],
    "validation": ["in_progress", "completed", "blocked"],
    "blocked": ["pending", "in_progress"],
    "completed": ["in_progress"],
    "cancelled": ["backlog"]
  }'::jsonb;

  -- 3. Validate
  IF NOT p_force THEN
    SELECT array_agg(value::text) INTO v_allowed
    FROM jsonb_array_elements_text(
      COALESCE(v_valid_transitions -> v_task.status, '[]'::jsonb)
    );
    IF v_allowed IS NULL OR NOT (p_new_status = ANY(v_allowed)) THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', format('Invalid transition: %s → %s', v_task.status, p_new_status),
        'currentStatus', v_task.status,
        'allowedTransitions', COALESCE(v_valid_transitions -> v_task.status, '[]'::jsonb)
      );
    END IF;
  END IF;

  -- 4. Update task
  UPDATE tasks SET
    status = p_new_status,
    updated_at = v_now,
    completed_date = CASE
      WHEN p_new_status = 'completed' THEN to_char(v_now, 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
      WHEN v_task.status = 'completed' AND p_new_status != 'completed' THEN NULL
      ELSE completed_date
    END,
    blocked_reason = CASE
      WHEN p_new_status = 'blocked' THEN COALESCE(p_blocked_reason, blocked_reason)
      WHEN v_task.status = 'blocked' AND p_new_status != 'blocked' THEN ''
      ELSE blocked_reason
    END,
    blocked_at = CASE WHEN p_new_status = 'blocked' THEN v_now ELSE blocked_at END,
    unblocked_at = CASE
      WHEN v_task.status = 'blocked' AND p_new_status != 'blocked' THEN v_now
      ELSE unblocked_at
    END
  WHERE id = p_task_id;

  -- 5. Audit trail
  INSERT INTO task_activity_log (task_id, type, description, user_id, user_name, "timestamp", date)
  VALUES (p_task_id, 'status_changed', format('Estado: %s → %s', v_task.status, p_new_status),
    p_user_id, p_user_name, v_now, v_local_date);

  -- 6. Block history
  IF p_new_status = 'blocked' THEN
    INSERT INTO task_block_history (task_id, blocked_at, blocked_reason, blocked_by_user_id, blocked_by_name, assigned_to)
    VALUES (p_task_id, v_now, COALESCE(p_blocked_reason, ''), p_user_id, p_user_name, v_task.assigned_to);
  END IF;

  IF v_task.status = 'blocked' AND p_new_status != 'blocked' THEN
    UPDATE task_block_history SET
      unblocked_at = v_now,
      unblocked_by_user_id = p_user_id,
      duration_hours = EXTRACT(EPOCH FROM (v_now - blocked_at)) / 3600.0
    WHERE task_id = p_task_id AND unblocked_at IS NULL;
  END IF;

  -- Reset flag
  PERFORM set_config('app.allow_status_change', 'false', true);

  RETURN jsonb_build_object(
    'success', true,
    'previousStatus', v_task.status,
    'newStatus', p_new_status,
    'taskId', p_task_id
  );
END;
$$;

-- Create the trigger
CREATE TRIGGER trg_protect_task_status
  BEFORE UPDATE ON tasks
  FOR EACH ROW
  EXECUTE FUNCTION protect_task_status();
