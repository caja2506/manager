/**
 * useEngineeringData — Proxy
 * ===========================
 * Routes to Firebase or Supabase implementation based on VITE_DB_BACKEND.
 */

import { USE_SUPABASE } from '../services/_backend';
import * as SupabaseImpl from './useEngineeringData.supabase.jsx';
import * as FirebaseImpl from './useEngineeringData.firebase.jsx';

export const useEngineeringData = USE_SUPABASE ? SupabaseImpl.useEngineeringData : FirebaseImpl.useEngineeringData;
export const EngineeringDataProvider = USE_SUPABASE ? SupabaseImpl.EngineeringDataProvider : FirebaseImpl.EngineeringDataProvider;
