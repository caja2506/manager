/**
 * AI Module — Barrel Export
 * =========================
 */

export { callGeminiInsights, testGeminiConnection } from './geminiService';
export {
    buildAuditAnalysisPrompt,
    buildTeamAnalysisPrompt,
    buildWeeklyBriefPrompt,
    parseGeminiResponse,
} from './insightGenerator';
