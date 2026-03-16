const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { defineSecret } = require("firebase-functions/params");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");

initializeApp();
const adminDb = getFirestore();

// Secrets managed via: firebase functions:secrets:set <SECRET_NAME>
const geminiApiKey = defineSecret("GEMINI_API_KEY");
const googleCseKey = defineSecret("GOOGLE_CSE_KEY");
const googleCx = defineSecret("GOOGLE_CX");

const MODEL_NAME = "gemini-2.5-flash";

/**
 * Cloud Function: testGeminiConnection
 * Simple ping to verify the Gemini API is reachable.
 */
exports.testGeminiConnection = onCall(
    { secrets: [geminiApiKey] },
    async (request) => {
        const apiKey = geminiApiKey.value();
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${apiKey}`;

        try {
            const response = await fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    contents: [
                        {
                            parts: [
                                { text: 'Responde únicamente con la palabra: CONECTADO' },
                            ],
                        },
                    ],
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new HttpsError(
                    "internal",
                    data.error?.message || `HTTP error ${response.status}`
                );
            }

            const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
            return { status: "ok", response: text };
        } catch (err) {
            if (err instanceof HttpsError) throw err;
            throw new HttpsError("internal", err.message);
        }
    }
);

/**
 * Cloud Function: analyzeQuotePdf
 * Receives extracted PDF text from the client, sends it to Gemini
 * with a structured prompt, and returns the parsed JSON result.
 */
exports.analyzeQuotePdf = onCall(
    { secrets: [geminiApiKey], timeoutSeconds: 120 },
    async (request) => {
        const { text } = request.data;

        if (!text || typeof text !== "string" || !text.trim()) {
            throw new HttpsError(
                "invalid-argument",
                "Se requiere el texto extraído del PDF."
            );
        }

        const apiKey = geminiApiKey.value();
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${apiKey}`;

        const prompt = `Analiza el texto de una cotización. Extrae los datos y devuelve EXCLUSIVAMENTE un JSON estricto con la siguiente estructura: { "supplier": "Nombre Proveedor", "items": [ { "pn": "Número de parte", "description": "Descripción", "quantity": numero, "unitPrice": numero, "leadTimeWeeks": numero } ] }.
Reglas:
1. Ignora texto irrelevante, encabezados o textos legales.
2. Los pn (Part Number) deben estar en MAYÚSCULAS y resolverse sin espacios.
3. description debe ser concisa, técnica y resumida.
4. quantity y unitPrice deben ser numéricos (usa 0 si falta el dato).
5. Si no hay proveedor, usa "".
6. leadTimeWeeks es el tiempo de entrega en SEMANAS. Si dice días, convierte dividiendo entre 7 y redondeando hacia arriba (mínimo 1). Si no se menciona, usa null.
7. Busca frases como "lead time", "tiempo de entrega", "delivery", "plazo", "semanas", "weeks", "días", "days".
Devuelve SOLO el JSON sin delimitadores markdown.

Texto:

${text}`;

        try {
            const response = await fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: { response_mime_type: "application/json" },
                }),
            });

            const result = await response.json();

            if (!response.ok) {
                throw new HttpsError(
                    "internal",
                    `Error de IA: ${result.error?.message || "Fallo desconocido"}`
                );
            }

            const rawJson = result.candidates?.[0]?.content?.parts?.[0]?.text;
            if (!rawJson) {
                throw new HttpsError("internal", "La IA no devolvió ningún texto.");
            }

            // Parse and validate the JSON
            const parsed = JSON.parse(
                rawJson
                    .replace(/```json/g, "")
                    .replace(/```/g, "")
                    .trim()
            );

            return { data: parsed };
        } catch (err) {
            if (err instanceof HttpsError) throw err;
            if (err instanceof SyntaxError) {
                throw new HttpsError(
                    "internal",
                    "La IA devolvió JSON inválido. Intenta de nuevo."
                );
            }
            throw new HttpsError("internal", err.message);
        }
    }
);

/**
 * Cloud Function: searchImages
 * Proxies Google Custom Search API for image search.
 * Keeps the CSE API key and CX ID server-side.
 */
exports.searchImages = onCall(
    { secrets: [googleCseKey, googleCx] },
    async (request) => {
        const { query } = request.data;

        if (!query || typeof query !== "string" || !query.trim()) {
            throw new HttpsError(
                "invalid-argument",
                "Se requiere un término de búsqueda."
            );
        }

        const key = googleCseKey.value();
        const cx = googleCx.value();
        const url = `https://www.googleapis.com/customsearch/v1?key=${key}&cx=${cx}&q=${encodeURIComponent(query + " product")}&searchType=image&num=8&imgSize=medium&safe=active`;

        try {
            const response = await fetch(url);
            const data = await response.json();

            if (data.error) {
                throw new HttpsError(
                    "internal",
                    data.error.message || "Error en la búsqueda de imágenes"
                );
            }

            const images = (data.items || []).map((item) => ({
                url: item.link,
                thumbnail: item.image?.thumbnailLink || item.link,
                title: item.title,
                source: item.displayLink,
            }));

            return { images };
        } catch (err) {
            if (err instanceof HttpsError) throw err;
            throw new HttpsError("internal", err.message);
        }
    }
);

/**
 * Cloud Function: generateInsights
 * Calls Gemini with a management intelligence prompt and returns structured insights.
 */
