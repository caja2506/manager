/**
 * AI Fallbacks — Backend (CJS)
 * ===============================
 * Deterministic fallback implementations when Gemini fails.
 * Uses Phase 2 parsers and templates as the safety net.
 */

const { parseReportText } = require("../telegram/telegramParsers");
const templates = require("../telegram/telegramTemplates");
const { OPERATIONAL_ROLES } = require("../automation/constants");

/**
 * Fallback extraction using Phase 2 deterministic parser.
 *
 * @param {string} rawText
 * @returns {Object} - Extraction result with deterministic data
 */
function fallbackExtraction(rawText) {
    const parsed = parseReportText(rawText);

    if (parsed.valid) {
        return {
            progressPercent: parsed.data.progressPercent,
            hoursWorked: parsed.data.hoursWorked,
            blockerPresent: !!parsed.data.blocker,
            blockerSummary: parsed.data.blocker || null,
            taskReference: null,
            normalizedSummary: `Avance: ${parsed.data.progressPercent}%, Horas: ${parsed.data.hoursWorked}`,
            confidenceScore: 0.9, // Deterministic = high confidence when it works
            needsConfirmation: false,
            missingFields: [],
        };
    }

    // Parser couldn't extract — return empty with low confidence
    return {
        progressPercent: null,
        hoursWorked: null,
        blockerPresent: false,
        blockerSummary: null,
        taskReference: null,
        normalizedSummary: rawText.substring(0, 200),
        confidenceScore: 0.1,
        needsConfirmation: true,
        missingFields: ["progressPercent", "hoursWorked"],
    };
}

/**
 * Fallback briefing using Phase 2 deterministic templates.
 *
 * @param {string} role - OPERATIONAL_ROLES value
 * @param {Object} data - Available data
 * @returns {string} - HTML-formatted message
 */
function fallbackBriefing(role, data = {}) {
    const name = data.userName || data.name || "Usuario";

    switch (role) {
        case OPERATIONAL_ROLES.TECHNICIAN:
            return templates.morningDigestTechnician({
                name,
                tasks: data.userTasks || [],
                overdueTasks: data.overdueTasks || [],
            });

        case OPERATIONAL_ROLES.ENGINEER:
            return templates.morningDigestEngineer({
                name,
                teamTasks: data.teamTasks || [],
                blockedTasks: data.blockedTasks || [],
                riskCount: data.overdueCount || 0,
            });

        case OPERATIONAL_ROLES.TEAM_LEAD:
        case OPERATIONAL_ROLES.MANAGER:
            return templates.morningDigestManager({
                name,
                totalTasks: data.totalTasks || 0,
                overdueTasks: data.overdueCount || 0,
                blockedTasks: data.blockedCount || 0,
                teamCount: data.teamSize || 0,
            });

        default:
            return `☀️ <b>Buenos días, ${name}</b>\n\nTu briefing está temporalmente no disponible. Consulta con tu administrador.`;
    }
}

/**
 * Fallback incident classification.
 */
function fallbackIncidentClassification(text) {
    const lower = (text || "").toLowerCase();
    const blockerKeywords = ["bloqueado", "bloqueo", "no puedo", "parado", "detenido", "sin material", "falla", "problema"];
    const isBlocker = blockerKeywords.some(k => lower.includes(k));

    return {
        isBlocker,
        summary: text.substring(0, 200),
        suggestedCause: null,
        suggestedSeverity: isBlocker ? "medium" : "low",
        suggestedResponsible: null,
        confidenceScore: isBlocker ? 0.6 : 0.3,
        needsConfirmation: true,
    };
}

module.exports = {
    fallbackExtraction,
    fallbackBriefing,
    fallbackIncidentClassification,
};
