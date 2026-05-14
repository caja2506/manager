/**
 * Peer Review Domain Exports — functions/exports/peerReviews.js
 * ==============================================================
 * Cloud Functions for peer review operations.
 *
 * Functions:
 *   - requestPeerReview: Request a peer review for a task
 *   - submitPeerReview: Submit review decision (approve/changes_requested)
 *   - waivePeerReview: Waive review requirement (privileged only)
 *   - getPeerReviewTemplates: Get all active templates
 *   - generatePRChecklist: AI-generated checklist per task type
 *   - saveTaskTypeChecklist: Save checklist sections to taskType doc
 */

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const {
    requestPeerReview,
    submitPeerReview,
    waivePeerReview,
} = require("../handlers/peerReviewHandler");
const paths = require("../automation/firestorePaths");

function createPeerReviewExports(adminDb, secrets = {}) {
    // ── Request Peer Review ──
    const requestPeerReviewFn = onCall(
        { timeoutSeconds: 30 },
        async (request) => {
            if (!request.auth) throw new HttpsError("unauthenticated", "User must be authenticated.");
            const userId = request.auth.uid;
            const { taskId, reviewerId } = request.data;

            try {
                const result = await requestPeerReview(adminDb, {
                    taskId,
                    reviewerId,
                    requestedBy: userId,
                });
                return result;
            } catch (err) {
                console.error("[requestPeerReview] Error:", err.message);
                throw new HttpsError("failed-precondition", err.message);
            }
        }
    );

    // ── Submit Peer Review ──
    const submitPeerReviewFn = onCall(
        { timeoutSeconds: 30 },
        async (request) => {
            if (!request.auth) throw new HttpsError("unauthenticated", "User must be authenticated.");
            const userId = request.auth.uid;
            const { reviewId, decision, checklistItems, summary } = request.data;

            try {
                const result = await submitPeerReview(adminDb, {
                    reviewId,
                    decision,
                    checklistItems,
                    summary,
                    userId,
                });
                return result;
            } catch (err) {
                console.error("[submitPeerReview] Error:", err.message);
                throw new HttpsError("failed-precondition", err.message);
            }
        }
    );

    // ── Waive Peer Review ──
    const waivePeerReviewFn = onCall(
        { timeoutSeconds: 30 },
        async (request) => {
            if (!request.auth) throw new HttpsError("unauthenticated", "User must be authenticated.");
            const userId = request.auth.uid;
            const { taskId, reason } = request.data;

            // Fetch user role from Supabase
            let userRole = "viewer";
            try {
                const { loadUser } = require("../db/coreDataReader");
                const userData = await loadUser(userId);
                if (userData) {
                    userRole = userData.teamRole || userData.rbacRole || "viewer";
                }
            } catch (err) {
                console.warn("[waivePeerReview] Could not fetch user role:", err.message);
            }

            try {
                const result = await waivePeerReview(adminDb, {
                    taskId,
                    reason,
                    userId,
                    userRole,
                });
                return result;
            } catch (err) {
                console.error("[waivePeerReview] Error:", err.message);
                throw new HttpsError("failed-precondition", err.message);
            }
        }
    );

    // ── Get Peer Review Templates ──
    const getPeerReviewTemplatesFn = onCall(
        { timeoutSeconds: 15 },
        async (request) => {
            if (!request.auth) throw new HttpsError("unauthenticated", "User must be authenticated.");

            const templatesSnap = await adminDb.collection(paths.PEER_REVIEW_TEMPLATES)
                .where("active", "==", true)
                .get();

            const templates = templatesSnap.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
            }));

            return { templates };
        }
    );

    // ── Generate PR Checklist with AI (per task type) ──
    const generatePRChecklistFn = onCall(
        { timeoutSeconds: 60, secrets: [secrets.geminiApiKey] },
        async (request) => {
            if (!request.auth) throw new HttpsError("unauthenticated", "User must be authenticated.");
            const { taskTypeName, context } = request.data;
            if (!taskTypeName) throw new HttpsError("invalid-argument", "taskTypeName is required.");

            const apiKey = secrets.geminiApiKey.value();
            const MODEL = "gemini-2.5-flash";
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`;

            const prompt = `Eres un experto en ingeniería de automatización industrial para manufactura de dispositivos médicos (ICU Medical).

Genera un checklist de peer review para tareas del tipo "${taskTypeName}" en el contexto de: ${context || "automatización de equipos de manufactura médica"}.

El checklist debe estar organizado por SECCIONES temáticas. Cada sección agrupa criterios relacionados que el revisor debe verificar.

Responde SOLO con un JSON válido sin markdown, con esta estructura exacta:
{
  "sections": [
    {
      "name": "Nombre de la Sección",
      "items": [
        { "label": "Descripción del criterio a verificar", "required": true },
        { "label": "Otro criterio", "required": false }
      ]
    }
  ]
}

Reglas:
- Genera entre 3-5 secciones relevantes al tipo "${taskTypeName}"
- Cada sección debe tener 3-6 items
- Los items "required: true" son obligatorios para aprobar
- Los items "required: false" son recomendados pero opcionales
- Escribe en español
- Sé específico al tipo de tarea y al contexto de automatización industrial médica
- Incluye aspectos de seguridad, calidad, documentación y cumplimiento regulatorio donde aplique`;

            const res = await fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: { temperature: 0.7, responseMimeType: "application/json" },
                }),
            });

            if (!res.ok) {
                const errText = await res.text();
                throw new HttpsError("internal", `Gemini error: ${errText}`);
            }

            const data = await res.json();
            const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
            if (!text) throw new HttpsError("internal", "Empty AI response");

            try {
                const parsed = JSON.parse(text);
                return { sections: parsed.sections || [] };
            } catch (e) {
                throw new HttpsError("internal", "Failed to parse AI response: " + text.substring(0, 200));
            }
        }
    );

    // ── Save Task Type Checklist (writes to taskTypes collection directly) ──
    const saveTaskTypeChecklistFn = onCall(
        { timeoutSeconds: 15 },
        async (request) => {
            if (!request.auth) throw new HttpsError("unauthenticated", "User must be authenticated.");
            const { taskTypeId, sections } = request.data;
            if (!taskTypeId) throw new HttpsError("invalid-argument", "taskTypeId is required.");

            const now = new Date().toISOString();
            await adminDb.collection("taskTypes").doc(taskTypeId).update({
                peerReviewSections: sections || [],
                updatedAt: now,
                updatedBy: request.auth.uid,
            });

            return { success: true, taskTypeId };
        }
    );

    return {
        requestPeerReview: requestPeerReviewFn,
        submitPeerReview: submitPeerReviewFn,
        waivePeerReview: waivePeerReviewFn,
        getPeerReviewTemplates: getPeerReviewTemplatesFn,
        generatePRChecklist: generatePRChecklistFn,
        saveTaskTypeChecklist: saveTaskTypeChecklistFn,
    };
}

module.exports = { createPeerReviewExports };