exports.generateInsights = onCall(
    { secrets: [geminiApiKey], timeoutSeconds: 60 },
    async (request) => {
        // Require authentication
        if (!request.auth) {
            throw new HttpsError("unauthenticated", "User must be authenticated.");
        }

        const { prompt, type } = request.data;
        if (!prompt || typeof prompt !== "string") {
            throw new HttpsError("invalid-argument", "A valid prompt string is required.");
        }

        const apiKey = geminiApiKey.value();
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${apiKey}`;

        try {
            const response = await fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    contents: [
                        {
                            parts: [{ text: prompt }],
                        },
                    ],
                    generationConfig: {
                        temperature: 0.4,
                        maxOutputTokens: 4096,
                        topP: 0.8,
                        responseMimeType: "application/json",
                    },
                }),
            });

            if (!response.ok) {
                const errorBody = await response.text();
                throw new HttpsError("internal", `Gemini API error: ${response.status} - ${errorBody}`);
            }

            const result = await response.json();
            const text = result?.candidates?.[0]?.content?.parts?.[0]?.text;

            if (!text) {
                throw new HttpsError("internal", "No text response from Gemini.");
            }

            console.log(`[generateInsights] Successfully generated insights of type: ${type}`);
            console.log(`[generateInsights] RAW Output snippet: ${text.substring(0, 150)}...`);
            return {
                success: true,
                response: text,
                type: type || "general",
                model: MODEL_NAME,
                generatedAt: new Date().toISOString(),
            };
        } catch (err) {
            if (err instanceof HttpsError) throw err;
            throw new HttpsError("internal", `Gemini insight generation failed: ${err.message}`);
        }
    }
);

// ============================================================
// SCHEDULED: Daily Audit (runs at 6:00 AM CST)
// ============================================================

exports.scheduledAudit = onSchedule(
    {
        schedule: "0 6 * * *",
        timeZone: "America/Mexico_City",
        timeoutSeconds: 120,
    },
    async () => {
        console.log("Starting scheduled daily audit...");

        try {
            // Fetch all tasks
            const tasksSnap = await adminDb.collection("tasks").get();
            const tasks = tasksSnap.docs.map(d => ({ id: d.id, ...d.data() }));

            // Fetch all projects
            const projectsSnap = await adminDb.collection("projects").get();
            const projects = projectsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

            // === SERVER-SIDE RULE EVALUATION ===
            const now = new Date();
            const findings = [];

            // Task Rules (server-side simplified versions)
            for (const task of tasks) {
                if (["completed", "cancelled"].includes(task.status)) continue;

                if (!task.assignedTo) {
                    findings.push({
                        ruleId: "TASK_NO_ASSIGNEE",
                        severity: "warning",
                        title: "Tarea sin asignar",
                        message: `"${task.title}" no tiene responsable asignado.`,
                        entityType: "task",
                        entityId: task.id,
                    });
                }

                if (!task.estimatedHours || task.estimatedHours <= 0) {
                    findings.push({
                        ruleId: "TASK_NO_ESTIMATE",
                        severity: "warning",
                        title: "Tarea sin estimación",
                        message: `"${task.title}" no tiene estimación de horas.`,
                        entityType: "task",
                        entityId: task.id,
                    });
                }

                if (task.dueDate && new Date(task.dueDate) < now) {
                    findings.push({
                        ruleId: "TASK_OVERDUE",
                        severity: "critical",
                        title: "Tarea vencida",
                        message: `"${task.title}" venció el ${task.dueDate}.`,
                        entityType: "task",
                        entityId: task.id,
                    });
                }

                if (task.status === "blocked" && !task.blockedReason) {
                    findings.push({
                        ruleId: "TASK_BLOCKED_NO_DELAY",
                        severity: "warning",
                        title: "Bloqueada sin causa",
                        message: `"${task.title}" está bloqueada sin causa de delay documentada.`,
                        entityType: "task",
                        entityId: task.id,
                    });
                }
            }

            // Project Rules
            for (const project of projects) {
                if (["completed", "cancelled", "on_hold"].includes(project.status)) continue;

                const projectTasks = tasks.filter(t => t.projectId === project.id);
                const activeTasks = projectTasks.filter(t => !["completed", "cancelled"].includes(t.status));
                const overdueTasks = activeTasks.filter(t => t.dueDate && new Date(t.dueDate) < now);

                if (activeTasks.length > 0 && overdueTasks.length / activeTasks.length > 0.3) {
                    findings.push({
                        ruleId: "PROJECT_TOO_MANY_OVERDUE",
                        severity: "critical",
                        title: "Proyecto con exceso de tareas vencidas",
                        message: `"${project.name}" tiene ${overdueTasks.length}/${activeTasks.length} tareas vencidas (${Math.round(overdueTasks.length / activeTasks.length * 100)}%).`,
                        entityType: "project",
                        entityId: project.id,
                    });
                }
            }

            // Calculate compliance scores — REAL computations, no placeholders
            const totalActive = tasks.filter(t => !["completed", "cancelled"].includes(t.status)).length;
            const withAssignee = tasks.filter(t => t.assignedTo && !["completed", "cancelled"].includes(t.status)).length;
            const withEstimate = tasks.filter(t => t.estimatedHours > 0 && !["completed", "cancelled"].includes(t.status)).length;

            const methodologyScore = totalActive > 0 ? Math.round((withAssignee / totalActive) * 100) : 100;
            const planningScore = totalActive > 0 ? Math.round((withEstimate / totalActive) * 100) : 100;

            // estimationAccuracy: real calculation from completed tasks
            const completedTasks = tasks.filter(t => t.status === "completed");
            const tasksWithBothHours = completedTasks.filter(t => t.estimatedHours > 0 && t.actualHours > 0);
            let estimationAccuracy;
            if (tasksWithBothHours.length === 0) {
                estimationAccuracy = completedTasks.length === 0 ? 100 : 50; // No data = neutral
            } else {
                const accuracies = tasksWithBothHours.map(t => {
                    const ratio = t.actualHours / t.estimatedHours;
                    const deviation = Math.abs(1 - ratio);
                    return Math.max(0, 1 - deviation);
                });
                estimationAccuracy = Math.round(
                    (accuracies.reduce((sum, a) => sum + a, 0) / accuracies.length) * 100
                );
            }

            // dataDiscipline: percentage of active tasks updated in last 14 days
            const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
            const activeTasks = tasks.filter(t => !["completed", "cancelled"].includes(t.status));
            const recentlyUpdated = activeTasks.filter(t => {
                const updated = t.updatedAt ? new Date(t.updatedAt) : null;
                return updated && updated >= fourteenDaysAgo;
            });
            const dataDiscipline = activeTasks.length > 0
                ? Math.round((recentlyUpdated.length / activeTasks.length) * 100)
                : 100;

            const scores = {
                methodologyCompliance: methodologyScore,
                planningReliability: planningScore,
                estimationAccuracy,
                dataDiscipline,
                projectHealth: Math.max(0, 100 - (findings.filter(f => f.severity === "critical").length * 10)),
                calculatedAt: now.toISOString(),
            };

            // Persist findings
            const batch = adminDb.batch();
            const runId = `audit-scheduled-${Date.now()}`;

            for (let i = 0; i < Math.min(findings.length, 450); i++) {
                const ref = adminDb.collection("auditFindings").doc();
                batch.set(ref, {
                    ...findings[i],
                    auditRunId: runId,
                    status: "open",
                    createdAt: now.toISOString(),
                });
            }

            // Audit event (official schema)
            const eventRef = adminDb.collection("auditEvents").doc();
            batch.set(eventRef, {
                eventType: "audit_run",
                entityType: "system",
                entityId: "department",
                userId: "system",
                timestamp: now.toISOString(),
                source: "scheduled",
                correlationId: runId,
                details: {
                    totalFindings: findings.length,
                    bySeverity: {
                        critical: findings.filter(f => f.severity === "critical").length,
                        warning: findings.filter(f => f.severity === "warning").length,
                        info: findings.filter(f => f.severity === "info").length,
                    },
                    scores,
                },
            });

            // Compliance snapshot
            const snapRef = adminDb.collection("analyticsSnapshots").doc();
            batch.set(snapRef, {
                scope: "compliance",
                entityId: "department",
                snapshotDate: now.toISOString().split("T")[0],
                metrics: {
                    ...scores,
                    totalTasks: tasks.length,
                    activeTasks: totalActive,
                    totalProjects: projects.length,
                    totalFindings: findings.length,
                },
                createdAt: now.toISOString(),
                createdBy: "system",
            });

            await batch.commit();

            console.log(`Scheduled audit complete: ${findings.length} findings, scores saved.`);
        } catch (err) {
            console.error("Scheduled audit failed:", err);
        }
    }
);

// ============================================================
// SCHEDULED: Weekly Management Brief (Mondays 7:00 AM CST)
// ============================================================

exports.weeklyBriefGenerator = onSchedule(
    {
        schedule: "0 7 * * 1",
        timeZone: "America/Mexico_City",
        timeoutSeconds: 120,
        secrets: [geminiApiKey],
    },
    async () => {
        console.log("Starting weekly brief generation...");

        try {
            // Fetch latest compliance snapshot
            const snapQuery = adminDb
                .collection("analyticsSnapshots")
                .where("scope", "==", "compliance")
                .orderBy("createdAt", "desc")
                .limit(2);

            const snapDocs = await snapQuery.get();
            const latestSnap = snapDocs.docs[0]?.data();
            const previousSnap = snapDocs.docs[1]?.data();

            // Fetch latest audit event
            const auditQuery = adminDb
                .collection("auditEvents")
                .where("eventType", "==", "audit_run")
                .orderBy("timestamp", "desc")
                .limit(1);

            const auditDocs = await auditQuery.get();
            const latestAudit = auditDocs.docs[0]?.data();

            if (!latestSnap || !latestAudit) {
                console.log("No audit data available for weekly brief. Skipping.");
                return;
            }

            // Build prompt
            const metrics = latestSnap.metrics || {};
            const scores = latestAudit.details?.scores || {};
            const auditSummary = latestAudit.details || {};

            const prompt = `Eres un gerente de ingeniería de automatización industrial.
Genera un brief ejecutivo semanal para el departamento.

Métricas del snapshot más reciente:
- Tareas activas: ${metrics.activeTasks || 0}
- Total tareas: ${metrics.totalTasks || 0}
- Proyectos: ${metrics.totalProjects || 0}
- Hallazgos de auditoría: ${auditSummary.totalFindings || 0} (${auditSummary.bySeverity?.critical || 0} críticos)

Scores de cumplimiento:
- Metodología: ${scores.methodologyCompliance || "N/A"}%
- Planificación: ${scores.planningReliability || "N/A"}%
- Salud Proyectos: ${scores.projectHealth || "N/A"}%

${previousSnap ? `Snapshot anterior: Metodología ${previousSnap.metrics?.methodologyCompliance || "N/A"}%, Planificación ${previousSnap.metrics?.planningReliability || "N/A"}%` : "Sin datos previos."}

Proporciona el brief en formato JSON:
{
  "executiveSummary": "Resumen ejecutivo en 3-4 oraciones",
  "highlights": ["Logro 1", "Logro 2"],
  "concerns": ["Preocupación 1", "Preocupación 2"],
  "nextWeekPriorities": ["Prioridad 1", "Prioridad 2", "Prioridad 3"],
  "kpiStatus": "mejorando|estable|deteriorando",
  "overallSentiment": "positivo|neutral|negativo"
}

Responde ÚNICAMENTE con el JSON.`;

            // Call Gemini
            const apiKey = geminiApiKey.value();
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${apiKey}`;

            const response = await fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: { temperature: 0.4, maxOutputTokens: 2048 },
                }),
            });

            if (!response.ok) {
                throw new Error(`Gemini API error: ${response.status}`);
            }

            const result = await response.json();
            const text = result?.candidates?.[0]?.content?.parts?.[0]?.text;

            if (!text) {
                throw new Error("No response text from Gemini");
            }

            // Parse response
            let briefData;
            try {
                briefData = JSON.parse(text);
            } catch {
                const match = text.match(/\{[\s\S]*\}/);
                briefData = match ? JSON.parse(match[0]) : { executiveSummary: text };
            }

            // Store brief
            const briefRef = adminDb.collection("managementBriefs").doc();
            await briefRef.set({
                type: "weekly",
                generatedBy: "gemini",
                model: MODEL_NAME,
                content: briefData,
                snapshotData: {
                    metrics,
                    scores,
                    auditSummary: {
                        totalFindings: auditSummary.totalFindings,
                        bySeverity: auditSummary.bySeverity,
                    },
                },
                createdAt: new Date().toISOString(),
                weekOf: new Date().toISOString().split("T")[0],
            });

            console.log("Weekly brief generated and stored successfully.");
        } catch (err) {
            console.error("Weekly brief generation failed:", err);
        }
    }
);

