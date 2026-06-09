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
const { callWithFallback, parseJsonFromResponse, DEEPSEEK_MODEL } = require("../ai/deepseekClient");
const { detectWriteIntent } = require("./intentDetector");
const { getConfirmMessage } = require("./writeTools");

let _mcpClient = null;

/**
 * Initialize and retrieve the local MCP client connection.
 * Falls back to local tools if the MCP connection cannot be established.
 * @returns {Promise<Object|null>}
 */
async function getMcpClient() {
    if (_mcpClient) return _mcpClient;

    const path = require("path");
    const mcpServerPath = path.resolve(__dirname, "../../scripts/mcp-server/index.js");

    try {
        const { Client } = await import("@modelcontextprotocol/sdk/client/index.js");
        const { StdioClientTransport } = await import("@modelcontextprotocol/sdk/client/stdio.js");

        const transport = new StdioClientTransport({
            command: "node",
            args: [mcpServerPath],
        });

        const client = new Client(
            {
                name: "autobom-agent-client",
                version: "1.0.0",
            },
            {
                capabilities: {},
            }
        );

        await client.connect(transport);
        console.log("[mcpClient] Connected successfully to autobom-mcp-server");
        _mcpClient = client;
        return _mcpClient;
    } catch (err) {
        console.warn("[mcpClient] Could not initialize MCP client (using local fallback):", err.message);
        return null;
    }
}

/**
 * Helper to call a tool via MCP if available, falling back to local JS tools.
 * @param {string} toolName - camelCase tool name
 * @param {Object} args - Arguments passed to the tool
 */
