/**
 * Planner Timer Sync Handler — Backend (CJS)
 * =============================================
 * Automatically starts/stops timers based on planner schedule.
 *
 * Runs every 15 minutes via Cloud Scheduler.
 * Reads weeklyPlanItems for today, compares with active timers,
 * and starts/stops timers as needed.
 *
 * RULES:
 *   - Only manages timers with source "planner_auto"
 *   - Manual timers (kanban, manual, etc.) are NEVER touched
 *   - One timer per user at a time
 *   - Skips during break bands
 *   - Respects daySchedule.enabled setting
 */

const paths = require("../automation/firestorePaths");
const { loadBreakBands, getBreakHoursInRange } = require("../utils/breakTimeUtils");

const TZ = "America/Costa_Rica";
const PLANNER_SOURCE = "planner_auto";

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

/**
 * Check if current time falls within any break band
 */
function isInBreak(breakBands, currentHour) {
    for (const band of breakBands) {
        const start = typeof band.start === "number" ? band.start : timeToDecimal(band.start);
        const end = typeof band.end === "number" ? band.end : timeToDecimal(band.end);
        if (currentHour >= start && currentHour < end) return true;
    }
    return false;
}

function timeToDecimal(timeStr) {
    if (typeof timeStr === "number") return timeStr;
    const [h, m] = timeStr.split(":").map(Number);
    return h + (m || 0) / 60;
}

/**
 * Main sync execution.
 */