// ============================================================
// WORKFLOW ENFORCEMENT: transitionTaskStatus
// ============================================================
//
// SECURITY: This is the ONLY authorized way to change task status.
// Firestore rules block direct client writes to `status`, `completedDate`,
// `completedAt`, and `reopenedAt` on the `tasks` collection.
// This function uses Admin SDK (bypasses rules).
//
// See: src/core/workflow/workflowModel.js for the canonical state machine.
// ============================================================

// Server-side copy of the workflow state machine.
// MUST stay in sync with src/core/workflow/workflowModel.js VALID_TRANSITIONS.
const VALID_TRANSITIONS = {
    backlog: ["pending", "in_progress", "cancelled"],
    pending: ["in_progress", "backlog", "blocked", "cancelled"],
    in_progress: ["validation", "blocked", "cancelled"],
    blocked: ["in_progress", "pending", "cancelled"],
    validation: ["completed", "in_progress", "blocked"],
    completed: ["in_progress"],    // reopen
    cancelled: ["backlog"],        // reactivate
};

const REQUIRED_FIELDS = {
    pending: [
        { field: "assignedTo", label: "Responsable asignado" },
        { field: "projectId", label: "Proyecto asignado" },
    ],
    in_progress: [
        { field: "assignedTo", label: "Responsable asignado" },
    ],
    blocked: [
        { field: "blockedReason", label: "Razón de bloqueo" },
    ],
    validation: [
        { field: "assignedTo", label: "Responsable asignado" },
    ],
    completed: [
        { field: "assignedTo", label: "Responsable asignado" },
    ],
};

