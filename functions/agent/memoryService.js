/**
 * ARIA Agent — Memory Service
 * ==============================
 * Persistent memory layer using Supabase.
 * Stores facts, preferences, and conversation history.
 *
 * Tables: agent_memory, agent_conversations
 */

const MAX_CONVERSATION_MESSAGES = 20;  // Keep last N messages in context
const MAX_MEMORIES_PER_QUERY = 15;     // Load top N memories per request

/**
 * Load relevant memories for a user.
 * Returns a mix of recent + high-importance memories.
 *
 * @param {string} userId
 * @returns {Promise<Array<{id, memory_type, category, content, importance}>>}
 */
async function loadUserMemory(userId) {
    const { getSupabase } = require("../db/supabaseAdmin");
    const supabase = getSupabase();

    // Fetch non-expired memories, ordered by importance then recency
    const { data, error } = await supabase
        .from("agent_memory")
        .select("id, memory_type, category, content, importance, created_at")
        .eq("user_id", userId)
        .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
        .order("importance", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(MAX_MEMORIES_PER_QUERY);

    if (error) {
        console.warn("[memoryService] loadUserMemory error:", error.message);
        return [];
    }

    return data || [];
}

/**
 * Save a new memory for a user.
 *
 * @param {string} userId
 * @param {string} type - 'fact', 'preference', 'context', 'interaction_summary'
 * @param {string} content - The memory content in natural language
 * @param {Object} [metadata] - { category, importance, source, expiresAt }
 * @returns {Promise<{ok: boolean, id?: string, error?: string}>}
 */
async function saveMemory(userId, type, content, metadata = {}) {
    const { getSupabase } = require("../db/supabaseAdmin");
    const supabase = getSupabase();

    const record = {
        user_id: userId,
        memory_type: type,
        content,
        category: metadata.category || null,
        importance: metadata.importance || 5,
        source: metadata.source || "conversation",
        expires_at: metadata.expiresAt || null,
    };

    const { data, error } = await supabase
        .from("agent_memory")
        .insert(record)
        .select("id")
        .single();

    if (error) {
        console.error("[memoryService] saveMemory error:", error.message);
        return { ok: false, error: error.message };
    }

    return { ok: true, id: data.id };
}

/**
 * Load recent conversation messages for a chat.
 *
 * @param {string} chatId - Telegram chat ID
 * @returns {Promise<{messages: Array, summary: string|null, messageCount: number}>}
 */
async function getRecentConversation(chatId) {
    const { getSupabase } = require("../db/supabaseAdmin");
    const supabase = getSupabase();

    const { data, error } = await supabase
        .from("agent_conversations")
        .select("messages, summary, message_count")
        .eq("chat_id", chatId)
        .single();

    if (error && error.code !== "PGRST116") { // PGRST116 = not found
        console.warn("[memoryService] getRecentConversation error:", error.message);
    }

    return {
        messages: data?.messages || [],
        summary: data?.summary || null,
        messageCount: data?.message_count || 0,
    };
}

/**
 * Append messages to a conversation and trim to max length.
 *
 * @param {string} chatId
 * @param {string} userId
 * @param {Array<{role: string, content: string}>} newMessages
 * @returns {Promise<void>}
 */
async function appendToConversation(chatId, userId, newMessages) {
    const { getSupabase } = require("../db/supabaseAdmin");
    const supabase = getSupabase();

    // Load existing
    const existing = await getRecentConversation(chatId);
    let messages = [...existing.messages, ...newMessages];

    // Trim to max (keep most recent)
    if (messages.length > MAX_CONVERSATION_MESSAGES) {
        messages = messages.slice(-MAX_CONVERSATION_MESSAGES);
    }

    const record = {
        chat_id: chatId,
        user_id: userId,
        messages,
        message_count: existing.messageCount + newMessages.length,
        last_interaction_at: new Date().toISOString(),
    };

    // Upsert (insert or update based on chat_id unique constraint)
    const { error } = await supabase
        .from("agent_conversations")
        .upsert(record, { onConflict: "chat_id" });

    if (error) {
        console.error("[memoryService] appendToConversation error:", error.message);
    }
}

/**
 * Extract memorable facts from a conversation using AI.
 * Called asynchronously after a conversation ends.
 *
 * @param {Object} keys - { nvidiaKey, geminiKey }
 * @param {string} userId
 * @param {Array<{role: string, content: string}>} messages - Recent messages
 * @returns {Promise<Array<{type, content, category, importance}>>}
 */
async function extractMemoriesFromConversation(keys, userId, messages) {
    const { callWithFallback, parseJsonFromResponse } = require("../ai/nvidiaClient");

    if (messages.length < 3) return []; // Too short to extract anything

    const conversationText = messages
        .filter(m => m.role !== "system")
        .map(m => `${m.role === "user" ? "Usuario" : "ARIA"}: ${m.content}`)
        .join("\n");

    const result = await callWithFallback(keys, [
        {
            role: "system",
            content: `Analiza esta conversación y extrae HECHOS IMPORTANTES para recordar sobre el usuario. Solo incluye información relevante para futuras interacciones laborales.

Responde SOLO con un JSON array. Ejemplo:
[
  {"type": "fact", "content": "Trabaja en el proyecto del conveyor de Línea 3", "category": "tasks", "importance": 7},
  {"type": "preference", "content": "Prefiere recibir recordatorios por la mañana", "category": "communication", "importance": 6}
]

Si no hay nada relevante que recordar, responde con un array vacío: []`,
        },
        {
            role: "user",
            content: conversationText,
        },
    ], { maxTokens: 500, temperature: 0.2 });

    if (!result.ok) {
        console.warn("[memoryService] extractMemories failed:", result.error);
        return [];
    }

    const { parsed } = parseJsonFromResponse(result.text);
    if (!Array.isArray(parsed)) return [];

    // Save each extracted memory
    const saved = [];
    for (const mem of parsed.slice(0, 5)) { // Max 5 memories per conversation
        if (mem.content && mem.type) {
            const saveResult = await saveMemory(userId, mem.type, mem.content, {
                category: mem.category,
                importance: mem.importance || 5,
                source: "conversation",
            });
            if (saveResult.ok) saved.push(mem);
        }
    }

    console.log(`[memoryService] Extracted ${saved.length} memories for user ${userId}`);
    return saved;
}

module.exports = {
    loadUserMemory,
    saveMemory,
    getRecentConversation,
    appendToConversation,
    extractMemoriesFromConversation,
    MAX_CONVERSATION_MESSAGES,
    MAX_MEMORIES_PER_QUERY,
};
