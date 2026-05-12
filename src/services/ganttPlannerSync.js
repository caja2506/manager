/**
 * ganttPlannerSync — Proxy
 * =========================
 * Routes to Firebase or Supabase implementation based on VITE_DB_BACKEND.
 */

import { USE_SUPABASE } from './_backend';

const impl = USE_SUPABASE
    ? await import('./ganttPlannerSync.supabase.js')
    : await import('./ganttPlannerSync.firebase.js');

export const syncGanttToPlanner = impl.syncGanttToPlanner;
export const syncPlannerToGantt = impl.syncPlannerToGantt;
