/**
 * Gantt Service — Proxy
 * =====================
 * Routes to Firebase or Supabase implementation based on VITE_DB_BACKEND.
 */

import { USE_SUPABASE } from './_backend';

const impl = USE_SUPABASE
    ? await import('./ganttService.supabase.js')
    : await import('./ganttService.firebase.js');

export const getTasksForGantt = impl.getTasksForGantt;
export const getDependencies = impl.getDependencies;
export const getProjectsForGantt = impl.getProjectsForGantt;
export const getTaskTypesForGantt = impl.getTaskTypesForGantt;
export const getUsersForGantt = impl.getUsersForGantt;
export const getMilestonesForGantt = impl.getMilestonesForGantt;
export const updateTaskGanttFields = impl.updateTaskGanttFields;
export const createDependency = impl.createDependency;
export const deleteDependency = impl.deleteDependency;
