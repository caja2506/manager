/**
 * Time Tracking Service
 * =====================
 * CRUD operations for time log entries.
 *
 * ARCHITECTURE (V6): Timer state lives entirely in Firestore.
 * An "active timer" = a timeLog document with endTime === null.
 * localStorage is no longer used for timer state.
 *
 * This enables:
 *  - Admin/Manager/TL can start timers for other users
 *  - Timer visible in any browser/device
 *  - Timer is auditable and modifiable
 */
import { db } from '../firebase';
import {
    collection, doc, setDoc, updateDoc, deleteDoc,
    query, where, getDocs, getDoc
} from 'firebase/firestore';
import { COLLECTIONS, createTimeLogDocument } from '../models/schemas';
import { calculateProjectRisk } from './riskService';

// ============================================================
// ACTIVE TIMER — Firestore-based (no localStorage)
// ============================================================

/**
 * Find the active (open) timer for a given user from pre-loaded timeLogs.
 * An active timer = timeLog where endTime is null/empty.
 *
 * @param {Array} timeLogs — all time logs (from useEngineeringData)
 * @param {string} userId — the user to find an active timer for
 * @returns {Object|null} — the active time log object, or null
 */
export function getActiveTimerFromLogs(timeLogs, userId) {
    if (!timeLogs || !userId) return null;
    return timeLogs.find(
        log => log.userId === userId && !log.endTime && log.startTime
    ) || null;
}

/**
 * Find the active timer for a specific task (regardless of user).
 * Useful for checking if a task already has a running timer.
 *
 * @param {Array} timeLogs — all time logs
 * @param {string} taskId — the task to check
 * @returns {Object|null}
 */
export function getActiveTimerForTask(timeLogs, taskId) {
    if (!timeLogs || !taskId) return null;
    return timeLogs.find(
        log => log.taskId === taskId && !log.endTime && log.startTime
    ) || null;
}

/**
 * Check if a user has permission to start/stop timers for OTHER users.
 * - Admin (RBAC role) → yes
 * - Manager (teamRole) → yes
 * - Team Lead (teamRole) → yes
 * - Everyone else → only their own
 *
 * @param {string} role — RBAC role (admin/editor/viewer)
 * @param {string} teamRole — operational team role (manager/team_lead/engineer/technician)
 * @returns {boolean}
 */
export function canManageOthersTimers(role, teamRole) {
    if (role === 'admin') return true;
    if (teamRole === 'manager' || teamRole === 'team_lead') return true;
    return false;
}

// ============================================================
// START / STOP TIMER
// ============================================================

/**
 * Start a new timer. Creates an "open" time log in Firestore.
 * No localStorage is touched.
 *
 * @returns {Object} — { logId, taskId, projectId, startTime, userId }
 */
export async function startTimer({ taskId, projectId, userId, notes = '', overtime = false }) {
    const now = new Date().toISOString();
    const logData = createTimeLogDocument({
        taskId,
        projectId,
        userId,
        startTime: now,
        endTime: null,
        totalHours: 0,
        overtime,
        notes,
    });
    const ref = doc(collection(db, COLLECTIONS.TIME_LOGS));
    await setDoc(ref, logData);
    return { logId: ref.id, taskId, projectId, startTime: now, userId };
}

/**
 * Stop an active timer by its log ID.
 * Updates the Firestore time log with endTime and totalHours.
 *
 * @param {string} logId — the time log document ID
 * @param {Object} options — { notes, overtime }
 * @returns {Object|null} — { totalHours, overtimeHours, taskId }
 */
export async function stopTimer(logId, { notes = '', overtime = false } = {}) {
    if (!logId) return null;

    const now = new Date();
    const logRef = doc(db, COLLECTIONS.TIME_LOGS, logId);

    // Read the log to get startTime
    let logSnap;
    try {
        logSnap = await getDoc(logRef);
    } catch (err) {
        console.warn('[timeService] Could not read time log:', err.message);
        return null;
    }

    if (!logSnap.exists()) {
        console.warn(`[timeService] Time log ${logId} not found`);
        return null;
    }

    const logData = logSnap.data();
    const startTime = new Date(logData.startTime);
    const totalMs = now - startTime;
    let totalHours = parseFloat((totalMs / 3600000).toFixed(6));

    // Fallback: at least 1 minute
    if (totalHours < 0.016666) {
        totalHours = 0.016666;
    }

    const overtimeHours = overtime ? totalHours : 0;

    try {
        await updateDoc(logRef, {
            endTime: now.toISOString(),
            totalHours,
            overtime,
            overtimeHours,
            notes: notes || logData.notes || '',
        });

        // Recalculate task's actualHours
        if (logData.taskId) {
            await recalculateTaskHours(logData.taskId);
        }

        if (logData.projectId && (overtime || overtimeHours > 0)) {
            await calculateProjectRisk(logData.projectId);
        }
    } catch (err) {
        console.error('[timeService] Error stopping timer:', err);
    }

    return { totalHours, overtimeHours, taskId: logData.taskId };
}

