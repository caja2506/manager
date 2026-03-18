/**
 * Automation Firestore Paths — Backend (CJS)
 * ============================================
 * Centralized collection path constants for Cloud Functions.
 *
 * V5 (O9): Synchronized with schemas.js COLLECTIONS.
 * This is the SINGLE source of truth for collection paths in CFs.
 */

module.exports = {
    // ── System settings ──
    SETTINGS: "settings",
    SETTINGS_DOCS: {
        AUTOMATION_CORE: "automationCore",
        TELEGRAM_OPS: "telegramOps",
        AUTOMATION_AI: "automationAI",
    },

    // ── Core Data ──
    USERS: "users",
    USERS_ROLES: "users_roles",           // @deprecated: migration only — use USERS.rbacRole
    TASKS: "tasks",
    SUBTASKS: "subtasks",
    PROJECTS: "projects",
    TIME_LOGS: "timeLogs",
    DELAYS: "delays",
    DELAY_CAUSES: "delayCauses",
    RISKS: "risks",
    DAILY_REPORTS: "dailyReports",
    NOTIFICATIONS: "notifications",
    TASK_TYPES: "taskTypes",
    TASK_TYPE_CATEGORIES: "taskTypeCategories",

    // ── BOM (legacy naming preserved) ──
    PROYECTOS_BOM: "proyectos_bom",
    CATALOGO_MAESTRO: "catalogo_maestro",
    ITEMS_BOM: "items_bom",
    MARCAS: "marcas",
    CATEGORIAS: "categorias",
    PROVEEDORES: "proveedores",

    // ── Generic Automation ──
    AUTOMATION_ROUTINES: "automationRoutines",
    AUTOMATION_RUNS: "automationRuns",
    AUTOMATION_METRICS_DAILY: "automationMetricsDaily",
    OPERATION_INCIDENTS: "operationIncidents",

    // ── AI Layer ──
    AI_EXECUTIONS: "aiExecutions",

    // ── Telegram ──
    TELEGRAM_SESSIONS: "telegramSessions",
    TELEGRAM_REPORTS: "telegramReports",
    TELEGRAM_ESCALATIONS: "telegramEscalations",
    TELEGRAM_BOT_LOGS: "telegramBotLogs",
    TELEGRAM_DELIVERIES: "telegramDeliveries",
    TELEGRAM_LINK_CODES: "telegramLinkCodes",

    // ── Analytics Engine ──
    OPERATIONAL_KPI_SNAPSHOTS: "operationalKpiSnapshots",
    USER_OPERATIONAL_SCORES: "userOperationalScores",
    ROUTINE_OPERATIONAL_SCORES: "routineOperationalScores",
    TEAM_OPERATIONAL_SUMMARIES: "teamOperationalSummaries",
    OPERATIONAL_RISK_FLAGS: "operationalRiskFlags",
    OPERATIONAL_RECOMMENDATIONS: "operationalRecommendations",
    ANALYTICS_REFRESH_LOGS: "analyticsRefreshLogs",

    // ── Optimization Engine ──
    OPTIMIZATION_OPPORTUNITIES: "optimizationOpportunities",
    OPTIMIZATION_SIMULATIONS: "optimizationSimulations",
    OPERATIONAL_PLANS: "operationalPlans",
    APPLIED_RECOMMENDATIONS: "appliedRecommendations",
    OPTIMIZATION_HISTORY: "optimizationHistory",

    // ── Management Intelligence ──
    AUDIT_FINDINGS: "auditFindings",
    AUDIT_EVENTS: "auditEvents",
    AUDIT_LOGS: "auditLogs",
    ANALYTICS_SNAPSHOTS: "analyticsSnapshots",
    AI_INSIGHTS: "aiInsights",
    MANAGEMENT_BRIEFS: "managementBriefs",

    // ── V5 Foundation ──
    MILESTONES: "milestones",
    WORK_AREAS: "workAreas",
    AUDIT_TRAIL: "auditTrail",
    AI_GOVERNANCE: "aiGovernance",
    SCORE_SNAPSHOTS: "scoreSnapshots",
    RESOURCE_ASSIGNMENTS: "resourceAssignments",
};
