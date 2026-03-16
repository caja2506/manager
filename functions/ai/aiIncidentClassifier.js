/**
 * AI Incident Classifier — Backend (CJS)
 * =========================================
 * Uses Gemini to classify blocker reports:
 * severity, cause, whether it needs confirmation.
 * Never auto-creates incidents on low confidence.
 */

const { callGemini, parseJsonResponse } = require("./aiClient");
const { INCIDENT_CLASSIFICATION } = require("./aiPromptRegistry");
const { logAIExecution, logAIFailure } = require("./aiAuditLogger");
const { evaluateAction } = require("./aiConfidenceEvaluator");
const { fallbackIncidentClassification } = require("./aiFallbacks");

/**
 * Classify a blocker report.
 *
 * @param {FirebaseFirestore.Firestore} adminDb
 * @param {string} apiKey
 * @param {string} text - User's blocker description
 * @param {Object} [context] - { userId, runId }
 * @returns {Promise<{
 *   classification: Object,
 *   action: 'accept'|'confirm'|'fallback',
 *   source: 'ai'|'fallback'
 * }>}
 */
async function classifyIncident(adminDb, apiKey, text, context = {}) {
    try {
        const result = await callGemini(apiKey, {
            contents: [{ parts: [{ text: INCIDENT_CLASSIFICATION.buildUserPrompt(text) }] }],
            systemInstruction: INCIDENT_CLASSIFICATION.systemInstruction,
            temperature: 0.2,
            maxOutputTokens: 512,
            timeoutMs: 15000,
        });

        if (!result.ok) {
            await logAIFailure(adminDb, "incident_classification", "text", result.error, {
                userId: context.userId,
                latencyMs: result.latencyMs,
            });
            return {
                classification: fallbackIncidentClassification(text),
                action: "fallback",
                source: "fallback",
            };
        }

        const { parsed, parseError } = parseJsonResponse(result.text);

        if (!parsed || parseError) {
            await logAIFailure(adminDb, "incident_classification", "text",
                `JSON parse: ${parseError}`, {
                userId: context.userId,
                latencyMs: result.latencyMs,
            });
            return {
                classification: fallbackIncidentClassification(text),
                action: "fallback",
                source: "fallback",
            };
        }

        const classification = {
            isBlocker: !!parsed.isBlocker,
            summary: parsed.summary || text.substring(0, 200),
            suggestedCause: parsed.suggestedCause || null,
            suggestedSeverity: parsed.suggestedSeverity || "medium",
            suggestedResponsible: parsed.suggestedResponsible || null,
            confidenceScore: typeof parsed.confidenceScore === "number" ? parsed.confidenceScore : 0.5,
            needsConfirmation: parsed.needsConfirmation ?? true,
        };

        const action = evaluateAction(classification.confidenceScore);

        // Log
        await logAIExecution(adminDb, {
            featureType: "incident_classification",
            sourceType: "text",
            userId: context.userId,
            runId: context.runId,
            inputSummary: text.substring(0, 300),
            outputSummary: classification.summary,
            structuredOutput: classification,
            confidenceScore: classification.confidenceScore,
            confidenceAction: action,
            status: "success",
            latencyMs: result.latencyMs,
        });

        return { classification, action, source: "ai" };
    } catch (err) {
        console.error("[aiIncidentClassifier] Error:", err);
        await logAIFailure(adminDb, "incident_classification", "text", err, {
            userId: context.userId,
        });
        return {
            classification: fallbackIncidentClassification(text),
            action: "fallback",
            source: "fallback",
        };
    }
}

module.exports = { classifyIncident };
