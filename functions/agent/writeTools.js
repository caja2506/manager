/**
 * ARIA Agent — Write Tools (Phase 5)
 * =====================================
 * Tools that allow ARIA to WRITE data to the system.
 * Every write tool requires explicit user confirmation before execution.
 *
 * Supported operations:
 *   - createTask: Create a new task in Supabase
 *   - addTaskComment: Add a comment to an existing task
 *
 * Security:
 *   - All writes go through a confirmation flow (Sí/No)
 *   - Every execution is logged to `agent_write_log`
 *   - The user's own identity is always used (no impersonation)
 */

const coreReader = require("../db/coreDataReader");

/**
 * Registry of write tools available to ARIA.
 * Each tool has:
 *   - name: unique identifier
 *   - description: what it does (shown to the LLM)
 *   - requiresConfirmation: always true for writes
 *   - buildConfirmMessage: builds the confirmation prompt for Telegram
 *   - execute: async function that performs the write
 */
const WRITE_TOOL_REGISTRY = {

    createTask: {
        name: "createTask",
        description: "Crea una tarea nueva en el sistema.",
        requiresConfirmation: true,
        parameters: "title (string), projectId (string, optional), assignedTo (string, optional), priority (string, optional), dueDate (string YYYY-MM-DD, optional)",

        /**
         * Build a human-readable confirmation message.
         * @param {Object} params
         * @returns {string} HTML message for Telegram
         */
        buildConfirmMessage(params) {
            const lines = [
                "📋 <b>Voy a crear esta tarea:</b>\n",
                `▪️ Título: <b>${params.title}</b>`,
            ];
            if (params.projectName) lines.push(`▪️ Proyecto: ${params.projectName}`);
            if (params.assignedToName) lines.push(`▪️ Asignado a: ${params.assignedToName}`);
            if (params.priority) lines.push(`▪️ Prioridad: ${params.priority}`);
            if (params.dueDate) lines.push(`▪️ Fecha límite: ${params.dueDate}`);
            lines.push("\n¿Confirmas? Responde <b>Sí</b> o <b>No</b>");
            return lines.join("\n");
        },

        buildConfirmKeyboard(params) {
            return [
                [
                    { text: "👍 Sí, crear", callback_data: "write_confirm:yes" },
                    { text: "👎 No, cancelar", callback_data: "write_confirm:no" }
                ]
            ];
        },

        /**
         * Execute the write operation.
         * @param {Object} params - { title, projectId, assignedTo, priority, dueDate, userId }
         * @returns {Promise<{success: boolean, taskId?: string, error?: string}>}
         */
        async execute(params) {
            const { title, projectId, assignedTo, priority, dueDate, userId } = params;
            const now = new Date().toISOString();

            // insertTask() expects camelCase — it converts to snake_case internally
            const taskData = {
                title: title,
                status: "backlog",
                priority: priority || "medium",
                createdBy: userId,
                assignedTo: assignedTo || userId,
                createdAt: now,
                updatedAt: now,
            };

            if (projectId) taskData.projectId = projectId;
            if (dueDate) taskData.dueDate = dueDate;

            try {
                const result = await coreReader.insertTask(taskData);
                return { success: true, taskId: result?.id || null };
            } catch (err) {
                console.error("[writeTools] createTask error:", err.message);
                return { success: false, error: err.message };
            }
        },
    },

    addTaskComment: {
        name: "addTaskComment",
        description: "Agrega un comentario a una tarea existente.",
        requiresConfirmation: true,
        parameters: "taskId (string), text (string)",

        buildConfirmMessage(params) {
            const lines = [
                "💬 <b>Voy a agregar este comentario:</b>\n",
                `▪️ Tarea: <b>${params.taskTitle || params.taskId}</b>`,
                `▪️ Comentario: <i>${(params.text || "").substring(0, 150)}</i>`,
                "\n¿Confirmas? Responde <b>Sí</b> o <b>No</b>",
            ];
            return lines.join("\n");
        },

        buildConfirmKeyboard(params) {
            return [
                [
                    { text: "👍 Sí, comentar", callback_data: "write_confirm:yes" },
                    { text: "👎 No, cancelar", callback_data: "write_confirm:no" }
                ]
            ];
        },

        async execute(params) {
            const { taskId, text, userId, userName } = params;
            const now = new Date().toISOString();

            try {
                const { getSupabase } = require("../db/supabaseAdmin");
                const sb = getSupabase();

                const { data, error } = await sb.from("task_comments").insert({
                    task_id: taskId,
                    user_id: userId,
                    user_name: userName || "Usuario",
                    text: `[vía ARIA] ${text}`,
                    created_at: now,
                    updated_at: now,
                }).select("id").single();

                if (error) {
                    console.error("[writeTools] addTaskComment error:", error.message);
                    return { success: false, error: error.message };
                }

                return { success: true, commentId: data?.id || null };
            } catch (err) {
                console.error("[writeTools] addTaskComment error:", err.message);
                return { success: false, error: err.message };
            }
        },
    },

    updateTaskPriority: {
        name: "updateTaskPriority",
        description: "Actualiza la prioridad de una tarea existente.",
        requiresConfirmation: true,
        parameters: "taskId (string), priority (string: low/medium/high/critical)",

        buildConfirmMessage(params) {
            const lines = [
                "⚠️ <b>Voy a cambiar la prioridad de esta tarea:</b>\n",
                `▪️ Tarea: <b>${params.taskTitle || params.taskId}</b>`,
                `▪️ Nueva prioridad: <b>${(params.priority || "medium").toUpperCase()}</b>`,
                "\n¿Confirmas? Responde <b>Sí</b> o <b>No</b>",
            ];
            return lines.join("\n");
        },

        buildConfirmKeyboard(params) {
            return [
                [
                    { text: "👍 Sí, cambiar", callback_data: "write_confirm:yes" },
                    { text: "👎 No, cancelar", callback_data: "write_confirm:no" }
                ]
            ];
        },

        async execute(params) {
            const { taskId, priority } = params;
            try {
                const result = await coreReader.updateTask(taskId, { priority });
                if (!result) {
                    return { success: false, error: "updateTask returned null" };
                }
                return { success: true, taskId: result.id, updatedPriority: result.priority };
            } catch (err) {
                console.error("[writeTools] updateTaskPriority error:", err.message);
                return { success: false, error: err.message };
            }
        },
    },
};

