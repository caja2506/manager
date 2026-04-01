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
    collection, doc, setDoc, getDocs, query, where, orderBy, limit,
    collectionGroup
} from 'firebase/firestore';

// ── Event types ──
export const ACTIVITY_TYPES = {
    SUBTASK_COMPLETED: 'subtask_completed',
    SUBTASK_UNCHECKED: 'subtask_unchecked',
    STATUS_CHANGED: 'status_changed',
    TIMER_STARTED: 'timer_started',
    TIMER_STOPPED: 'timer_stopped',
    DELAY_REPORTED: 'delay_reported',
};

const TYPE_CONFIG = {
    [ACTIVITY_TYPES.SUBTASK_COMPLETED]: { icon: '✅', color: '#22c55e', label: 'Subtarea completada' },
    [ACTIVITY_TYPES.SUBTASK_UNCHECKED]: { icon: '⬜', color: '#64748b', label: 'Subtarea desmarcada' },
    [ACTIVITY_TYPES.STATUS_CHANGED]: { icon: '🔄', color: '#6366f1', label: 'Cambio de estado' },
    [ACTIVITY_TYPES.TIMER_STARTED]: { icon: '▶️', color: '#f59e0b', label: 'Timer iniciado' },
    [ACTIVITY_TYPES.TIMER_STOPPED]: { icon: '⏹️', color: '#f59e0b', label: 'Timer detenido' },
    [ACTIVITY_TYPES.DELAY_REPORTED]: { icon: '⚠️', color: '#ef4444', label: 'Retraso reportado' },
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
