/**
 * Tasks Domain Exports — functions/exports/tasks.js
 * [Phase M.5] Task workflow enforcement and project risk recalculation.
 */
const { onCall, HttpsError } = require("firebase-functions/v2/https");

const VALID_TRANSITIONS = {
    backlog: ["pending", "in_progress", "cancelled"],
    pending: ["in_progress", "backlog", "blocked", "cancelled"],
    in_progress: ["validation", "blocked", "cancelled"],
    blocked: ["in_progress", "pending", "cancelled"],
    validation: ["completed", "in_progress", "blocked"],
    completed: ["in_progress"],
    cancelled: ["backlog"],
};

const REQUIRED_FIELDS = {
    pending: [{ field: "assignedTo", label: "Responsable asignado" }, { field: "projectId", label: "Proyecto asignado" }],
    in_progress: [{ field: "assignedTo", label: "Responsable asignado" }],
    blocked: [{ field: "blockedReason", label: "Razón de bloqueo" }],
    validation: [{ field: "assignedTo", label: "Responsable asignado" }],
    completed: [{ field: "assignedTo", label: "Responsable asignado" }],
};

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

function createTasksExports(adminDb) {
    const transitionTaskStatus = onCall(
        { timeoutSeconds: 30 },
        async (request) => {
            if (!request.auth) throw new HttpsError("unauthenticated", "User must be authenticated.");
            const userId = request.auth.uid;
            const { taskId, newStatus, force } = request.data;
            if (!taskId || typeof taskId !== "string") throw new HttpsError("invalid-argument", "taskId is required.");
            if (!newStatus || typeof newStatus !== "string") throw new HttpsError("invalid-argument", "newStatus is required.");

            const taskRef = adminDb.collection("tasks").doc(taskId);
            const taskSnap = await taskRef.get();
            if (!taskSnap.exists) throw new HttpsError("not-found", `Task ${taskId} not found.`);
            const task = { id: taskSnap.id, ...taskSnap.data() };
            const currentStatus = task.status;

            const allowedTargets = VALID_TRANSITIONS[currentStatus];
            if (!allowedTargets || !allowedTargets.includes(newStatus)) {
                throw new HttpsError("failed-precondition", `Transition "${currentStatus}" → "${newStatus}" is not allowed. Valid targets: ${(allowedTargets || []).join(", ") || "none"}`);
            }

            const warnings = [];
            const requiredFields = REQUIRED_FIELDS[newStatus] || [];
            const missingFields = [];
            for (const req of requiredFields) {
                const value = task[req.field];
                if (!value || (typeof value === "string" && !value.trim())) missingFields.push(req.label);
            }
            if (missingFields.length > 0 && !force) throw new HttpsError("failed-precondition", `Missing required fields: ${missingFields.join(", ")}`);
            if (missingFields.length > 0 && force) warnings.push(`Forced with missing: ${missingFields.join(", ")}`);

            const now = new Date().toISOString();
            const updates = { status: newStatus, updatedAt: now, updatedBy: userId };
            if (newStatus === "completed") updates.completedDate = now;
            if (currentStatus === "completed" && newStatus === "in_progress") {
                updates.completedDate = null; updates.reopenedAt = now; updates.reopenedBy = userId;
                warnings.push("Task reopened — completion metrics affected.");
            }
            if (currentStatus === "cancelled" && newStatus === "backlog") {
                updates.completedDate = null; warnings.push("Task reactivated from cancelled.");
            }

            const batch = adminDb.batch();
            batch.update(taskRef, updates);
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
