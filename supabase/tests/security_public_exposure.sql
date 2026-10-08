-- Production verification for SEC-2026-10-07; run as postgres with ON_ERROR_STOP.
-- Reads only counts, checks privileges, and calls administrative RPCs with SELECT 1.
-- It never creates users, edits application records, or invokes a task transition.
BEGIN;
SET LOCAL statement_timeout = '30s';

DO $checks$
BEGIN
  IF NOT (SELECT relrowsecurity FROM pg_class
          WHERE oid = 'public.catalogo_maestro_backup_20260708'::regclass) THEN
    RAISE EXCEPTION 'Backup RLS is disabled';
  END IF;
END;
$checks$;

SET LOCAL ROLE anon;
DO $checks$
DECLARE
  table_name text;
  function_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'catalogo_maestro_backup_20260708', 'catalogo_maestro', 'categorias',
    'items_bom', 'marcas', 'proveedores', 'proyectos_bom', 'users', 'agent_write_log'
  ] LOOP
    IF has_table_privilege(current_user, format('public.%I', table_name),
                          'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') THEN
      RAISE EXCEPTION 'anon still has privileges on %', table_name;
    END IF;
    BEGIN
      EXECUTE format('SELECT count(*) FROM public.%I', table_name);
      RAISE EXCEPTION 'anon unexpectedly read %', table_name;
    EXCEPTION WHEN insufficient_privilege THEN
      NULL;
    END;
  END LOOP;
  FOREACH function_name IN ARRAY ARRAY['exec_query_json', 'exec_sql', 'query_sql'] LOOP
    BEGIN
      EXECUTE format('SELECT public.%I(%L)', function_name, 'SELECT 1');
      RAISE EXCEPTION 'anon unexpectedly executed %', function_name;
    EXCEPTION WHEN insufficient_privilege THEN
      NULL;
    END;
  END LOOP;
  IF has_function_privilege(current_user,
      'public.transition_task_status(text,text,text,text,boolean,text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'anon can still transition tasks';
  END IF;
END;
$checks$;
RESET ROLE;

SET LOCAL ROLE authenticated;
DO $checks$
DECLARE
  table_name text;
  function_name text;
BEGIN
  IF has_table_privilege(current_user, 'public.catalogo_maestro_backup_20260708',
                        'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') THEN
    RAISE EXCEPTION 'authenticated still has backup privileges';
  END IF;
  BEGIN
    PERFORM count(*) FROM public.catalogo_maestro_backup_20260708;
    RAISE EXCEPTION 'authenticated unexpectedly read backup';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;
  FOREACH function_name IN ARRAY ARRAY['exec_query_json', 'exec_sql', 'query_sql'] LOOP
    BEGIN
      EXECUTE format('SELECT public.%I(%L)', function_name, 'SELECT 1');
      RAISE EXCEPTION 'authenticated unexpectedly executed %', function_name;
    EXCEPTION WHEN insufficient_privilege THEN
      NULL;
    END;
  END LOOP;
  -- This is a PostgreSQL role-level compatibility check, not a Firebase login test.
  FOREACH table_name IN ARRAY ARRAY[
    'catalogo_maestro', 'categorias', 'items_bom', 'marcas',
    'proveedores', 'proyectos_bom', 'users', 'agent_write_log'
  ] LOOP
    EXECUTE format('SELECT count(*) FROM public.%I', table_name);
  END LOOP;
  IF NOT has_function_privilege(current_user,
      'public.transition_task_status(text,text,text,text,boolean,text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'authenticated lost task transition access';
  END IF;
END;
$checks$;
RESET ROLE;

SET LOCAL ROLE service_role;
DO $checks$
DECLARE
  function_name text;
BEGIN
  PERFORM count(*) FROM public.catalogo_maestro_backup_20260708;
  PERFORM count(*) FROM public.catalogo_maestro;
  FOREACH function_name IN ARRAY ARRAY['exec_query_json', 'exec_sql', 'query_sql'] LOOP
    EXECUTE format('SELECT public.%I(%L)', function_name, 'SELECT 1');
  END LOOP;
END;
$checks$;
RESET ROLE;

SELECT 'PASS: anonymous denied; signed-in operational access and service access preserved'
  AS security_verification;
ROLLBACK;
