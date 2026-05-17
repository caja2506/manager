/**
 * timeService — Proxy
 * ============================
 * Routes to Firebase or Supabase implementation based on VITE_DB_BACKEND.
 * Note: Refactored to remove top-level await to fix production deadlocks.
 */

import { USE_SUPABASE } from './_backend';
import * as supabaseImpl from './timeService.supabase.js';
import * as firebaseImpl from './timeService.firebase.js';

export const getActiveTimerFromLogs = (...args) => (USE_SUPABASE ? supabaseImpl : firebaseImpl).getActiveTimerFromLogs(...args);
export const getAllActiveTimersForUser = (...args) => (USE_SUPABASE ? supabaseImpl : firebaseImpl).getAllActiveTimersForUser(...args);
export const getActiveTimerForTask = (...args) => (USE_SUPABASE ? supabaseImpl : firebaseImpl).getActiveTimerForTask(...args);
export const canManageOthersTimers = (...args) => (USE_SUPABASE ? supabaseImpl : firebaseImpl).canManageOthersTimers(...args);
export const isSupervisorOf = (...args) => (USE_SUPABASE ? supabaseImpl : firebaseImpl).isSupervisorOf(...args);
export const startTimer = (...args) => (USE_SUPABASE ? supabaseImpl : firebaseImpl).startTimer(...args);
export const startTimerSafe = (...args) => (USE_SUPABASE ? supabaseImpl : firebaseImpl).startTimerSafe(...args);
export const stopTimer = (...args) => (USE_SUPABASE ? supabaseImpl : firebaseImpl).stopTimer(...args);
export const handleTaskStatusTimerSync = (...args) => (USE_SUPABASE ? supabaseImpl : firebaseImpl).handleTaskStatusTimerSync(...args);
export const forceStopTaskTimers = (...args) => (USE_SUPABASE ? supabaseImpl : firebaseImpl).forceStopTaskTimers(...args);
export const closeDay = (...args) => (USE_SUPABASE ? supabaseImpl : firebaseImpl).closeDay(...args);
export const openDay = (...args) => (USE_SUPABASE ? supabaseImpl : firebaseImpl).openDay(...args);
export const recalculateTaskHours = (...args) => (USE_SUPABASE ? supabaseImpl : firebaseImpl).recalculateTaskHours(...args);
export const createManualTimeLog = (...args) => (USE_SUPABASE ? supabaseImpl : firebaseImpl).createManualTimeLog(...args);
export const addSimpleManualTimeLog = (...args) => (USE_SUPABASE ? supabaseImpl : firebaseImpl).addSimpleManualTimeLog(...args);
export const updateTimeLog = (...args) => (USE_SUPABASE ? supabaseImpl : firebaseImpl).updateTimeLog(...args);
export const deleteTimeLog = (...args) => (USE_SUPABASE ? supabaseImpl : firebaseImpl).deleteTimeLog(...args);
export const formatDuration = (...args) => (USE_SUPABASE ? supabaseImpl : firebaseImpl).formatDuration(...args);
export const formatElapsed = (...args) => (USE_SUPABASE ? supabaseImpl : firebaseImpl).formatElapsed(...args);
export const clearLegacyTimer = (...args) => (USE_SUPABASE ? supabaseImpl : firebaseImpl).clearLegacyTimer(...args);
