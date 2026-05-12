-- ══════════════════════════════════════════════════════════════
-- AutoBOM Pro — Fix UUID columns to TEXT for Firebase UID compatibility
-- Migration: 010_fix_user_id_columns.sql
-- ══════════════════════════════════════════════════════════════
-- 
-- Firebase Auth UIDs are NOT UUID-format strings (e.g. "f7jhLgYoXmTKOVKadbhcR5cuGSQ2").
-- All user-referencing columns must be TEXT, not UUID.
--
-- Strategy: Drop FK constraints → ALTER column type → Recreate FK constraints
-- ══════════════════════════════════════════════════════════════

-- Helper: Drop all FK constraints referencing user IDs
DO $$ 
DECLARE r RECORD;
BEGIN
    FOR r IN (
        SELECT tc.constraint_name, tc.table_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.constraint_column_usage ccu 
          ON tc.constraint_name = ccu.constraint_name
        WHERE tc.constraint_type = 'FOREIGN KEY'
          AND tc.table_schema = 'public'
          AND ccu.table_name = 'users'
          AND ccu.column_name = 'id'
    ) LOOP
        EXECUTE 'ALTER TABLE public.' || r.table_name || ' DROP CONSTRAINT IF EXISTS ' || r.constraint_name;
        RAISE NOTICE 'Dropped FK constraint % on %', r.constraint_name, r.table_name;
    END LOOP;
END $$;

-- ═══════ TASKS ═══════
ALTER TABLE tasks ALTER COLUMN assigned_to TYPE TEXT USING assigned_to::TEXT;
ALTER TABLE tasks ALTER COLUMN assigned_by TYPE TEXT USING assigned_by::TEXT;
ALTER TABLE tasks ALTER COLUMN created_by TYPE TEXT USING created_by::TEXT;
ALTER TABLE tasks ALTER COLUMN blocked_by_user_id TYPE TEXT USING blocked_by_user_id::TEXT;

-- ═══════ TIME_LOGS ═══════
ALTER TABLE time_logs ALTER COLUMN user_id TYPE TEXT USING user_id::TEXT;

-- ═══════ PROJECTS ═══════
ALTER TABLE projects ALTER COLUMN owner_id TYPE TEXT USING owner_id::TEXT;
ALTER TABLE projects ALTER COLUMN created_by TYPE TEXT USING created_by::TEXT;

-- ═══════ RESOURCE_ASSIGNMENTS ═══════
ALTER TABLE resource_assignments ALTER COLUMN user_id TYPE TEXT USING user_id::TEXT;
ALTER TABLE resource_assignments ALTER COLUMN assigned_by TYPE TEXT USING assigned_by::TEXT;

-- ═══════ DELAYS ═══════
ALTER TABLE delays ALTER COLUMN reported_by TYPE TEXT USING reported_by::TEXT;
ALTER TABLE delays ALTER COLUMN assigned_to TYPE TEXT USING assigned_to::TEXT;

-- ═══════ PROJECT_RISKS ═══════
ALTER TABLE project_risks ALTER COLUMN identified_by TYPE TEXT USING identified_by::TEXT;
ALTER TABLE project_risks ALTER COLUMN assigned_to TYPE TEXT USING assigned_to::TEXT;

-- ═══════ SCORE_SNAPSHOTS ═══════
ALTER TABLE score_snapshots ALTER COLUMN triggered_by TYPE TEXT USING triggered_by::TEXT;

-- ═══════ DAILY_SCORE_LOGS ═══════
ALTER TABLE daily_score_logs ALTER COLUMN triggered_by TYPE TEXT USING triggered_by::TEXT;

-- ═══════ TASK_BLOCK_HISTORY ═══════
ALTER TABLE task_block_history ALTER COLUMN blocked_by TYPE TEXT USING blocked_by::TEXT;
ALTER TABLE task_block_history ALTER COLUMN unblocked_by TYPE TEXT USING unblocked_by::TEXT;

-- ═══════ TASK_ACTIVITY_LOG ═══════
ALTER TABLE task_activity_log ALTER COLUMN user_id TYPE TEXT USING user_id::TEXT;

-- ═══════ PEER_REVIEWS ═══════
ALTER TABLE peer_reviews ALTER COLUMN requested_by TYPE TEXT USING requested_by::TEXT;
ALTER TABLE peer_reviews ALTER COLUMN reviewer_id TYPE TEXT USING reviewer_id::TEXT;

-- ═══════ NOTIFICATIONS ═══════
-- Already TEXT from migration 005, but ensure:
ALTER TABLE notifications ALTER COLUMN user_id TYPE TEXT USING user_id::TEXT;
ALTER TABLE notifications ALTER COLUMN triggered_by TYPE TEXT USING triggered_by::TEXT;

-- ═══════ COMMENTS ═══════
ALTER TABLE comments ALTER COLUMN user_id TYPE TEXT USING user_id::TEXT;

-- ══════════════════════════════════════════════════════════════
-- RE-ADD FK CONSTRAINTS (soft — no cascade, just referential)
-- These are optional for integrity but not required for operation
-- ══════════════════════════════════════════════════════════════

-- We intentionally do NOT re-add FK constraints because:
-- 1. Firebase UIDs already exist in users table (from migration scripts)
-- 2. Some operations create tasks before the user row exists
-- 3. The app handles referential integrity at the application layer
-- 4. This matches the Firestore behavior (no enforced FKs)

-- ══════════════════════════════════════════════════════════════
-- VERIFICATION
-- ══════════════════════════════════════════════════════════════
-- SELECT table_name, column_name, data_type 
-- FROM information_schema.columns 
-- WHERE column_name IN ('user_id','assigned_to','assigned_by','created_by',
--   'owner_id','reported_by','blocked_by','unblocked_by','triggered_by',
--   'requested_by','reviewer_id','identified_by','blocked_by_user_id')
-- AND table_schema = 'public'
-- ORDER BY table_name, column_name;
-- ══════════════════════════════════════════════════════════════
