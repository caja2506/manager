/**
 * engineeringDataService — Proxy
 * ================================
 * Routes to Firebase or Supabase implementation based on VITE_DB_BACKEND.
 */

import { USE_SUPABASE } from './_backend';

const impl = USE_SUPABASE
    ? await import('./engineeringDataService.supabase.js')
    : await import('./engineeringDataService.firebase.js');

export const fetchProjectMilestones = impl.fetchProjectMilestones;
export const fetchMilestoneWorkAreas = impl.fetchMilestoneWorkAreas;
export const fetchTaskDependencies = impl.fetchTaskDependencies;
export const fetchTaskPlannerItems = impl.fetchTaskPlannerItems;
export const addWorkAreaType = impl.addWorkAreaType;
