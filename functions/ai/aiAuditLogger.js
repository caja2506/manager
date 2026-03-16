/**
 * AI Audit Logger — Backend (CJS)
 * ==================================
 * Logs every AI execution to Firestore for traceability.
 * Collection: aiExecutions
 */

const paths = require("../automation/firestorePaths");

/**
 * Log an AI execution.
 *
 * @param {FirebaseFirestore.Firestore} adminDb
 * @param {Object} entry
 * @param {string} entry.featureType - 'report_extraction'|'briefing_generation'|'incident_classification'|'audio_transcription'
 * @param {string} [entry.provider='gemini']
 * @param {string} [entry.model]
 * @param {string} [entry.routineKey]
 * @param {string} [entry.runId]
 * @param {string} [entry.userId]
 * @param {string} entry.sourceType - 'text'|'audio'|'system_context'
 * @param {string} entry.inputSummary - Truncated/sanitized input
 * @param {boolean} [entry.rawInputStored=false]
 * @param {string} [entry.outputSummary]
 * @param {Object} [entry.structuredOutput]
 * @param {number} [entry.confidenceScore]
 * @param {string} entry.status - 'success'|'failure'|'fallback'
 * @param {string} [entry.errorSummary]
 * @param {number} [entry.latencyMs]
 * @param {string} [entry.confidenceAction] - 'accept'|'confirm'|'fallback'
 * @returns {Promise<string>} - Document ID
 */
async function logAIExecution(adminDb, entry) {
    const now = new Date().toISOString();

    const doc = {
        featureType: entry.featureType,
        provider: entry.provider || "gemini",
        model: entry.model || null,
        routineKey: entry.routineKey || null,
        runId: entry.runId || null,
        userId: entry.userId || null,
        sourceType: entry.sourceType || "text",
        inputSummary: (entry.inputSummary || "").substring(0, 500),
        rawInputStored: entry.rawInputStored || false,
        outputSummary: (entry.outputSummary || "").substring(0, 500),
        structuredOutput: entry.structuredOutput || null,
        confidenceScore: entry.confidenceScore ?? null,
        confidenceAction: entry.confidenceAction || null,
        status: entry.status || "success",
        errorSummary: entry.errorSummary || null,
        latencyMs: entry.latencyMs || null,
        createdAt: now,
    };

    const ref = await adminDb.collection(paths.AI_EXECUTIONS).add(doc);
    return ref.id;
}

/**
 * Log a failed AI execution (convenience shorthand).
 */
async function logAIFailure(adminDb, featureType, sourceType, error, extras = {}) {
    return logAIExecution(adminDb, {
        featureType,
        sourceType,
        status: "failure",
        errorSummary: typeof error === "string" ? error : error?.message || "Unknown error",
        ...extras,
    });
}

module.exports = { logAIExecution, logAIFailure };
