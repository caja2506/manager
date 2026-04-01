/**
 * Open Day Handler — Backend (CJS)
 * =================================
 * Automated start-of-day routine:
 *   1. Find timers that were auto-stopped yesterday (closeDay)
 *   2. Restart timers for tasks still in_progress
 *   3. Clear autoStopped flag
 *
 * Triggered by: scheduledOpenDay (cron at 08:00)
 */

const paths = require("../automation/firestorePaths");

/**
 * Execute the day open routine.
 * Note: This handler does NOT send Telegram messages — the morning digest
 * handles communication. This handler only manages timer state.
 */
async function execute(adminDb, token, targets, context) {
    const { dryRun } = context;
    const yesterday = new Date(Date.now() - 24 * 3600000);
    const now = new Date().toISOString();

    // ── 1. Find auto-stopped timers from the last 24 hours ──
    const timeLogsSnap = await adminDb.collection(paths.TIME_LOGS)
        .where("autoStopped", "==", true)
        .get();

    const autoStoppedTimers = timeLogsSnap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(log => {
            if (!log.endTime) return false;
            return new Date(log.endTime) >= yesterday;
        });

    if (autoStoppedTimers.length === 0) {
        console.log("[openDay] No auto-stopped timers found. Nothing to restart.");
        return { sentCount: 0, failedCount: 0, errors: [], restartedTimers: 0 };
    }

    // ── 2. Deduplicate by taskId + userId ──
    const seen = new Set();
    const uniqueTimers = [];
    for (const log of autoStoppedTimers) {
        const key = `${log.taskId || ""}_${log.userId}`;
        if (!seen.has(key)) {
            seen.add(key);
            uniqueTimers.push(log);
        }
    }

    // ── 3. Check which tasks are still in_progress ──
    const taskIds = [...new Set(uniqueTimers.map(t => t.taskId).filter(Boolean))];
    const tasksMap = {};
    if (taskIds.length > 0) {
        // Fetch tasks in batches of 10 (Firestore 'in' limit)
        for (let i = 0; i < taskIds.length; i += 10) {
            const batch = taskIds.slice(i, i + 10);
            const snap = await adminDb.collection(paths.TASKS).where("__name__", "in", batch).get();
            snap.docs.forEach(d => { tasksMap[d.id] = d.data(); });
        }
    }

    // ── 4. Restart valid timers ──
    let restarted = 0;

    for (const log of uniqueTimers) {
        // Check task is still in_progress
        if (log.taskId) {
            const task = tasksMap[log.taskId];
            if (task && task.status !== "in_progress") {
                console.log(`[openDay] Skipping ${log.taskId} — status is ${task?.status}`);
                continue;
            }
        }

        // Check if there's already an active timer
        const existingSnap = await adminDb.collection(paths.TIME_LOGS)
            .where("taskId", "==", log.taskId)
            .where("userId", "==", log.userId)
            .where("endTime", "==", null)
            .limit(1)
            .get();

        if (!existingSnap.empty) {
            console.log(`[openDay] Timer already running for task ${log.taskId} / user ${log.userId}`);
            continue;
        }

        if (dryRun) {
            console.log(`[openDay] DRY-RUN: Would restart timer for ${log.userId} on task ${log.taskId}`);
            restarted++;
            continue;
        }

        try {
            // Create new timer
            const newLogRef = adminDb.collection(paths.TIME_LOGS).doc();
            await newLogRef.set({
                taskId: log.taskId || null,
                projectId: log.projectId || null,
                userId: log.userId,
                startTime: now,
                endTime: null,
                totalHours: 0,
                overtime: false,
                overtimeHours: 0,
                autoStopped: false,
                notes: "Auto-iniciado al abrir el día",
                source: "auto_open_day",
                createdAt: now,
            });

            // Clear autoStopped flag on originals
            await adminDb.collection(paths.TIME_LOGS).doc(log.id).update({
                autoStopped: false,
            });

            restarted++;
        } catch (err) {
            console.warn(`[openDay] Error restarting timer:`, err.message);
        }
    }

    console.log(`[openDay] Restarted ${restarted} timers`);

    return {
        sentCount: 0,        // This handler doesn't send messages
        failedCount: 0,
        errors: [],
        restartedTimers: restarted,
    };
}

module.exports = { execute };
