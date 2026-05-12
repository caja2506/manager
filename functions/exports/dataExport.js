/**
 * Data Export Endpoints — functions/exports/dataExport.js
 * ========================================================
 * Public HTTP endpoints for live data access from Excel / Power Query.
 * No authentication required — data is read-only task summaries.
 */
const { onRequest } = require("firebase-functions/v2/https");

const STATUS_LABELS = {
    in_progress: "In Progress", pending: "To Do", backlog: "Backlog",
    validation: "Revisión", completed: "Completado", blocked: "Bloqueado", cancelled: "Cancelado",
};
const PRIORITY_LABELS = {
    low: "Baja", medium: "Media", high: "Alta", critical: "Crítica",
};

function createDataExportExports(adminDb) {

    /**
     * GET /exportTasksForExcel
     * Returns all tasks as a flat JSON array ready for Excel Power Query.
     *
     * Optional query params:
     *   ?status=in_progress,pending    (comma-separated filter)
     *   ?project=<projectId>
     *   ?assignee=<userId>
     */
    const exportTasksForExcel = onRequest(
        { timeoutSeconds: 60, cors: true },
        async (req, res) => {
            if (req.method !== "GET") {
                res.status(405).json({ error: "Method not allowed. Use GET." });
                return;
            }

            // ── API Key validation ──
            const providedKey = req.query.key || req.headers["x-api-key"] || "";
            if (!providedKey) {
                res.status(401).json({ error: "API key required. Use ?key=YOUR_KEY" });
                return;
            }
            try {
                const keysDoc = await adminDb.collection("settings").doc("apiKeys").get();
                const validKeys = keysDoc.exists ? (keysDoc.data().exportKeys || []) : [];
                if (!validKeys.includes(providedKey)) {
                    res.status(403).json({ error: "Invalid API key." });
                    return;
                }
            } catch (keyErr) {
                console.error("[exportTasksForExcel] Key validation error:", keyErr.message);
                res.status(500).json({ error: "Key validation failed." });
                return;
            }

            try {
                // ── Fetch all data in parallel ──
                const [tasksSnap, projectsSnap, membersSnap, taskTypesSnap, workAreasSnap, subtasksSnap] = await Promise.all([
                    adminDb.collection("tasks").get(),
                    adminDb.collection("projects").get(),
                    adminDb.collection("teamMembers").get(),
                    adminDb.collection("taskTypes").get(),
                    adminDb.collection("workAreaTypes").get(),
                    adminDb.collection("subtasks").get(),
                ]);

                const projects = {};
                projectsSnap.docs.forEach(d => { projects[d.id] = d.data().name || ""; });

                const members = {};
                membersSnap.docs.forEach(d => {
                    const data = d.data();
                    members[data.uid || d.id] = data.displayName || data.email || "";
                });

                const taskTypesMap = {};
                taskTypesSnap.docs.forEach(d => { taskTypesMap[d.id] = d.data().name || ""; });

                const workAreasMap = {};
                workAreasSnap.docs.forEach(d => { workAreasMap[d.id] = d.data().name || ""; });

                // Subtask counts per task
                const subtaskCounts = {};
                const subtaskDone = {};
                subtasksSnap.docs.forEach(d => {
                    const data = d.data();
                    const tid = data.taskId;
                    if (!tid) return;
                    subtaskCounts[tid] = (subtaskCounts[tid] || 0) + 1;
                    if (data.completed || data.done) subtaskDone[tid] = (subtaskDone[tid] || 0) + 1;
                });

                // ── Apply filters ──
                let tasks = tasksSnap.docs.map(d => ({ id: d.id, ...d.data() }));

                const statusFilter = req.query.status;
                if (statusFilter) {
                    const allowed = statusFilter.split(",").map(s => s.trim());
                    tasks = tasks.filter(t => allowed.includes(t.status));
                }
                if (req.query.project) {
                    tasks = tasks.filter(t => t.projectId === req.query.project);
                }
                if (req.query.assignee) {
                    tasks = tasks.filter(t => t.assignedTo === req.query.assignee);
                }

                // ── Build rows ──
                const fmtDate = (d) => {
                    if (!d) return "";
                    const date = new Date(d);
                    return isNaN(date) ? "" : date.toISOString().split("T")[0];
                };

                const rows = tasks.map(task => {
                    const totalSubs = subtaskCounts[task.id] || 0;
                    const doneSubs = subtaskDone[task.id] || 0;
                    const subsPct = totalSubs > 0 ? Math.round((doneSubs / totalSubs) * 100) : 0;
                    const progressPct = task.progressPct != null
                        ? Math.round(task.progressPct)
                        : (task.status === "completed" ? 100 : subsPct);

                    // Health (metodología)
                    let methHealth = 0;
                    if (totalSubs > 0) methHealth += 15;
                    if ((task.estimatedHours || 0) > 0) methHealth += 20;
                    if (task.assignedTo) methHealth += 20;
                    if (task.dueDate || task.plannedEndDate) methHealth += 15;
                    if (task.taskTypeId) methHealth += 10;
                    if ((task.description || "").trim().length >= 10) methHealth += 10;
                    if (task.priority !== "critical" || task.milestoneId) methHealth += 10;

                    // Score (operativo)
                    let opScore = null;
                    if (task.status !== "cancelled") {
                        opScore = task.status === "completed" ? 100 : 100;
                        if (task.status !== "completed") {
                            const startRaw = task.plannedStartDate || task.createdAt;
                            const endRaw = task.dueDate || task.plannedEndDate;
                            const startDate = startRaw ? new Date(startRaw) : null;
                            const endDate = endRaw ? new Date(endRaw) : null;
                            const now = new Date();
                            let daysLeft = null;
                            let timelinePct = 0;
                            if (startDate && endDate) {
                                const total = Math.max(1, (endDate - startDate) / (1000 * 60 * 60 * 24));
                                const elapsed = Math.max(0, (now - startDate) / (1000 * 60 * 60 * 24));
                                timelinePct = Math.min(100, Math.max(0, (elapsed / total) * 100));
                                daysLeft = Math.ceil((endDate - now) / (1000 * 60 * 60 * 24));
                            }
                            const hoursPct = (task.estimatedHours || 0) > 0
                                ? Math.round(((task.actualHours || 0) / task.estimatedHours) * 100)
                                : 0;
                            if (daysLeft !== null && daysLeft < 0) opScore -= Math.min(40, Math.abs(daysLeft) * 4);
                            else if (daysLeft !== null && daysLeft <= 2) opScore -= 15;
                            if (hoursPct > 120) opScore -= 25;
                            else if (hoursPct > 100) opScore -= 15;
                            else if (hoursPct > 85) opScore -= 5;
                            if (timelinePct > 70 && progressPct < 30) opScore -= 20;
                            else if (timelinePct > 50 && progressPct < 20) opScore -= 10;
                            opScore = Math.max(0, Math.min(100, opScore));
                        }
                    }

                    return {
                        Tarea: task.title || "",
                        Responsable: members[task.assignedTo] || "",
                        Proyecto: projects[task.projectId] || "",
                        Estado: STATUS_LABELS[task.status] || task.status || "",
                        Area: workAreasMap[task.workAreaTypeId] || "",
                        Tipo: taskTypesMap[task.taskTypeId] || "",
                        "Avance_%": progressPct,
                        Health: methHealth,
                        Score: opScore,
                        Fecha_Inicio: fmtDate(task.plannedStartDate),
                        Fecha_Fin: fmtDate(task.dueDate || task.plannedEndDate),
                        Horas_Reales: task.actualHours || 0,
                        Horas_Estimadas: task.estimatedHours || 0,
                        Prioridad: PRIORITY_LABELS[task.priority] || task.priority || "",
                        Asignado_Por: members[task.assignedBy] || "",
                        Subtareas_Total: totalSubs,
                        Subtareas_Completadas: doneSubs,
                    };
                });

                res.status(200).json(rows);
            } catch (err) {
                console.error("[exportTasksForExcel] Error:", err);
                res.status(500).json({ error: "Internal server error", message: err.message });
            }
        }
    );

    return { exportTasksForExcel };
}

module.exports = { createDataExportExports };
