/**
 * ARIA Agent — Conversation Engine
 * ====================================
 * The brain of the ARIA agent. Processes inbound messages,
 * loads context (memory + conversation history + operational data),
 * generates intelligent responses via NVIDIA NIM (+ Gemini fallback),
 * and manages tool execution for data queries.
 *
 * Flow:
 * 1. Load user memories
 * 2. Load recent conversation
 * 3. Detect if tool use is needed (via LLM)
 * 4. Execute tools if requested
 * 5. Generate natural response
 * 6. Save to conversation history
 * 7. Extract new memories (async/background)
 */

const { buildSystemPrompt } = require("./agentPersona");
const { loadUserMemory, getRecentConversation, appendToConversation, extractMemoriesFromConversation } = require("./memoryService");
const { getToolDescriptionsForPrompt, executeTool, listTools } = require("./toolRegistry");
const { callWithFallback, parseJsonFromResponse } = require("../ai/nvidiaClient");

/**
 * Process an inbound user message and generate ARIA's response.
 *
 * @param {Object} params
 * @param {string} params.userId - Firebase UID
 * @param {string} params.chatId - Telegram chat ID
 * @param {string} params.userMessage - The text message from the user
 * @param {string} params.userName - Display name
 * @param {string} params.userRole - engineer, technician, teamlead, manager
 * @param {Object} params.keys - { nvidiaKey, geminiKey }
 * @returns {Promise<{response: string, provider: string, toolsUsed: string[], latencyMs: number}>}
 */
async function processMessage(params) {
    const { userId, chatId, userMessage, userName, userRole, keys } = params;
    const tag = "[conversationEngine]";
    const startTime = Date.now();

    // ── 1. Load context ──
    const [memories, conversation] = await Promise.all([
        loadUserMemory(userId),
        getRecentConversation(chatId),
    ]);

    // ── 2. Build system prompt with persona + memories ──
    const systemPrompt = buildSystemPrompt({
        userName,
        userRole,
        memories,
    });

    // ── 3. Build message history ──
    const messages = [
        { role: "system", content: systemPrompt },
    ];

    // Add conversation summary if exists
    if (conversation.summary) {
        messages.push({
            role: "system",
            content: `Resumen de conversaciones previas: ${conversation.summary}`,
        });
    }

    // Add recent messages (context window)
    for (const msg of conversation.messages) {
        messages.push(msg);
    }

    // Add the new user message
    messages.push({ role: "user", content: userMessage });

    // ── 4. First pass: detect if we need tools ──
    const toolsUsed = [];
    let toolResultsContext = "";

    const needsTools = detectToolNeed(userMessage);
    if (needsTools) {
        const toolResult = await executeToolsForMessage(keys, userId, userMessage, systemPrompt);
        if (toolResult.data) {
            toolResultsContext = `\n\n[DATOS DEL SISTEMA — usa esta información para tu respuesta]\n${JSON.stringify(toolResult.data, null, 2)}`;
            toolsUsed.push(...toolResult.toolsUsed);
        }
    }

    // ── 5. Generate response ──
    if (toolResultsContext) {
        // Append to the last user message instead of creating a second system message.
        // This prevents the Gemini fallback from filtering it out, and plays nicer with LLM roles.
        const lastMsg = messages[messages.length - 1];
        if (lastMsg && lastMsg.role === "user") {
            lastMsg.content += `\n${toolResultsContext}`;
        }
    }

    const result = await callWithFallback(keys, messages, {
        maxTokens: 600,
        temperature: 0.2,
        timeoutMs: 30000,
    });

    const latencyMs = Date.now() - startTime;

    if (!result.ok) {
        console.error(`${tag} AI call failed:`, result.error);
        return {
            response: "⚠️ Lo siento, tengo un problema técnico en este momento. Intenta de nuevo en unos minutos.",
            provider: result.provider,
            toolsUsed,
            latencyMs,
        };
    }

    let response = result.text;
    
    // Append signature for cost tracking
    const signature = result.provider === "nvidia" 
        ? "\n\n<i>🧠 Procesado por NVIDIA NIM (Sin Costo)</i>" 
        : "\n\n<i>🧠 Procesado por Gemini (Fallback - Costo API)</i>";
    
    response += signature;

    // ── 6. Save conversation history ──
    await appendToConversation(chatId, userId, [
        { role: "user", content: userMessage },
        { role: "assistant", content: response },
    ]);

    // ── 7. Extract memories in background (don't await) ──
    const recentMsgs = [
        ...conversation.messages.slice(-6),
        { role: "user", content: userMessage },
        { role: "assistant", content: response },
    ];
    extractMemoriesFromConversation(keys, userId, recentMsgs).catch(err => {
        console.warn(`${tag} Memory extraction failed:`, err.message);
    });

    console.log(`${tag} Response generated for ${userName} (${latencyMs}ms, provider=${result.provider}, tools=[${toolsUsed.join(",")}])`);

    return {
        response,
        provider: result.provider,
        toolsUsed,
        latencyMs,
    };
}

