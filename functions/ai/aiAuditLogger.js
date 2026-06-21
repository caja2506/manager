/**
 * AI Audit Logger — Backend (CJS)
 * ==================================
 * Logs every AI execution to Supabase for traceability.
 * Table: ai_executions
 */

const { getSupabase } = require("../db/supabaseAdmin");

/**
 * Log an AI execution.
 *
 * @param {any} _adminDb - Deprecated, kept for compatibility
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
 * @param {number} [entry.inputTokens]
 * @param {number} [entry.outputTokens]
 * @returns {Promise<string>} - Document ID (UUID)
 */
async function logAIExecution(_adminDb, entry) {
    const now = new Date().toISOString();
    const sb = getSupabase();

    const doc = {
        feature_type: entry.featureType,
        source_type: entry.sourceType || "text",
        status: entry.status || "success",
        latency_ms: entry.latencyMs || 0,
        confidence_score: entry.confidenceScore ?? 1.0,
        confidence_action: entry.confidenceAction || null,
        input_tokens: entry.inputTokens || 0,
        output_tokens: entry.outputTokens || 0,
        created_by: entry.userId || null,
        created_at: now,
        details: {
            provider: entry.provider || "gemini",
            model: entry.model || null,
            routineKey: entry.routineKey || null,
            runId: entry.runId || null,
            inputSummary: (entry.inputSummary || "").substring(0, 500),
            rawInputStored: entry.rawInputStored || false,
            outputSummary: (entry.outputSummary || "").substring(0, 500),
            structuredOutput: entry.structuredOutput || null,
            errorSummary: entry.errorSummary || null,
        }
    };

    const { data, error } = await sb.from("ai_executions")
        .insert(doc)
        .select("id")
        .single();

    if (error) {
        console.error("[aiAuditLogger] logAIExecution error:", error.message);
        throw error;
    }

    return data.id;
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

