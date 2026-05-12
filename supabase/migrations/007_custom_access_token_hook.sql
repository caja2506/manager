-- ══════════════════════════════════════════════════════════════
-- AutoBOM Pro — Custom Access Token Hook for Firebase Auth
-- Migration: 007_custom_access_token_hook.sql
-- ══════════════════════════════════════════════════════════════
--
-- This hook runs when Supabase processes a Firebase JWT token.
-- It ensures the `role` claim is set to 'authenticated' and
-- maps the Firebase UID to auth.uid() for RLS policies.
-- ══════════════════════════════════════════════════════════════

-- Create the custom access token hook function
CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  claims jsonb;
  user_role text;
BEGIN
  -- Extract claims from the event
  claims := event->'claims';
  
  -- Always set role to 'authenticated' for Firebase users
  IF claims IS NOT NULL THEN
    claims := jsonb_set(claims, '{role}', '"authenticated"'::jsonb);
  END IF;
  
  -- Optionally, look up the user's RBAC role from our users table
  -- and add it as a custom claim for use in RLS policies
  BEGIN
    SELECT rbac_role INTO user_role 
    FROM public.users 
    WHERE id = (event->>'user_id')::text;
    
    IF user_role IS NOT NULL THEN
      claims := jsonb_set(claims, '{rbac_role}', to_jsonb(user_role));
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- If lookup fails, just continue with authenticated role
    NULL;
  END;
  
  -- Return modified event with updated claims
  event := jsonb_set(event, '{claims}', claims);
  RETURN event;
END;
$$;

-- Grant execute permission to supabase_auth_admin
GRANT EXECUTE ON FUNCTION public.custom_access_token_hook TO supabase_auth_admin;

-- Revoke from public for security
REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook FROM public;
REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook FROM anon;
REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook FROM authenticated;