async function callToolViaMcpOrLocal(toolName, args = {}) {
    const mcpClient = await getMcpClient();
    if (mcpClient) {
        // Map camelCase toolName to snake_case (e.g. getMyTasks -> get_my_tasks)
        const mcpToolName = toolName.replace(/([A-Z])/g, "_$1").toLowerCase();
        try {
            console.log(`[conversationEngine] Calling MCP tool: ${mcpToolName} with args:`, args);
            const mcpResult = await mcpClient.callTool({
                name: mcpToolName,
                arguments: args,
            });
            if (mcpResult && mcpResult.content && mcpResult.content[0]) {
                return JSON.parse(mcpResult.content[0].text);
            }
        } catch (mcpErr) {
            console.warn(`[conversationEngine] MCP call for ${mcpToolName} failed, falling back to local:`, mcpErr.message);
        }
    }
    
    // Fallback: local execution with positional arguments mapping
    let positionalArgs = [];
    if (toolName === "getMyTasks" || toolName === "getMyHoursToday") {
        positionalArgs = [args.userId];
    } else if (toolName === "getTaskDetails") {
        positionalArgs = [args.taskId];
    } else if (toolName === "getProjectMetrics" || toolName === "getProjectMilestones" || toolName === "getProjectComments" || toolName === "getProjectDelays") {
        positionalArgs = [args.projectId];
    } else if (toolName === "getUpcomingDeadlines") {
        positionalArgs = [args.days];
    }
    
    return await executeTool(toolName, ...positionalArgs);
}


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

    // ── 0. Check for write intent FIRST ──
    try {
        const writeIntent = await detectWriteIntent(userMessage, userId);
        if (writeIntent.type === "write" && writeIntent.action) {
            console.log(`${tag} Write intent detected: ${writeIntent.action}`);
            const extractedParams = { ...writeIntent.extractedParams, userId, userName };

            // Validate minimum required params — if missing, FALL THROUGH
            // to the normal conversation engine so ARIA can use chat context.
            const hasMinParams =
                (writeIntent.action === "createTask" && extractedParams.title) ||
                (writeIntent.action === "addTaskComment" && extractedParams.taskId && extractedParams.text) ||
                (writeIntent.action === "updateTaskPriority" && extractedParams.taskId && extractedParams.priority);

            if (hasMinParams) {
                const confirmMessage = getConfirmMessage(writeIntent.action, extractedParams);
                return {
                    response: confirmMessage,
                    provider: "system",
                    toolsUsed: [],
                    latencyMs: Date.now() - startTime,
                    pendingWrite: {
                        toolName: writeIntent.action,
                        params: extractedParams,
                        confirmMessage,
                    },
                };
            } else {
                // Insufficient params — let the LLM handle it with full conversation context
                console.log(`${tag} Write intent detected but insufficient params, falling through to LLM`);
            }
        }
    } catch (writeErr) {
        console.warn(`${tag} Write intent detection error (non-blocking):`, writeErr.message);
    }

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

    // Add recent messages (context window) and clean legacy formatting
    for (const msg of conversation.messages) {
        let content = msg.content;
        if (typeof content === "string") {
            content = cleanBulletsAndSignatures(content);
        }
        messages.push({ ...msg, content });
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
        model: DEEPSEEK_MODEL,
        maxTokens: 600,
        temperature: 0.2,
        timeoutMs: 90000,
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

    let response = cleanBulletsAndSignatures(result.text);
    
    // ── 6. Save conversation history (save raw response WITHOUT signature) ──
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

    // Append signature for cost tracking ONLY to the final returned message sent to Telegram
    let signature = "";
    if (result.provider === "deepseek") {
        const usage = result.usage;
        if (usage) {
            const promptTokens = usage.prompt_tokens || 0;
            const completionTokens = usage.completion_tokens || 0;
            // DeepSeek V3 pricing:
            // Input: $0.14 / 1,000,000 tokens
            // Output: $0.28 / 1,000,000 tokens
            const cost = (promptTokens * 0.14 / 1000000) + (completionTokens * 0.28 / 1000000);
            signature = `\n\n${cost.toFixed(6)} $`;
        } else {
            signature = `\n\n0.000000 $`;
        }
    } else if (result.provider === "gemini") {
        const usage = result.rawResponse?.usageMetadata;
        if (usage) {
            const promptTokens = usage.promptTokenCount || 0;
            const candidatesTokens = usage.candidatesTokenCount || 0;
            // Gemini 2.5 Flash prices:
            // Input: $0.075 / 1,000,000 tokens
            // Output: $0.30 / 1,000,000 tokens
            const cost = (promptTokens * 0.075 / 1000000) + (candidatesTokens * 0.30 / 1000000);
            signature = `\n\n${cost.toFixed(6)} $`;
        } else {
            signature = `\n\n0.000000 $`;
        }
    }
    
    const finalResponse = response + signature;

    console.log(`${tag} Response generated for ${userName} (${latencyMs}ms, provider=${result.provider}, tools=[${toolsUsed.join(",")}])`);

    return {
        response: finalResponse,
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
        const coreReader = require("../db/coreDataReader");
        const allUsers = await coreReader.loadAllUsers();

        // Detect if the query refers to a specific team member
        const mentionedUser = allUsers.find(u => {
            const name = (u.name || u.displayName || u.email || "").toLowerCase();
            const firstName = name.split(" ")[0]; // e.g. "eduardo"
            return firstName && firstName.length > 2 && lower.includes(firstName);
        });

        if (mentionedUser) {
            const targetUserId = mentionedUser.id;
            const targetName = mentionedUser.name || mentionedUser.displayName || mentionedUser.email;

            // Tasks for mentioned user
            if (lower.includes("tarea") || lower.includes("task") || lower.includes("pendiente") || lower.includes("hace") || lower.includes("haciendo") || lower.includes("tiene")) {
                data.tasksForUser = {
                    userName: targetName,
                    tasks: await callToolViaMcpOrLocal("getMyTasks", { userId: targetUserId })
                };
                toolsUsed.push("getMyTasks");
                console.log(`[conversationEngine] getMyTasks returned ${data.tasksForUser.tasks?.length || 0} tasks for teammate ${targetName}`);
            }

            // Hours for mentioned user
            if (lower.includes("hora") || lower.includes("timer") || lower.includes("tiempo") || lower.includes("cuánto lleva") || lower.includes("cuanto lleva")) {
                data.hoursForUser = {
                    userName: targetName,
                    hoursToday: await callToolViaMcpOrLocal("getMyHoursToday", { userId: targetUserId })
                };
                toolsUsed.push("getMyHoursToday");
            }

            // Default to tasks if no specific tool was matched for the teammate
            if (toolsUsed.length === 0) {
                data.tasksForUser = {
                    userName: targetName,
                    tasks: await callToolViaMcpOrLocal("getMyTasks", { userId: targetUserId })
                };
                toolsUsed.push("getMyTasks");
            }
        } else {
            // My tasks (broad matching — anything about tasks, pending, what I have)
            if (lower.includes("mis tarea") || lower.includes("my task") ||
                lower.includes("qué tengo") || lower.includes("que tengo") ||
                lower.includes("pendiente") || lower.includes("mis pendiente") ||
                lower.includes("tengo asignad") || lower.includes("qué me falta") ||
                lower.includes("que me falta")) {
                data.myTasks = await callToolViaMcpOrLocal("getMyTasks", { userId });
                toolsUsed.push("getMyTasks");
                console.log(`[conversationEngine] getMyTasks returned ${data.myTasks?.length || 0} tasks for user ${userId}`);
            }

            // Team status
            if (lower.includes("equipo") || lower.includes("team") || lower.includes("todos") || lower.includes("quién")) {
                data.teamStatus = await callToolViaMcpOrLocal("getTeamStatus");
                toolsUsed.push("getTeamStatus");
            }

            // Overdue tasks
            if (lower.includes("vencid") || lower.includes("overdue") || lower.includes("atrasad")) {
                data.overdueTasks = await callToolViaMcpOrLocal("getOverdueTasks");
                toolsUsed.push("getOverdueTasks");
            }

            // My hours today
            if (lower.includes("hora") || lower.includes("timer") || lower.includes("tiempo") || lower.includes("cuánto llevo")) {
                data.myHoursToday = await callToolViaMcpOrLocal("getMyHoursToday", { userId });
                toolsUsed.push("getMyHoursToday");
            }

            // Projects
            if (lower.includes("proyecto") || lower.includes("project")) {
                data.projects = await callToolViaMcpOrLocal("getAllProjects");
                toolsUsed.push("getAllProjects");
            }

            // Generic status — fetch tasks + hours if nothing specific matched
            if (toolsUsed.length === 0 && (lower.includes("status") || lower.includes("estado") ||
                lower.includes("cómo va") || lower.includes("como va") ||
                lower.includes("tarea") || lower.includes("task"))) {
                data.myTasks = await callToolViaMcpOrLocal("getMyTasks", { userId });
                data.myHoursToday = await callToolViaMcpOrLocal("getMyHoursToday", { userId });
                toolsUsed.push("getMyTasks", "getMyHoursToday");
                console.log(`[conversationEngine] Generic status: ${data.myTasks?.length || 0} tasks, hours=${JSON.stringify(data.myHoursToday)}`);
            }
        }
    } catch (err) {
        console.warn("[conversationEngine] Tool execution error:", err.message);
    }

    console.log(`[conversationEngine] Tools executed: [${toolsUsed.join(",")}], hasData=${toolsUsed.length > 0}`);
    return { data: toolsUsed.length > 0 ? data : null, toolsUsed };
}

function cleanBulletsAndSignatures(text) {
    if (typeof text !== "string") return text;
    return text
        // Clean legacy signatures
        .replace(/\n\n<i>🧠 Procesado por NVIDIA NIM \(Sin Costo\)<\/i>/g, "")
        .replace(/\n\n<i>🧠 Procesado por Gemini \(Fallback - Costo API\)<\/i>/g, "")
        .replace(/\n\n(?:<i>)?\d+(?:\.\d+)?\s?\$(?:<\/i>)?/g, "")
        // Convert dry parent bullets (* or ▪) to beautiful emoji bullets
        .replace(/^\s*[\*\▪]\s*/gm, "🔹 ")
        // Convert dry sub-bullets (+ or -) to nested dot bullets (•)
        .replace(/^\s*[\+\-]\s*/gm, "  • ");
}

module.exports = {
    processMessage,
    detectToolNeed,
    callToolViaMcpOrLocal,
    executeToolsForMessage,
};