// ============================================================
// LEGACY CLEANUP — remove orphaned localStorage timers
// ============================================================

/**
 * One-time cleanup: remove any leftover localStorage timer from the old system.
 * Call this once on app startup to clear zombie timers.
 */
export function clearLegacyTimer() {
    try {
        localStorage.removeItem('autobom_active_timer');
    } catch { /* ignore */ }
}

// ============================================================
// TASK HOURS AGGREGATION
// ============================================================

/**
 * Recalculate the actualHours field on a task by summing all its completed timeLogs.
 */
export async function recalculateTaskHours(taskId) {
    if (!taskId) return;
    try {
        const logsSnap = await getDocs(
            query(collection(db, COLLECTIONS.TIME_LOGS), where('taskId', '==', taskId))
        );
        let totalHours = 0;
        logsSnap.docs.forEach(d => {
            const data = d.data();
            if (data.totalHours && data.endTime) {
                totalHours += data.totalHours;
            }
        });

        totalHours = parseFloat(totalHours.toFixed(4));
        await updateDoc(doc(db, COLLECTIONS.TASKS, taskId), {
            actualHours: totalHours,
            updatedAt: new Date().toISOString(),
        });
    } catch (err) {
        console.error('Error recalculating task hours:', err);
    }
}

// ============================================================
// MANUAL ENTRY CRUD
// ============================================================

export async function createManualTimeLog({
    taskId, projectId, userId, startTime, endTime, notes, overtime,
}) {
    const start = new Date(startTime);
    const end = new Date(endTime);
    const totalMs = end - start;
    let totalHours = parseFloat((totalMs / 3600000).toFixed(6));

    if (totalHours > 0 && totalHours < 0.016666) {
        totalHours = 0.016666;
    } else if (totalHours < 0) {
        totalHours = 0;
    }

    const overtimeHours = overtime ? totalHours : 0;

    const logData = createTimeLogDocument({
        taskId,
        projectId,
        userId,
        startTime: start.toISOString(),
        endTime: end.toISOString(),
        totalHours,
        overtime,
        overtimeHours,
        notes,
    });

    const ref = doc(collection(db, COLLECTIONS.TIME_LOGS));
    await setDoc(ref, logData);

    if (taskId) await recalculateTaskHours(taskId);

    if (projectId && (overtime || overtimeHours > 0)) {
        await calculateProjectRisk(projectId);
    }

    return ref.id;
}

export async function updateTimeLog(logId, updates) {
    if (updates.startTime && updates.endTime) {
        const start = new Date(updates.startTime);
        const end = new Date(updates.endTime);
        const totalMs = end - start;
        updates.totalHours = parseFloat((totalMs / 3600000).toFixed(6));
        if (updates.overtime) {
            updates.overtimeHours = updates.totalHours;
        }
    }
    await updateDoc(doc(db, COLLECTIONS.TIME_LOGS, logId), updates);

    if (updates.overtime !== undefined) {
        const snap = await getDoc(doc(db, COLLECTIONS.TIME_LOGS, logId));
        if (snap.exists() && snap.data().projectId) {
            await calculateProjectRisk(snap.data().projectId);
        }
    }
}

export async function deleteTimeLog(logId, taskId = null, projectId = null) {
    try {
        await deleteDoc(doc(db, COLLECTIONS.TIME_LOGS, logId));
        if (taskId) await recalculateTaskHours(taskId);
        if (projectId) await calculateProjectRisk(projectId);
    } catch (err) {
        console.error('CRITICAL: Error deleting time log:', err);
        throw err;
    }
}

// ============================================================
// HELPERS
// ============================================================

export function formatDuration(hours) {
    if (!hours || hours <= 0) return '0:00';
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    return `${h}:${m.toString().padStart(2, '0')}`;
}

export function formatElapsed(startIso) {
    if (!startIso) return '0:00:00';
    const now = new Date();
    const start = new Date(startIso);
    const totalSeconds = Math.max(0, Math.floor((now - start) / 1000));
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}
