/**
 * ganttPlannerSync — Proxy
 * ============================
 * Routes to Firebase or Supabase implementation based on VITE_DB_BACKEND.
 * Note: Refactored to remove top-level await to fix production deadlocks.
 */

import { USE_SUPABASE } from './_backend';
import * as supabaseImpl from './ganttPlannerSync.supabase.js';
import * as firebaseImpl from './ganttPlannerSync.firebase.js';

export const syncGanttToPlanner = (...args) => (USE_SUPABASE ? supabaseImpl : firebaseImpl).syncGanttToPlanner(...args);
export const syncPlannerToGantt = (...args) => (USE_SUPABASE ? supabaseImpl : firebaseImpl).syncPlannerToGantt(...args);
