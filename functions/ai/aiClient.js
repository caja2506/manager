/**
 * AI Client — Backend (CJS)
 * ===========================
 * Centralized Gemini REST API client for all AI operations.
 * Handles text generation, multimodal (audio), structured output,
 * timeout control, error handling, and latency measurement.
 *
 * Uses the same REST pattern as existing index.js Gemini calls.
 * No SDK dependency — pure fetch.
 */

const BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models";

// Default models
const MODELS = {
    TEXT: "gemini-2.5-flash",
    MULTIMODAL: "gemini-2.5-flash",
    BRIEFING: "gemini-2.5-flash",
};

/**
 * Call Gemini REST API.
 *
 * @param {string} apiKey
 * @param {Object} options
 * @param {string} [options.model] - Model name (defaults to TEXT)
 * @param {Array} options.contents - Gemini contents array
 * @param {string} [options.systemInstruction] - System-level instruction
 * @param {number} [options.maxOutputTokens=2048]
 * @param {number} [options.temperature=0.3]
 * @param {number} [options.timeoutMs=30000]
 * @returns {Promise<{ok: boolean, text?: string, latencyMs: number, error?: string, rawResponse?: Object}>}
 */
async function callGemini(apiKey, options = {}) {
    const {
        model = MODELS.TEXT,
        contents,
        systemInstruction,
        maxOutputTokens = 2048,
        temperature = 0.3,
        timeoutMs = 30000,
    } = options;

    const url = `${BASE_URL}/${model}:generateContent?key=${apiKey}`;
    const startTime = Date.now();

    const body = {
        contents,
        generationConfig: {
            maxOutputTokens,
            temperature,
        },
    };

    if (systemInstruction) {
        body.systemInstruction = {
            parts: [{ text: systemInstruction }],
        };
    }

    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), timeoutMs);

        const response = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
            signal: controller.signal,
        });

        clearTimeout(timeout);
        const latencyMs = Date.now() - startTime;
        const data = await response.json();

        if (!response.ok) {
            return {
                ok: false,
                error: data.error?.message || `HTTP ${response.status}`,
                latencyMs,
                rawResponse: data,
            };
        }

        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!text) {
            return {
                ok: false,
                error: "Empty response from Gemini",
                latencyMs,
                rawResponse: data,
            };
        }

        return { ok: true, text, latencyMs, rawResponse: data };
    } catch (err) {
        const latencyMs = Date.now() - startTime;

        if (err.name === "AbortError") {
            return { ok: false, error: `Timeout after ${timeoutMs}ms`, latencyMs };
        }

        return { ok: false, error: err.message, latencyMs };
    }
}

/**
 * Call Gemini with multimodal content (audio + text).
 *
 * @param {string} apiKey
 * @param {Buffer|string} audioData - Base64-encoded audio
 * @param {string} mimeType - e.g. "audio/ogg", "audio/mpeg"
 * @param {string} textPrompt - Text instructions alongside audio
 * @param {Object} [options] - Additional options for callGemini
 * @returns {Promise<{ok: boolean, text?: string, latencyMs: number, error?: string}>}
 */
async function callGeminiMultimodal(apiKey, audioData, mimeType, textPrompt, options = {}) {
    const base64Audio = Buffer.isBuffer(audioData)
        ? audioData.toString("base64")
        : audioData;

    const contents = [
        {
            parts: [
                {
                    inlineData: {
                        mimeType,
                        data: base64Audio,
                    },
                },
                { text: textPrompt },
            ],
        },
    ];

    return callGemini(apiKey, {
        model: options.model || MODELS.MULTIMODAL,
        contents,
        systemInstruction: options.systemInstruction,
        maxOutputTokens: options.maxOutputTokens || 2048,
        temperature: options.temperature || 0.2,
        timeoutMs: options.timeoutMs || 45000, // Audio needs more time
    });
}

/**
 * Parse a Gemini response expecting JSON.
 * Handles markdown code fences and partial JSON.
 *
 * @param {string} text - Raw Gemini output
 * @returns {{ parsed: Object|null, parseError?: string }}
 */
function parseJsonResponse(text) {
    if (!text) return { parsed: null, parseError: "Empty text" };

    // Remove markdown code fences if present
    let cleaned = text.trim();
    if (cleaned.startsWith("```json")) {
        cleaned = cleaned.replace(/^```json\s*/, "").replace(/```\s*$/, "");
    } else if (cleaned.startsWith("```")) {
        cleaned = cleaned.replace(/^```\s*/, "").replace(/```\s*$/, "");
    }

    try {
        return { parsed: JSON.parse(cleaned) };
    } catch (err) {
        // Try to extract JSON from mixed text
        const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            try {
                return { parsed: JSON.parse(jsonMatch[0]) };
            } catch (e) {
                // fall through
            }
        }
        return { parsed: null, parseError: `JSON parse failed: ${err.message}` };
    }
}

module.exports = {
    callGemini,
    callGeminiMultimodal,
    parseJsonResponse,
    MODELS,
};
