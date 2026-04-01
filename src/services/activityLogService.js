/**
 * Activity Log Service
 * ====================
 * Records and retrieves activity events for tasks.
 * Events are stored in a sub-collection: tasks/{taskId}/activityLog/{logId}
 *
 * Event types:
 *   subtask_completed, subtask_unchecked,
 *   status_changed, timer_started, timer_stopped,
 *   delay_reported
 */

import { db } from '../firebase';
import {
    collection, doc, setDoc, getDocs, updateDoc, deleteDoc,
    query, where, orderBy, limit, collectionGroup
} from 'firebase/firestore';

// ── Event types ──
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
        // Use LOCAL date to match frontend filter (same fix as dailyScrumEngine)
        const localDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        const colRef = collection(db, 'tasks', taskId, 'activityLog');
        const ref = doc(colRef);

        await setDoc(ref, {
            type,
            description: description || TYPE_CONFIG[type]?.label || type,
            userId,
            userName,
            timestamp,
            date: localDate, // YYYY-MM-DD local timezone for date filtering
            meta,
            taskId, // denormalized for collectionGroup queries
        });
    } catch (err) {
        // Non-blocking: don't break the main action if logging fails
        console.warn('[activityLogService] Failed to log activity:', err.message);
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
        const colRef = collection(db, 'tasks', taskId, 'activityLog');
        const q = query(colRef, orderBy('timestamp', 'desc'), limit(maxItems));
        const snap = await getDocs(q);
        return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (err) {
        console.warn('[activityLogService] Failed to fetch task activity:', err.message);
        return [];
    }
}

/**
 * Fetch activity logs across ALL tasks using a collectionGroup query.
 * Filtered by date range. Requires Firestore index on collectionGroup 'activityLog'.
 *
 * @param {string} dateFrom — 'YYYY-MM-DD'
 * @param {string} dateTo — 'YYYY-MM-DD'
 * @returns {Array}
 */
export async function fetchAllActivityLogs(dateFrom, dateTo) {
    try {
        const colGroupRef = collectionGroup(db, 'activityLog');
        const q = query(
            colGroupRef,
            where('date', '>=', dateFrom),
            where('date', '<=', dateTo),
            orderBy('date', 'desc'),
            limit(2000)
        );
        const snap = await getDocs(q);
        return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (err) {
        console.warn('[activityLogService] Failed to fetch all activity logs:', err.message);
        return [];
    }
}
/**
 * Update fields on an existing activity log.
 * @param {string} taskId
 * @param {string} logId
 * @param {Object} updates — e.g. { userName, description }
 */
export async function updateActivityLog(taskId, logId, updates) {
    try {
        const ref = doc(db, 'tasks', taskId, 'activityLog', logId);
        await updateDoc(ref, updates);
    } catch (err) {
        console.warn('[activityLogService] Failed to update activity log:', err.message);
        throw err;
    }
}

/**
 * Delete an activity log entry.
 * @param {string} taskId
 * @param {string} logId
 */
export async function deleteActivityLog(taskId, logId) {
    try {
        const ref = doc(db, 'tasks', taskId, 'activityLog', logId);
        await deleteDoc(ref);
    } catch (err) {
        console.warn('[activityLogService] Failed to delete activity log:', err.message);
        throw err;
    }
}
