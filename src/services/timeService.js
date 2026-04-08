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
import { logActivity, ACTIVITY_TYPES } from './activityLogService';
import { getEffectiveHours, getBreakHoursInRange } from '../utils/breakTimeUtils';

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
 * Find ALL active (open) timers for a given user.
 * Unlike getActiveTimerFromLogs which returns only the first,
 * this returns ALL — useful for detecting ghost/duplicate timers.
 */
export function getAllActiveTimersForUser(timeLogs, userId) {
    if (!timeLogs || !userId) return [];
    return timeLogs.filter(
        log => log.userId === userId && !log.endTime && log.startTime
    );
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
export async function startTimer({ taskId, projectId, userId, notes = '', overtime = false, taskTitle = '', projectName = '', displayName = '', source = 'manual' }) {
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
        taskTitle,
        projectName,
        displayName,
        source,
    });
    const ref = doc(collection(db, COLLECTIONS.TIME_LOGS));
    await setDoc(ref, logData);

    // Log activity
    if (taskId) {
        logActivity(taskId, {
            type: ACTIVITY_TYPES.TIMER_STARTED,
            description: 'Timer iniciado',
            userId,
            meta: { logId: ref.id, notes, source },
        });
    }

    return { logId: ref.id, taskId, projectId, startTime: now, userId };
}

/**
 * Safe timer start with mutex: checks for active timers, asks for confirmation,
 * auto-stops existing timers, then starts the new one.
 *
 * @param {Object} params — same as startTimer, plus:
 * @param {Function} onConfirm — async (info) => boolean — called if there's an active timer.
 *   Receives { activeTaskTitle, newTaskTitle }. Return true to proceed, false to cancel.
 */
export async function startTimerSafe({ taskId, projectId, userId, notes = '', overtime = false,
    taskTitle = '', projectName = '', displayName = '', source = 'manual', onConfirm }) {
    // 1. Query Firestore for ANY active timer for this user (real-time, not snapshot)
    const activeQuery = query(
        collection(db, COLLECTIONS.TIME_LOGS),
        where('userId', '==', userId),
        where('endTime', '==', null)
    );
    const activeSnap = await getDocs(activeQuery);

    // 2. If active timer exists → ask for confirmation
    if (!activeSnap.empty) {
        const activeData = activeSnap.docs[0].data();

        if (onConfirm) {
            const confirmed = await onConfirm({
                activeTaskTitle: activeData.taskTitle || activeData.taskId || 'tarea actual',
                newTaskTitle: taskTitle || taskId || 'nueva tarea',
            });
            if (!confirmed) return null; // User cancelled
        }

        // Auto-stop ALL active timers (including ghosts)
        for (const activeDoc of activeSnap.docs) {
            try {
                await stopTimer(activeDoc.id, { notes: '[Auto-detenido al iniciar nuevo timer]' });
            } catch (err) {
                console.warn('[timeService] Error auto-stopping timer:', activeDoc.id, err.message);
            }
        }
    }

    // 3. Start new timer
    return await startTimer({ taskId, projectId, userId, notes, overtime, taskTitle, projectName, displayName, source });
}

/**
 * Central handler for task status changes that affect timers.
 * Replaces duplicate logic in TaskDetailModal, TaskManager, TaskCard.
 *
 * @param {string} newStatus — the new status of the task
 * @param {Function} onConfirm — confirmation callback for startTimerSafe
 */
