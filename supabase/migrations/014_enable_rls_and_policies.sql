-- ══════════════════════════════════════════════════════════════
-- AutoBOM Pro — Enable RLS and Admin Policies for Audit & Analytics (DO block)
-- Migration: 014_enable_rls_and_policies.sql
-- Date: 2026-05-23
-- ══════════════════════════════════════════════════════════════

DO $$
BEGIN
  -- 1. Habilitar RLS en las 37 tablas
  EXECUTE 'ALTER TABLE public.analytics_snapshots ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE public.audit_events ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE public.audit_findings ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE public.audit_trail ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE public.catalogo_maestro ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE public.categorias ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE public.daily_score_logs ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE public.delay_causes ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE public.delays ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE public.items_bom ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE public.marcas ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE public.milestone_types ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE public.milestones ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE public.peer_review_templates ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE public.peer_reviews ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE public.project_risks ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE public.project_stations ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE public.proveedores ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE public.proyectos_bom ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE public.resource_assignments ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE public.score_snapshots ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE public.subtasks ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE public.task_activity_log ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE public.task_block_history ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE public.task_comments ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE public.task_dependencies ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE public.task_type_categories ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE public.task_types ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE public.time_logs ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE public.users ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE public.weekly_plan_items ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE public.work_area_types ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE public.work_areas ENABLE ROW LEVEL SECURITY';

  -- 2. Crear políticas exclusivas para administradores (solo admin) en tablas de auditoría
  EXECUTE 'DROP POLICY IF EXISTS select_analytics_snapshots ON public.analytics_snapshots';
  EXECUTE 'DROP POLICY IF EXISTS insert_analytics_snapshots ON public.analytics_snapshots';
  EXECUTE 'CREATE POLICY select_analytics_snapshots ON public.analytics_snapshots FOR SELECT TO authenticated USING (is_admin())';
  EXECUTE 'CREATE POLICY insert_analytics_snapshots ON public.analytics_snapshots FOR INSERT TO authenticated WITH CHECK (is_admin())';

  EXECUTE 'DROP POLICY IF EXISTS select_audit_events ON public.audit_events';
  EXECUTE 'DROP POLICY IF EXISTS insert_audit_events ON public.audit_events';
  EXECUTE 'CREATE POLICY select_audit_events ON public.audit_events FOR SELECT TO authenticated USING (is_admin())';
  EXECUTE 'CREATE POLICY insert_audit_events ON public.audit_events FOR INSERT TO authenticated WITH CHECK (is_admin())';

  EXECUTE 'DROP POLICY IF EXISTS select_audit_findings ON public.audit_findings';
  EXECUTE 'DROP POLICY IF EXISTS insert_audit_findings ON public.audit_findings';
  EXECUTE 'CREATE POLICY select_audit_findings ON public.audit_findings FOR SELECT TO authenticated USING (is_admin())';
  EXECUTE 'CREATE POLICY insert_audit_findings ON public.audit_findings FOR INSERT TO authenticated WITH CHECK (is_admin())';
END $$;
