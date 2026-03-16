/**
 * Time Tracking Service
 * CRUD operations for time log entries.
 */
import { db } from '../firebase';
import {
    collection, doc, setDoc, updateDoc, deleteDoc,
    query, where, getDocs, orderBy, getDoc
} from 'firebase/firestore';
import { COLLECTIONS, createTimeLogDocument } from '../models/schemas';
import { calculateProjectRisk } from './riskService';

// ============================================================
// ACTIVE TIMER — stored in localStorage + Firestore
// ============================================================

const TIMER_KEY = 'autobom_active_timer';

export function getActiveTimer() {
    const raw = localStorage.getItem(TIMER_KEY);
    if (!raw) return null;
    try {
        return JSON.parse(raw);
    } catch {
        return null;
    }
}

export function setActiveTimer(timer) {
    if (timer) {
        localStorage.setItem(TIMER_KEY, JSON.stringify(timer));
    } else {
        localStorage.removeItem(TIMER_KEY);
    }
}

// ============================================================
// START / STOP / PAUSE TIMER
// ============================================================

/**
 * Start a new timer. Creates an "open" time log in Firestore.
 */
export async function startTimer({ taskId, projectId, userId, notes = '', overtime = false, taskTitle = '', projectName = '' }) {
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

    const timer = { logId: ref.id, taskId, projectId, startTime: now, overtime, notes, taskTitle, projectName };
    setActiveTimer(timer);
    return timer;
}

/**
 * Stop the active timer. Updates the Firestore time log with endTime and totalHours.
 * Always clears localStorage to prevent stuck timers, even if Firestore update fails.
 */
export async function stopTimer(logId, { notes = '', overtime = false } = {}) {
    const now = new Date();
    const timer = getActiveTimer();
    if (!timer) {
        // No timer in localStorage — clear anyway
        setActiveTimer(null);
        return null;
    }

    // Use the logId from localStorage if passed logId doesn't match
    const effectiveLogId = logId || timer.logId;
    if (!effectiveLogId) {
        setActiveTimer(null);
        return null;
    }

    const startTime = new Date(timer.startTime);
    const totalMs = now - startTime;
    let totalHours = parseFloat((totalMs / 3600000).toFixed(6));

    // Fallback: If timer stopped too fast (less than 1 min), log at least 1 minute
    if (totalHours < 0.016666) {
        totalHours = 0.016666;
    }

    const overtimeHours = overtime ? totalHours : 0;

    try {
        await updateDoc(doc(db, COLLECTIONS.TIME_LOGS, effectiveLogId), {
            endTime: now.toISOString(),
            totalHours,
            overtime,
            overtimeHours,
            notes: notes || timer.notes || '',
        });

        // Update task's actualHours
        if (timer.taskId) {
            await recalculateTaskHours(timer.taskId);
        }

        if (timer.projectId && (overtime || overtimeHours > 0)) {
            await calculateProjectRisk(timer.projectId);
        }
    } catch (err) {
        console.warn('[timeService] Firestore update failed during stop, clearing timer anyway:', err.message);
    }

    // ALWAYS clear localStorage, even if Firestore update failed
    setActiveTimer(null);
    return { totalHours, overtimeHours, taskId: timer.taskId };
}

/**
 * Force-stop: unconditionally clears the active timer from localStorage.
 * Use when the normal stop fails (e.g., orphaned timer, Firestore doc missing).
 */
export function forceStopTimer() {
    const timer = getActiveTimer();
    setActiveTimer(null);
    console.warn('[timeService] Timer force-stopped:', timer?.logId);
    return timer;
}

/** Maximum hours before a timer is considered stale and auto-stopped */
const MAX_TIMER_HOURS = 10;

/**
 * Validate the active timer on app startup.
 * - If the Firestore time log document no longer exists → clear the timer
 * - If the timer has been running for more than MAX_TIMER_HOURS → auto-stop it
 * Call this once on app mount (e.g., in MyWork or App).
 * 
 * @returns {{ valid: boolean, autoStopped?: boolean, orphaned?: boolean, hours?: number }}
 */
export async function validateActiveTimer() {
    const timer = getActiveTimer();
    if (!timer) return { valid: true };

    // Check elapsed hours
    const hours = (Date.now() - new Date(timer.startTime).getTime()) / 3600000;

    // Check if Firestore doc still exists
    if (timer.logId) {
        try {
            const snap = await getDoc(doc(db, COLLECTIONS.TIME_LOGS, timer.logId));
            if (!snap.exists()) {
                console.warn(`[timeService] Orphaned timer: Firestore doc ${timer.logId} not found. Clearing.`);
                setActiveTimer(null);
                return { valid: false, orphaned: true, hours };
            }
        } catch (err) {
            console.warn('[timeService] Could not validate timer doc:', err.message);
            // Don't clear on network errors — might just be offline
        }
    }

    // Auto-stop if running too long
    if (hours > MAX_TIMER_HOURS) {
        console.warn(`[timeService] Timer running ${hours.toFixed(1)}h (>${MAX_TIMER_HOURS}h). Auto-stopping.`);
        try {
            await stopTimer(timer.logId);
        } catch {
            setActiveTimer(null);
        }
        return { valid: false, autoStopped: true, hours };
    }

    return { valid: true, hours };
}

// ============================================================
// TASK HOURS AGGREGATION
// ============================================================

/**
 * Recalculate the actualHours field on a task by summing all its timeLogs.
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

        // Final precision on the task document (4 decimals is enough for accurate summing while keeping display clean)
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

    // Recalculate task hours
    if (taskId) await recalculateTaskHours(taskId);

    if (projectId && (overtime || overtimeHours > 0)) {
        await calculateProjectRisk(projectId);
    }

    return ref.id;
}

export async function updateTimeLog(logId, updates) {
    // Recalculate totals if times changed
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

    // If overtime was involved, recalculate risk.
    // Need to get the document to know projectId.
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
        // Recalculate task hours after deletion
        if (taskId) await recalculateTaskHours(taskId);
        if (projectId) await calculateProjectRisk(projectId);
    } catch (err) {
        console.error('CRITICAL: Error deleting time log:', err);
        throw err; // Re-throw to be caught in UI
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