exports.transitionTaskStatus = onCall(
    { timeoutSeconds: 30 },
    async (request) => {
        // ── 1. Auth check ──
        if (!request.auth) {
            throw new HttpsError("unauthenticated", "User must be authenticated.");
        }
        const userId = request.auth.uid;

        // ── 2. Input validation ──
        const { taskId, newStatus, force } = request.data;
        if (!taskId || typeof taskId !== "string") {
            throw new HttpsError("invalid-argument", "taskId is required.");
        }
        if (!newStatus || typeof newStatus !== "string") {
            throw new HttpsError("invalid-argument", "newStatus is required.");
        }

        // ── 3. Read current task ──
        const taskRef = adminDb.collection("tasks").doc(taskId);
        const taskSnap = await taskRef.get();
        if (!taskSnap.exists) {
            throw new HttpsError("not-found", `Task ${taskId} not found.`);
        }
        const task = { id: taskSnap.id, ...taskSnap.data() };
        const currentStatus = task.status;

        // ── 4. Validate transition ──
        const allowedTargets = VALID_TRANSITIONS[currentStatus];
        if (!allowedTargets || !allowedTargets.includes(newStatus)) {
            throw new HttpsError(
                "failed-precondition",
                `Transition "${currentStatus}" → "${newStatus}" is not allowed. ` +
                `Valid targets: ${(allowedTargets || []).join(", ") || "none"}`
            );
        }

        // ── 5. Validate required fields ──
        const warnings = [];
        const requiredFields = REQUIRED_FIELDS[newStatus] || [];
        const missingFields = [];

        for (const req of requiredFields) {
            const value = task[req.field];
            if (!value || (typeof value === "string" && !value.trim())) {
                missingFields.push(req.label);
            }
        }

        // force=true allows override (admin panel / confirmed by user)
        if (missingFields.length > 0 && !force) {
            throw new HttpsError(
                "failed-precondition",
                `Missing required fields: ${missingFields.join(", ")}`
            );
        }
        if (missingFields.length > 0 && force) {
            warnings.push(`Forced with missing: ${missingFields.join(", ")}`);
        }

        // ── 6. Build update payload ──
        const now = new Date().toISOString();
        const updates = {
            status: newStatus,
            updatedAt: now,
            updatedBy: userId,
        };

        // Completion: set official completedDate
        if (newStatus === "completed") {
            updates.completedDate = now;
        }

        // Reopen from completed: trace + clear completedDate
        if (currentStatus === "completed" && newStatus === "in_progress") {
            updates.completedDate = null;
            updates.reopenedAt = now;
            updates.reopenedBy = userId;
            warnings.push("Task reopened — completion metrics affected.");
        }

        // Reactivate from cancelled
        if (currentStatus === "cancelled" && newStatus === "backlog") {
            updates.completedDate = null;
            warnings.push("Task reactivated from cancelled.");
        }

        // ── 7. Atomic write: task + audit event ──
        const batch = adminDb.batch();
        batch.update(taskRef, updates);

        const auditRef = adminDb.collection("auditEvents").doc();
        batch.set(auditRef, {
            eventType: "task_transition",
            entityType: "task",
            entityId: taskId,
            userId: userId,
            timestamp: now,
            source: "cloud_function",
            correlationId: null,
            details: {
                previousStatus: currentStatus,
                newStatus: newStatus,
                taskTitle: task.title || "",
                projectId: task.projectId || null,
                forced: !!force,
                warnings: warnings,
            },
        });

        await batch.commit();

        // ── 8. Recalculate project risk (non-blocking) ──
        if (task.projectId) {
            try {
                await recalculateProjectRisk(task.projectId);
            } catch (riskErr) {
                console.warn("[transitionTaskStatus] Risk recalc failed:", riskErr.message);
            }
        }

        console.log(`[transitionTaskStatus] ${currentStatus} → ${newStatus} | task=${taskId} | user=${userId}`);

        return {
            success: true,
            previousStatus: currentStatus,
            newStatus: newStatus,
            warnings: warnings,
        };
    }
);

/**
 * Server-side project risk recalculation (simplified).
 * Mirrors client-side calculateProjectRisk from riskService.js.
 */
