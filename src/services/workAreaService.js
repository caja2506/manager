/**
 * Work Area Service — Proxy
 * ===========================
 * Routes to Firebase or Supabase implementation based on VITE_DB_BACKEND.
 */

import { USE_SUPABASE } from './_backend';

const impl = USE_SUPABASE
    ? await import('./workAreaService.supabase.js')
    : await import('./workAreaService.firebase.js');

export const createWorkArea = impl.createWorkArea;
export const updateWorkArea = impl.updateWorkArea;
export const getWorkAreasByMilestone = impl.getWorkAreasByMilestone;
export const getWorkAreasByProject = impl.getWorkAreasByProject;
export const getFilteredTasks = impl.getFilteredTasks;
export const computeAreaScore = impl.computeAreaScore;
export const computeAreaScoreWithExplanation = impl.computeAreaScoreWithExplanation;
export const applyAreaOverride = impl.applyAreaOverride;
export const deleteWorkArea = impl.deleteWorkArea;
export const updateWorkAreaTypeMapping = impl.updateWorkAreaTypeMapping;
export const updateWorkAreaTaskTypes = impl.updateWorkAreaTaskTypes;
