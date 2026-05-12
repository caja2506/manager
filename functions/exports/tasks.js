/**
 * Tasks Domain Exports — functions/exports/tasks.js
 * [Phase M.5 + WIP] Task workflow enforcement, WIP limit, and blocked time tracking.
 *
 * ★ Workflow contract derived from shared/taskWorkflow.js (Single Source of Truth)
 * ★ WIP limit enforcement: max N tasks in_progress per person (configurable)
 */
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const {
    TRANSITIONS: VALID_TRANSITIONS,
    REQUIRED_FIELDS: REQUIRED_FIELDS_MAP,
} = require("../shared/taskWorkflow.cjs");
const { calculateBusinessHours } = require("../utils/businessHours");

async function recalculateProjectRisk(adminDb, projectId) {
    const tasksSnap = await adminDb.collection("tasks").where("projectId", "==", projectId).get();
    const tasks = tasksSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const now = new Date();
    const active = tasks.filter(t => !["completed", "cancelled"].includes(t.status));
    const overdue = active.filter(t => t.dueDate && new Date(t.dueDate) < now);
    const blocked = active.filter(t => t.status === "blocked");

    let score = 0;
    const factors = [];

    if (active.length > 0) {
        const overdueRatio = overdue.length / active.length;
        if (overdueRatio > 0.3) { score += 30; factors.push({ factor: "High overdue ratio", score: 30 }); }
        else if (overdueRatio > 0.1) { score += 15; factors.push({ factor: "Moderate overdue ratio", score: 15 }); }
    }
    if (blocked.length > 2) { score += 20; factors.push({ factor: "Multiple blocked tasks", score: 20 }); }

    const riskLevel = score >= 60 ? "high" : score >= 30 ? "medium" : "low";
    await adminDb.collection("projects").doc(projectId).update({ riskScore: score, riskLevel, riskFactors: factors, riskUpdatedAt: now.toISOString() });
}

/**
 * Read WIP limit from settings. Returns { enabled, limit }.
 * Default: enabled=true, limit=1.
 */
async function getWipConfig(adminDb) {
    try {
        const doc = await adminDb.collection("settings").doc("wipConfig").get();
        if (doc.exists) {
            const data = doc.data();
            return {
                enabled: data.enabled !== false,
                limit: Number(data.globalWipLimit) || 1,
            };
        }
    } catch (err) {
        console.warn("[WIP] Could not read wipConfig:", err.message);
    }
    return { enabled: true, limit: 1 };
}

