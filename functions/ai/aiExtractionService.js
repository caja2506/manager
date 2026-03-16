/**
 * AI Extraction Service — Backend (CJS)
 * ========================================
 * Structured data extraction from text and audio transcripts.
 * Uses aiClient + aiPromptRegistry + aiAuditLogger.
 * Falls back to deterministic parser on failure.
 */

const { callGemini, parseJsonResponse } = require("./aiClient");
const { REPORT_EXTRACTION } = require("./aiPromptRegistry");
const { logAIExecution, logAIFailure } = require("./aiAuditLogger");
const { evaluateAction } = require("./aiConfidenceEvaluator");
const { fallbackExtraction } = require("./aiFallbacks");

/**
 * Default empty extraction result.
 */
function emptyExtraction() {
    return {
        progressPercent: null,
        hoursWorked: null,
        blockerPresent: false,
        blockerSummary: null,
        taskReference: null,
        normalizedSummary: "",
        confidenceScore: 0,
        needsConfirmation: true,
        missingFields: ["progressPercent", "hoursWorked"],
    };
}

/**
 * Extract structured report data from text using Gemini.
 *
 * @param {FirebaseFirestore.Firestore} adminDb
 * @param {string} apiKey
 * @param {string} rawText
 * @param {Object} [context] - { userId, runId, routineKey }
 * @returns {Promise<{ extracted: Object, action: string, source: 'ai'|'fallback', latencyMs: number }>}
 */
async function extractFromText(adminDb, apiKey, rawText, context = {}) {
    const inputSummary = rawText.substring(0, 300);

    try {
        // Call Gemini
        const result = await callGemini(apiKey, {
            contents: [{ parts: [{ text: REPORT_EXTRACTION.buildUserPrompt(rawText) }] }],
            systemInstruction: REPORT_EXTRACTION.systemInstruction,
            temperature: 0.2,
            maxOutputTokens: 1024,
        });

        if (!result.ok) {
            // AI failed → fallback
            await logAIFailure(adminDb, "report_extraction", "text", result.error, {
                userId: context.userId,
                latencyMs: result.latencyMs,
                inputSummary,
            });

            const fb = fallbackExtraction(rawText);
            return {
                extracted: fb,
                action: "fallback",
                source: "fallback",
                latencyMs: result.latencyMs,
            };
        }

        // Parse JSON response
        const { parsed, parseError } = parseJsonResponse(result.text);

        if (!parsed || parseError) {
            await logAIFailure(adminDb, "report_extraction", "text",
                `JSON parse error: ${parseError}`, {
                userId: context.userId,
                latencyMs: result.latencyMs,
                inputSummary,
                outputSummary: result.text?.substring(0, 300),
            });

            const fb = fallbackExtraction(rawText);
            return {
                extracted: fb,
                action: "fallback",
                source: "fallback",
                latencyMs: result.latencyMs,
            };
        }

        // Normalize extracted data
        const extracted = {
            progressPercent: typeof parsed.progressPercent === "number" ? parsed.progressPercent : null,
            hoursWorked: typeof parsed.hoursWorked === "number" ? parsed.hoursWorked : null,
            blockerPresent: !!parsed.blockerPresent,
            blockerSummary: parsed.blockerSummary || null,
            taskReference: parsed.taskReference || null,
            normalizedSummary: parsed.normalizedSummary || "",
            confidenceScore: typeof parsed.confidenceScore === "number" ? parsed.confidenceScore : 0.5,
            needsConfirmation: parsed.needsConfirmation ?? false,
            missingFields: Array.isArray(parsed.missingFields) ? parsed.missingFields : [],
        };

        // Determine action
        const action = evaluateAction(extracted.confidenceScore);

        // Log success
        await logAIExecution(adminDb, {
            featureType: "report_extraction",
            sourceType: "text",
            userId: context.userId,
            runId: context.runId,
            routineKey: context.routineKey,
            inputSummary,
            outputSummary: extracted.normalizedSummary.substring(0, 300),
            structuredOutput: extracted,
            confidenceScore: extracted.confidenceScore,
            confidenceAction: action,
            status: "success",
            latencyMs: result.latencyMs,
        });

        return {
            extracted,
            action,
            source: "ai",
            latencyMs: result.latencyMs,
        };
    } catch (err) {
        console.error("[aiExtractionService] Unexpected error:", err);
        await logAIFailure(adminDb, "report_extraction", "text", err, {
            userId: context.userId,
            inputSummary,
        });

        const fb = fallbackExtraction(rawText);
        return {
            extracted: fb,
            action: "fallback",
            source: "fallback",
            latencyMs: 0,
        };
    }
}

module.exports = { extractFromText, emptyExtraction };
