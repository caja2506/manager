/**
 * AI Briefing Service — Backend (CJS)
 * ======================================
 * Generates role-specific briefings using Gemini in Supabase.
 * Falls back to Phase 2 deterministic templates on failure.
 */

const { callGemini } = require("./aiClient");
const {
    BRIEFING_TECHNICIAN,
    BRIEFING_ENGINEER,
    BRIEFING_TEAMLEAD,
    BRIEFING_MANAGER,
} = require("./aiPromptRegistry");
const { logAIExecution, logAIFailure } = require("./aiAuditLogger");
const { fallbackBriefing } = require("./aiFallbacks");
const { OPERATIONAL_ROLES } = require("../automation/constants");
const { getSupabase } = require("../db/supabaseAdmin");
const { loadSetting } = require("../db/coreDataReader");

// Map role to prompt config
const ROLE_PROMPTS = {
    [OPERATIONAL_ROLES.TECHNICIAN]: BRIEFING_TECHNICIAN,
    [OPERATIONAL_ROLES.ENGINEER]: BRIEFING_ENGINEER,
    [OPERATIONAL_ROLES.TEAM_LEAD]: BRIEFING_TEAMLEAD,
    [OPERATIONAL_ROLES.MANAGER]: BRIEFING_MANAGER,
};

/**
 * Load AI configuration from Supabase settings.
 */
async function loadAIConfig(adminDb) {
    try {
        return await loadSetting("automationAI");
    } catch {
        return null;
    }
}

/**
 * Load operational data for briefings from Supabase.
 */
async function loadBriefingData(adminDb, userId, role) {
    const { loadAllTasks, loadAllProjects, loadAllUsers } = require("../db/coreDataReader");
    const now = new Date();
    const data = {};

    // Active tasks from Supabase
    const allTasksRaw = await loadAllTasks();
    const allTasks = allTasksRaw.filter(t => !["completed", "cancelled"].includes(t.status));

    data.totalTasks = allTasks.length;
    data.userTasks = allTasks.filter(t => t.assignedTo === userId);
    data.teamTasks = allTasks.slice(0, 30); // Limit for prompt
    data.overdueTasks = allTasks.filter(t => t.dueDate && new Date(t.dueDate) < now);
    data.blockedTasks = allTasks.filter(t => t.status === "blocked");
    data.overdueCount = data.overdueTasks.length;
    data.blockedCount = data.blockedTasks.length;

    // Open incidents from Supabase
    try {
        const sb = getSupabase();
        const { data: incidents, error } = await sb.from("operation_incidents")
            .select("id")
            .eq("status", "open");
        data.openIncidents = error ? 0 : (incidents || []).length;
    } catch {
        data.openIncidents = 0;
    }

    // Active projects from Supabase
    try {
        const projects = await loadAllProjects();
        data.activeProjects = projects.length;
    } catch {
        data.activeProjects = 0;
    }

    // Team size from Supabase
    try {
        const allUsers = await loadAllUsers();
        data.teamSize = allUsers.filter(u => u.isAutomationParticipant).length;
    } catch {
        data.teamSize = 0;
    }

    return data;
}

/**
 * Generate a role-specific briefing using Gemini.
 *
 * @param {any} adminDb - Kept for signature compatibility
 * @param {string} apiKey
 * @param {string} role - OPERATIONAL_ROLES value
 * @param {Object} userData - { userId, userName }
 * @param {Object} [context] - { runId, routineKey }
 * @returns {Promise<{ message: string, source: 'ai'|'fallback' }>}
 */
async function generateBriefing(adminDb, apiKey, role, userData, context = {}) {
    const promptConfig = ROLE_PROMPTS[role];
    if (!promptConfig) {
        console.warn(`[aiBriefingService] No prompt for role: ${role}`);
        return { message: fallbackBriefing(role, { userName: userData.userName }), source: "fallback" };
    }

    // Check if AI briefings are enabled
    const aiConfig = await loadAIConfig(null);
    if (!aiConfig?.enabled || !aiConfig?.allowSmartBriefings) {
        return { message: fallbackBriefing(role, { userName: userData.userName }), source: "fallback" };
    }

    try {
        // Load data
        const data = await loadBriefingData(null, userData.userId, role);
        data.userName = userData.userName;

        // Build prompt
        const userPrompt = promptConfig.buildUserPrompt(data);

        // Call Gemini
        const result = await callGemini(apiKey, {
            contents: [{ parts: [{ text: userPrompt }] }],
            systemInstruction: promptConfig.systemInstruction,
            temperature: 0.4,
            maxOutputTokens: 1024,
            timeoutMs: 20000,
        });

        if (!result.ok) {
            await logAIFailure(null, "briefing_generation", "system_context", result.error, {
                userId: userData.userId,
                routineKey: context.routineKey,
                latencyMs: result.latencyMs,
            });
            return { message: fallbackBriefing(role, data), source: "fallback" };
        }

        // Log success
        await logAIExecution(null, {
            featureType: "briefing_generation",
            sourceType: "system_context",
            model: aiConfig.briefingModel || null,
            userId: userData.userId,
            runId: context.runId,
            routineKey: context.routineKey,
            inputSummary: `Briefing for ${role}: ${userData.userName}`,
            outputSummary: result.text?.substring(0, 300),
            confidenceScore: 0.9, // Briefings are always usable
            status: "success",
            latencyMs: result.latencyMs,
        });

        return { message: result.text, source: "ai" };
    } catch (err) {
        console.error("[aiBriefingService] Unexpected error:", err);
        await logAIFailure(null, "briefing_generation", "system_context", err, {
            userId: userData.userId,
        });
        return { message: fallbackBriefing(role, { userName: userData.userName }), source: "fallback" };
    }
}

module.exports = { generateBriefing, loadAIConfig, loadBriefingData };

