/**
 * NVIDIA NIM Client — Backend (CJS)
 * ====================================
 * Client for NVIDIA NIM API (build.nvidia.com).
 * OpenAI-compatible chat completions format.
 *
 * Free tier: ~1,000 credits, ~40 RPM, no credit card.
 * Fallback: If NVIDIA fails → Gemini (already configured).
 *
 * Used as the primary "brain" for ARIA agent.
 */

const NVIDIA_BASE_URL = "https://integrate.api.nvidia.com/v1";

// Recommended models on NVIDIA NIM free tier
const NVIDIA_MODELS = {
    // Primary: excellent for Spanish, reasoning, conversation
    LLAMA_70B: "meta/llama-3.1-70b-instruct",
    // Lighter fallback
    LLAMA_8B: "meta/llama-3.1-8b-instruct",
    // Alternative: strong multilingual
    MISTRAL_LARGE: "mistralai/mistral-large-2-instruct",
    // NVIDIA's highly aligned fine-tune
    NEMOTRON_70B: "nvidia/llama-3.1-nemotron-70b-instruct",
};

/**
 * Call NVIDIA NIM chat completions API.
 *
 * @param {string} apiKey - NVIDIA API key (nvapi-...)
 * @param {Object} options
 * @param {string} [options.model] - Model identifier
 * @param {Array<{role: string, content: string}>} options.messages - Chat messages
 * @param {number} [options.maxTokens=1024]
 * @param {number} [options.temperature=0.5]
 * @param {number} [options.timeoutMs=30000]
 * @returns {Promise<{ok: boolean, text?: string, latencyMs: number, model: string, error?: string, usage?: Object}>}
 */
async function callNvidia(apiKey, options = {}) {
    const {
        model = NVIDIA_MODELS.LLAMA_8B,
        messages,
        maxTokens = 1024,
        temperature = 0.5,
        timeoutMs = 30000,
    } = options;

    if (!apiKey || !messages?.length) {
        return { ok: false, error: "Missing apiKey or messages", latencyMs: 0, model };
    }

    const url = `${NVIDIA_BASE_URL}/chat/completions`;
    const startTime = Date.now();

    const body = {
        model,
        messages,
        max_tokens: maxTokens,
        temperature,
        stream: false,
    };

    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), timeoutMs);

        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${apiKey}`,
            },
            body: JSON.stringify(body),
            signal: controller.signal,
        });

        clearTimeout(timeout);
        const latencyMs = Date.now() - startTime;

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            const errorMsg = errorData.error?.message || errorData.detail || `HTTP ${response.status}`;

            // Detect rate limit
            if (response.status === 429) {
                return { ok: false, error: `Rate limited: ${errorMsg}`, latencyMs, model, rateLimited: true };
            }
            // Detect quota exhausted
            if (response.status === 402 || response.status === 403) {
                return { ok: false, error: `Quota/auth error: ${errorMsg}`, latencyMs, model, quotaExhausted: true };
            }

            return { ok: false, error: errorMsg, latencyMs, model };
        }

        const data = await response.json();
        const text = data.choices?.[0]?.message?.content;

        if (!text) {
            return { ok: false, error: "Empty response from NVIDIA NIM", latencyMs, model };
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
 * Call NVIDIA NIM with automatic fallback to Gemini.
 *
 * Strategy:
 * 1. Try NVIDIA NIM (free, primary brain)
 * 2. If NVIDIA fails (rate limit, quota, error) → fall back to Gemini
 *
 * @param {Object} keys - { nvidiaKey, geminiKey }
 * @param {Array<{role: string, content: string}>} messages - OpenAI-format messages
 * @param {Object} [options] - { model, maxTokens, temperature, timeoutMs }
 * @returns {Promise<{ok: boolean, text?: string, provider: string, latencyMs: number, model: string, error?: string}>}
 */
async function callWithFallback(keys, messages, options = {}) {
    const { nvidiaKey, geminiKey } = keys;
    const tag = "[callWithFallback]";

    // ── 1. Try NVIDIA NIM ──
    if (nvidiaKey) {
        const nvidiaResult = await callNvidia(nvidiaKey, { messages, ...options });

        if (nvidiaResult.ok) {
            console.log(`${tag} NVIDIA OK (${nvidiaResult.latencyMs}ms, model=${nvidiaResult.model})`);
            return { ...nvidiaResult, provider: "nvidia" };
        }

        console.warn(`${tag} NVIDIA failed: ${nvidiaResult.error} — falling back to Gemini`);
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
 * Reuses the pattern from the existing aiClient.js.
 */
async function callGeminiFallback(geminiKey, messages, options = {}) {
    const { callGemini } = require("./aiClient");

    // Convert OpenAI messages format to Gemini contents format
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
        temperature: options.temperature || 0.5,
        timeoutMs: options.timeoutMs || 30000,
    });
}

/**
 * Parse JSON from an LLM response (handles markdown fences, etc.)
 * Reuses the pattern from aiClient.js but works with any provider.
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
        // Try to extract JSON object from mixed text
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
    callNvidia,
    callWithFallback,
    callGeminiFallback,
    parseJsonFromResponse,
    NVIDIA_MODELS,
    NVIDIA_BASE_URL,
};
