-- ══════════════════════════════════════════════════════════════
-- AutoBOM Pro — Allow External User Creation and Update
-- Migration: 20260524_allow_external_users.sql
-- Date: 2026-05-24
-- ══════════════════════════════════════════════════════════════

-- 1. Drop existing policies on users table
DROP POLICY IF EXISTS users_insert ON public.users;
DROP POLICY IF EXISTS users_update ON public.users;

-- 2. Re-create users_insert policy:
-- Allow users to create their own profile, OR allow editors (is_editor())
-- to register external profile rows (where ID starts with 'ext_').
CREATE POLICY users_insert ON public.users FOR INSERT
  TO authenticated WITH CHECK (
    id = public.firebase_uid()
    OR (is_editor() AND id LIKE 'ext_%')
  );

-- 3. Re-create users_update policy:
-- Allow admin to update anyone, users to update their own profile,
-- OR editors to update external profiles (where ID starts with 'ext_').
CREATE POLICY users_update ON public.users FOR UPDATE
  TO authenticated USING (
    is_admin() 
    OR id = public.firebase_uid()
    OR (is_editor() AND id LIKE 'ext_%')
  );

-- 4. Re-create users_delete policy:
-- Allow admin to delete anyone, OR editors to delete external profiles
DROP POLICY IF EXISTS users_delete ON public.users;
CREATE POLICY users_delete ON public.users FOR DELETE
  TO authenticated USING (
    is_admin()
    OR (is_editor() AND id LIKE 'ext_%')
  );

