/**
 * Automation Firestore Collection Paths
 * ======================================
 * 
 * Centralized collection path constants for all automation-related
 * Firestore collections. Avoids string duplication across the codebase.
 * 
 * @module automation/firestorePaths
 */

// ============================================================
// GENERIC AUTOMATION COLLECTIONS
// ============================================================

/** System settings documents (stored in existing 'settings' collection) */
export const SETTINGS_COLLECTION = 'settings';
export const SETTINGS_DOCS = {
    AUTOMATION_CORE: 'automationCore',
    TELEGRAM_OPS: 'telegramOps',
    AUTOMATION_AI: 'automationAI',
};

/** Automation routine definitions */
export const AUTOMATION_ROUTINES = 'automationRoutines';

/** Automation run execution records */
export const AUTOMATION_RUNS = 'automationRuns';

/** Daily aggregated automation metrics */
export const AUTOMATION_METRICS_DAILY = 'automationMetricsDaily';

/** Generic operational incidents */
export const OPERATION_INCIDENTS = 'operationIncidents';

/** AI execution audit trail */
export const AI_EXECUTIONS = 'aiExecutions';

// ============================================================
// TELEGRAM-SPECIFIC COLLECTIONS
// ============================================================

/** Telegram conversational sessions per user/chat */
export const TELEGRAM_SESSIONS = 'telegramSessions';

/** Telegram daily progress reports */
export const TELEGRAM_REPORTS = 'telegramReports';

/** Telegram escalation records */
export const TELEGRAM_ESCALATIONS = 'telegramEscalations';

/** Telegram bot operational logs (append-only) */
export const TELEGRAM_BOT_LOGS = 'telegramBotLogs';

/** Telegram message delivery tracking */
export const TELEGRAM_DELIVERIES = 'telegramDeliveries';

// ============================================================
// ANALYTICS ENGINE (Phase 4)
// ============================================================

/** Operational KPI snapshots (global, per-period) */
export const OPERATIONAL_KPI_SNAPSHOTS = 'operationalKpiSnapshots';

/** User-level operational scores */
export const USER_OPERATIONAL_SCORES = 'userOperationalScores';

/** Routine-level operational scores */
export const ROUTINE_OPERATIONAL_SCORES = 'routineOperationalScores';

/** Team/role operational summaries */
export const TEAM_OPERATIONAL_SUMMARIES = 'teamOperationalSummaries';

/** Active risk flags */
export const OPERATIONAL_RISK_FLAGS = 'operationalRiskFlags';

/** Actionable recommendations */
export const OPERATIONAL_RECOMMENDATIONS = 'operationalRecommendations';

/** Analytics refresh audit logs */
export const ANALYTICS_REFRESH_LOGS = 'analyticsRefreshLogs';

// ============================================================
// OPTIMIZATION ENGINE (Phase 5)
// ============================================================

/** Detected optimization opportunities */
export const OPTIMIZATION_OPPORTUNITIES = 'optimizationOpportunities';

/** What-if simulation results */
export const OPTIMIZATION_SIMULATIONS = 'optimizationSimulations';

/** Daily/weekly operational plans */
export const OPERATIONAL_PLANS = 'operationalPlans';

/** Applied recommendation tracking (before/after) */
export const APPLIED_RECOMMENDATIONS = 'appliedRecommendations';

/** Optimization audit trail */
export const OPTIMIZATION_HISTORY = 'optimizationHistory';

// ============================================================
// ALL AUTOMATION PATHS (for iteration/validation)
// ============================================================

export const ALL_AUTOMATION_COLLECTIONS = [
    AUTOMATION_ROUTINES,
    AUTOMATION_RUNS,
    AUTOMATION_METRICS_DAILY,
    OPERATION_INCIDENTS,
    AI_EXECUTIONS,
    TELEGRAM_SESSIONS,
    TELEGRAM_REPORTS,
    TELEGRAM_ESCALATIONS,
    TELEGRAM_BOT_LOGS,
    TELEGRAM_DELIVERIES,
    OPERATIONAL_KPI_SNAPSHOTS,
    USER_OPERATIONAL_SCORES,
    ROUTINE_OPERATIONAL_SCORES,
    TEAM_OPERATIONAL_SUMMARIES,
    OPERATIONAL_RISK_FLAGS,
    OPERATIONAL_RECOMMENDATIONS,
    ANALYTICS_REFRESH_LOGS,
    OPTIMIZATION_OPPORTUNITIES,
    OPTIMIZATION_SIMULATIONS,
    OPERATIONAL_PLANS,
    APPLIED_RECOMMENDATIONS,
    OPTIMIZATION_HISTORY,
];

