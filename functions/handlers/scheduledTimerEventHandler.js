/**
 * Scheduled Timer Event Handler — Backend (CJS)
 * ================================================
 * Processes pending timer start/stop events from the
 * `scheduledTimerEvents` collection.
 *
 * Called by the scheduler every tick (15 min).
 * Much cheaper than scanning all weeklyPlanItems + timeLogs.
 *
 * RULES:
 *   - Only manages timers with source "planner_auto"
 *   - Manual timers are NEVER touched
 *   - Events past their triggerAt are processed, then marked processed=true
 *   - Stale events (> 2 hours past triggerAt) are auto-expired
 */

const paths = require("../automation/firestorePaths");
const { loadBreakBands, getBreakHoursInRange } = require("../utils/breakTimeUtils");

const PLANNER_SOURCE = "planner_auto";
const STALE_THRESHOLD_MS = 2 * 60 * 60 * 1000; // 2 hours

async function execute(adminDb, token, targets, context) {
    const tag = "[scheduledTimerEvent]";
    const now = new Date();
    const nowISO = now.toISOString();

    // ── 0. Auto-seed routine doc if missing ──
    const routineRef = adminDb.collection(paths.AUTOMATION_ROUTINES).doc("scheduled_timer_events");
    const routineSnap = await routineRef.get();
    if (!routineSnap.exists) {
        console.log(`${tag} Creating automationRoutines/scheduled_timer_events doc...`);
        await routineRef.set({
            key: "scheduled_timer_events",
            name: "Scheduled Timer Events",
            description: "Processes pending timer start/stop events from planner triggers",
            enabled: true,
            scheduleType: "interval",
            scheduleConfig: { intervalMinutes: 15 },
            channel: "none",
            targetRole: "all",
            dryRun: false,
            debugMode: false,
            createdAt: nowISO,
        });
    }

    // ── 1. Load break bands for hour calculations ──
    await loadBreakBands(adminDb);

    // ── 2. Query events that are due (triggerAt <= now AND not processed) ──
    const dueEventsSnap = await adminDb.collection(paths.SCHEDULED_TIMER_EVENTS)
        .where("processed", "==", false)
        .where("triggerAt", "<=", nowISO)
        .orderBy("triggerAt")
        .get();

    if (dueEventsSnap.empty) {
        console.log(`${tag} No pending events.`);
        return { sentCount: 0, failedCount: 0, errors: [], processed: 0 };
    }

    console.log(`${tag} Processing ${dueEventsSnap.size} due events`);
    let started = 0;
    let stopped = 0;
    let expired = 0;
    const errors = [];

    for (const eventDoc of dueEventsSnap.docs) {
        const event = eventDoc.data();

        try {
            // ── Check for stale events (> 2 hours old) ──
            const triggerTime = new Date(event.triggerAt);
            if (now - triggerTime > STALE_THRESHOLD_MS) {
                console.log(`${tag} Event ${eventDoc.id} is stale (${Math.round((now - triggerTime) / 60000)} min old). Expiring.`);
                await eventDoc.ref.update({ processed: true, expired: true, processedAt: nowISO });
                expired++;
                continue;
            }

            if (event.type === "start") {
                // ── START: Check if user already has an active timer ──
                const existingSnap = await adminDb.collection(paths.TIME_LOGS)
                    .where("userId", "==", event.userId)
                    .where("endTime", "==", null)
                    .limit(1)
                    .get();

                if (!existingSnap.empty) {
                    const existing = existingSnap.docs[0].data();
                    if (existing.taskId === event.taskId) {
                        // Already running for this task — skip
                        console.log(`${tag} Timer already running for ${event.userId} on ${event.taskId}. Marking processed.`);
                        await eventDoc.ref.update({ processed: true, processedAt: nowISO, skipped: true, skipReason: "timer_already_running" });
                        continue;
                    }
                    if (existing.source === PLANNER_SOURCE) {
                        // Different planner timer → stop it first, then start new one
                        await stopPlannerTimer(adminDb, { id: existingSnap.docs[0].id, ...existing }, nowISO);
                        console.log(`${tag} Stopped existing planner timer for ${event.userId} before starting new one.`);
                    } else {
                        // Manual timer → DON'T touch it (per user decision)
                        console.log(`${tag} ${event.userId} has manual timer. Skipping start event.`);
                        await eventDoc.ref.update({ processed: true, processedAt: nowISO, skipped: true, skipReason: "manual_timer_active" });
                        continue;
                    }
                }

                // Create the planner timer
                await startPlannerTimer(adminDb, event, nowISO);
                started++;

            } else if (event.type === "stop") {
                // ── STOP: Find the active planner_auto timer for this task ──
                const activeSnap = await adminDb.collection(paths.TIME_LOGS)
                    .where("userId", "==", event.userId)
                    .where("taskId", "==", event.taskId)
                    .where("endTime", "==", null)
                    .where("source", "==", PLANNER_SOURCE)
                    .limit(1)
                    .get();

                if (!activeSnap.empty) {
                    await stopPlannerTimer(adminDb, { id: activeSnap.docs[0].id, ...activeSnap.docs[0].data() }, nowISO);
                    stopped++;
                } else {
                    console.log(`${tag} No active planner timer found for ${event.userId}/${event.taskId}. Skipping stop.`);
                }
            }

            await eventDoc.ref.update({ processed: true, processedAt: nowISO });

        } catch (err) {
            console.error(`${tag} Error processing event ${eventDoc.id}:`, err.message);
            errors.push({ eventId: eventDoc.id, error: err.message });
            // Mark as errored but not processed, so it can be retried
            await eventDoc.ref.update({ lastError: err.message, lastErrorAt: nowISO }).catch(() => {});
        }
    }

    console.log(`${tag} Summary: started=${started}, stopped=${stopped}, expired=${expired}, errors=${errors.length}`);

    return {
        sentCount: 0,
        failedCount: 0,
        errors,
        processed: started + stopped + expired,
        started,
        stopped,
        expired,
    };
}

/**
 * Start a new planner-managed timer.
 */
async function startPlannerTimer(adminDb, event, now) {
    const newLogRef = adminDb.collection(paths.TIME_LOGS).doc();
    await newLogRef.set({
        taskId: event.taskId || null,
        projectId: event.projectId || null,
        userId: event.userId,
        startTime: now,
        endTime: null,
        totalHours: 0,
        overtime: false,
        overtimeHours: 0,
        autoStopped: false,
        notes: `Auto-iniciado por planner: ${event.taskTitleSnapshot || event.taskId}`,
        source: PLANNER_SOURCE,
        planItemId: event.planItemId || null,
        createdAt: now,
    });

    console.log(`[scheduledTimerEvent] STARTED timer for ${event.userId} → ${event.taskId}`);

    // Auto-transition task to in_progress if applicable
    if (event.taskId) {
        try {
            const taskRef = adminDb.collection(paths.TASKS).doc(event.taskId);
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
                    console.log(`[scheduledTimerEvent] Task ${event.taskId}: ${taskData.status} → in_progress`);
                }
            }
        } catch (err) {
            console.warn(`[scheduledTimerEvent] Could not transition task ${event.taskId}:`, err.message);
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

    console.log(`[scheduledTimerEvent] STOPPED timer ${timer.id} for ${timer.userId} (net: ${netHours.toFixed(2)}h)`);

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
            console.warn(`[scheduledTimerEvent] Error recalculating task ${timer.taskId}:`, err.message);
        }
    }
}

module.exports = { execute };