export async function handleTaskStatusTimerSync({
    taskId, projectId, newStatus, userId, timeLogs,
    taskTitle = '', projectName = '', displayName = '', onConfirm,
}) {
    if (newStatus === 'in_progress') {
        // Check if this task already has a timer running
        const existing = getActiveTimerForTask(timeLogs, taskId);
        if (existing) return null; // Already running for this task

        return await startTimerSafe({
            taskId, projectId, userId,
            taskTitle, projectName, displayName,
            source: 'kanban_auto',
            timeLogs, onConfirm,
        });
    }

    if (['completed', 'cancelled', 'blocked'].includes(newStatus)) {
        const activeLog = getActiveTimerForTask(timeLogs, taskId);
        if (activeLog) {
            return await stopTimer(activeLog.id, { notes: `Auto-detenido: tarea → ${newStatus}` });
        }
    }
    return null;
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
    const totalHoursGross = parseFloat((totalMs / 3600000).toFixed(6));
    let totalHours = getEffectiveHours(startTime, now);

    // Fallback: at least 1 minute
    if (totalHours < 0.016666) {
        totalHours = 0.016666;
    }

    const breakHoursDeducted = parseFloat((totalHoursGross - totalHours).toFixed(4));
    const overtimeHours = overtime ? totalHours : 0;

    try {
        await updateDoc(logRef, {
            endTime: now.toISOString(),
            totalHours,
            totalHoursGross,
            breakHoursDeducted,
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

    // Log activity
    if (logData.taskId) {
        logActivity(logData.taskId, {
            type: ACTIVITY_TYPES.TIMER_STOPPED,
            description: `Timer detenido (${totalHours.toFixed(1)}h)`,
            userId: logData.userId,
            meta: { logId, totalHours, overtimeHours },
        });
    }

    return { totalHours, overtimeHours, taskId: logData.taskId };
}

// ============================================================
// DAY CLOSE / DAY OPEN — batch timer management
// ============================================================

/**
 * Close the day: stop ALL active timers and mark them as autoStopped.
 * This allows openDay() to know which timers to restart the next morning.
 *
 * @param {Array} timeLogs — all time logs (from useEngineeringData)
 * @returns {number} — count of timers stopped
 */
export async function closeDay(timeLogs) {
    const runningTimers = (timeLogs || []).filter(log => !log.endTime && log.startTime);
    if (runningTimers.length === 0) return 0;

    const now = new Date();
    let stopped = 0;

    for (const log of runningTimers) {
        const startTime = new Date(log.startTime);
        const totalMs = now - startTime;
        const totalHoursGross = parseFloat((totalMs / 3600000).toFixed(6));
        let totalHours = getEffectiveHours(startTime, now);
        if (totalHours < 0.016666) totalHours = 0.016666;
        const breakHoursDeducted = parseFloat((totalHoursGross - totalHours).toFixed(4));

        try {
            await updateDoc(doc(db, COLLECTIONS.TIME_LOGS, log.id), {
                endTime: now.toISOString(),
                totalHours,
                totalHoursGross,
                breakHoursDeducted,
                autoStopped: true,
                notes: (log.notes || '') + ' [Auto-cerrado al cierre de día]',
            });

            if (log.taskId) {
                await recalculateTaskHours(log.taskId);
            }
            stopped++;
        } catch (err) {
            console.error(`[closeDay] Error stopping timer ${log.id}:`, err);
        }
    }

    return stopped;
}

/**
 * Open the day: find timers that were auto-stopped yesterday (closeDay)
 * and restart them for the same task/user combinations.
 *
 * @param {Array} timeLogs — all time logs (from useEngineeringData)
 * @param {Array} tasks — all engineering tasks (to check status is still in_progress)
 * @returns {number} — count of timers restarted
 */
export async function openDay(timeLogs, tasks) {
    // Find auto-stopped timers from the last 24 hours
    const yesterday = new Date(Date.now() - 24 * 3600000);

    const autoStoppedTimers = (timeLogs || []).filter(log => {
        if (!log.autoStopped) return false;
        if (!log.endTime) return false;
        const endTime = new Date(log.endTime);
        return endTime >= yesterday;
    });

    if (autoStoppedTimers.length === 0) return 0;

    // Deduplicate by taskId+userId (in case of multiple auto-stops)
    const seen = new Set();
    const uniqueTimers = [];
    for (const log of autoStoppedTimers) {
        const key = `${log.taskId || ''}_${log.userId}`;
        if (!seen.has(key)) {
            seen.add(key);
            uniqueTimers.push(log);
        }
    }

    let restarted = 0;

    for (const log of uniqueTimers) {
        // Check if there's already an active timer for this task
        const alreadyRunning = (timeLogs || []).find(
            l => l.taskId === log.taskId && l.userId === log.userId && !l.endTime
        );
        if (alreadyRunning) continue;

        // Check if task is still in_progress
        if (log.taskId) {
            const task = (tasks || []).find(t => t.id === log.taskId);
            if (task && task.status !== 'in_progress') continue;
        }

        try {
            await startTimer({
                taskId: log.taskId,
                projectId: log.projectId,
                userId: log.userId,
                notes: 'Auto-iniciado al abrir el día',
                overtime: false,
                source: 'open_day',
            });

            // Clear the autoStopped flag on the original log
            await updateDoc(doc(db, COLLECTIONS.TIME_LOGS, log.id), {
                autoStopped: false,
            });

            restarted++;
        } catch (err) {
            console.error(`[openDay] Error restarting timer:`, err);
        }
    }

    return restarted;
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
    const totalHoursGross = parseFloat((totalMs / 3600000).toFixed(6));
    let totalHours = getEffectiveHours(start, end);

    if (totalHours > 0 && totalHours < 0.016666) {
        totalHours = 0.016666;
    } else if (totalHours < 0) {
        totalHours = 0;
    }

    const breakHoursDeducted = parseFloat((totalHoursGross - totalHours).toFixed(4));
    const overtimeHours = overtime ? totalHours : 0;

    const logData = createTimeLogDocument({
        taskId,
        projectId,
        userId,
        startTime: start.toISOString(),
        endTime: end.toISOString(),
        totalHours,
        totalHoursGross,
        breakHoursDeducted,
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

export async function addSimpleManualTimeLog({
    taskId, projectId, userId, dateIso, hours, notes, overtime
}) {
    const hrs = parseFloat(hours);
    if (!hrs || hrs <= 0) return null;
    
    // Create a fake interval that exactly matches the requested hours 
    // without crossing the break time (12:00PM - 1:00PM)
    const baseDate = dateIso ? new Date(dateIso) : new Date();
    baseDate.setHours(13, 0, 0, 0); // Start at 1:00 PM to avoid lunch deductions
    
    const startIso = baseDate.toISOString();
    const endIso = new Date(baseDate.getTime() + (hrs * 3600000)).toISOString();
    
    const logData = createTimeLogDocument({
        taskId,
        projectId,
        userId,
        startTime: startIso,
        endTime: endIso,
        totalHours: hrs,
        totalHoursGross: hrs,
        breakHoursDeducted: 0,
        overtime: !!overtime,
        overtimeHours: overtime ? hrs : 0,
        notes: notes || 'Registro manual',
    });

    const ref = doc(collection(db, COLLECTIONS.TIME_LOGS));
    await setDoc(ref, logData);

    if (taskId) {
        await recalculateTaskHours(taskId);
        logActivity(taskId, {
            type: ACTIVITY_TYPES.TASK_UPDATED,
            description: `Se agregaron ${hrs}h manualmente`,
            userId,
            meta: { logId: ref.id, hours: hrs }
        });
    }

    if (projectId && (overtime || overtime ? hrs : 0 > 0)) {
        await calculateProjectRisk(projectId);
    }

    return ref.id;
}

export async function updateTimeLog(logId, updates) {
    if (updates.startTime && updates.endTime) {
        const start = new Date(updates.startTime);
        const end = new Date(updates.endTime);
        const totalMs = end - start;
        const totalHoursGross = parseFloat((totalMs / 3600000).toFixed(6));
        updates.totalHours = getEffectiveHours(start, end);
        updates.totalHoursGross = totalHoursGross;
        updates.breakHoursDeducted = parseFloat((totalHoursGross - updates.totalHours).toFixed(4));
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
    const grossMs = Math.max(0, now - start);
    // Subtract break hours that have already elapsed
    const breakHours = getBreakHoursInRange(start, now);
    const netMs = Math.max(0, grossMs - breakHours * 3_600_000);
    const totalSeconds = Math.floor(netMs / 1000);
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}
