/**
 * useEngineeringData — Proxy
 * ===========================
 * Routes to Firebase or Supabase implementation based on VITE_DB_BACKEND.
 */

import * as SupabaseImpl from './useEngineeringData.supabase.jsx';

export const useEngineeringData = SupabaseImpl.useEngineeringData;
export const EngineeringDataProvider = SupabaseImpl.EngineeringDataProvider;
