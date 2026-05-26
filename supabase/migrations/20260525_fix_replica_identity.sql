-- ══════════════════════════════════════════════════════════════
-- AutoBOM Pro — Fix Realtime DELETE Payloads (Replica Identity)
-- Migration: 20260525_fix_replica_identity.sql
-- ══════════════════════════════════════════════════════════════
--
-- Configures REPLICA IDENTITY to FULL on key tables so that
-- Supabase Realtime DELETE payloads contain the old record
-- data (including primary keys/IDs) rather than being empty.
-- ══════════════════════════════════════════════════════════════

ALTER TABLE public.tasks REPLICA IDENTITY FULL;
ALTER TABLE public.subtasks REPLICA IDENTITY FULL;
ALTER TABLE public.time_logs REPLICA IDENTITY FULL;
ALTER TABLE public.delays REPLICA IDENTITY FULL;
ALTER TABLE public.task_comments REPLICA IDENTITY FULL;