async function recalculateProjectRisk(projectId) {
    const tasksSnap = await adminDb
        .collection("tasks")
        .where("projectId", "==", projectId)
        .get();

    const tasks = tasksSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const now = new Date();
    const active = tasks.filter(t => !["completed", "cancelled"].includes(t.status));
    const overdue = active.filter(t => t.dueDate && new Date(t.dueDate) < now);
    const blocked = active.filter(t => t.status === "blocked");

    let score = 0;
    const factors = [];

    if (active.length > 0) {
        const overdueRatio = overdue.length / active.length;
        if (overdueRatio > 0.3) {
            score += 30;
            factors.push({ factor: "High overdue ratio", score: 30 });
        } else if (overdueRatio > 0.1) {
            score += 15;
            factors.push({ factor: "Moderate overdue ratio", score: 15 });
        }
    }

    if (blocked.length > 2) {
        score += 20;
        factors.push({ factor: "Multiple blocked tasks", score: 20 });
    }

    const riskLevel = score >= 60 ? "high" : score >= 30 ? "medium" : "low";

    await adminDb.collection("projects").doc(projectId).update({
        riskScore: score,
        riskLevel: riskLevel,
        riskFactors: factors,
        riskUpdatedAt: now.toISOString(),
    });
}

// ============================================================
// AUTOMATION OPERATIONS & ACCOUNTABILITY — Phase 2
// ============================================================
//
// Runtime Operativo + Telegram Adapter + Control Manual
// Architecture: routineExecutor → handler → telegramProvider → telegramClient
//

const { onRequest } = require("firebase-functions/v2/https");
const telegramBotToken = defineSecret("TELEGRAM_BOT_TOKEN");

// ── Telegram Webhook ──
// Receives inbound messages from Telegram Bot API.
// Must be registered with: setWebhook(url=<this-function-url>)

exports.telegramWebhookEndpoint = onRequest(
    {
        secrets: [telegramBotToken, geminiApiKey],
        cors: false,
        maxInstances: 10,
    },
    async (req, res) => {
        if (req.method !== "POST") {
            res.status(405).send("Method Not Allowed");
            return;
        }

        try {
            const { handleWebhook } = require("./telegram/telegramWebhook");
            const token = telegramBotToken.value();
            // Pass apiKey through body for AI operations
            const body = { ...req.body, _apiKey: geminiApiKey.value() };
            const result = await handleWebhook(adminDb, token, body);

            if (result.processed) {
                res.status(200).json({ ok: true });
            } else {
                console.warn("[webhook] Not processed:", result.error);
                res.status(200).json({ ok: true, skipped: result.error });
            }
        } catch (err) {
            console.error("[webhook] Critical error:", err);
            res.status(200).json({ ok: true, error: "internal" });
        }
    }
);

// ── Unified Dynamic Scheduler ──
// Runs every 15 minutes and checks which routines should execute
// based on their scheduleConfig stored in Firestore (user-configurable).
// This replaces individual hardcoded scheduled functions.

exports.unifiedRoutineScheduler = onSchedule(
    {
        schedule: "*/15 * * * *",
        timeZone: "America/Mexico_City",
        timeoutSeconds: 180,
        secrets: [telegramBotToken, geminiApiKey],
    },
    async () => {
        console.log("[scheduler] Unified scheduler tick...");
        try {
            const { executeRoutine } = require("./automation/routineExecutor");
            const routinePaths = require("./automation/firestorePaths");
            const token = telegramBotToken.value();

            // Load all routines from Firestore
            const routinesSnap = await adminDb
                .collection(routinePaths.AUTOMATION_ROUTINES)
                .get();

            const now = new Date();
            const tz = "America/Mexico_City";
            const nowInTz = new Date(now.toLocaleString("en-US", { timeZone: tz }));
            const currentHour = nowInTz.getHours();
            const currentMinute = nowInTz.getMinutes();
            const currentDay = nowInTz.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat

            console.log(`[scheduler] Current time: ${currentHour}:${String(currentMinute).padStart(2, '0')} day=${currentDay}`);

            for (const doc of routinesSnap.docs) {
                const routine = doc.data();
                const key = routine.key || doc.id;

                // Skip non-daily routines (event_driven, manual)
                if (routine.scheduleType !== "daily") continue;
                if (!routine.enabled) continue;
                if (!routine.scheduleConfig?.cron) continue;

                // Parse cron: "minute hour * * days"
                const cronParts = routine.scheduleConfig.cron.split(" ");
                const cronMinute = parseInt(cronParts[0]);
                const cronHour = parseInt(cronParts[1]);
                const cronDays = cronParts[4] || "1-5";

                // Check if current day matches
                const activeDays = new Set();
                cronDays.split(",").forEach(segment => {
                    if (segment.includes("-")) {
                        const [start, end] = segment.split("-").map(Number);
                        for (let i = start; i <= end; i++) activeDays.add(i);
                    } else {
                        activeDays.add(parseInt(segment));
                    }
                });

                if (!activeDays.has(currentDay)) continue;

                // Check if current time is within the 15-min window
                // (scheduler runs every 15 min, so match if we're in the right window)
                const cronTotalMinutes = cronHour * 60 + cronMinute;
                const currentTotalMinutes = currentHour * 60 + currentMinute;
                const diff = currentTotalMinutes - cronTotalMinutes;

                // Execute if we're within [0, 14] minutes after the scheduled time
                if (diff < 0 || diff >= 15) continue;

                console.log(`[scheduler] Routine "${key}" matches schedule (${cronHour}:${String(cronMinute).padStart(2, '0')}). Executing...`);

                try {
                    const options = {};
                    // Pass API key for routines that need AI (morning digest)
                    if (key === "morning_digest_all") {
                        options.apiKey = geminiApiKey.value();
                    }
                    const result = await executeRoutine(adminDb, token, key, "scheduled", options);
                    console.log(`[scheduler] ${key} result:`, JSON.stringify(result));
                } catch (routineErr) {
                    console.error(`[scheduler] ${key} failed:`, routineErr);
                }
            }

            console.log("[scheduler] Tick complete.");
        } catch (err) {
            console.error("[scheduler] Fatal error:", err);
        }
    }
);

// ── Manual: Execute Routine (Admin-only callable) ──

