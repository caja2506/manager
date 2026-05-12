/**
 * Activity Log Service — Proxy
 * ============================
 * Routes to Firebase or Supabase implementation based on VITE_DB_BACKEND.
 */

import { USE_SUPABASE } from './_backend';

const impl = USE_SUPABASE
    ? await import('./activityLogService.supabase.js')
    : await import('./activityLogService.firebase.js');

export const ACTIVITY_TYPES = impl.ACTIVITY_TYPES;
export const ACTIVITY_TYPE_CONFIG = impl.ACTIVITY_TYPE_CONFIG;
export const logActivity = impl.logActivity;
export const fetchTaskActivityLog = impl.fetchTaskActivityLog;
export const fetchAllActivityLogs = impl.fetchAllActivityLogs;
export const updateActivityLog = impl.updateActivityLog;
export const deleteActivityLog = impl.deleteActivityLog;
