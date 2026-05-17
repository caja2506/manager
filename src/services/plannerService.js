/**
 * plannerService — Proxy
 * ============================
 * Routes to Firebase or Supabase implementation based on VITE_DB_BACKEND.
 * Note: Refactored to remove top-level await to fix production deadlocks.
 */

import { USE_SUPABASE } from './_backend';
import * as supabaseImpl from './plannerService.supabase.js';
import * as firebaseImpl from './plannerService.firebase.js';

export const plannerService = USE_SUPABASE ? supabaseImpl.plannerService : firebaseImpl.plannerService;
