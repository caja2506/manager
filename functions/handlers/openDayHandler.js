/**
 * Open Day Handler — Backend (CJS)
 * =================================
 * Automated start-of-day routine:
 *   1. Find timers that were auto-stopped yesterday (closeDay)
 *   2. Restart timers for tasks still in_progress
 *   3. Clear autoStopped flag
 *
 * Triggered by: scheduledOpenDay (cron at 08:00)
 *
 * [SUPABASE MIGRATION] Core data (time_logs, tasks) now read/written
 * via coreDataReader (Supabase).
 */

const {
    loadAllTimeLogs, loadTask,
    insertTimeLog, updateTimeLog,
    loadTaskUserTimeLogs,
    loadWeeklyPlanItemsForDate,
} = require("../db/coreDataReader");

const TZ = "America/Costa_Rica";

/**
 * Get current date string in Costa Rica timezone: "YYYY-MM-DD"
 */
function getTodayDateString() {
    return new Date().toLocaleString("en-CA", { timeZone: TZ }).split(",")[0];
}

/**
 * Get current time as decimal hour in Costa Rica timezone
 */
function getCurrentDecimalHour() {
    const parts = new Date().toLocaleString("en-US", {
        timeZone: TZ, hour: "numeric", minute: "numeric", hour12: false,
    }).split(":");
    return parseInt(parts[0]) + parseInt(parts[1]) / 60;
}

function getDecimalHour(d) {
    const parts = d.toLocaleString("en-US", {
        timeZone: TZ, hour: "numeric", minute: "numeric", hour12: false,
    }).split(":");
    return parseInt(parts[0]) + parseInt(parts[1]) / 60;
}

/**
 * Find the planner block that covers the current hour.
 */
function findActiveBlock(items, currentHour) {
    for (const item of items) {
        if (!item.startDateTime || !item.endDateTime) continue;
        const startDate = new Date(item.startDateTime);
        const endDate = new Date(item.endDateTime);

        const startHour = getDecimalHour(startDate);
        const endHour = getDecimalHour(endDate);

        if (currentHour >= startHour && currentHour < endHour) {
            return item;
        }
    }
    return null;
}

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
    const allTimeLogs = await loadAllTimeLogs();
    const yesterdayISO = yesterday.toISOString();

    const autoStoppedTimers = allTimeLogs.filter(log =>
        log.autoStopped === true &&
        log.endTime &&
        log.endTime >= yesterdayISO
    );

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

    // ── 2.5 Load today's weekly plan items to prioritize planner tasks ──
    const todayStr = getTodayDateString();
    const todayPlanItems = await loadWeeklyPlanItemsForDate(todayStr);
    const currentHour = getCurrentDecimalHour();

    // ── 3. Check which tasks are still in_progress ──
    const tasksMap = {};
    const taskIds = [...new Set(uniqueTimers.map(t => t.taskId).filter(Boolean))];
    for (const taskId of taskIds) {
        const task = await loadTask(taskId);
        if (task) tasksMap[taskId] = task;
    }

    // ── 4. Restart valid timers ──
    let restarted = 0;

    for (const log of uniqueTimers) {
        // Guard: Check if the user has an active block scheduled in the Planner at this hour.
        // If they do, the Planner has priority, so we do not restart the auto-stopped timer of yesterday.
        const userPlanItems = todayPlanItems.filter(item => item.assignedTo === log.userId);
        const activeBlock = findActiveBlock(userPlanItems, currentHour);
        if (activeBlock) {
            console.log(`[openDay] Skipping restart for user ${log.userId} on task ${log.taskId} — user has active planner block scheduled now: task ${activeBlock.taskId}`);
            continue;
        }

        // Check task is still in_progress
        if (log.taskId) {
            const task = tasksMap[log.taskId];
            if (task && task.status !== "in_progress") {
                console.log(`[openDay] Skipping ${log.taskId} — status is ${task?.status}`);
                continue;
            }
        }

        // Check if there's already an active timer
        const userTaskLogs = await loadTaskUserTimeLogs(log.taskId, log.userId);
        const hasActiveTimer = userTaskLogs.some(l => !l.endTime);

        if (hasActiveTimer) {
            console.log(`[openDay] Timer already running for task ${log.taskId} / user ${log.userId}`);
            continue;
        }

        if (dryRun) {
            console.log(`[openDay] DRY-RUN: Would restart timer for ${log.userId} on task ${log.taskId}`);
            restarted++;
            continue;
        }

        try {
            // Create new timer in Supabase
            await insertTimeLog({
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
            await updateTimeLog(log.id, { autoStopped: false });

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
