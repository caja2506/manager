/**
 * Common Domain — Collections & Shared Constants
 * ===============================================
 * [Phase M.4] Shared collection constants used across all domains.
 * This is the ONLY cross-domain file. Everything else lives in its domain.
 */

// ============================================================
// COLLECTION NAME CONSTANTS
// ============================================================

export const COLLECTIONS = {
    // ── BOM Module (@classification: core, legacy naming preserved) ──
    USERS_ROLES: 'users_roles',
    PROYECTOS_BOM: 'proyectos_bom',
    CATALOGO_MAESTRO: 'catalogo_maestro',
    ITEMS_BOM: 'items_bom',
    MARCAS: 'marcas',
    CATEGORIAS: 'categorias',
    PROVEEDORES: 'proveedores',

    // ── Core Engineering Data (@classification: core) ──
    USERS: 'users',
    PROJECTS: 'projects',
    TASKS: 'tasks',
    SUBTASKS: 'subtasks',
    TIME_LOGS: 'timeLogs',
    DELAY_CAUSES: 'delayCauses',
    DELAYS: 'delays',
    RISKS: 'risks',
    DAILY_REPORTS: 'dailyReports',
    NOTIFICATIONS: 'notifications',
    TASK_TYPES: 'taskTypes',
    WORK_AREA_TYPES: 'workAreaTypes',
    MILESTONE_TYPES: 'milestoneTypes',
    SETTINGS: 'settings',
    WEEKLY_PLAN_ITEMS: 'weeklyPlanItems',
    TASK_DEPENDENCIES: 'taskDependencies',
    TASK_TYPE_CATEGORIES: 'taskTypeCategories',

    // ── Management Intelligence (@classification: derived) ──
    AUDIT_FINDINGS: 'auditFindings',
    AUDIT_EVENTS: 'auditEvents',
    AUDIT_LOGS: 'auditLogs',
    ANALYTICS_SNAPSHOTS: 'analyticsSnapshots',
    AI_INSIGHTS: 'aiInsights',
    MANAGEMENT_BRIEFS: 'managementBriefs',

    // ── Automation Operations (@classification: core) ──
    AUTOMATION_ROUTINES: 'automationRoutines',
    AUTOMATION_RUNS: 'automationRuns',
    AUTOMATION_METRICS_DAILY: 'automationMetricsDaily',
    OPERATION_INCIDENTS: 'operationIncidents',
    TELEGRAM_SESSIONS: 'telegramSessions',
    TELEGRAM_REPORTS: 'telegramReports',
    TELEGRAM_ESCALATIONS: 'telegramEscalations',
    TELEGRAM_BOT_LOGS: 'telegramBotLogs',
    TELEGRAM_DELIVERIES: 'telegramDeliveries',
    TELEGRAM_LINK_CODES: 'telegramLinkCodes',

    // ── Analytics Engine (@classification: derived) ──
    OPERATIONAL_KPI_SNAPSHOTS: 'operationalKpiSnapshots',
    USER_OPERATIONAL_SCORES: 'userOperationalScores',
    ROUTINE_OPERATIONAL_SCORES: 'routineOperationalScores',
    TEAM_OPERATIONAL_SUMMARIES: 'teamOperationalSummaries',
    OPERATIONAL_RISK_FLAGS: 'operationalRiskFlags',
    OPERATIONAL_RECOMMENDATIONS: 'operationalRecommendations',
    ANALYTICS_REFRESH_LOGS: 'analyticsRefreshLogs',
    AI_EXECUTIONS: 'aiExecutions',

    // ── Optimization Engine (@classification: derived) ──
    OPTIMIZATION_OPPORTUNITIES: 'optimizationOpportunities',
    OPTIMIZATION_SIMULATIONS: 'optimizationSimulations',
    OPERATIONAL_PLANS: 'operationalPlans',
    APPLIED_RECOMMENDATIONS: 'appliedRecommendations',
    OPTIMIZATION_HISTORY: 'optimizationHistory',

    // ── Station Management (@classification: core) ──
    // Subcollection: projects/{projectId}/stations
    PROJECT_STATIONS: 'stations',

    // ── V5 Foundation (@classification: core) ──
    MILESTONES: 'milestones',
    WORK_AREAS: 'workAreas',
    AUDIT_TRAIL: 'auditTrail',
    AI_GOVERNANCE: 'aiGovernance',
    SCORE_SNAPSHOTS: 'scoreSnapshots',
    RESOURCE_ASSIGNMENTS: 'resourceAssignments',
    DAILY_SCORE_LOGS: 'dailyScoreLogs',
};


// ============================================================
// LEGACY FIELDS REGISTRY
// ============================================================

export const LEGACY_FIELDS = {
    users: [
        { field: 'operationalRole', replacement: 'teamRole', retirePhase: 'M8' },
        { field: 'isAutomationParticipant', replacement: 'automation.isParticipant', retirePhase: 'M8' },
        { field: 'telegramChatId', replacement: 'channels.telegram.chatId', retirePhase: 'M8' },
        { field: 'name', replacement: 'displayName', retirePhase: 'M8' },
        { field: 'providerLinks', replacement: 'channels', retirePhase: 'M9' },
        { field: 'role', replacement: 'rbacRole', retirePhase: 'M8' },
    ],
    weeklyPlanItems: [
        { field: 'taskTitleSnapshot', replacement: 'enrichment via tasks collection', retirePhase: 'M9' },
        { field: 'projectNameSnapshot', replacement: 'enrichment via projects collection', retirePhase: 'M9' },
        { field: 'assignedToName', replacement: 'enrichment via users collection', retirePhase: 'M9' },
        { field: 'statusSnapshot', replacement: 'enrichment via tasks collection', retirePhase: 'M9' },
        { field: 'colorKey', replacement: 'enrichment via task type config', retirePhase: 'M9' },
    ],
    collections: [
        { field: 'users_roles', replacement: 'users (with rbacRole)', retirePhase: 'M8', action: 'freeze' },
        { field: 'auditEvents', replacement: 'auditTrail', retirePhase: 'M10', action: 'migrate' },
        { field: 'auditLogs', replacement: 'auditTrail', retirePhase: 'M10', action: 'migrate' },
    ],
};


// ============================================================
// DEFAULT SYSTEM SETTINGS
// ============================================================

export const DEFAULT_SETTINGS = [
    {
        key: 'risk_weights',
        value: { delayedTaskWeight: 20, overtimeHoursWeight: 2, activeDelaysWeight: 15, tasksInValidationWeight: 10, ownerOverloadedBonus: 15 },
        description: 'Pesos para la fórmula de cálculo de riesgo de proyecto',
        category: 'risk',
    },
    {
        key: 'overtime_threshold_weekly',
        value: 10,
        description: 'Umbral de horas extras semanales para generar alertas',
        category: 'time_tracking',
    },
    {
        key: 'work_hours_per_day',
        value: 8,
        description: 'Horas laborales estándar por día',
        category: 'time_tracking',
    },
    {
        key: 'work_days_per_week',
        value: 5,
        description: 'Días laborales por semana',
        category: 'time_tracking',
    },
    {
        key: 'daily_report_auto_generate',
        value: true,
        description: 'Generar reportes diarios automáticamente',
        category: 'reports',
    },
];

export function createSettingDocument({
    key = '',
    value = null,
    description = '',
    category = 'general',
} = {}) {
    return {
        key, value, description, category,
        updatedAt: new Date().toISOString(),
        updatedBy: null,
    };
}
