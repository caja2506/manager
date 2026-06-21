/**
 * activityLogService — Proxy
 * ============================
 * Routes to Firebase or Supabase implementation based on VITE_DB_BACKEND.
 * Note: Refactored to remove top-level await to fix production deadlocks.
 */

import * as supabaseImpl from './activityLogService.supabase.js';

export const ACTIVITY_TYPES = {
    SUBTASK_COMPLETED: 'subtask_completed',
    SUBTASK_UNCHECKED: 'subtask_unchecked',
    SUBTASK_CREATED: 'subtask_created',
    SUBTASK_DELETED: 'subtask_deleted',
    STATUS_CHANGED: 'status_changed',
    TIMER_STARTED: 'timer_started',
    TIMER_STOPPED: 'timer_stopped',
    DELAY_REPORTED: 'delay_reported',
    TASK_CREATED: 'task_created',
    TASK_COMPLETED: 'task_completed',
    PRIORITY_CHANGED: 'priority_changed',
    ASSIGNEE_CHANGED: 'assignee_changed',
    DUE_DATE_CHANGED: 'due_date_changed',
    TITLE_CHANGED: 'title_changed',
    DESCRIPTION_CHANGED: 'description_changed',
    TASK_PREEMPTED: 'task_preempted',
};

export const ACTIVITY_TYPE_CONFIG = {
    [ACTIVITY_TYPES.SUBTASK_COMPLETED]: { icon: '✅', color: '#22c55e', label: 'Subtarea completada' },
    [ACTIVITY_TYPES.SUBTASK_UNCHECKED]: { icon: '⬜', color: '#64748b', label: 'Subtarea desmarcada' },
    [ACTIVITY_TYPES.SUBTASK_CREATED]: { icon: '➕', color: '#06b6d4', label: 'Subtarea creada' },
    [ACTIVITY_TYPES.SUBTASK_DELETED]: { icon: '🗑️', color: '#ef4444', label: 'Subtarea eliminada' },
    [ACTIVITY_TYPES.STATUS_CHANGED]: { icon: '🔄', color: '#6366f1', label: 'Cambio de estado' },
    [ACTIVITY_TYPES.TIMER_STARTED]: { icon: '▶️', color: '#f59e0b', label: 'Timer iniciado' },
    [ACTIVITY_TYPES.TIMER_STOPPED]: { icon: '⏹️', color: '#f59e0b', label: 'Timer detenido' },
    [ACTIVITY_TYPES.DELAY_REPORTED]: { icon: '⚠️', color: '#ef4444', label: 'Retraso reportado' },
    [ACTIVITY_TYPES.TASK_CREATED]: { icon: '🆕', color: '#3b82f6', label: 'Tarea creada' },
    [ACTIVITY_TYPES.TASK_COMPLETED]: { icon: '🏁', color: '#22c55e', label: 'Tarea completada' },
    [ACTIVITY_TYPES.PRIORITY_CHANGED]: { icon: '🔺', color: '#f97316', label: 'Prioridad cambiada' },
    [ACTIVITY_TYPES.ASSIGNEE_CHANGED]: { icon: '👤', color: '#8b5cf6', label: 'Reasignación' },
    [ACTIVITY_TYPES.DUE_DATE_CHANGED]: { icon: '📅', color: '#ec4899', label: 'Fecha cambiada' },
    [ACTIVITY_TYPES.TITLE_CHANGED]: { icon: '✏️', color: '#64748b', label: 'Título editado' },
    [ACTIVITY_TYPES.DESCRIPTION_CHANGED]: { icon: '📝', color: '#64748b', label: 'Descripción editada' },
    [ACTIVITY_TYPES.TASK_PREEMPTED]: { icon: '⚡', color: '#a855f7', label: 'Interrumpida por prioridad' },
};

export const logActivity = (...args) => supabaseImpl.logActivity(...args);
export const fetchTaskActivityLog = (...args) => supabaseImpl.fetchTaskActivityLog(...args);
export const fetchAllActivityLogs = (...args) => supabaseImpl.fetchAllActivityLogs(...args);
export const updateActivityLog = (...args) => supabaseImpl.updateActivityLog(...args);
export const deleteActivityLog = (...args) => supabaseImpl.deleteActivityLog(...args);
