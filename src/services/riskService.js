/**
 * riskService — Proxy
 * ============================
 * Routes to Firebase or Supabase implementation based on VITE_DB_BACKEND.
 * Note: Refactored to remove top-level await to fix production deadlocks.
 */

import { USE_SUPABASE } from './_backend';
import * as supabaseImpl from './riskService.supabase.js';
import * as firebaseImpl from './riskService.firebase.js';

export const calculateProjectRisk = (...args) => (USE_SUPABASE ? supabaseImpl : firebaseImpl).calculateProjectRisk(...args);
