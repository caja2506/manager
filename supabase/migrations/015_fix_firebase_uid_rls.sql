-- ══════════════════════════════════════════════════════════════
-- AutoBOM Pro — Fix Firebase UID UUID Casting Error in RLS
-- Migration: 015_fix_firebase_uid_rls.sql
-- Date: 2026-05-23
-- ══════════════════════════════════════════════════════════════

DO $$
BEGIN
  -- 1. Crear la función firebase_uid que no castea a UUID
  CREATE OR REPLACE FUNCTION public.firebase_uid()
  RETURNS TEXT AS $body$
    SELECT COALESCE(
      nullif(current_setting('request.jwt.claim.sub', true), ''),
      (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
    );
  $body$ LANGUAGE sql SECURITY DEFINER STABLE;

  -- 2. Actualizar las funciones helpers para usar firebase_uid()
  CREATE OR REPLACE FUNCTION public.get_rbac_role()
  RETURNS TEXT AS $body$
    SELECT COALESCE(
      (SELECT rbac_role FROM public.users WHERE id = public.firebase_uid()),
      'viewer'
    );
  $body$ LANGUAGE sql SECURITY DEFINER STABLE;

  CREATE OR REPLACE FUNCTION public.get_team_role()
  RETURNS TEXT AS $body$
    SELECT team_role FROM public.users WHERE id = public.firebase_uid();
  $body$ LANGUAGE sql SECURITY DEFINER STABLE;

  -- 3. Re-crear las políticas de RLS de las tablas usando public.firebase_uid()

  -- Tabla users
  EXECUTE 'DROP POLICY IF EXISTS users_insert ON public.users';
  EXECUTE 'CREATE POLICY users_insert ON public.users FOR INSERT TO authenticated WITH CHECK (id = public.firebase_uid() AND (rbac_role IS NULL OR rbac_role = ''viewer''))';

  EXECUTE 'DROP POLICY IF EXISTS users_update ON public.users';
  EXECUTE 'CREATE POLICY users_update ON public.users FOR UPDATE TO authenticated USING (is_admin() OR id = public.firebase_uid())';

  -- Tabla time_logs
  EXECUTE 'DROP POLICY IF EXISTS time_logs_update ON public.time_logs';
  EXECUTE 'CREATE POLICY time_logs_update ON public.time_logs FOR UPDATE TO authenticated USING (user_id = public.firebase_uid() OR is_admin() OR is_engineer())';

  EXECUTE 'DROP POLICY IF EXISTS time_logs_delete ON public.time_logs';
  EXECUTE 'CREATE POLICY time_logs_delete ON public.time_logs FOR DELETE TO authenticated USING (user_id = public.firebase_uid() OR is_admin() OR is_engineer())';

  -- Tabla delays
  EXECUTE 'DROP POLICY IF EXISTS delays_update ON public.delays';
  EXECUTE 'CREATE POLICY delays_update ON public.delays FOR UPDATE TO authenticated USING (created_by = public.firebase_uid() OR is_admin())';

  -- Tabla weekly_plan_items
  EXECUTE 'DROP POLICY IF EXISTS wpi_insert ON public.weekly_plan_items';
  EXECUTE 'CREATE POLICY wpi_insert ON public.weekly_plan_items FOR INSERT TO authenticated WITH CHECK (created_by = public.firebase_uid())';

  EXECUTE 'DROP POLICY IF EXISTS wpi_update ON public.weekly_plan_items';
  EXECUTE 'CREATE POLICY wpi_update ON public.weekly_plan_items FOR UPDATE TO authenticated USING (created_by = public.firebase_uid() OR is_admin())';

  EXECUTE 'DROP POLICY IF EXISTS wpi_delete ON public.weekly_plan_items';
  EXECUTE 'CREATE POLICY wpi_delete ON public.weekly_plan_items FOR DELETE TO authenticated USING (created_by = public.firebase_uid() OR is_admin())';

END $$;
