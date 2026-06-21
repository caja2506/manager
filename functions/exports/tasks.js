/**
 * Tasks Domain Exports — functions/exports/tasks.js
 * [Phase M.5 + WIP] Task workflow enforcement, WIP limit, and blocked time tracking.
 */
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { getSupabase } = require("../db/supabaseAdmin");
const { loadSetting } = require("../db/coreDataReader");

/**
 * Recalculate project risk score based on its tasks in Supabase.
 */
async function recalculateProjectRisk(projectId) {
    const sb = getSupabase();
    const { data: tasks, error } = await sb.from("tasks")
        .select("status, due_date")
        .eq("project_id", projectId);

    if (error || !tasks) {
        console.warn(`[Risk Recalc] Error fetching tasks for project ${projectId}:`, error?.message);
        return;
    }

    const now = new Date();
    const active = tasks.filter(t => !["completed", "cancelled"].includes(t.status));
    const overdue = active.filter(t => t.due_date && new Date(t.due_date) < now);
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

    const { error: updateErr } = await sb.from("projects")
        .update({
            risk_score: score,
            risk_level: riskLevel,
            risk_factors: factors,
            risk_updated_at: now.toISOString()
        })
        .eq("id", projectId);

    if (updateErr) {
        console.warn(`[Risk Recalc] Error updating project ${projectId}:`, updateErr.message);
    }
}

/**
 * Read WIP limit from settings in Supabase.
 */
async function getWipConfig() {
    try {
        const data = await loadSetting("wipConfig");
        if (data) {
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
        { secrets: ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"], timeoutSeconds: 30 },
        async (request) => {
            if (!request.auth) throw new HttpsError("unauthenticated", "User must be authenticated.");
            const userId = request.auth.uid;
            const { taskId, newStatus, force, blockedReason } = request.data;
            if (!taskId || typeof taskId !== "string") throw new HttpsError("invalid-argument", "taskId is required.");
            if (!newStatus || typeof newStatus !== "string") throw new HttpsError("invalid-argument", "newStatus is required.");

            const sb = getSupabase();

            // 1. Load task to check assignee and project
            const { data: task, error: getErr } = await sb.from("tasks")
                .select("*")
                .eq("id", taskId)
                .single();

            if (getErr || !task) throw new HttpsError("not-found", `Task ${taskId} not found.`);

            // 2. Enforce WIP Limit
            if (newStatus === "in_progress" && task.assigned_to) {
                const wipConfig = await getWipConfig();
                if (wipConfig.enabled) {
                    const { data: otherTasks } = await sb.from("tasks")
                        .select("id, title")
                        .eq("assigned_to", task.assigned_to)
                        .eq("status", "in_progress");

                    const otherInProgress = (otherTasks || []).filter(t => t.id !== taskId);
                    if (otherInProgress.length >= wipConfig.limit && !force) {
                        const otherTitles = otherInProgress.slice(0, 3).map(t => t.title || "Sin título").join(", ");
                        throw new HttpsError("failed-precondition",
                            `WIP limit (${wipConfig.limit}): ya tiene en progreso: "${otherTitles}". Suspenda esa(s) tarea(s) primero.`
                        );
                    }
                }
            }

            // Get current user display name for activity logging
            const { loadUser } = require("../db/coreDataReader");
            const userProfile = await loadUser(userId);
            const userName = userProfile?.displayName || userProfile?.name || userProfile?.email || "system";

            // 3. Perform database status transition using stored procedure
            const { data: result, error: rpcErr } = await sb.rpc('transition_task_status', {
                p_task_id: taskId,
                p_new_status: newStatus,
                p_user_id: userId,
                p_user_name: userName,
                p_force: !!force,
                p_blocked_reason: blockedReason || null
            });

            if (rpcErr || (result && !result.success)) {
                const errMsg = rpcErr?.message || result?.error || "Error al transicionar de estado.";
                throw new HttpsError("failed-precondition", errMsg);
            }

            // 4. Recalculate project risk
            if (task.project_id) {
                try {
                    await recalculateProjectRisk(task.project_id);
                } catch (riskErr) {
                    console.warn("[transitionTaskStatus] Risk recalc failed:", riskErr.message);
                }
            }

            console.log(`[transitionTaskStatus.sb] ${task.status} → ${newStatus} | task=${taskId} | user=${userId}`);
            return {
                success: true,
                previousStatus: result.previousStatus || task.status,
                newStatus: result.newStatus || newStatus,
                warnings: []
            };
        }
    );

    return { transitionTaskStatus };
}

module.exports = { createTasksExports };
