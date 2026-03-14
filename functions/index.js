const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");
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
                        maxOutputTokens: 2048,
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

                if (task.status === "blocked" && !task.blockReason) {
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

            // Calculate basic compliance scores
            const totalActive = tasks.filter(t => !["completed", "cancelled"].includes(t.status)).length;
            const withAssignee = tasks.filter(t => t.assignedTo && !["completed", "cancelled"].includes(t.status)).length;
            const withEstimate = tasks.filter(t => t.estimatedHours > 0 && !["completed", "cancelled"].includes(t.status)).length;

            const methodologyScore = totalActive > 0 ? Math.round((withAssignee / totalActive) * 100) : 100;
            const planningScore = totalActive > 0 ? Math.round((withEstimate / totalActive) * 100) : 100;

            const scores = {
                methodologyCompliance: methodologyScore,
                planningReliability: planningScore,
                estimationAccuracy: 75, // Placeholder for server-side
                dataDiscipline: 70,     // Placeholder for server-side
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

            // Audit event
            const eventRef = adminDb.collection("auditEvents").doc();
            batch.set(eventRef, {
                eventType: "audit_run",
                userId: "system",
                timestamp: now.toISOString(),
                details: {
                    runId,
                    source: "scheduled",
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
