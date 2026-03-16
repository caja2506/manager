/**
 * Automation Firestore Paths — Backend (CJS)
 * ============================================
 * Centralized collection path constants for Cloud Functions.
 */

module.exports = {
    // System settings
    SETTINGS: "settings",
    SETTINGS_DOCS: {
        AUTOMATION_CORE: "automationCore",
        TELEGRAM_OPS: "telegramOps",
        AUTOMATION_AI: "automationAI",
    },

    // Generic automation
    AUTOMATION_ROUTINES: "automationRoutines",
    AUTOMATION_RUNS: "automationRuns",
    AUTOMATION_METRICS_DAILY: "automationMetricsDaily",
    OPERATION_INCIDENTS: "operationIncidents",

    // AI layer
    AI_EXECUTIONS: "aiExecutions",

    // Telegram specific
    TELEGRAM_SESSIONS: "telegramSessions",
    TELEGRAM_REPORTS: "telegramReports",
    TELEGRAM_ESCALATIONS: "telegramEscalations",
    TELEGRAM_BOT_LOGS: "telegramBotLogs",
    TELEGRAM_DELIVERIES: "telegramDeliveries",

    // Existing collections (for data integration)
    USERS: "users",
    USERS_ROLES: "users_roles",
    TASKS: "tasks",
    TIME_LOGS: "timeLogs",
    PROJECTS: "projects",
    DELAYS: "delays",

    // Analytics engine (Phase 4)
    OPERATIONAL_KPI_SNAPSHOTS: "operationalKpiSnapshots",
    USER_OPERATIONAL_SCORES: "userOperationalScores",
    ROUTINE_OPERATIONAL_SCORES: "routineOperationalScores",
    TEAM_OPERATIONAL_SUMMARIES: "teamOperationalSummaries",
    OPERATIONAL_RISK_FLAGS: "operationalRiskFlags",
    OPERATIONAL_RECOMMENDATIONS: "operationalRecommendations",
    ANALYTICS_REFRESH_LOGS: "analyticsRefreshLogs",

    // Optimization engine (Phase 5)
    OPTIMIZATION_OPPORTUNITIES: "optimizationOpportunities",
    OPTIMIZATION_SIMULATIONS: "optimizationSimulations",
    OPERATIONAL_PLANS: "operationalPlans",
    APPLIED_RECOMMENDATIONS: "appliedRecommendations",
    OPTIMIZATION_HISTORY: "optimizationHistory",
};
