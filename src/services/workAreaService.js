/**
 * workAreaService — Proxy
 * ============================
 * Routes to Firebase or Supabase implementation based on VITE_DB_BACKEND.
 * Note: Refactored to remove top-level await to fix production deadlocks.
 */

import * as supabaseImpl from './workAreaService.supabase.js';

export const createWorkArea = (...args) => supabaseImpl.createWorkArea(...args);
export const updateWorkArea = (...args) => supabaseImpl.updateWorkArea(...args);
export const getWorkAreasByMilestone = (...args) => supabaseImpl.getWorkAreasByMilestone(...args);
export const getWorkAreasByProject = (...args) => supabaseImpl.getWorkAreasByProject(...args);
export const getFilteredTasks = (...args) => supabaseImpl.getFilteredTasks(...args);
export const computeAreaScore = (...args) => supabaseImpl.computeAreaScore(...args);
export const computeAreaScoreWithExplanation = (...args) => supabaseImpl.computeAreaScoreWithExplanation(...args);
export const applyAreaOverride = (...args) => supabaseImpl.applyAreaOverride(...args);
export const deleteWorkArea = (...args) => supabaseImpl.deleteWorkArea(...args);
export const updateWorkAreaTypeMapping = (...args) => supabaseImpl.updateWorkAreaTypeMapping(...args);
export const updateWorkAreaTaskTypes = (...args) => supabaseImpl.updateWorkAreaTaskTypes(...args);
