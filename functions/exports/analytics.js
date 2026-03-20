/**
 * Analytics Domain Exports — functions/exports/analytics.js
 * [Phase M.5] Scheduled audit, weekly brief, analytics refresh, dashboard.
 */
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");

const MODEL_NAME = "gemini-2.5-flash";

function createAnalyticsExports(adminDb, secrets) {
    const { geminiApiKey } = secrets;

    const scheduledAudit = onSchedule(
        { schedule: "0 6 * * *", timeZone: "America/Mexico_City", timeoutSeconds: 120 },
        async () => {
            console.log("Starting scheduled daily audit...");
            try {
                const tasksSnap = await adminDb.collection("tasks").get();
                const tasks = tasksSnap.docs.map(d => ({ id: d.id, ...d.data() }));
                const projectsSnap = await adminDb.collection("projects").get();
                const projects = projectsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

                const now = new Date();
                const findings = [];

                for (const task of tasks) {
                    if (["completed", "cancelled"].includes(task.status)) continue;
                    if (!task.assignedTo) {
                        findings.push({ ruleId: "TASK_NO_ASSIGNEE", severity: "warning", title: "Tarea sin asignar", message: `"${task.title}" no tiene responsable asignado.`, entityType: "task", entityId: task.id });
                    }
                    if (!task.estimatedHours || task.estimatedHours <= 0) {
                        findings.push({ ruleId: "TASK_NO_ESTIMATE", severity: "warning", title: "Tarea sin estimación", message: `"${task.title}" no tiene estimación de horas.`, entityType: "task", entityId: task.id });
                    }
                    if (task.dueDate && new Date(task.dueDate) < now) {
                        findings.push({ ruleId: "TASK_OVERDUE", severity: "critical", title: "Tarea vencida", message: `"${task.title}" venció el ${task.dueDate}.`, entityType: "task", entityId: task.id });
                    }
                    if (task.status === "blocked" && !task.blockedReason) {
                        findings.push({ ruleId: "TASK_BLOCKED_NO_DELAY", severity: "warning", title: "Bloqueada sin causa", message: `"${task.title}" está bloqueada sin causa de delay documentada.`, entityType: "task", entityId: task.id });
                    }
                }

                for (const project of projects) {
                    if (["completed", "cancelled", "on_hold"].includes(project.status)) continue;
                    const projectTasks = tasks.filter(t => t.projectId === project.id);
                    const activeTasks = projectTasks.filter(t => !["completed", "cancelled"].includes(t.status));
                    const overdueTasks = activeTasks.filter(t => t.dueDate && new Date(t.dueDate) < now);
                    if (activeTasks.length > 0 && overdueTasks.length / activeTasks.length > 0.3) {
                        findings.push({ ruleId: "PROJECT_TOO_MANY_OVERDUE", severity: "critical", title: "Proyecto con exceso de tareas vencidas", message: `"${project.name}" tiene ${overdueTasks.length}/${activeTasks.length} tareas vencidas (${Math.round(overdueTasks.length / activeTasks.length * 100)}%).`, entityType: "project", entityId: project.id });
                    }
                }

                const totalActive = tasks.filter(t => !["completed", "cancelled"].includes(t.status)).length;
                const withAssignee = tasks.filter(t => t.assignedTo && !["completed", "cancelled"].includes(t.status)).length;
                const withEstimate = tasks.filter(t => t.estimatedHours > 0 && !["completed", "cancelled"].includes(t.status)).length;
                const methodologyScore = totalActive > 0 ? Math.round((withAssignee / totalActive) * 100) : 100;
                const planningScore = totalActive > 0 ? Math.round((withEstimate / totalActive) * 100) : 100;

                const completedTasks = tasks.filter(t => t.status === "completed");
                const tasksWithBothHours = completedTasks.filter(t => t.estimatedHours > 0 && t.actualHours > 0);
                let estimationAccuracy;
                if (tasksWithBothHours.length === 0) {
                    estimationAccuracy = completedTasks.length === 0 ? 100 : 50;
                } else {
                    const accuracies = tasksWithBothHours.map(t => { const ratio = t.actualHours / t.estimatedHours; return Math.max(0, 1 - Math.abs(1 - ratio)); });
                    estimationAccuracy = Math.round((accuracies.reduce((sum, a) => sum + a, 0) / accuracies.length) * 100);
                }

                const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
                const activeTasks = tasks.filter(t => !["completed", "cancelled"].includes(t.status));
                const recentlyUpdated = activeTasks.filter(t => { const updated = t.updatedAt ? new Date(t.updatedAt) : null; return updated && updated >= fourteenDaysAgo; });
                const dataDiscipline = activeTasks.length > 0 ? Math.round((recentlyUpdated.length / activeTasks.length) * 100) : 100;

                const scores = { methodologyCompliance: methodologyScore, planningReliability: planningScore, estimationAccuracy, dataDiscipline, projectHealth: Math.max(0, 100 - (findings.filter(f => f.severity === "critical").length * 10)), calculatedAt: now.toISOString() };

                const batch = adminDb.batch();
                const runId = `audit-scheduled-${Date.now()}`;
                for (let i = 0; i < Math.min(findings.length, 450); i++) {
                    const ref = adminDb.collection("auditFindings").doc();
                    batch.set(ref, { ...findings[i], auditRunId: runId, status: "open", createdAt: now.toISOString() });
                }
                const eventRef = adminDb.collection("auditEvents").doc();
                batch.set(eventRef, { eventType: "audit_run", entityType: "system", entityId: "department", userId: "system", timestamp: now.toISOString(), source: "scheduled", correlationId: runId, details: { totalFindings: findings.length, bySeverity: { critical: findings.filter(f => f.severity === "critical").length, warning: findings.filter(f => f.severity === "warning").length, info: findings.filter(f => f.severity === "info").length }, scores } });
                const snapRef = adminDb.collection("analyticsSnapshots").doc();
                batch.set(snapRef, { scope: "compliance", entityId: "department", snapshotDate: now.toISOString().split("T")[0], metrics: { ...scores, totalTasks: tasks.length, activeTasks: totalActive, totalProjects: projects.length, totalFindings: findings.length }, createdAt: now.toISOString(), createdBy: "system" });
                await batch.commit();
                console.log(`Scheduled audit complete: ${findings.length} findings, scores saved.`);
            } catch (err) {
                console.error("Scheduled audit failed:", err);
            }
        }
    );

    const weeklyBriefGenerator = onSchedule(
        { schedule: "0 7 * * 1", timeZone: "America/Mexico_City", timeoutSeconds: 120, secrets: [geminiApiKey] },
        async () => {
            console.log("Starting weekly brief generation...");
            try {
                const snapQuery = adminDb.collection("analyticsSnapshots").where("scope", "==", "compliance").orderBy("createdAt", "desc").limit(2);
                const snapDocs = await snapQuery.get();
                const latestSnap = snapDocs.docs[0]?.data();
                const previousSnap = snapDocs.docs[1]?.data();
                const auditQuery = adminDb.collection("auditEvents").where("eventType", "==", "audit_run").orderBy("timestamp", "desc").limit(1);
                const auditDocs = await auditQuery.get();
                const latestAudit = auditDocs.docs[0]?.data();
                if (!latestSnap || !latestAudit) { console.log("No audit data available for weekly brief. Skipping."); return; }

                const metrics = latestSnap.metrics || {};
                const scores = latestAudit.details?.scores || {};
                const auditSummary = latestAudit.details || {};
                const prompt = `Eres un gerente de ingeniería de automatización industrial.\nGenera un brief ejecutivo semanal para el departamento.\n\nMétricas del snapshot más reciente:\n- Tareas activas: ${metrics.activeTasks || 0}\n- Total tareas: ${metrics.totalTasks || 0}\n- Proyectos: ${metrics.totalProjects || 0}\n- Hallazgos de auditoría: ${auditSummary.totalFindings || 0} (${auditSummary.bySeverity?.critical || 0} críticos)\n\nScores de cumplimiento:\n- Metodología: ${scores.methodologyCompliance || "N/A"}%\n- Planificación: ${scores.planningReliability || "N/A"}%\n- Salud Proyectos: ${scores.projectHealth || "N/A"}%\n\n${previousSnap ? `Snapshot anterior: Metodología ${previousSnap.metrics?.methodologyCompliance || "N/A"}%, Planificación ${previousSnap.metrics?.planningReliability || "N/A"}%` : "Sin datos previos."}\n\nProporciona el brief en formato JSON:\n{\n  "executiveSummary": "Resumen ejecutivo en 3-4 oraciones",\n  "highlights": ["Logro 1", "Logro 2"],\n  "concerns": ["Preocupación 1", "Preocupación 2"],\n  "nextWeekPriorities": ["Prioridad 1", "Prioridad 2", "Prioridad 3"],\n  "kpiStatus": "mejorando|estable|deteriorando",\n  "overallSentiment": "positivo|neutral|negativo"\n}\n\nResponde ÚNICAMENTE con el JSON.`;

                const apiKey = geminiApiKey.value();
                const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${apiKey}`;
                const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.4, maxOutputTokens: 2048 } }) });
                if (!response.ok) throw new Error(`Gemini API error: ${response.status}`);
                const result = await response.json();
                const text = result?.candidates?.[0]?.content?.parts?.[0]?.text;
                if (!text) throw new Error("No response text from Gemini");

                let briefData;
                try { briefData = JSON.parse(text); } catch { const match = text.match(/\{[\s\S]*\}/); briefData = match ? JSON.parse(match[0]) : { executiveSummary: text }; }

                const briefRef = adminDb.collection("managementBriefs").doc();
                await briefRef.set({ type: "weekly", generatedBy: "gemini", model: MODEL_NAME, content: briefData, snapshotData: { metrics, scores, auditSummary: { totalFindings: auditSummary.totalFindings, bySeverity: auditSummary.bySeverity } }, createdAt: new Date().toISOString(), weekOf: new Date().toISOString().split("T")[0] });
                console.log("Weekly brief generated and stored successfully.");
            } catch (err) {
                console.error("Weekly brief generation failed:", err);
            }
        }
    );

    // Analytics refresh + dashboard from existing handler
    const { runAnalyticsRefresh, getAnalyticsDashboardData } = require("../handlers/analyticsRefreshHandler");

    const scheduledAnalyticsRefresh = onSchedule(
        { schedule: "30 6 * * *", timeZone: "America/Mexico_City", timeoutSeconds: 120 },
        async () => {
            console.log("[scheduledAnalyticsRefresh] Starting daily analytics refresh...");
            try {
                const result = await runAnalyticsRefresh(adminDb, { periodType: "daily" });
                console.log("[scheduledAnalyticsRefresh] Complete:", JSON.stringify({ riskFlags: result.riskFlagsGenerated, recommendations: result.recommendationsGenerated, latencyMs: result.latencyMs }));
            } catch (err) {
                console.error("[scheduledAnalyticsRefresh] Failed:", err);
            }
        }
    );

    const refreshAnalyticsManual = onCall(
        { timeoutSeconds: 120 },
        async (request) => {
            if (!request.auth) throw new HttpsError("unauthenticated", "User must be authenticated.");
            const roleDoc = await adminDb.collection("users_roles").doc(request.auth.uid).get();
            if (!roleDoc.exists || roleDoc.data().role !== "admin") throw new HttpsError("permission-denied", "Admin access required.");
            const { periodType = "daily", startDate, endDate } = request.data || {};
            console.log(`[refreshAnalyticsManual] Admin ${request.auth.uid} requested ${periodType} refresh`);
            const result = await runAnalyticsRefresh(adminDb, { periodType, startDate, endDate });
            return result;
        }
    );

    const getAnalyticsDashboard = onCall(
        { timeoutSeconds: 30 },
        async (request) => {
            if (!request.auth) throw new HttpsError("unauthenticated", "User must be authenticated.");
            const { periodType = "daily" } = request.data || {};
            const data = await getAnalyticsDashboardData(adminDb, periodType);
            return data;
        }
    );

    return { scheduledAudit, weeklyBriefGenerator, scheduledAnalyticsRefresh, refreshAnalyticsManual, getAnalyticsDashboard };
}

module.exports = { createAnalyticsExports };
