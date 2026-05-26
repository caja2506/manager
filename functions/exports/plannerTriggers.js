/**
 * Planner Triggers — Firestore event-driven timer scheduling.
 * =============================================================
 * When a weeklyPlanItem is created/updated/deleted,
 * this trigger schedules timer start/stop events in
 * `scheduledTimerEvents` for the lightweight cron to process.
 *
 * This replaces the expensive "scan all planItems + timeLogs"
 * pattern with surgical event creation.
 *
 * Cost impact: ~96 reads/day → ~40 reads/day (70-80% reduction)
 */
const { onDocumentWritten } = require("firebase-functions/v2/firestore");
const paths = require("../automation/firestorePaths");
const { loadBreakBands, getBreakHoursInRange } = require("../utils/breakTimeUtils");
const {
    loadActiveTimerForUser,
    insertTimeLog,
    updateTimeLog,
    loadTask,
    updateTask,
    recalculateTaskHours,
    transitionTaskStatus,
} = require("../db/coreDataReader");

const PLANNER_SOURCE = "planner_auto";

// Función auxiliar para detener el temporizador
async function stopPlannerTimer(adminDb, timer, nowISO) {
    const start = new Date(timer.startTime);
    const end = new Date(nowISO);
    const grossHours = (end - start) / 3_600_000;

    await loadBreakBands(adminDb);
    const breakHours = getBreakHoursInRange(start, end);
    const netHours = Math.max(0, grossHours - breakHours);

    await updateTimeLog(timer.id, {
        endTime: nowISO,
        totalHours: parseFloat(netHours.toFixed(6)),
        totalHoursGross: parseFloat(grossHours.toFixed(6)),
        breakHoursDeducted: parseFloat(breakHours.toFixed(4)),
        autoStopped: true,
    });

    console.log(`[plannerTrigger] STOPPED active planner timer ${timer.id} for user ${timer.userId}`);

    if (timer.taskId) {
        try {
            await recalculateTaskHours(timer.taskId);
        } catch (err) {
            console.warn(`[plannerTrigger] Error recalculating task hours:`, err.message);
        }
    }
}

// Función auxiliar para iniciar el temporizador
async function startPlannerTimer(adminDb, itemId, userId, taskId, projectId, taskTitleSnapshot, nowISO) {
    await insertTimeLog({
        taskId: taskId || null,
        projectId: projectId || null,
        userId: userId,
        startTime: nowISO,
        endTime: null,
        totalHours: 0,
        overtime: false,
        overtimeHours: 0,
        autoStopped: false,
        notes: `Auto-iniciado por planner (manual active): ${taskTitleSnapshot || taskId}`,
        source: PLANNER_SOURCE,
        planItemId: itemId || null,
    });

    console.log(`[plannerTrigger] STARTED planner timer for user ${userId} -> task ${taskId}`);

    if (taskId) {
        try {
            const taskData = await loadTask(taskId);
            if (taskData) {
                const CAN_AUTO_START = ["backlog", "pending", "blocked"];
                if (CAN_AUTO_START.includes(taskData.status)) {
                    await transitionTaskStatus(taskId, "in_progress", userId, "Planner Trigger Auto", true);
                    console.log(`[plannerTrigger] Task ${taskId} transitioned to in_progress via transitionTaskStatus`);
                }
            }
        } catch (err) {
            console.warn(`[plannerTrigger] Could not transition task ${taskId}:`, err.message);
        }
    }
}

