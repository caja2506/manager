/**
 * timeService — Direct Supabase export
 */
export {
  getActiveTimerFromLogs,
  getAllActiveTimersForUser,
  getActiveTimerForTask,
  canManageOthersTimers,
  isSupervisorOf,
  startTimer,
  startTimerSafe,
  stopTimer,
  handleTaskStatusTimerSync,
  forceStopTaskTimers,
  closeDay,
  openDay,
  recalculateTaskHours,
  confirmDraftLogs,
  createManualTimeLog,
  addSimpleManualTimeLog,
  updateTimeLog,
  deleteTimeLog,
  formatDuration,
  formatElapsed,
  clearLegacyTimer,
} from './timeService.supabase.js';