function createTasksExports(adminDb) {
    const transitionTaskStatus = onCall(
        { timeoutSeconds: 30 },
        async (request) => {
            if (!request.auth) throw new HttpsError("unauthenticated", "User must be authenticated.");
            const userId = request.auth.uid;
            const { taskId, newStatus, force, blockedReason, blockedByUserId, blockedByName } = request.data;
            if (!taskId || typeof taskId !== "string") throw new HttpsError("invalid-argument", "taskId is required.");
            if (!newStatus || typeof newStatus !== "string") throw new HttpsError("invalid-argument", "newStatus is required.");

            const taskRef = adminDb.collection("tasks").doc(taskId);
            const taskSnap = await taskRef.get();
            if (!taskSnap.exists) throw new HttpsError("not-found", `Task ${taskId} not found.`);
            const task = { id: taskSnap.id, ...taskSnap.data() };
            const currentStatus = task.status;

            // ★ Transition validation from shared contract
            const allowedTargets = VALID_TRANSITIONS[currentStatus];
            if (!allowedTargets || !allowedTargets.includes(newStatus)) {
                throw new HttpsError("failed-precondition", `Transition "${currentStatus}" → "${newStatus}" is not allowed. Valid targets: ${(allowedTargets || []).join(", ") || "none"}`);
            }

            // ★ WIP LIMIT ENFORCEMENT
            if (newStatus === "in_progress" && task.assignedTo) {
                const wipConfig = await getWipConfig(adminDb);
                if (wipConfig.enabled) {
                    const wipQuery = await adminDb.collection("tasks")
                        .where("assignedTo", "==", task.assignedTo)
                        .where("status", "==", "in_progress")
                        .get();
                    const otherInProgress = wipQuery.docs.filter(d => d.id !== taskId);
                    if (otherInProgress.length >= wipConfig.limit && !force) {
                        const otherTitles = otherInProgress.slice(0, 3).map(d => d.data().title || "Sin título").join(", ");
                        throw new HttpsError("failed-precondition",
                            `WIP limit (${wipConfig.limit}): ya tiene en progreso: "${otherTitles}". Suspenda esa(s) tarea(s) primero.`
                        );
                    }
                    if (otherInProgress.length >= wipConfig.limit && force) {
                        // Allowed via force — log as warning
                    }
                }
            }

            // ★ Required fields validation using canonical check() functions
            const warnings = [];
            const requiredFields = REQUIRED_FIELDS_MAP[newStatus] || [];
            const missingFields = [];
            for (const req of requiredFields) {
                if (!req.check(task)) missingFields.push(req.label);
            }
            if (missingFields.length > 0 && !force) throw new HttpsError("failed-precondition", `Missing required fields: ${missingFields.join(", ")}`);
            if (missingFields.length > 0 && force) warnings.push(`Forced with missing: ${missingFields.join(", ")}`);

            const now = new Date().toISOString();
            const updates = { status: newStatus, updatedAt: now, updatedBy: userId };

            // ★ BLOCKED → track timestamps + blockHistory
            if (newStatus === "blocked") {
                updates.blockedAt = now;
                if (blockedReason) updates.blockedReason = blockedReason;
                if (blockedByUserId) updates.blockedByUserId = blockedByUserId;
                if (blockedByName) updates.blockedByName = blockedByName;
            }

            // ★ UNBLOCKED → calculate blocked duration + write to blockHistory
            if (currentStatus === "blocked" && ["in_progress", "pending"].includes(newStatus)) {
                const lastBlockedAt = task.blockedAt;
                let blockedDuration = 0;
                let rawDuration = 0;
                if (lastBlockedAt) {
                    rawDuration = Math.max(0, (new Date(now) - new Date(lastBlockedAt)) / 3600000);
                    rawDuration = parseFloat(rawDuration.toFixed(4));
                    // Calculate business hours only (excluding nights, weekends, breaks)
                    try {
                        const scheduleSnap = await adminDb.doc("settings/daySchedule").get();
                        const schedule = scheduleSnap.exists ? scheduleSnap.data() : {};
                        blockedDuration = calculateBusinessHours(lastBlockedAt, now, schedule);
                    } catch (schedErr) {
                        console.warn("[transitionTaskStatus] Could not read schedule, using raw hours:", schedErr.message);
                        blockedDuration = rawDuration;
                    }
                }
                updates.unblockedAt = now;
                updates.totalBlockedHours = parseFloat(((task.totalBlockedHours || 0) + blockedDuration).toFixed(4));

                // Write blockHistory entry
                const blockHistoryRef = taskRef.collection("blockHistory").doc();
                const blockEntry = {
                    blockedAt: lastBlockedAt || now,
                    unblockedAt: now,
                    durationHours: blockedDuration,
                    durationHoursRaw: rawDuration,
                    blockedReason: task.blockedReason || "",
                    blockedByUserId: task.blockedByUserId || null,
                    blockedByName: task.blockedByName || null,
                    unblockedByUserId: userId,
                    type: "manual",
                    taskId: taskId,
                    assignedTo: task.assignedTo || null,
                };
                // This is written in the same batch below
                // We need to add it to the batch
                // Store it for batch write
                updates._blockHistoryEntry = { ref: blockHistoryRef, data: blockEntry };
            }

            if (newStatus === "completed") updates.completedDate = now;
            if (currentStatus === "completed" && newStatus === "in_progress") {
                updates.completedDate = null; updates.reopenedAt = now; updates.reopenedBy = userId;
                warnings.push("Task reopened — completion metrics affected.");
            }
            if (currentStatus === "cancelled" && newStatus === "backlog") {
                updates.completedDate = null; warnings.push("Task reactivated from cancelled.");
            }

            // Extract blockHistory entry before writing to task
            const blockHistoryWrite = updates._blockHistoryEntry;
            delete updates._blockHistoryEntry;

            const batch = adminDb.batch();
            batch.update(taskRef, updates);

            // Write blockHistory entry if unblocking
            if (blockHistoryWrite) {
                batch.set(blockHistoryWrite.ref, blockHistoryWrite.data);
            }

            const auditRef = adminDb.collection("auditEvents").doc();
            batch.set(auditRef, {
                eventType: "task_transition", entityType: "task", entityId: taskId, userId, timestamp: now, source: "cloud_function", correlationId: null,
                details: { previousStatus: currentStatus, newStatus, taskTitle: task.title || "", projectId: task.projectId || null, forced: !!force, warnings },
            });
            await batch.commit();

            if (task.projectId) {
                try { await recalculateProjectRisk(adminDb, task.projectId); } catch (riskErr) { console.warn("[transitionTaskStatus] Risk recalc failed:", riskErr.message); }
            }
            console.log(`[transitionTaskStatus] ${currentStatus} → ${newStatus} | task=${taskId} | user=${userId}`);
            return { success: true, previousStatus: currentStatus, newStatus, warnings };
        }
    );

    return { transitionTaskStatus };
}

module.exports = { createTasksExports };
