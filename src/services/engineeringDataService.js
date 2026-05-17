/**
 * engineeringDataService — Proxy
 * ============================
 * Routes to Firebase or Supabase implementation based on VITE_DB_BACKEND.
 * Note: Refactored to remove top-level await to fix production deadlocks.
 */

import { USE_SUPABASE } from './_backend';
import * as supabaseImpl from './engineeringDataService.supabase.js';
import * as firebaseImpl from './engineeringDataService.firebase.js';

export const fetchProjectMilestones = (...args) => (USE_SUPABASE ? supabaseImpl : firebaseImpl).fetchProjectMilestones(...args);
export const fetchMilestoneWorkAreas = (...args) => (USE_SUPABASE ? supabaseImpl : firebaseImpl).fetchMilestoneWorkAreas(...args);
export const fetchTaskDependencies = (...args) => (USE_SUPABASE ? supabaseImpl : firebaseImpl).fetchTaskDependencies(...args);
export const fetchTaskPlannerItems = (...args) => (USE_SUPABASE ? supabaseImpl : firebaseImpl).fetchTaskPlannerItems(...args);
export const addWorkAreaType = (...args) => (USE_SUPABASE ? supabaseImpl : firebaseImpl).addWorkAreaType(...args);
