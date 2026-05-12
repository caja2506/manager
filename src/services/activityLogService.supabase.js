/**
 * Activity Log Service — Supabase Implementation
 * ===============================================
 * Drop-in replacement for activityLogService.js (Firestore version).
 *
 * KEY DIFFERENCE: Firestore used sub-collections (tasks/{taskId}/activityLog/{logId}).
 * Supabase uses a flat table `task_activity_log` with a `task_id` FK.
 *
 * @module services/activityLogService.supabase
 */

import { supabase } from '../supabase';

// ── Event types (same as Firestore version) ──
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

const TYPE_CONFIG = {
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

export { TYPE_CONFIG as ACTIVITY_TYPE_CONFIG };

/**
 * Log an activity event for a specific task.
 *
 * @param {string} taskId
 * @param {Object} event — { type, description, userId, userName, meta }
 */
export async function logActivity(taskId, { type, description, userId = null, userName = null, meta = {} }) {
    if (!taskId || !type) return;

    try {
        const now = new Date();
        const timestamp = now.toISOString();
        const localDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

        await supabase
            .from('task_activity_log')
            .insert({
                task_id: taskId,
                type,
                description: description || TYPE_CONFIG[type]?.label || type,
                user_id: userId,
                user_name: userName,
                timestamp,
                date: localDate,
                meta,
            });
    } catch (err) {
        // Non-blocking: don't break the main action if logging fails
        console.warn('[activityLogService.sb] Failed to log activity:', err.message);
    }
}

/**
 * Fetch activity logs for a single task, ordered by timestamp desc.
 *
 * @param {string} taskId
 * @param {number} maxItems — max items to return
 * @returns {Array}
 */
export async function fetchTaskActivityLog(taskId, maxItems = 100) {
    if (!taskId) return [];

    try {
        const { data, error } = await supabase
            .from('task_activity_log')
            .select('*')
            .eq('task_id', taskId)
            .order('timestamp', { ascending: false })
            .limit(maxItems);

        if (error) throw error;

        return (data || []).map(mapRow);
    } catch (err) {
        console.warn('[activityLogService.sb] Failed to fetch task activity:', err.message);
        return [];
    }
}

/**
 * Fetch activity logs across ALL tasks, filtered by date range.
 * Replaces Firestore collectionGroup query.
 *
 * @param {string} dateFrom — 'YYYY-MM-DD'
 * @param {string} dateTo — 'YYYY-MM-DD'
 * @returns {Array}
 */
export async function fetchAllActivityLogs(dateFrom, dateTo) {
    try {
        const { data, error } = await supabase
            .from('task_activity_log')
            .select('*')
            .gte('date', dateFrom)
            .lte('date', dateTo)
            .order('date', { ascending: false })
            .limit(2000);

        if (error) throw error;

        return (data || []).map(mapRow);
    } catch (err) {
        console.warn('[activityLogService.sb] Failed to fetch all activity logs:', err.message);
        return [];
    }
}

/**
 * Update fields on an existing activity log.
 * @param {string} taskId — not used (flat table, kept for API compat)
 * @param {string} logId
 * @param {Object} updates — e.g. { userName, description }
 */
export async function updateActivityLog(taskId, logId, updates) {
    const mapped = {};
    if (updates.userName !== undefined) mapped.user_name = updates.userName;
    if (updates.description !== undefined) mapped.description = updates.description;

    const { error } = await supabase
        .from('task_activity_log')
        .update(mapped)
        .eq('id', logId);

    if (error) throw new Error(`[activityLogService.sb] update: ${error.message}`);
}

/**
 * Delete an activity log entry.
 * @param {string} taskId — not used (flat table, kept for API compat)
 * @param {string} logId
 */
export async function deleteActivityLog(taskId, logId) {
    const { error } = await supabase
        .from('task_activity_log')
        .delete()
        .eq('id', logId);

    if (error) throw new Error(`[activityLogService.sb] delete: ${error.message}`);
}

// ── Mapper: snake_case → camelCase ──
function mapRow(row) {
    return {
        id: row.id,
        taskId: row.task_id,
        type: row.type,
        description: row.description,
        userId: row.user_id,
        userName: row.user_name,
        timestamp: row.timestamp,
        date: row.date,
        meta: row.meta || {},
    };
}