/**
 * Log a write operation for audit trail.
 * @param {Object} params
 * @param {string} params.userId
 * @param {string} params.toolName
 * @param {string} params.targetId
 * @param {Object} params.payload
 * @returns {Promise<void>}
 */
async function logWriteOperation({ userId, toolName, targetId, payload }) {
    try {
        const { getSupabase } = require("../db/supabaseAdmin");
        const sb = getSupabase();

        await sb.from("agent_write_log").insert({
            user_id: userId,
            tool_name: toolName,
            target_id: targetId || null,
            payload: payload || {},
            confirmed_at: new Date().toISOString(),
            executed_at: new Date().toISOString(),
        });
    } catch (err) {
        // Non-blocking — audit log failure should not break the write
        console.warn("[writeTools] Failed to log write operation:", err.message);
    }
}

/**
 * Execute a write tool by name, with audit logging.
 * @param {string} toolName
 * @param {Object} params
 * @returns {Promise<Object>}
 */
async function executeWriteTool(toolName, params) {
    const tool = WRITE_TOOL_REGISTRY[toolName];
    if (!tool) {
        return { success: false, error: `Write tool "${toolName}" not found` };
    }

    const result = await tool.execute(params);

    // Log the operation regardless of success
    await logWriteOperation({
        userId: params.userId,
        toolName,
        targetId: result.taskId || result.commentId || params.taskId || null,
        payload: { params, result },
    });

    return result;
}

/**
 * Get a write tool's confirmation message.
 * @param {string} toolName
 * @param {Object} params
 * @returns {string|null}
 */
function getConfirmMessage(toolName, params) {
    const tool = WRITE_TOOL_REGISTRY[toolName];
    if (!tool) return null;
    return tool.buildConfirmMessage(params);
}

/**
 * Get a write tool's confirmation keyboard.
 * @param {string} toolName
 * @param {Object} params
 * @returns {Array|null}
 */
function getConfirmKeyboard(toolName, params) {
    const tool = WRITE_TOOL_REGISTRY[toolName];
    if (!tool || !tool.buildConfirmKeyboard) return null;
    return tool.buildConfirmKeyboard(params);
}

/**
 * Get write tool descriptions for the LLM system prompt.
 * @returns {string}
 */
function getWriteToolDescriptionsForPrompt() {
    const tools = Object.values(WRITE_TOOL_REGISTRY);
    return tools.map(t =>
        `- <b>${t.name}</b>(${t.parameters}): ${t.description} [⚠️ REQUIERE CONFIRMACIÓN]`
    ).join("\n");
}

module.exports = {
    WRITE_TOOL_REGISTRY,
    executeWriteTool,
    getConfirmMessage,
    getConfirmKeyboard,
    getWriteToolDescriptionsForPrompt,
    logWriteOperation,
};