async function execute(adminDb, token, targets, context) {
    const { dryRun } = context;
    const tag = "[plannerTimerSync]";

    // ── 0. Auto-seed routine doc if missing ──
    const routineRef = adminDb.collection(paths.AUTOMATION_ROUTINES).doc("planner_timer_sync");
    const routineSnap = await routineRef.get();
    if (!routineSnap.exists) {
        console.log(`${tag} Creating automationRoutines/planner_timer_sync doc...`);
        await routineRef.set({
            key: "planner_timer_sync",
            name: "Planner Timer Sync",
            description: "Auto-starts/stops timers based on planner schedule",
            enabled: true,
            scheduleType: "interval",
            scheduleConfig: { intervalMinutes: 15 },
            channel: "none",
            targetRole: "all",
            dryRun: false,
            debugMode: false,
            createdAt: new Date().toISOString(),
        });
    }

    // ── 1. Check if enabled ──
    const schedDoc = await adminDb.doc("settings/daySchedule").get();
    const schedData = schedDoc.exists ? schedDoc.data() : {};
    if (schedData.enabled === false) {
        console.log(`${tag} Day schedule disabled. Skipping.`);
        return { sentCount: 0, failedCount: 0, errors: [], synced: 0 };
    }

    // ── 2. Load break bands ──
    await loadBreakBands(adminDb);
    const breakBands = schedData.breakBands || [];
    const currentHour = getCurrentDecimalHour();

    // ── 3. Skip during breaks ──
    if (isInBreak(breakBands, currentHour)) {
        console.log(`${tag} Currently in break (hour=${currentHour.toFixed(2)}). Skipping.`);
        return { sentCount: 0, failedCount: 0, errors: [], synced: 0, inBreak: true };
    }

    // ── 4. Get today's planner items ──
    const today = getTodayDateString();
    console.log(`${tag} Syncing for date: ${today}, hour: ${currentHour.toFixed(2)}`);

    const planSnap = await adminDb.collection(paths.WEEKLY_PLAN_ITEMS)
        .where("date", "==", today)
        .get();

    if (planSnap.empty) {
        console.log(`${tag} No planner items for today.`);
        // Still need to stop any planner_auto timers that shouldn't be running
    }

    const planItems = planSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    console.log(`${tag} Found ${planItems.length} planner blocks for today.`);

    // ── 5. Group by user ──
    const itemsByUser = {};
    for (const item of planItems) {
        const uid = item.assignedTo;
        if (!uid) continue;
        if (!itemsByUser[uid]) itemsByUser[uid] = [];
        itemsByUser[uid].push(item);
    }

    // ── 6. Get ALL active timers (endTime === null) ──
    const activeTimersSnap = await adminDb.collection(paths.TIME_LOGS)
        .where("endTime", "==", null)
        .get();

    const activeTimers = activeTimersSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    // Use ARRAY per user to detect ghost/duplicate timers (F-14)
    const timersByUser = {};
    const now = new Date().toISOString();
    for (const timer of activeTimers) {
        if (!timersByUser[timer.userId]) timersByUser[timer.userId] = [];
        timersByUser[timer.userId].push(timer);
    }

    // ── 6b. Detect and clean up ghost timers ──
    for (const [uid, timers] of Object.entries(timersByUser)) {
        if (timers.length > 1) {
            console.warn(`${tag} GHOST DETECTED: ${uid} has ${timers.length} active timers! Cleaning...`);
            // Keep the most recent one, stop the rest
            const sorted = timers.sort((a, b) => new Date(b.startTime) - new Date(a.startTime));
            for (let i = 1; i < sorted.length; i++) {
                try {
                    await stopPlannerTimer(adminDb, sorted[i], now);
                    console.warn(`${tag} Cleaned ghost timer ${sorted[i].id} for ${uid}`);
                } catch (err) {
                    console.error(`${tag} Error cleaning ghost timer:`, err.message);
                }
            }
            // Keep only the first (most recent) in the list
            timersByUser[uid] = [sorted[0]];
        }
    }

    // ── 7. Sync each user ──
    let started = 0;
    let stopped = 0;
    let switched = 0;
    const errors = [];

    // Get all unique users (from planner + active planner_auto timers)
    const allUsers = new Set([
        ...Object.keys(itemsByUser),
        ...activeTimers.filter(t => t.source === PLANNER_SOURCE).map(t => t.userId),
    ]);

    for (const userId of allUsers) {
        const userItems = itemsByUser[userId] || [];
        const activeTimer = (timersByUser[userId] || [])[0] || null;  // First (most recent) timer

        // Find the block that covers NOW
        const activeBlock = findActiveBlock(userItems, currentHour);

        try {
            if (activeBlock && !activeTimer) {
                // ── CASE A: Block active, no timer → START ──
                if (dryRun) {
                    console.log(`${tag} DRY-RUN: Would START timer for ${userId} on task ${activeBlock.taskId}`);
                } else {
                    await startPlannerTimer(adminDb, userId, activeBlock, now);
                    console.log(`${tag} STARTED timer for ${userId} → task ${activeBlock.taskId} (${activeBlock.taskTitleSnapshot || ""})`);
                }
                started++;

            } else if (activeBlock && activeTimer && activeTimer.taskId !== activeBlock.taskId) {
                // ── CASE B: Block active, timer on DIFFERENT task ──
                if (activeTimer.source === PLANNER_SOURCE) {
                    // It's a planner timer → stop and switch
                    if (dryRun) {
                        console.log(`${tag} DRY-RUN: Would SWITCH ${userId}: ${activeTimer.taskId} → ${activeBlock.taskId}`);
                    } else {
                        await stopPlannerTimer(adminDb, activeTimer, now);
                        await startPlannerTimer(adminDb, userId, activeBlock, now);
                        console.log(`${tag} SWITCHED ${userId}: ${activeTimer.taskId} → ${activeBlock.taskId}`);
                    }
                    switched++;
                } else {
                    // Manual timer → DON'T touch it
                    console.log(`${tag} ${userId} has manual timer on ${activeTimer.taskId}, not switching.`);
                }

            } else if (activeBlock && activeTimer && activeTimer.taskId === activeBlock.taskId) {
                // ── CASE C: Block active, timer on SAME task → nothing ──
                // All good

            } else if (!activeBlock && activeTimer && activeTimer.source === PLANNER_SOURCE) {
                // ── CASE D: No block, planner timer running → STOP ──
                if (dryRun) {
                    console.log(`${tag} DRY-RUN: Would STOP planner timer for ${userId}`);
                } else {
                    await stopPlannerTimer(adminDb, activeTimer, now);
                    console.log(`${tag} STOPPED planner timer for ${userId} (no active block)`);
                }
                stopped++;

            } else if (!activeBlock && activeTimer && activeTimer.source !== PLANNER_SOURCE) {
                // ── CASE E: No block, manual timer → DON'T touch ──
                // Manual timer, leave it alone
            }
        } catch (err) {
            console.error(`${tag} Error syncing user ${userId}:`, err.message);
            errors.push({ userId, error: err.message });
        }
    }

    console.log(`${tag} Summary: started=${started}, stopped=${stopped}, switched=${switched}, errors=${errors.length}`);

    return {
        sentCount: 0,
        failedCount: 0,
        errors,
        synced: started + stopped + switched,
        started,
        stopped,
        switched,
    };
}

/**
 * Find the planner block that covers the current hour.
 */
