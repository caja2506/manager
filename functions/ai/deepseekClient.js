/**
 * DeepSeek Client — Backend (CJS)
 * ====================================
 * Client for DeepSeek completions API (api.deepseek.com).
 * OpenAI-compatible chat completions format.
 *
 * Fallback: If DeepSeek fails → Gemini.
 */

const DEEPSEEK_BASE_URL = "https://api.deepseek.com/v1";
const DEEPSEEK_MODEL = "deepseek-chat";
const DEEPSEEK_API_KEY_FALLBACK = "sk-e218f8a6ae9348e08ab5f89daa98414f";

/**
 * Call DeepSeek chat completions API.
 *
 * @param {string} apiKey - DeepSeek API key
 * @param {Object} options
 * @param {string} [options.model] - Model identifier
 * @param {Array<{role: string, content: string}>} options.messages - Chat messages
 * @param {number} [options.maxTokens=1024]
 * @param {number} [options.temperature=0.3]
 * @param {number} [options.timeoutMs=45000]
 * @returns {Promise<{ok: boolean, text?: string, latencyMs: number, model: string, error?: string, usage?: Object}>}
 */
async function callDeepSeek(apiKey, options = {}) {
    const key = apiKey || DEEPSEEK_API_KEY_FALLBACK;
    const {
        model = DEEPSEEK_MODEL,
        messages,
        maxTokens = 1024,
        temperature = 0.3,
        timeoutMs = 45000,
    } = options;

    if (!key || !messages?.length) {
        return { ok: false, error: "Missing apiKey or messages", latencyMs: 0, model };
    }

    const url = `${DEEPSEEK_BASE_URL}/chat/completions`;
    const startTime = Date.now();

    const body = {
        model,
        messages,
        temperature,
        stream: false,
    };

    // DeepSeek API doesn't strictly require max_tokens, but we can set it if provided
    if (maxTokens) {
        body.max_tokens = maxTokens;
    }

    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), timeoutMs);

        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${key}`,
            },
            body: JSON.stringify(body),
            signal: controller.signal,
        });

        clearTimeout(timeout);
        const latencyMs = Date.now() - startTime;

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            const errorMsg = errorData.error?.message || errorData.detail || `HTTP ${response.status}`;

            if (response.status === 429) {
                return { ok: false, error: `Rate limited: ${errorMsg}`, latencyMs, model, rateLimited: true };
            }
            if (response.status === 402 || response.status === 403) {
                return { ok: false, error: `Quota/auth error: ${errorMsg}`, latencyMs, model, quotaExhausted: true };
            }

            return { ok: false, error: errorMsg, latencyMs, model };
        }

        const data = await response.json();
        const text = data.choices?.[0]?.message?.content;

        if (!text) {
            return { ok: false, error: "Empty response from DeepSeek API", latencyMs, model };
        }

        return {
            ok: true,
            text: text.trim(),
            latencyMs,
            model,
            usage: data.usage || null,
            finishReason: data.choices?.[0]?.finish_reason,
        };
    } catch (err) {
        const latencyMs = Date.now() - startTime;

        if (err.name === "AbortError") {
            return { ok: false, error: `Timeout after ${timeoutMs}ms`, latencyMs, model };
        }

        return { ok: false, error: err.message, latencyMs, model };
    }
}

/**
 * Call DeepSeek with automatic fallback to Gemini.
 *
 * @param {Object} keys - { deepseekKey, geminiKey }
 * @param {Array<{role: string, content: string}>} messages - OpenAI-format messages
 * @param {Object} [options] - { model, maxTokens, temperature, timeoutMs }
 * @returns {Promise<{ok: boolean, text?: string, provider: string, latencyMs: number, model: string, error?: string}>}
 */
async function callWithFallback(keys, messages, options = {}) {
    const { deepseekKey, geminiKey } = keys;
    const tag = "[callWithFallback]";
    const dsKey = deepseekKey || DEEPSEEK_API_KEY_FALLBACK;

    // ── 1. Try DeepSeek ──
    if (dsKey) {
        const deepseekResult = await callDeepSeek(dsKey, { messages, ...options });

        if (deepseekResult.ok) {
            console.log(`${tag} DeepSeek OK (${deepseekResult.latencyMs}ms, model=${deepseekResult.model})`);
            return { ...deepseekResult, provider: "deepseek" };
        }

        console.warn(`${tag} DeepSeek failed: ${deepseekResult.error} — falling back to Gemini`);
    }

    // ── 2. Fallback to Gemini ──
    if (geminiKey) {
        const geminiResult = await callGeminiFallback(geminiKey, messages, options);

        if (geminiResult.ok) {
            console.log(`${tag} Gemini fallback OK (${geminiResult.latencyMs}ms)`);
            return { ...geminiResult, provider: "gemini" };
        }

        console.error(`${tag} Gemini fallback also failed: ${geminiResult.error}`);
        return { ...geminiResult, provider: "gemini" };
    }

    return { ok: false, error: "No AI provider available (missing keys)", provider: "none", latencyMs: 0, model: "none" };
}

/**
 * Gemini fallback — converts OpenAI-format messages to Gemini REST format.
 */
async function callGeminiFallback(geminiKey, messages, options = {}) {
    const { callGemini } = require("./aiClient");

    const systemMsg = messages.find(m => m.role === "system");
    const nonSystemMsgs = messages.filter(m => m.role !== "system");

    const contents = nonSystemMsgs.map(msg => ({
        role: msg.role === "assistant" ? "model" : "user",
        parts: [{ text: msg.content }],
    }));

    return callGemini(geminiKey, {
        contents,
        systemInstruction: systemMsg?.content || undefined,
        maxOutputTokens: options.maxTokens || 1024,
        temperature: options.temperature || 0.3,
        timeoutMs: options.timeoutMs || 45000,
    });
}

/**
 * Parse JSON from an LLM response (handles markdown fences, etc.)
 */
function parseJsonFromResponse(text) {
    if (!text) return { parsed: null, parseError: "Empty text" };

    let cleaned = text.trim();

    // Remove markdown code fences
    if (cleaned.startsWith("```json")) {
        cleaned = cleaned.replace(/^```json\s*/, "").replace(/```\s*$/, "");
    } else if (cleaned.startsWith("```")) {
        cleaned = cleaned.replace(/^```\s*/, "").replace(/```\s*$/, "");
    }

    try {
        return { parsed: JSON.parse(cleaned) };
    } catch (err) {
        const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            try {
                return { parsed: JSON.parse(jsonMatch[0]) };
            } catch (_) { /* fall through */ }
        }
        return { parsed: null, parseError: `JSON parse failed: ${err.message}` };
    }
}

module.exports = {
    callDeepSeek,
    callWithFallback,
    callGeminiFallback,
    parseJsonFromResponse,
    DEEPSEEK_MODEL,
    DEEPSEEK_BASE_URL,
    DEEPSEEK_API_KEY_FALLBACK,
};
