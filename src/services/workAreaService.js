/**
 * workAreaService — Proxy
 * ============================
 * Routes to Firebase or Supabase implementation based on VITE_DB_BACKEND.
 * Note: Refactored to remove top-level await to fix production deadlocks.
 */

import { USE_SUPABASE } from './_backend';
import * as supabaseImpl from './workAreaService.supabase.js';
import * as firebaseImpl from './workAreaService.firebase.js';

export const createWorkArea = (...args) => (USE_SUPABASE ? supabaseImpl : firebaseImpl).createWorkArea(...args);
export const updateWorkArea = (...args) => (USE_SUPABASE ? supabaseImpl : firebaseImpl).updateWorkArea(...args);
export const getWorkAreasByMilestone = (...args) => (USE_SUPABASE ? supabaseImpl : firebaseImpl).getWorkAreasByMilestone(...args);
export const getWorkAreasByProject = (...args) => (USE_SUPABASE ? supabaseImpl : firebaseImpl).getWorkAreasByProject(...args);
export const getFilteredTasks = (...args) => (USE_SUPABASE ? supabaseImpl : firebaseImpl).getFilteredTasks(...args);
export const computeAreaScore = (...args) => (USE_SUPABASE ? supabaseImpl : firebaseImpl).computeAreaScore(...args);
export const computeAreaScoreWithExplanation = (...args) => (USE_SUPABASE ? supabaseImpl : firebaseImpl).computeAreaScoreWithExplanation(...args);
export const applyAreaOverride = (...args) => (USE_SUPABASE ? supabaseImpl : firebaseImpl).applyAreaOverride(...args);
export const deleteWorkArea = (...args) => (USE_SUPABASE ? supabaseImpl : firebaseImpl).deleteWorkArea(...args);
export const updateWorkAreaTypeMapping = (...args) => (USE_SUPABASE ? supabaseImpl : firebaseImpl).updateWorkAreaTypeMapping(...args);
export const updateWorkAreaTaskTypes = (...args) => (USE_SUPABASE ? supabaseImpl : firebaseImpl).updateWorkAreaTaskTypes(...args);