function createPlannerTriggerExports(adminDb) {

    const onPlanItemChanged = onDocumentWritten(
        `${paths.WEEKLY_PLAN_ITEMS}/{itemId}`,
        async (event) => {
            const before = event.data?.before?.data();
            const after = event.data?.after?.data();
            const itemId = event.params.itemId;
            const tag = "[plannerTrigger]";

            // ── DELETE: cancel all pending events for this item ──
            if (!after) {
                console.log(`${tag} Plan item ${itemId} deleted. Cancelling pending events.`);
                await cancelEvents(adminDb, itemId);
                return;
            }

            // ── CREATE or UPDATE: recalculate events ──
            const userId = after.assignedTo;
            const taskId = after.taskId;

            // Skip if missing required fields
            if (!userId || !taskId || !after.startDateTime || !after.endDateTime) {
                console.log(`${tag} Plan item ${itemId} missing required fields. Skipping.`);
                return;
            }

            // If update: check if scheduling-relevant fields changed
            if (before) {
                const fieldsChanged =
                    before.startDateTime !== after.startDateTime ||
                    before.endDateTime !== after.endDateTime ||
                    before.assignedTo !== after.assignedTo ||
                    before.taskId !== after.taskId;

                if (!fieldsChanged) {
                    console.log(`${tag} Plan item ${itemId} updated but no schedule-relevant changes. Skipping.`);
                    return;
                }
            }

            // Cancel old events for this item
            await cancelEvents(adminDb, itemId);

            // Only schedule events for future times
            const now = new Date();
            const startTime = new Date(after.startDateTime);
            const endTime = new Date(after.endDateTime);

            const batch = adminDb.batch();
            let eventsCreated = 0;

            // Handle immediate activation if plan is active right now
            if (startTime <= now && endTime > now) {
                console.log(`${tag} Plan item ${itemId} is active right now. Starting timer immediately.`);
                try {
                    const existingTimer = await loadActiveTimerForUser(userId);
                    let canStart = false;

                    if (existingTimer) {
                        if (existingTimer.taskId === taskId) {
                            console.log(`${tag} Timer already running for user ${userId} on task ${taskId}. Skipping start.`);
                        } else if (existingTimer.source === PLANNER_SOURCE) {
                            console.log(`${tag} User ${userId} has another active planner timer. Stopping it first.`);
                            await stopPlannerTimer(adminDb, existingTimer, now.toISOString());
                            canStart = true;
                        } else {
                            console.log(`${tag} User ${userId} has a manual active timer. Skipping planner timer start.`);
                        }
                    } else {
                        canStart = true;
                    }

                    if (canStart) {
                        await startPlannerTimer(
                            adminDb,
                            itemId,
                            userId,
                            taskId,
                            after.projectId || null,
                            after.taskTitleSnapshot || "",
                            now.toISOString()
                        );
                    }
                } catch (err) {
                    console.error(`${tag} Error in immediate timer activation:`, err.message);
                }
            }

            // Schedule START event (only if start time is in the future)
            if (startTime > now) {
                const startRef = adminDb.collection(paths.SCHEDULED_TIMER_EVENTS).doc();
                batch.set(startRef, {
                    type: "start",
                    planItemId: itemId,
                    userId,
                    taskId,
                    projectId: after.projectId || null,
                    taskTitleSnapshot: after.taskTitleSnapshot || "",
                    triggerAt: after.startDateTime,
                    processed: false,
                    createdAt: now.toISOString(),
                });
                eventsCreated++;
            }

            // Schedule STOP event (only if end time is in the future)
            if (endTime > now) {
                const stopRef = adminDb.collection(paths.SCHEDULED_TIMER_EVENTS).doc();
                batch.set(stopRef, {
                    type: "stop",
                    planItemId: itemId,
                    userId,
                    taskId,
                    triggerAt: after.endDateTime,
                    processed: false,
                    createdAt: now.toISOString(),
                });
                eventsCreated++;
            }

            if (eventsCreated > 0) {
                await batch.commit();
                console.log(`${tag} Scheduled ${eventsCreated} events for item ${itemId} (task: ${taskId}, user: ${userId})`);
            } else {
                console.log(`${tag} No future events scheduled for item ${itemId}.`);
            }
        }
    );

    return { onPlanItemChanged };
}

/**
 * Cancel all pending (unprocessed) events for a given plan item.
 */
async function cancelEvents(adminDb, planItemId) {
    const existing = await adminDb.collection(paths.SCHEDULED_TIMER_EVENTS)
        .where("planItemId", "==", planItemId)
        .where("processed", "==", false)
        .get();

    if (!existing.empty) {
        const batch = adminDb.batch();
        existing.docs.forEach(doc => batch.delete(doc.ref));
        await batch.commit();
        console.log(`[plannerTrigger] Cancelled ${existing.size} pending events for item ${planItemId}`);
    }
}

module.exports = { createPlannerTriggerExports };
