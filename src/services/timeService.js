/**
 * Time Service — Proxy
 * ====================
 * Routes to Firebase or Supabase implementation based on VITE_DB_BACKEND.
 */

import { USE_SUPABASE } from './_backend';

const impl = USE_SUPABASE
    ? await import('./timeService.supabase.js')
    : await import('./timeService.firebase.js');

// ── Active Timer (pure functions — same in both backends) ──
export const getActiveTimerFromLogs = impl.getActiveTimerFromLogs;
export const getAllActiveTimersForUser = impl.getAllActiveTimersForUser;
export const getActiveTimerForTask = impl.getActiveTimerForTask;
export const canManageOthersTimers = impl.canManageOthersTimers;
export const isSupervisorOf = impl.isSupervisorOf;

// ── Start / Stop ──
export const startTimer = impl.startTimer;
export const startTimerSafe = impl.startTimerSafe;
export const stopTimer = impl.stopTimer;
export const handleTaskStatusTimerSync = impl.handleTaskStatusTimerSync;
export const forceStopTaskTimers = impl.forceStopTaskTimers;

// ── Day Open / Close ──
export const closeDay = impl.closeDay;
export const openDay = impl.openDay;

// ── Aggregation ──
export const recalculateTaskHours = impl.recalculateTaskHours;

// ── Manual CRUD ──
export const createManualTimeLog = impl.createManualTimeLog;
export const addSimpleManualTimeLog = impl.addSimpleManualTimeLog;
export const updateTimeLog = impl.updateTimeLog;
export const deleteTimeLog = impl.deleteTimeLog;

// ── Helpers ──
export const formatDuration = impl.formatDuration;
export const formatElapsed = impl.formatElapsed;
export const clearLegacyTimer = impl.clearLegacyTimer;