exports.executeRoutineManually = onCall(
    {
        secrets: [telegramBotToken],
        timeoutSeconds: 120,
    },
    async (request) => {
        if (!request.auth) {
            throw new HttpsError("unauthenticated", "User must be authenticated.");
        }

        // Admin check
        const roleDoc = await adminDb.collection("users_roles").doc(request.auth.uid).get();
        if (!roleDoc.exists || roleDoc.data().role !== "admin") {
            throw new HttpsError("permission-denied", "Admin access required.");
        }

        const { routineKey } = request.data;
        if (!routineKey) {
            throw new HttpsError("invalid-argument", "routineKey is required.");
        }

        try {
            const { executeRoutine } = require("./automation/routineExecutor");
            const token = telegramBotToken.value();
            const result = await executeRoutine(adminDb, token, routineKey, "manual", { forceDryRun: false });
            return result;
        } catch (err) {
            throw new HttpsError("internal", `Routine execution failed: ${err.message}`);
        }
    }
);

// ── Manual: Send Test Message (Admin-only callable) ──

exports.sendTestMessage = onCall(
    {
        secrets: [telegramBotToken],
        timeoutSeconds: 30,
    },
    async (request) => {
        if (!request.auth) {
            throw new HttpsError("unauthenticated", "User must be authenticated.");
        }

        // Admin check
        const roleDoc = await adminDb.collection("users_roles").doc(request.auth.uid).get();
        if (!roleDoc.exists || roleDoc.data().role !== "admin") {
            throw new HttpsError("permission-denied", "Admin access required.");
        }

        const { userId, message } = request.data;
        if (!userId) {
            throw new HttpsError("invalid-argument", "userId is required.");
        }

        try {
            const { executeRoutine } = require("./automation/routineExecutor");
            const token = telegramBotToken.value();
            const result = await executeRoutine(adminDb, token, "manual_test_message", "manual", {
                targetUserId: userId,
                message,
                forceDryRun: false,
            });
            return result;
        } catch (err) {
            throw new HttpsError("internal", `Test message failed: ${err.message}`);
        }
    }
);

// ============================================================
// PHASE 3 — AI INTELLIGENCE LAYER
// ============================================================

// ── AI: Test Text Extraction (Admin-only) ──

exports.testAIExtraction = onCall(
    {
        secrets: [geminiApiKey],
        timeoutSeconds: 30,
    },
    async (request) => {
        if (!request.auth) {
            throw new HttpsError("unauthenticated", "User must be authenticated.");
        }
        const roleDoc = await adminDb.collection("users_roles").doc(request.auth.uid).get();
        if (!roleDoc.exists || roleDoc.data().role !== "admin") {
            throw new HttpsError("permission-denied", "Admin access required.");
        }

        const { text } = request.data;
        if (!text) throw new HttpsError("invalid-argument", "text is required.");

        const { extractFromText } = require("./ai/aiExtractionService");
        const result = await extractFromText(adminDb, geminiApiKey.value(), text);
        return result;
    }
);

// ── AI: Test Briefing Generation (Admin-only) ──

exports.testAIBriefing = onCall(
    {
        secrets: [geminiApiKey],
        timeoutSeconds: 30,
    },
    async (request) => {
        if (!request.auth) {
            throw new HttpsError("unauthenticated", "User must be authenticated.");
        }
        const roleDoc = await adminDb.collection("users_roles").doc(request.auth.uid).get();
        if (!roleDoc.exists || roleDoc.data().role !== "admin") {
            throw new HttpsError("permission-denied", "Admin access required.");
        }

        const { role, userName } = request.data;
        if (!role) throw new HttpsError("invalid-argument", "role is required.");

        const { generateBriefing } = require("./ai/aiBriefingService");
        const result = await generateBriefing(
            adminDb, geminiApiKey.value(), role,
            { userId: request.auth.uid, userName: userName || "Test User" }
        );
        return result;
    }
);

// ── AI: Reprocess Report with AI (Admin-only) ──

exports.reprocesarReporteConIA = onCall(
    {
        secrets: [geminiApiKey],
        timeoutSeconds: 30,
    },
    async (request) => {
        if (!request.auth) {
            throw new HttpsError("unauthenticated", "User must be authenticated.");
        }
        const roleDoc = await adminDb.collection("users_roles").doc(request.auth.uid).get();
        if (!roleDoc.exists || roleDoc.data().role !== "admin") {
            throw new HttpsError("permission-denied", "Admin access required.");
        }

        const { reportId } = request.data;
        if (!reportId) throw new HttpsError("invalid-argument", "reportId is required.");

        const reportDoc = await adminDb.collection("telegramReports").doc(reportId).get();
        if (!reportDoc.exists) throw new HttpsError("not-found", "Report not found.");

        const report = reportDoc.data();
        const rawText = report.rawText;
        if (!rawText) throw new HttpsError("failed-precondition", "Report has no rawText.");

        const { extractFromText } = require("./ai/aiExtractionService");
        const result = await extractFromText(adminDb, geminiApiKey.value(), rawText, {
            userId: report.userId,
        });

        await adminDb.collection("telegramReports").doc(reportId).update({
            aiReprocessed: true,
            aiReprocessedAt: new Date().toISOString(),
            aiParsedData: result.extracted,
            aiConfidence: result.extracted.confidenceScore,
            aiSource: result.source,
        });

        return { reportId, ...result };
    }
);

// ── Admin: Link Telegram User ──

