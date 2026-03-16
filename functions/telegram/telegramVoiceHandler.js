/**
 * Telegram Voice Handler — Backend (CJS)
 * =========================================
 * Downloads voice/audio files from Telegram, sends to Gemini
 * for transcription + extraction in a single multimodal call.
 */

const { callGeminiMultimodal, parseJsonResponse } = require("../ai/aiClient");
const { AUDIO_REPORT_EXTRACTION } = require("../ai/aiPromptRegistry");
const { logAIExecution, logAIFailure } = require("../ai/aiAuditLogger");
const { evaluateAction } = require("../ai/aiConfidenceEvaluator");
const { fallbackExtraction } = require("../ai/aiFallbacks");

const TELEGRAM_API = "https://api.telegram.org";

/**
 * Get file path from Telegram.
 */
async function getFilePath(token, fileId) {
    const cleanToken = (token || "").trim();
    const url = `${TELEGRAM_API}/bot${cleanToken}/getFile?file_id=${fileId}`;
    const res = await fetch(url);
    const data = await res.json();
    if (!data.ok) {
        throw new Error(`getFile failed: ${data.description}`);
    }
    return data.result.file_path;
}

/**
 * Download file from Telegram as Buffer.
 */
async function downloadFile(token, filePath) {
    const cleanToken = (token || "").trim();
    const url = `${TELEGRAM_API}/file/bot${cleanToken}/${filePath}`;
    const res = await fetch(url);
    if (!res.ok) {
        throw new Error(`Download failed: HTTP ${res.status}`);
    }
    const arrayBuffer = await res.arrayBuffer();
    return Buffer.from(arrayBuffer);
}

/**
 * Map Telegram MIME types to standard ones.
 */
function resolveMimeType(voice, audio) {
    if (voice) return voice.mime_type || "audio/ogg";
    if (audio) return audio.mime_type || "audio/mpeg";
    return "audio/ogg";
}

/**
 * Process a voice/audio message from Telegram.
 *
 * @param {string} token - Bot token
 * @param {string} apiKey - Gemini API key
 * @param {FirebaseFirestore.Firestore} adminDb
 * @param {Object} message - Telegram message object with .voice or .audio
 * @param {Object} [context] - { userId, chatId, runId }
 * @returns {Promise<{
 *   extracted: Object,
 *   transcript: string|null,
 *   action: 'accept'|'confirm'|'fallback',
 *   source: 'ai'|'fallback',
 *   latencyMs: number
 * }>}
 */
async function processVoiceMessage(token, apiKey, adminDb, message, context = {}) {
    const voice = message.voice;
    const audio = message.audio;
    const fileId = (voice || audio)?.file_id;

    if (!fileId) {
        return {
            extracted: fallbackExtraction(""),
            transcript: null,
            action: "fallback",
            source: "fallback",
            latencyMs: 0,
            error: "No file_id found",
        };
    }

    const mimeType = resolveMimeType(voice, audio);
    const duration = (voice || audio)?.duration || 0;
    const fileSize = (voice || audio)?.file_size || 0;

    // Safety: reject very long audio (>5 minutes)
    if (duration > 300) {
        await logAIFailure(adminDb, "audio_transcription", "audio",
            `Audio too long: ${duration}s`, { userId: context.userId });
        return {
            extracted: fallbackExtraction(""),
            transcript: null,
            action: "fallback",
            source: "fallback",
            latencyMs: 0,
            error: "Audio exceeds 5 minute limit",
        };
    }

    try {
        // 1. Download audio from Telegram
        const filePath = await getFilePath(token, fileId);
        const audioBuffer = await downloadFile(token, filePath);

        // 2. Send to Gemini for transcription + extraction
        const result = await callGeminiMultimodal(
            apiKey,
            audioBuffer,
            mimeType,
            AUDIO_REPORT_EXTRACTION.buildUserPrompt(),
            {
                systemInstruction: AUDIO_REPORT_EXTRACTION.systemInstruction,
                temperature: 0.2,
                maxOutputTokens: 1024,
                timeoutMs: 60000, // Audio processing needs more time
            }
        );

        if (!result.ok) {
            await logAIFailure(adminDb, "audio_transcription", "audio", result.error, {
                userId: context.userId,
                latencyMs: result.latencyMs,
            });
            return {
                extracted: fallbackExtraction(""),
                transcript: null,
                action: "fallback",
                source: "fallback",
                latencyMs: result.latencyMs,
                error: result.error,
            };
        }

        // 3. Parse JSON response
        const { parsed, parseError } = parseJsonResponse(result.text);

        if (!parsed || parseError) {
            await logAIFailure(adminDb, "audio_transcription", "audio",
                `JSON parse: ${parseError}`, {
                userId: context.userId,
                latencyMs: result.latencyMs,
                outputSummary: result.text?.substring(0, 300),
            });
            return {
                extracted: fallbackExtraction(""),
                transcript: result.text?.substring(0, 500) || null,
                action: "fallback",
                source: "fallback",
                latencyMs: result.latencyMs,
            };
        }

        // 4. Normalize
        const transcript = parsed.transcript || null;
        const extracted = {
            progressPercent: typeof parsed.progressPercent === "number" ? parsed.progressPercent : null,
            hoursWorked: typeof parsed.hoursWorked === "number" ? parsed.hoursWorked : null,
            blockerPresent: !!parsed.blockerPresent,
            blockerSummary: parsed.blockerSummary || null,
            taskReference: parsed.taskReference || null,
            normalizedSummary: parsed.normalizedSummary || transcript || "",
            confidenceScore: typeof parsed.confidenceScore === "number" ? parsed.confidenceScore : 0.5,
            needsConfirmation: parsed.needsConfirmation ?? true,
            missingFields: Array.isArray(parsed.missingFields) ? parsed.missingFields : [],
        };

        const action = evaluateAction(extracted.confidenceScore);

        // 5. Log success
        await logAIExecution(adminDb, {
            featureType: "audio_transcription",
            sourceType: "audio",
            userId: context.userId,
            inputSummary: `Audio: ${duration}s, ${fileSize} bytes, ${mimeType}`,
            rawInputStored: false,
            outputSummary: transcript?.substring(0, 300) || "",
            structuredOutput: extracted,
            confidenceScore: extracted.confidenceScore,
            confidenceAction: action,
            status: "success",
            latencyMs: result.latencyMs,
        });

        return {
            extracted,
            transcript,
            action,
            source: "ai",
            latencyMs: result.latencyMs,
        };
    } catch (err) {
        console.error("[telegramVoiceHandler] Error:", err);
        await logAIFailure(adminDb, "audio_transcription", "audio", err, {
            userId: context.userId,
        });
        return {
            extracted: fallbackExtraction(""),
            transcript: null,
            action: "fallback",
            source: "fallback",
            latencyMs: 0,
            error: err.message,
        };
    }
}

module.exports = { processVoiceMessage };
