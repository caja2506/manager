/**
 * Score Log Service — Proxy
 * ===========================
 * Routes to Firebase or Supabase implementation based on VITE_DB_BACKEND.
 */

import { USE_SUPABASE } from './_backend';

const impl = USE_SUPABASE
    ? await import('./scoreLogService.supabase.js')
    : await import('./scoreLogService.firebase.js');

export const saveScoreLog = impl.saveScoreLog;
export const saveTeamScoreLogs = impl.saveTeamScoreLogs;
export const getScoreLogs = impl.getScoreLogs;
export const getTeamLogsForDate = impl.getTeamLogsForDate;
export const getWeeklyAverages = impl.getWeeklyAverages;