exports.linkTelegramUser = onCall(
    { timeoutSeconds: 15 },
    async (request) => {
        if (!request.auth) {
            throw new HttpsError("unauthenticated", "User must be authenticated.");
        }
        const roleDoc = await adminDb.collection("users_roles").doc(request.auth.uid).get();
        if (!roleDoc.exists || roleDoc.data().role !== "admin") {
            throw new HttpsError("permission-denied", "Admin access required.");
        }

        const { userId, chatId } = request.data;
        if (!userId || !chatId) {
            throw new HttpsError("invalid-argument", "userId and chatId are required.");
        }

        const chatIdStr = String(chatId);
        const now = new Date().toISOString();

        // 1. Find or create session for this chatId
        const sessSnap = await adminDb.collection("telegramSessions")
            .where("chatId", "==", chatIdStr)
            .limit(1)
            .get();

        if (!sessSnap.empty) {
            // Update existing session
            await sessSnap.docs[0].ref.update({
                userId,
                updatedAt: now,
            });
        } else {
            // Create new session
            await adminDb.collection("telegramSessions").add({
                chatId: chatIdStr,
                userId,
                currentState: "idle",
                isActive: true,
                metadata: {},
                createdAt: now,
                updatedAt: now,
            });
        }

        // 2. Update user doc with chatId
        const userRef = adminDb.collection("users").doc(userId);
        const userSnap = await userRef.get();
        if (userSnap.exists) {
            await userRef.update({
                telegramChatId: chatIdStr,
                isAutomationParticipant: true,
                updatedAt: now,
            });
        }

        // 3. List all users for reference
        const allUsers = await adminDb.collection("users").limit(20).get();
        const userList = allUsers.docs.map(d => ({
            id: d.id,
            name: d.data().name,
            email: d.data().email,
            telegramChatId: d.data().telegramChatId || null,
        }));

        return { linked: true, userId, chatId: chatIdStr, allUsers: userList };
    }
);

// ── Team Management: Get Team Members (Admin-only) ──

const teamMgmt = require("./handlers/teamManagementHandler");

exports.getTeamMembers = onCall(
    { timeoutSeconds: 15 },
    async (request) => {
        if (!request.auth) {
            throw new HttpsError("unauthenticated", "User must be authenticated.");
        }
        const roleDoc = await adminDb.collection("users_roles").doc(request.auth.uid).get();
        if (!roleDoc.exists || roleDoc.data().role !== "admin") {
            throw new HttpsError("permission-denied", "Admin access required.");
        }
        try {
            return await teamMgmt.getTeamMembers(adminDb);
        } catch (err) {
            throw new HttpsError("internal", `Failed to get team members: ${err.message}`);
        }
    }
);

// ── Team Management: Generate Telegram Link Code (Admin-only) ──

exports.generateTelegramLinkCode = onCall(
    { timeoutSeconds: 15 },
    async (request) => {
        if (!request.auth) {
            throw new HttpsError("unauthenticated", "User must be authenticated.");
        }
        const roleDoc = await adminDb.collection("users_roles").doc(request.auth.uid).get();
        if (!roleDoc.exists || roleDoc.data().role !== "admin") {
            throw new HttpsError("permission-denied", "Admin access required.");
        }

        const { userId } = request.data;
        if (!userId) {
            throw new HttpsError("invalid-argument", "userId is required.");
        }
        try {
            return await teamMgmt.generateLinkCode(adminDb, userId);
        } catch (err) {
            throw new HttpsError("internal", `Failed to generate link code: ${err.message}`);
        }
    }
);

// ── Team Management: Unlink Telegram (Admin-only) ──

exports.unlinkTelegramMember = onCall(
    { timeoutSeconds: 15 },
    async (request) => {
        if (!request.auth) {
            throw new HttpsError("unauthenticated", "User must be authenticated.");
        }
        const roleDoc = await adminDb.collection("users_roles").doc(request.auth.uid).get();
        if (!roleDoc.exists || roleDoc.data().role !== "admin") {
            throw new HttpsError("permission-denied", "Admin access required.");
        }

        const { userId } = request.data;
        if (!userId) {
            throw new HttpsError("invalid-argument", "userId is required.");
        }
        try {
            return await teamMgmt.unlinkTelegramUser(adminDb, userId);
        } catch (err) {
            throw new HttpsError("internal", `Failed to unlink: ${err.message}`);
        }
    }
);

// ── Team Management: Update Team Member (Admin-only) ──

exports.updateTeamMember = onCall(
    { timeoutSeconds: 15 },
    async (request) => {
        if (!request.auth) {
            throw new HttpsError("unauthenticated", "User must be authenticated.");
        }
        const roleDoc = await adminDb.collection("users_roles").doc(request.auth.uid).get();
        if (!roleDoc.exists || roleDoc.data().role !== "admin") {
            throw new HttpsError("permission-denied", "Admin access required.");
        }

        const { userId, fields } = request.data;
        if (!userId || !fields) {
            throw new HttpsError("invalid-argument", "userId and fields are required.");
        }
        try {
            return await teamMgmt.updateTeamMember(adminDb, userId, fields);
        } catch (err) {
            throw new HttpsError("internal", `Failed to update member: ${err.message}`);
        }
    }
);

// ============================================================
// PHASE 4: ANALYTICS ENGINE
// ============================================================

const { runAnalyticsRefresh, getAnalyticsDashboardData } = require("./handlers/analyticsRefreshHandler");

// ── Scheduled: Daily Analytics Refresh (6:30 AM CST) ──
exports.scheduledAnalyticsRefresh = onSchedule(
    {
        schedule: "30 6 * * *",
        timeZone: "America/Mexico_City",
        timeoutSeconds: 120,
    },
    async () => {
        console.log("[scheduledAnalyticsRefresh] Starting daily analytics refresh...");
        try {
            const result = await runAnalyticsRefresh(adminDb, { periodType: "daily" });
            console.log("[scheduledAnalyticsRefresh] Complete:", JSON.stringify({
                riskFlags: result.riskFlagsGenerated,
                recommendations: result.recommendationsGenerated,
                latencyMs: result.latencyMs,
            }));
        } catch (err) {
            console.error("[scheduledAnalyticsRefresh] Failed:", err);
        }
    }
);

// ── Admin Callable: Manual Analytics Refresh ──
exports.refreshAnalyticsManual = onCall(
    { timeoutSeconds: 120 },
    async (request) => {
        if (!request.auth) {
            throw new HttpsError("unauthenticated", "User must be authenticated.");
        }
        const roleDoc = await adminDb.collection("users_roles").doc(request.auth.uid).get();
        if (!roleDoc.exists || roleDoc.data().role !== "admin") {
            throw new HttpsError("permission-denied", "Admin access required.");
        }

        const { periodType = "daily", startDate, endDate } = request.data || {};
        console.log(`[refreshAnalyticsManual] Admin ${request.auth.uid} requested ${periodType} refresh`);

        const result = await runAnalyticsRefresh(adminDb, { periodType, startDate, endDate });
        return result;
    }
);