function findActiveBlock(items, currentHour) {
    for (const item of items) {
        if (!item.startDateTime || !item.endDateTime) continue;
        const startDate = new Date(item.startDateTime);
        const endDate = new Date(item.endDateTime);

        // Convert to Costa Rica decimal hours
        const startHour = getDecimalHour(startDate);
        const endHour = getDecimalHour(endDate);

        if (currentHour >= startHour && currentHour < endHour) {
            return item;
        }
    }
    return null;
}

function getDecimalHour(d) {
    const parts = d.toLocaleString("en-US", {
        timeZone: TZ, hour: "numeric", minute: "numeric", hour12: false,
    }).split(":");
    return parseInt(parts[0]) + parseInt(parts[1]) / 60;
}

/**
 * Start a new planner-managed timer.
 * Also transitions the task to in_progress if it's in a valid starting state.
 */
async function startPlannerTimer(adminDb, userId, block, now) {
    // GUARD: Verify no active timer exists (mutex)
    const existingSnap = await adminDb.collection(paths.TIME_LOGS)
        .where("userId", "==", userId)
        .where("endTime", "==", null)
        .limit(1)
        .get();

    if (!existingSnap.empty) {
        const existing = existingSnap.docs[0].data();
        if (existing.taskId === block.taskId) {
            console.log(`[plannerTimerSync] Timer already running for ${userId} on ${block.taskId}, skipping.`);
            return;
        }
        if (existing.source !== PLANNER_SOURCE) {
            console.log(`[plannerTimerSync] ${userId} has manual timer on ${existing.taskId}, not starting planner timer.`);
            return;
        }
        // It's a planner timer for a different task — should have been stopped by caller
    }

    const newLogRef = adminDb.collection(paths.TIME_LOGS).doc();
    await newLogRef.set({
        taskId: block.taskId || null,
        projectId: block.projectId || null,
        userId,
        startTime: now,
        endTime: null,
        totalHours: 0,
        overtime: false,
        overtimeHours: 0,
        autoStopped: false,
        notes: `Auto-iniciado por planner: ${block.taskTitleSnapshot || block.taskId}`,
        source: PLANNER_SOURCE,
        planItemId: block.id || null,
        createdAt: now,
    });

    // ── Auto-transition task to in_progress ──
    // Valid transitions: backlog→in_progress, pending→in_progress, blocked→in_progress
    if (block.taskId) {
        try {
            const taskRef = adminDb.collection(paths.TASKS).doc(block.taskId);
            const taskSnap = await taskRef.get();
            if (taskSnap.exists) {
                const taskData = taskSnap.data();
                const CAN_AUTO_START = ["backlog", "pending", "blocked"];
                if (CAN_AUTO_START.includes(taskData.status)) {
                    await taskRef.update({
                        status: "in_progress",
                        statusChangedAt: now,
                        statusChangedBy: "planner_auto",
                        updatedAt: now,
                    });
                    console.log(`[plannerTimerSync] Task ${block.taskId} transitioned: ${taskData.status} → in_progress`);
                }
            }
        } catch (err) {
            console.warn(`[plannerTimerSync] Could not transition task ${block.taskId}:`, err.message);
        }
    }
}

/**
 * Stop a planner-managed timer and calculate hours.
 */
async function stopPlannerTimer(adminDb, timer, now) {
    const start = new Date(timer.startTime);
    const end = new Date(now);
    const grossHours = (end - start) / 3_600_000;

    // Deduct break hours
    const breakHours = getBreakHoursInRange(start, end);
    const netHours = Math.max(0, grossHours - breakHours);

    await adminDb.collection(paths.TIME_LOGS).doc(timer.id).update({
        endTime: now,
        totalHours: parseFloat(netHours.toFixed(6)),
        totalHoursGross: parseFloat(grossHours.toFixed(6)),
        breakHoursDeducted: parseFloat(breakHours.toFixed(4)),
        autoStopped: true,
        updatedAt: now,
    });

    // Recalculate task actualHours
    if (timer.taskId) {
        try {
            const logsSnap = await adminDb.collection(paths.TIME_LOGS)
                .where("taskId", "==", timer.taskId)
                .get();
            let total = 0;
            logsSnap.docs.forEach(d => {
                const dd = d.data();
                if (dd.totalHours && dd.endTime) total += dd.totalHours;
            });
            await adminDb.collection(paths.TASKS).doc(timer.taskId).update({
                actualHours: parseFloat(total.toFixed(4)),
                updatedAt: now,
            });
        } catch (err) {
            console.warn(`[plannerTimerSync] Error recalculating task ${timer.taskId}:`, err.message);
        }
    }
}

module.exports = { execute };
