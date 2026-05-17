/**
 * scoreLogService — Proxy
 * ============================
 * Routes to Firebase or Supabase implementation based on VITE_DB_BACKEND.
 * Note: Refactored to remove top-level await to fix production deadlocks.
 */

import { USE_SUPABASE } from './_backend';
import * as supabaseImpl from './scoreLogService.supabase.js';
import * as firebaseImpl from './scoreLogService.firebase.js';

export const saveScoreLog = (...args) => (USE_SUPABASE ? supabaseImpl : firebaseImpl).saveScoreLog(...args);
export const saveTeamScoreLogs = (...args) => (USE_SUPABASE ? supabaseImpl : firebaseImpl).saveTeamScoreLogs(...args);
export const getScoreLogs = (...args) => (USE_SUPABASE ? supabaseImpl : firebaseImpl).getScoreLogs(...args);
export const getTeamLogsForDate = (...args) => (USE_SUPABASE ? supabaseImpl : firebaseImpl).getTeamLogsForDate(...args);
export const getWeeklyAverages = (...args) => (USE_SUPABASE ? supabaseImpl : firebaseImpl).getWeeklyAverages(...args);