// ── Callable: Get Analytics Dashboard Data ──
exports.getAnalyticsDashboard = onCall(
    { timeoutSeconds: 30 },
    async (request) => {
        if (!request.auth) {
            throw new HttpsError("unauthenticated", "User must be authenticated.");
        }

        const { periodType = "daily" } = request.data || {};
        const data = await getAnalyticsDashboardData(adminDb, periodType);
        return data;
    }
);

// ============================================================
// PHASE 5: OPTIMIZATION ENGINE + DECISION SUPPORT
// ============================================================

const {
    runOptimizationScan,
    getOptimizationDashboardData,
    handleSimulation,
} = require("./handlers/optimizationHandler");

// ── Callable: Run Optimization Scan (Admin) ──
exports.runOptimizationScan = onCall(
    { timeoutSeconds: 120 },
    async (request) => {
        if (!request.auth) {
            throw new HttpsError("unauthenticated", "User must be authenticated.");
        }
        const roleDoc = await adminDb.collection("users_roles").doc(request.auth.uid).get();
        if (!roleDoc.exists || roleDoc.data().role !== "admin") {
            throw new HttpsError("permission-denied", "Admin access required.");
        }

        const { periodType = "daily" } = request.data || {};
        console.log(`[runOptimizationScan] Admin ${request.auth.uid} requested scan`);

        const result = await runOptimizationScan(adminDb, { periodType });
        return result;
    }
);

// ── Callable: Simulate Change (Admin) ──
exports.simulateChange = onCall(
    { timeoutSeconds: 30 },
    async (request) => {
        if (!request.auth) {
            throw new HttpsError("unauthenticated", "User must be authenticated.");
        }
        const roleDoc = await adminDb.collection("users_roles").doc(request.auth.uid).get();
        if (!roleDoc.exists || roleDoc.data().role !== "admin") {
            throw new HttpsError("permission-denied", "Admin access required.");
        }

        const { type, params } = request.data || {};
        if (!type) {
            throw new HttpsError("invalid-argument", "Simulation type is required.");
        }

        const result = await handleSimulation(adminDb, { type, params }, request.auth.uid);
        return result;
    }
);

// ── Callable: Get Optimization Dashboard Data ──
exports.getOptimizationDashboard = onCall(
    { timeoutSeconds: 30 },
    async (request) => {
        if (!request.auth) {
            throw new HttpsError("unauthenticated", "User must be authenticated.");
        }

        const data = await getOptimizationDashboardData(adminDb);
        return data;
    }
);

// ============================================================
// FIRESTORE TRIGGER: Notify on Delay/Blocker Created
// ============================================================

exports.onDelayCreated = onDocumentCreated(
    {
        document: "delays/{delayId}",
        secrets: [telegramBotToken],
    },
    async (event) => {
        const snap = event.data;
        if (!snap) return;

        const delay = snap.data();
        const delayId = event.params.delayId;

        console.log(`[onDelayCreated] New delay: ${delayId}`, JSON.stringify(delay));

        const token = telegramBotToken.value();
        if (!token) {
            console.warn("[onDelayCreated] No Telegram bot token configured, skipping notification.");
            return;
        }

        try {
            const { sendToUser } = require("./telegram/telegramProvider");

            // Get reporter name
            let reporterName = "Alguien";
            if (delay.createdBy) {
                const userDoc = await adminDb.collection("users").doc(delay.createdBy).get();
                if (userDoc.exists) {
                    const u = userDoc.data();
                    reporterName = u.name || u.displayName || u.email || reporterName;
                }
            }

            // Get task name
            let taskName = delay.taskId || "";
            if (delay.taskId) {
                const taskDoc = await adminDb.collection("tasks").doc(delay.taskId).get();
                if (taskDoc.exists) {
                    taskName = taskDoc.data().title || taskName;
                }
            }

            // Get project name
            let projectName = delay.projectId || "";
            if (delay.projectId) {
                const projDoc = await adminDb.collection("projects").doc(delay.projectId).get();
                if (projDoc.exists) {
                    projectName = projDoc.data().name || projectName;
                }
            }

            // Build notification message
            const message =
                `🚨 *Nuevo Bloqueo Reportado*\n\n` +
                `📋 *Causa:* ${delay.causeName || "Sin especificar"}\n` +
                (taskName ? `🎯 *Tarea:* ${taskName}\n` : "") +
                (projectName ? `📁 *Proyecto:* ${projectName}\n` : "") +
                (delay.notes ? `📝 *Notas:* ${delay.notes}\n` : "") +
                `👤 *Reportado por:* ${reporterName}\n` +
                `🕒 *Fecha:* ${new Date().toLocaleString("es-MX", { timeZone: "America/Mexico_City" })}`;

            // Find all users with linked Telegram
            const sessionsSnap = await adminDb.collection("telegramSessions").get();
            let sent = 0;

            for (const sessDoc of sessionsSnap.docs) {
                const sess = sessDoc.data();
                if (!sess.chatId && !sess.telegramChatId) continue;
                const chatId = sess.chatId || sess.telegramChatId;
                const uid = sess.uid || sess.userId;
                if (!uid) continue;

                // Check if user is a manager/team lead/admin
                const roleDoc = await adminDb.collection("users_roles").doc(uid).get();
                const userRole = roleDoc.exists ? roleDoc.data() : {};
                const isManagerOrLead = userRole.role === "admin" ||
                    userRole.teamRole === "manager" ||
                    userRole.teamRole === "team_lead";

                if (isManagerOrLead) {
                    try {
                        await sendToUser(adminDb, token, uid, chatId, message, {
                            routineKey: "blocker_notification",
                        });
                        sent++;
                        console.log(`[onDelayCreated] Notified ${uid} (chatId: ${chatId})`);
                    } catch (err) {
                        console.error(`[onDelayCreated] Failed to notify ${uid}:`, err.message);
                    }
                }
            }

            console.log(`[onDelayCreated] Blocker notification sent to ${sent} users.`);
        } catch (err) {
            console.error("[onDelayCreated] Error sending blocker notification:", err);
        }
    }
);
