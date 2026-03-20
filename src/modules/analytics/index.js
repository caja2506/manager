/**
 * Analytics Domain Module
 * =======================
 * [Phase M.3] Ownership barrel for engineering analytics,
 * audit findings, and AI monitoring.
 *
 * Surfaces: analytics data hook, risk scoring,
 *           compliance scoring, and audit logic.
 */

// --- Data Hooks ---
export { useEngineeringData } from '../../hooks/useEngineeringData';
export { useAnalyticsData } from '../../hooks/useAnalyticsData';
export { useAuditData } from '../../hooks/useAuditData';
export { useGeminiInsights } from '../../hooks/useGeminiInsights';

// --- Services ---
export { calculateProjectRisk } from '../../services/riskService';

// --- Core ---
export { computeAreaScore, explainScore } from '../../core/scoring/scoreEngine';
