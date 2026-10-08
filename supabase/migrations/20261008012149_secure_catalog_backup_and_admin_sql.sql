-- SEC-2026-10-07: contain public data exposure in Manager/AutoBOM.
-- Production target: mkymgptfmtlqpdswvywo (not MotelOps/Cabinas_Atlastis).
-- Preserve all rows, existing RLS policies, and operational authenticated access.
-- Archived backups and manually created SQL helpers may not exist in new DBs.
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

-- One block makes the complete permission change atomic even when run manually.
DO $security_fix$
DECLARE
  table_name text;
  function_signature text;
  target_function regprocedure;
BEGIN
  IF to_regclass('public.catalogo_maestro_backup_20260708') IS NOT NULL THEN
    ALTER TABLE public.catalogo_maestro_backup_20260708 ENABLE ROW LEVEL SECURITY;
    REVOKE ALL PRIVILEGES ON TABLE public.catalogo_maestro_backup_20260708
      FROM PUBLIC, anon, authenticated;
    -- No client policies: this archived copy is reserved for server/admin use.
    -- Existing service_role privileges and BYPASSRLS remain intact.
  END IF;

  -- These internal tables had unconditional PUBLIC policies and anon grants.
  -- Revoke the anonymous entry point without changing existing signed-in rules.
  FOREACH table_name IN ARRAY ARRAY[
    'catalogo_maestro', 'categorias', 'items_bom', 'marcas',
    'proveedores', 'proyectos_bom', 'users', 'agent_write_log'
  ] LOOP
    IF to_regclass(format('public.%I', table_name)) IS NOT NULL THEN
      EXECUTE format(
        'REVOKE ALL PRIVILEGES ON TABLE public.%I FROM PUBLIC, anon', table_name
      );
    END IF;
  END LOOP;

  -- Raw SQL executed as postgres would bypass RLS. These RPCs are maintenance
  -- tools, never browser APIs. Repository callers use a server service key.
  FOREACH function_signature IN ARRAY ARRAY[
    'public.exec_query_json(text)', 'public.exec_sql(text)', 'public.query_sql(text)'
  ] LOOP
    target_function := to_regprocedure(function_signature);
    IF target_function IS NOT NULL THEN
      EXECUTE format(
        'REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated',
        target_function
      );
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', target_function);
      EXECUTE format(
        'ALTER FUNCTION %s SET search_path = pg_catalog, public, pg_temp',
        target_function
      );
    END IF;
  END LOOP;

  -- This SECURITY DEFINER RPC changes tasks. Keep the existing signed-in and
  -- server callers, but block invocation without a session.
  target_function := to_regprocedure(
    'public.transition_task_status(text,text,text,text,boolean,text)'
  );
  IF target_function IS NOT NULL THEN
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon', target_function);
    EXECUTE format(
      'GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', target_function
    );
    EXECUTE format(
      'ALTER FUNCTION %s SET search_path = pg_catalog, public, pg_temp', target_function
    );
  END IF;
END;
$security_fix$;