/**
 * Simple heuristic to detect if a message likely needs tool data.
 * This avoids unnecessary tool calls for casual conversation.
 */
function detectToolNeed(message) {
    const lower = message.toLowerCase();
    const toolKeywords = [
        "tarea", "tareas", "task", "proyecto", "project",
        "horas", "hours", "timer", "tiempo",
        "equipo", "team", "status", "estado",
        "vencid", "overdue", "bloqueada", "blocked",
        "métrica", "score", "ips", "rendimiento",
        "avance", "progreso", "progress",
        "cuántas", "cuantas", "cuántos", "cuantos",
        "quién", "quien", "cómo va", "como va",
        "reportar", "reporte", "report",
        "pendiente", "atrasad",
    ];

    return toolKeywords.some(kw => lower.includes(kw));
}

/**
 * Execute appropriate tools based on the user message.
 * Uses a simple intent-matching approach (fast, no extra LLM call).
 */
async function executeToolsForMessage(keys, userId, message, systemPrompt) {
    const lower = message.toLowerCase();
    const toolsUsed = [];
    const data = {};

    try {
        // My tasks (broad matching — anything about tasks, pending, what I have)
        if (lower.includes("mis tarea") || lower.includes("my task") ||
            lower.includes("qué tengo") || lower.includes("que tengo") ||
            lower.includes("pendiente") || lower.includes("mis pendiente") ||
            lower.includes("tengo asignad") || lower.includes("qué me falta") ||
            lower.includes("que me falta")) {
            data.myTasks = await executeTool("getMyTasks", userId);
            toolsUsed.push("getMyTasks");
            console.log(`[conversationEngine] getMyTasks returned ${data.myTasks?.length || 0} tasks for user ${userId}`);
        }

        // Team status
        if (lower.includes("equipo") || lower.includes("team") || lower.includes("todos") || lower.includes("quién")) {
            data.teamStatus = await executeTool("getTeamStatus");
            toolsUsed.push("getTeamStatus");
        }

        // Overdue tasks
        if (lower.includes("vencid") || lower.includes("overdue") || lower.includes("atrasad")) {
            data.overdueTasks = await executeTool("getOverdueTasks");
            toolsUsed.push("getOverdueTasks");
        }

        // My hours today
        if (lower.includes("hora") || lower.includes("timer") || lower.includes("tiempo") || lower.includes("cuánto llevo")) {
            data.myHoursToday = await executeTool("getMyHoursToday", userId);
            toolsUsed.push("getMyHoursToday");
        }

        // Projects
        if (lower.includes("proyecto") || lower.includes("project")) {
            data.projects = await executeTool("getAllProjects");
            toolsUsed.push("getAllProjects");
        }

        // Generic status — fetch tasks + hours if nothing specific matched
        if (toolsUsed.length === 0 && (lower.includes("status") || lower.includes("estado") ||
            lower.includes("cómo va") || lower.includes("como va") ||
            lower.includes("tarea") || lower.includes("task"))) {
            data.myTasks = await executeTool("getMyTasks", userId);
            data.myHoursToday = await executeTool("getMyHoursToday", userId);
            toolsUsed.push("getMyTasks", "getMyHoursToday");
            console.log(`[conversationEngine] Generic status: ${data.myTasks?.length || 0} tasks, hours=${JSON.stringify(data.myHoursToday)}`);
        }
    } catch (err) {
        console.warn("[conversationEngine] Tool execution error:", err.message);
    }

    console.log(`[conversationEngine] Tools executed: [${toolsUsed.join(",")}], hasData=${toolsUsed.length > 0}`);
    return { data: toolsUsed.length > 0 ? data : null, toolsUsed };
}

module.exports = {
    processMessage,
    detectToolNeed,
};
