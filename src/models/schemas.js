/**
 * Firestore Collection Schemas — V5 Foundation
 * =============================================
 * 
 * This file defines the data model for all Firestore collections
 * used by the Engineering Management Platform.
 * 
 * V5 ENTITY CONTRACT:
 * Every new entity MUST include: createdAt, createdBy, updatedAt, updatedBy.
 * Timestamps are always ISO-8601 strings.
 * References are string IDs with pattern {entityName}Id.
 * 
 * Each schema exports:
 * - COLLECTION_NAME: string constant for the collection path
 * - Field definitions with types and descriptions
 * - createDocument(): factory function for new documents
 * - STATUS constants where applicable
 * 
 * IMPORTANT: These are reference schemas. Firestore is schema-less,
 * but these definitions ensure consistency across the codebase.
 */

// ============================================================
// COLLECTION NAME CONSTANTS
// ============================================================

export const COLLECTIONS = {
    // ── BOM Module (@classification: core, legacy naming preserved) ──
    USERS_ROLES: 'users_roles',         // @deprecated @transitional — freeze after M8
    PROYECTOS_BOM: 'proyectos_bom',     // @classification: core
    CATALOGO_MAESTRO: 'catalogo_maestro', // @classification: core
    ITEMS_BOM: 'items_bom',             // @classification: core
    MARCAS: 'marcas',                   // @classification: core
    CATEGORIAS: 'categorias',           // @classification: core
    PROVEEDORES: 'proveedores',         // @classification: core

    // ── Core Engineering Data (@classification: core) ──
    USERS: 'users',                     // @classification: core — SINGLE user SoT
    PROJECTS: 'projects',               // @classification: core
    TASKS: 'tasks',                     // @classification: core
    SUBTASKS: 'subtasks',               // @classification: core
    TIME_LOGS: 'timeLogs',              // @classification: core
    DELAY_CAUSES: 'delayCauses',        // @classification: core (catalog)
    DELAYS: 'delays',                   // @classification: core
    RISKS: 'risks',                     // @classification: core
    DAILY_REPORTS: 'dailyReports',      // @classification: core
    NOTIFICATIONS: 'notifications',     // @classification: core
    TASK_TYPES: 'taskTypes',            // @classification: core (catalog)
    WORK_AREA_TYPES: 'workAreaTypes',   // @classification: core (catalog) — global catalog of work area names
    MILESTONE_TYPES: 'milestoneTypes',   // @classification: core (catalog) — dynamic milestone types
    SETTINGS: 'settings',              // @classification: config
    WEEKLY_PLAN_ITEMS: 'weeklyPlanItems', // @classification: core (snapshot fields @transitional)
    TASK_DEPENDENCIES: 'taskDependencies', // @classification: core
    TASK_TYPE_CATEGORIES: 'taskTypeCategories', // @classification: core (catalog)

    // ── Management Intelligence (@classification: derived) ──
    AUDIT_FINDINGS: 'auditFindings',    // @classification: derived
    AUDIT_EVENTS: 'auditEvents',        // @classification: derived — migrate to AUDIT_TRAIL
    AUDIT_LOGS: 'auditLogs',            // @deprecated — alias for AUDIT_EVENTS
    ANALYTICS_SNAPSHOTS: 'analyticsSnapshots', // @classification: derived
    AI_INSIGHTS: 'aiInsights',          // @classification: derived
    MANAGEMENT_BRIEFS: 'managementBriefs', // @classification: derived

    // ── Automation Operations (@classification: core) ──
    AUTOMATION_ROUTINES: 'automationRoutines', // @classification: config
    AUTOMATION_RUNS: 'automationRuns',         // @classification: log
    AUTOMATION_METRICS_DAILY: 'automationMetricsDaily', // @classification: derived
    OPERATION_INCIDENTS: 'operationIncidents', // @classification: log
    TELEGRAM_SESSIONS: 'telegramSessions',     // @classification: core
    TELEGRAM_REPORTS: 'telegramReports',       // @classification: log
    TELEGRAM_ESCALATIONS: 'telegramEscalations', // @classification: log
    TELEGRAM_BOT_LOGS: 'telegramBotLogs',      // @classification: log
    TELEGRAM_DELIVERIES: 'telegramDeliveries', // @classification: log
    TELEGRAM_LINK_CODES: 'telegramLinkCodes',  // @classification: transitional

    // ── Analytics Engine (@classification: derived) ──
    OPERATIONAL_KPI_SNAPSHOTS: 'operationalKpiSnapshots', // @classification: derived
    USER_OPERATIONAL_SCORES: 'userOperationalScores',     // @classification: derived
    ROUTINE_OPERATIONAL_SCORES: 'routineOperationalScores', // @classification: derived
    TEAM_OPERATIONAL_SUMMARIES: 'teamOperationalSummaries', // @classification: derived
    OPERATIONAL_RISK_FLAGS: 'operationalRiskFlags',       // @classification: derived
    OPERATIONAL_RECOMMENDATIONS: 'operationalRecommendations', // @classification: derived
    ANALYTICS_REFRESH_LOGS: 'analyticsRefreshLogs',       // @classification: log
    AI_EXECUTIONS: 'aiExecutions',                        // @classification: log

    // ── Optimization Engine (@classification: derived) ──
    OPTIMIZATION_OPPORTUNITIES: 'optimizationOpportunities', // @classification: derived
    OPTIMIZATION_SIMULATIONS: 'optimizationSimulations',     // @classification: log
    OPERATIONAL_PLANS: 'operationalPlans',                   // @classification: derived
    APPLIED_RECOMMENDATIONS: 'appliedRecommendations',       // @classification: log
    OPTIMIZATION_HISTORY: 'optimizationHistory',             // @classification: log

    // ── V5 Foundation (@classification: core) ──
    MILESTONES: 'milestones',           // @classification: core
    WORK_AREAS: 'workAreas',            // @classification: core
    AUDIT_TRAIL: 'auditTrail',          // @classification: core (append-only, immutable)
    AI_GOVERNANCE: 'aiGovernance',      // @classification: config
    SCORE_SNAPSHOTS: 'scoreSnapshots',  // @classification: derived (V5: score history)
};


// ============================================================
// ENUM CONSTANTS
// ============================================================

/**
 * Engineering team roles (new system)
 * Coexist alongside existing RBAC roles (admin, editor, viewer)
 */
export const TEAM_ROLES = {
    MANAGER: 'manager',
    TEAM_LEAD: 'team_lead',
    ENGINEER: 'engineer',
    TECHNICIAN: 'technician',
};

/**
 * Existing RBAC roles (preserved)
 */
export const RBAC_ROLES = {
    ADMIN: 'admin',
    EDITOR: 'editor',
    VIEWER: 'viewer',
};

/**
 * Task workflow statuses
 */
export const TASK_STATUS = {
    BACKLOG: 'backlog',
    PENDING: 'pending',
    IN_PROGRESS: 'in_progress',
    VALIDATION: 'validation',
    COMPLETED: 'completed',
    BLOCKED: 'blocked',
    CANCELLED: 'cancelled',
};

/**
 * Task status display configuration
 */
export const TASK_STATUS_CONFIG = {
    [TASK_STATUS.BACKLOG]: {
        label: 'Backlog',
        color: '#64748b',
        icon: 'Inbox',
        order: 0,
    },
    [TASK_STATUS.PENDING]: {
        label: 'Pendiente',
        color: '#ef4444',
        icon: 'Clock',
        order: 1,
    },
    [TASK_STATUS.IN_PROGRESS]: {
        label: 'En Progreso',
        color: '#f59e0b',
        icon: 'Play',
        order: 2,
    },
    [TASK_STATUS.VALIDATION]: {
        label: 'Validación',
        color: '#8b5cf6',
        icon: 'CheckCircle',
        order: 3,
    },
    [TASK_STATUS.COMPLETED]: {
        label: 'Completado',
        color: '#22c55e',
        icon: 'CheckCheck',
        order: 4,
    },
    [TASK_STATUS.BLOCKED]: {
        label: 'Bloqueado',
        color: '#ef4444',
        icon: 'Ban',
        order: 5,
    },
    [TASK_STATUS.CANCELLED]: {
        label: 'Cancelado',
        color: '#6b7280',
        icon: 'XCircle',
        order: 6,
    },
};

/**
 * Task priority levels
 */
export const TASK_PRIORITY = {
    LOW: 'low',
    MEDIUM: 'medium',
    HIGH: 'high',
    CRITICAL: 'critical',
};

export const TASK_PRIORITY_CONFIG = {
    [TASK_PRIORITY.LOW]: {
        label: 'Baja',
        color: 'slate',
        order: 0,
    },
    [TASK_PRIORITY.MEDIUM]: {
        label: 'Media',
        color: 'blue',
        order: 1,
    },
    [TASK_PRIORITY.HIGH]: {
        label: 'Alta',
        color: 'amber',
        order: 2,
    },
    [TASK_PRIORITY.CRITICAL]: {
        label: 'Crítica',
        color: 'red',
        order: 3,
    },
};

/**
 * Project statuses
 */
export const PROJECT_STATUS = {
    PLANNING: 'planning',
    ACTIVE: 'active',
    ON_HOLD: 'on_hold',
    COMPLETED: 'completed',
    CANCELLED: 'cancelled',
};

export const PROJECT_STATUS_CONFIG = {
    [PROJECT_STATUS.PLANNING]: {
        label: 'Planificación',
        color: 'blue',
        order: 0,
    },
    [PROJECT_STATUS.ACTIVE]: {
        label: 'Activo',
        color: 'green',
        order: 1,
    },
    [PROJECT_STATUS.ON_HOLD]: {
        label: 'En Pausa',
        color: 'amber',
        order: 2,
    },
    [PROJECT_STATUS.COMPLETED]: {
        label: 'Completado',
        color: 'slate',
        order: 3,
    },
    [PROJECT_STATUS.CANCELLED]: {
        label: 'Cancelado',
        color: 'gray',
        order: 4,
    },
};

/**
 * Risk levels
 */
export const RISK_LEVEL = {
    LOW: 'low',
    MEDIUM: 'medium',
    HIGH: 'high',
};

export const RISK_LEVEL_CONFIG = {
    [RISK_LEVEL.LOW]: {
        label: 'Bajo',
        color: 'green',
        minScore: 0,
        maxScore: 29,
        icon: 'Shield',
    },
    [RISK_LEVEL.MEDIUM]: {
        label: 'Medio',
        color: 'amber',
        minScore: 30,
        maxScore: 59,
        icon: 'AlertTriangle',
    },
    [RISK_LEVEL.HIGH]: {
        label: 'Alto',
        color: 'red',
        minScore: 60,
        maxScore: Infinity,
        icon: 'AlertOctagon',
    },
};

/**
 * Notification types
 */
export const NOTIFICATION_TYPE = {
    TASK_ASSIGNED: 'task_assigned',
    TASK_STATUS_CHANGED: 'task_status_changed',
    TASK_BLOCKED: 'task_blocked',
    DELAY_REPORTED: 'delay_reported',
    RISK_ALERT: 'risk_alert',
    OVERTIME_ALERT: 'overtime_alert',
    REPORT_GENERATED: 'report_generated',
    SYSTEM: 'system',
};

/**
 * Audit finding severity levels
 */
export const AUDIT_FINDING_SEVERITY = {
    INFO: 'info',
    WARNING: 'warning',
    CRITICAL: 'critical',
};

export const AUDIT_FINDING_SEVERITY_CONFIG = {
    [AUDIT_FINDING_SEVERITY.INFO]: {
        label: 'Información',
        color: 'blue',
        icon: 'Info',
        order: 0,
    },
    [AUDIT_FINDING_SEVERITY.WARNING]: {
        label: 'Advertencia',
        color: 'amber',
        icon: 'AlertTriangle',
        order: 1,
    },
    [AUDIT_FINDING_SEVERITY.CRITICAL]: {
        label: 'Crítico',
        color: 'red',
        icon: 'AlertOctagon',
        order: 2,
    },
};

/**
 * Audit finding statuses
 */
export const AUDIT_FINDING_STATUS = {
    OPEN: 'open',
    RESOLVED: 'resolved',
    DISMISSED: 'dismissed',
};

/**
 * Analytics snapshot scopes
 */
export const ANALYTICS_SCOPE = {
    DEPARTMENT: 'department',
    PROJECT: 'project',
    USER: 'user',
};

/**
 * AI Insight types
 */
export const AI_INSIGHT_TYPE = {
    TEAM_OVERLOAD: 'team_overload_report',
    ESTIMATION_DRIFT: 'estimation_drift',
    BOTTLENECK_ANALYSIS: 'bottleneck_analysis',
    RISK_ASSESSMENT: 'risk_assessment',
    WEEKLY_SUMMARY: 'weekly_summary',
};

// ── V5 Foundation Enums ──

/**
 * Milestone statuses
 */
export const MILESTONE_STATUS = {
    PLANNING: 'planning',
    ACTIVE: 'active',
    COMPLETED: 'completed',
    ON_HOLD: 'on_hold',
};

/**
 * Milestone types
 */
export const MILESTONE_TYPE = {
    SETUP: 'setup',
    COMMISSIONING: 'commissioning',
    VALIDATION: 'validation',
    CUSTOM: 'custom',
};

/**
 * Traffic light values + score locks (anti-false-greens)
 */
export const TRAFFIC_LIGHT = {
    GREEN: 'green',
    YELLOW: 'yellow',
    RED: 'red',
};

/**
 * Score lock reasons — conditions that override computed traffic light
 */
export const SCORE_LOCK_REASON = {
    CRITICAL_OVERDUE: 'critical_task_overdue_3d',        // → Lock RED
    UNRESOLVED_BLOCKER_48H: 'unresolved_blocker_48h',    // → Lock YELLOW min
    STALE_AREA_5D: 'stale_area_no_update_5d',            // → Lock YELLOW min
    UNOWNED_CRITICAL: 'unowned_critical_tasks',          // → Lock RED
};

/**
 * Audit trail event types (V5)
 */
export const AUDIT_TRAIL_EVENT_TYPE = {
    TASK_TRANSITION: 'task_transition',
    ENTITY_CHANGE: 'entity_change',
    OVERRIDE: 'override',
    AI_ACTION: 'ai_action',
    ADMIN_ACTION: 'admin_action',
};

export const AUDIT_TRAIL_ACTOR_TYPE = {
    USER: 'user',
    SYSTEM: 'system',
    AI: 'ai',
    AUTOMATION: 'automation',
};

/**
 * AI Governance capability types
 */
export const AI_GOVERNANCE_TYPE = {
    RECOMMENDER: 'recommender',
    EXECUTOR_CONTROLLED: 'executor_controlled',
    EXECUTOR_AUTONOMOUS: 'executor_autonomous',
};

// ── Phase 2E: Catalog Enums ──

/**
 * Work area types — configurable per project
 */
export const WORK_AREA_TYPE = {
    ENGINEERING: 'engineering',
    PROCUREMENT: 'procurement',
    COMMISSIONING: 'commissioning',
    DOCUMENTATION: 'documentation',
    QUALITY: 'quality',
    CUSTOM: 'custom',
};

export const WORK_AREA_TYPE_CONFIG = {
    [WORK_AREA_TYPE.ENGINEERING]: { label: 'Ingeniería', icon: 'Wrench', color: '#3b82f6' },
    [WORK_AREA_TYPE.PROCUREMENT]: { label: 'Procura', icon: 'ShoppingCart', color: '#f59e0b' },
    [WORK_AREA_TYPE.COMMISSIONING]: { label: 'Comisionamiento', icon: 'Zap', color: '#ef4444' },
    [WORK_AREA_TYPE.DOCUMENTATION]: { label: 'Documentación', icon: 'FileText', color: '#8b5cf6' },
    [WORK_AREA_TYPE.QUALITY]: { label: 'Calidad', icon: 'Shield', color: '#22c55e' },
    [WORK_AREA_TYPE.CUSTOM]: { label: 'Personalizada', icon: 'Settings', color: '#6b7280' },
};

/**
 * Override reason types — required when manually overriding traffic lights
 */
export const OVERRIDE_REASON_TYPE = {
    MANAGEMENT_DECISION: 'management_decision',
    EXTERNAL_DEPENDENCY: 'external_dependency',
    CLIENT_CHANGE: 'client_change',
    EMERGENCY: 'emergency',
    AWAITING_INFO: 'awaiting_info',
    OTHER: 'other',
};

export const OVERRIDE_REASON_TYPE_CONFIG = {
    [OVERRIDE_REASON_TYPE.MANAGEMENT_DECISION]: { label: 'Decisión gerencial' },
    [OVERRIDE_REASON_TYPE.EXTERNAL_DEPENDENCY]: { label: 'Dependencia externa' },
    [OVERRIDE_REASON_TYPE.CLIENT_CHANGE]: { label: 'Cambio del cliente' },
    [OVERRIDE_REASON_TYPE.EMERGENCY]: { label: 'Emergencia' },
    [OVERRIDE_REASON_TYPE.AWAITING_INFO]: { label: 'En espera de información' },
    [OVERRIDE_REASON_TYPE.OTHER]: { label: 'Otro' },
};

/**
 * Delay cause types — structured categories for delays
 */
export const DELAY_CAUSE_TYPE = {
    RESOURCE: 'resource',
    TECHNICAL: 'technical',
    EXTERNAL: 'external',
    PLANNING: 'planning',
    APPROVAL: 'approval',
    SUPPLIER: 'supplier',
    OTHER: 'other',
};

export const DELAY_CAUSE_TYPE_CONFIG = {
    [DELAY_CAUSE_TYPE.RESOURCE]: { label: 'Recurso', icon: 'Users', color: '#3b82f6' },
    [DELAY_CAUSE_TYPE.TECHNICAL]: { label: 'Técnico', icon: 'Wrench', color: '#f59e0b' },
    [DELAY_CAUSE_TYPE.EXTERNAL]: { label: 'Externo', icon: 'Globe', color: '#ef4444' },
    [DELAY_CAUSE_TYPE.PLANNING]: { label: 'Planificación', icon: 'Calendar', color: '#8b5cf6' },
    [DELAY_CAUSE_TYPE.APPROVAL]: { label: 'Aprobación', icon: 'CheckCircle', color: '#22c55e' },
    [DELAY_CAUSE_TYPE.SUPPLIER]: { label: 'Proveedor', icon: 'Truck', color: '#6366f1' },
    [DELAY_CAUSE_TYPE.OTHER]: { label: 'Otro', icon: 'HelpCircle', color: '#6b7280' },
};

/**
 * Risk types — structured risk categories
 */
export const RISK_TYPE = {
    SCHEDULE: 'schedule',
    RESOURCE: 'resource',
    TECHNICAL: 'technical',
    EXTERNAL: 'external',
    QUALITY: 'quality',
    SCOPE: 'scope',
};

export const RISK_TYPE_CONFIG = {
    [RISK_TYPE.SCHEDULE]: { label: 'Cronograma', color: '#ef4444' },
    [RISK_TYPE.RESOURCE]: { label: 'Recurso', color: '#f59e0b' },
    [RISK_TYPE.TECHNICAL]: { label: 'Técnico', color: '#3b82f6' },
    [RISK_TYPE.EXTERNAL]: { label: 'Externo', color: '#8b5cf6' },
    [RISK_TYPE.QUALITY]: { label: 'Calidad', color: '#22c55e' },
    [RISK_TYPE.SCOPE]: { label: 'Alcance', color: '#6366f1' },
};

/**
 * AI event types — what kind of AI action was performed
 */
export const AI_EVENT_TYPE = {
    BRIEFING: 'briefing',
    EXTRACTION: 'extraction',
    RECOMMENDATION: 'recommendation',
    ESCALATION_HINT: 'escalation_hint',
    TRANSCRIPTION: 'transcription',
    ANALYSIS: 'analysis',
};


// ============================================================
// LEGACY FIELDS REGISTRY (Phase 2D)
// ============================================================

/**
 * Documents every legacy field with its replacement and retirement phase.
 * Used by migration utilities to verify transition progress.
 */
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
// DOCUMENT FACTORY FUNCTIONS
// ============================================================

/**
 * Users Collection — V5 SINGLE SOURCE OF TRUTH
 * =============================================
 * Consolidated user identity for the entire platform.
 * `users_roles` is maintained as read-only backup during migration.
 *
 * V5 changes:
 *  - `rbacRole` replaces synced `role` field (source of truth for RBAC)
 *  - `displayName` replaces inconsistent `name` field
 *  - `operationalRole` removed (redundant with `teamRole`)
 *  - `channels` embeds provider connections (Telegram, etc.)
 *  - `automation` embeds automation settings
 *
 * Document ID: Firebase Auth UID
 */
export function createUserDocument({
    displayName = '',
    email = '',
    photoURL = '',
    // ── Access Control ──
    rbacRole = RBAC_ROLES.VIEWER,   // V5: Source of truth for RBAC
    role = RBAC_ROLES.VIEWER,       // @deprecated — kept for backward compat, use rbacRole
    teamRole = null,                // Engineering role (manager/team_lead/engineer/technician)
    // ── Operational Profile ──
    department = 'Engineering',
    weeklyCapacityHours = 40,
    active = true,
    reportsTo = null,               // UID of direct supervisor
    // ── Channels (embedded) ──
    channels = {
        telegram: { chatId: null, linkedAt: null, active: false },
    },
    // ── Automation (embedded) ──
    automation = {
        isParticipant: false,
        shift: null,                // 'morning' | 'afternoon' | null
        schedule: { start: '08:00', end: '17:00' },
    },
    // ── V5 Metadata ──
    createdBy = 'system',
    // --- @deprecated fields — kept for backward compat ---
    name = '',                      // @deprecated: use displayName
    operationalRole = null,         // @deprecated: use teamRole
    providerLinks = {},             // @deprecated: use channels
    isAutomationParticipant = false, // @deprecated: use automation.isParticipant
    escalationTargetUserId = null,  // @deprecated
    activeShift = null,             // @deprecated: use automation.shift
    workSchedule = null,            // @deprecated: use automation.schedule
} = {}) {
    const now = new Date().toISOString();
    return {
        // V5 canonical fields
        displayName: displayName || name,
        email,
        photoURL,
        rbacRole,
        role: rbacRole,             // Backward compat alias
        teamRole,
        department,
        weeklyCapacityHours,
        active,
        reportsTo,
        channels,
        automation,
        // @deprecated fields (backward compat)
        name: displayName || name,
        operationalRole,
        providerLinks,
        isAutomationParticipant: isAutomationParticipant || automation.isParticipant,
        escalationTargetUserId,
        activeShift: activeShift || automation.shift,
        workSchedule: workSchedule || automation.schedule,
        // V5 Metadata
        createdBy,
        updatedBy: createdBy,
        createdAt: now,
        updatedAt: now,
    };
}

/**
 * Projects Collection (Engineering Projects)
 * Extends the concept from proyectos_bom with engineering management fields.
 * The existing proyectos_bom collection is preserved for BOM-specific data.
 *
 * Document ID: auto-generated
 */
export function createProjectDocument({
    name = '',
    description = '',
    client = '',
    priority = TASK_PRIORITY.MEDIUM,
    status = PROJECT_STATUS.PLANNING,
    ownerId = null,                 // Reference to user UID
    teamMemberIds = [],             // Array of user UIDs assigned to this project
    startDate = null,               // ISO string
    dueDate = null,                 // ISO string
    completedDate = null,           // ISO string — set when completed
    progress = 0,                   // 0-100
    bomProjectId = null,            // Optional link to existing proyectos_bom document
    tags = [],                      // Free-form tags
} = {}) {
    return {
        name,
        description,
        client,
        priority,
        status,
        ownerId,
        teamMemberIds,
        startDate,
        dueDate,
        completedDate,
        progress,
        bomProjectId,
        tags,
        // Risk fields — updated by risk calculation engine
        riskScore: 0,
        riskLevel: RISK_LEVEL.LOW,
        riskFactors: [],
        riskSummary: '',
        riskUpdatedAt: null,
        // Metadata
        createdBy: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    };
}

/**
 * Tasks Collection — OFFICIAL FIELD CONTRACT
 * ===========================================
 *
 * IMPORTANT: All code reading/writing task documents MUST use these field names.
 * Legacy documents may use deprecated aliases — use taskNormalizer.js at read-time.
 *
 * OFFICIAL FIELDS:
 *   status:         'backlog' | 'pending' | 'in_progress' | 'blocked' | 'validation' | 'completed' | 'cancelled'
 *   completedDate:  ISO string | null    ← NOT "completedAt" (deprecated alias)
 *   blockedReason:  string               ← NOT "blockReason" (deprecated typo)
 *   reopenedAt:     ISO string | null     (set by CF on reopen)
 *   reopenedBy:     string (uid) | null   (set by CF on reopen)
 *   updatedAt:      ISO string            (set by CF on transitions, serverTimestamp on edits)
 *   updatedBy:      string (uid) | null   (set by CF on transitions)
 *
 * STATUS ALIASES (DB value → Display):
 *   'pending'    → "Planificado"   (WORKFLOW_STATUS.PLANNED)
 *   'validation' → "En Revisión"   (WORKFLOW_STATUS.REVIEW)
 *
 * See: src/utils/taskNormalizer.js for legacy document normalization.
 * See: src/core/workflow/workflowModel.js for the official state machine.
 *
 * Document ID: auto-generated
 */
export function createTaskDocument({
    projectId = null,               // Reference to projects document
    subprojectId = null,            // Reference to subproject (optional)
    title = '',
    description = '',
    status = TASK_STATUS.BACKLOG,
    priority = TASK_PRIORITY.MEDIUM,
    taskTypeId = null,              // Reference to taskTypes document
    // ── V5 Milestone/Area linkage ──
    milestoneId = null,             // Reference to milestones document
    areaId = null,                  // Reference to workAreas document (AUTO-SET via mapping)
    countsForScore = false,         // true when milestoneId is set
    assignedBy = null,              // Creator / Assigner of the task
    assignedTo = null,              // Who must complete this task
    estimatedHours = 0,
    actualHours = 0,                // Calculated from timeLogs
    dueDate = null,                 // ISO string
    completedDate = null,           // ISO string
    blockedReason = '',             // If status === 'blocked'
    tags = [],
    order = 0,                      // Kanban column order
    // --- Gantt fields ---
    showInGantt = false,            // Whether this task appears in Gantt view
    plannedStartDate = null,        // ISO string — Gantt start
    plannedEndDate = null,          // ISO string — Gantt end
    plannedDurationHours = 0,       // Planned duration in hours
    percentComplete = 0,            // 0–100 progress percentage
    milestone = false,              // If true, renders as diamond ◆
    summaryTask = false,            // If true, renders as collapsed header bar
    parentTaskId = null,            // For WBS hierarchy
    ganttViewModeDefault = null,    // 'weekly' | 'monthly' | null
} = {}) {
    return {
        projectId,
        subprojectId,
        title,
        description,
        status,
        priority,
        taskTypeId,
        // V5 Milestone/Area
        milestoneId,
        areaId,
        countsForScore: milestoneId ? true : countsForScore,
        assignedBy,
        assignedTo,
        estimatedHours,
        actualHours,
        dueDate,
        completedDate,
        blockedReason,
        tags,
        order,
        // Gantt
        showInGantt,
        plannedStartDate,
        plannedEndDate,
        plannedDurationHours,
        percentComplete,
        milestone,
        summaryTask,
        parentTaskId,
        ganttViewModeDefault,
        createdBy: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    };
}

/**
 * Subtasks Collection
 *
 * Document ID: auto-generated
 */
export function createSubtaskDocument({
    taskId = null,                  // Reference to tasks document
    title = '',
    completed = false,
    order = 0,
    createdBy = null,
} = {}) {
    const now = new Date().toISOString();
    return {
        taskId,
        title,
        completed,
        order,
        createdBy,
        updatedBy: createdBy,
        createdAt: now,
        updatedAt: now,
    };
}

/**
 * TimeLogs Collection
 * Individual time tracking entries. Each user tracks independently.
 *
 * Document ID: auto-generated
 */
export function createTimeLogDocument({
    taskId = null,                  // Reference to tasks document
    projectId = null,               // Reference to projects document (denormalized)
    userId = null,                  // Auth UID
    startTime = null,               // ISO string
    endTime = null,                 // ISO string (null while timer running)
    totalHours = 0,                 // Calculated: (endTime - startTime) in hours
    overtime = false,               // Manually indicated by user
    overtimeHours = 0,              // Hours classified as overtime
    notes = '',
    createdBy = null,
} = {}) {
    const now = new Date().toISOString();
    return {
        taskId,
        projectId,
        userId,
        startTime,
        endTime,
        totalHours,
        overtime,
        overtimeHours,
        notes,
        createdBy: createdBy || userId,
        updatedBy: createdBy || userId,
        createdAt: now,
        updatedAt: now,
    };
}

/**
 * DelayCauses Collection
 * Configurable list of delay reasons. Managed by admin.
 *
 * Document ID: auto-generated
 */
export function createDelayCauseDocument({
    name = '',
    description = '',
    active = true,
    order = 0,
    createdBy = null,
} = {}) {
    const now = new Date().toISOString();
    return {
        name,
        description,
        active,
        order,
        createdBy,
        updatedBy: createdBy,
        createdAt: now,
        updatedAt: now,
    };
}

/**
 * Delays Collection
 * Records of delays linked to projects and/or tasks.
 *
 * Document ID: auto-generated
 */
export function createDelayDocument({
    projectId = null,               // Required — linked project
    taskId = null,                  // Optional — linked task
    causeId = null,                 // Reference to delayCauses document
    causeName = '',                 // Denormalized cause name for display
    comment = '',
    impact = '',                    // Optional impact description
    resolved = false,
    resolvedAt = null,              // ISO string
    createdBy = null,               // User UID
} = {}) {
    return {
        projectId,
        taskId,
        causeId,
        causeName,
        comment,
        impact,
        resolved,
        resolvedAt,
        createdBy,
        createdAt: new Date().toISOString(),
    };
}

/**
 * Risks Collection
 * Computed risk snapshots for projects.
 * Can be recalculated periodically or on-demand.
 *
 * Document ID: projectId (one-to-one with projects)
 */
export function createRiskDocument({
    projectId = null,
    riskScore = 0,
    riskLevel = RISK_LEVEL.LOW,
    riskFactors = [],               // Array of { factor: string, score: number }
    riskSummary = '',
    metrics = {
        delayedTasks: 0,
        overtimeHours: 0,
        activeDelays: 0,
        tasksInValidation: 0,
        ownerOverloaded: false,
    },
} = {}) {
    return {
        projectId,
        riskScore,
        riskLevel,
        riskFactors,
        riskSummary,
        metrics,
        calculatedAt: new Date().toISOString(),
    };
}

/**
 * DailyReports Collection
 * Auto-generated daily engineering reports.
 *
 * Document ID: `{userId}_{YYYY-MM-DD}` for uniqueness
 */
export function createDailyReportDocument({
    date = '',                      // YYYY-MM-DD format
    userId = null,
    userName = '',                  // Denormalized for display
    data = {
        tasksWorked: [],              // Array of { taskId, taskTitle, projectName, hours }
        totalHours: 0,
        overtimeHours: 0,
        tasksCompleted: 0,
        delaysReported: 0,
        notesSummary: '',
    },
    createdBy = 'system',
    source = 'system',
} = {}) {
    const now = new Date().toISOString();
    return {
        date,
        userId,
        userName,
        data,
        source,
        createdBy,
        updatedBy: createdBy,
        createdAt: now,
        updatedAt: now,
    };
}

/**
 * Notifications Collection
 *
 * Document ID: auto-generated
 */
export function createNotificationDocument({
    userId = null,                  // Target user UID
    type = NOTIFICATION_TYPE.SYSTEM,
    title = '',
    message = '',
    read = false,
    actionUrl = null,               // Optional deep link
    relatedId = null,               // Related document ID (task, project, etc.)
    relatedCollection = null,       // Which collection the relatedId belongs to
    createdBy = 'system',
} = {}) {
    const now = new Date().toISOString();
    return {
        userId,
        type,
        title,
        message,
        read,
        actionUrl,
        relatedId,
        relatedCollection,
        createdBy,
        createdAt: now,
        updatedAt: now,
    };
}

/**
 * TaskTypes Collection
 * Configurable task categories/types.
 *
 * Document ID: auto-generated
 */
export function createTaskTypeDocument({
    name = '',
    icon = 'Wrench',               // lucide-react icon name
    color = 'indigo',              // Tailwind color name
    active = true,
    order = 0,
    createdBy = null,
} = {}) {
    const now = new Date().toISOString();
    return {
        name,
        icon,
        color,
        active,
        order,
        createdBy,
        updatedBy: createdBy,
        createdAt: now,
        updatedAt: now,
    };
}

/**
 * Settings Collection
 * System-wide configuration key-value store.
 *
 * Document ID: setting key name
 */
export function createSettingDocument({
    key = '',
    value = null,                   // Can be any JSON-serializable value
    description = '',
    category = 'general',
} = {}) {
    return {
        key,
        value,
        description,
        category,
        updatedAt: new Date().toISOString(),
        updatedBy: null,
    };
}

/**
 * AuditLogs Collection
 * Immutable audit trail for system actions.
 *
 * Document ID: auto-generated
 */
export function createAuditLogDocument({
    action = '',                    // e.g., 'create', 'update', 'delete', 'status_change'
    userId = null,
    userName = '',                  // Denormalized
    collection = '',                // Target collection name
    documentId = '',                // Target document ID
    changes = {},                   // { field: { before, after } }
    metadata = {},                  // Additional context
} = {}) {
    return {
        action,
        userId,
        userName,
        collection,
        documentId,
        changes,
        metadata,
        timestamp: new Date().toISOString(),
    };
}

/**
 * WeeklyPlanItems Collection
 * Represents a single block of time planned for a task in the Weekly Planner.
 *
 * Architecture: tasks = master record, weeklyPlanItems = scheduling record.
 * The frontend should enrich plan items with live task data via
 * enrichPlanItemsWithTasks() from utils/plannerUtils.js.
 *
 * ── REQUIRED FIELDS (scheduling) ──
 *   taskId, weekStartDate, date, dayOfWeek, startDateTime, endDateTime,
 *   plannedHours, createdBy
 *
 * ── OPTIONAL FIELDS ──
 *   assignedTo, projectId — kept for query performance / filtering
 *   notes
 *
 * ── DEPRECATED FIELDS (legacy snapshots) ──
 *   taskTitleSnapshot, projectNameSnapshot, statusSnapshot,
 *   assignedToName, priority (snapshot), colorKey
 *   → These are still written transitionally for backward compatibility
 *     but should NOT be used as source of truth. Use enriched data instead.
 *   → TODO migration: remove these fields after full migration.
 *
 * Document ID: auto-generated
 */
export function createWeeklyPlanItemDocument({
    // ── Required: scheduling fields ──
    taskId = null,                  // Reference to tasks document (REQUIRED)
    weekStartDate = '',             // ISO YYYY-MM-DD — Monday of the planned week
    date = '',                      // Date of this block: YYYY-MM-DD
    dayOfWeek = 1,                  // 0 = Sunday, 1 = Monday, etc.
    startDateTime = null,           // ISO datetime string
    endDateTime = null,             // ISO datetime string
    plannedHours = 0,               // Calculated: end - start
    createdBy = null,               // User UID who created this block

    // ── Optional: kept for query filtering / performance ──
    assignedTo = null,              // User UID — duplicated for filter queries
    projectId = null,               // Reference to projects document — duplicated for filter queries
    notes = '',

    // ── @deprecated — TRANSITIONAL snapshot fields (legacy) ──
    // These fields are still accepted for backward compatibility with
    // existing Firestore documents but should NOT be read as source of truth.
    // The frontend reads live data from tasks via enrichPlanItemsWithTasks().
    // TODO migration: stop writing these after full data migration.
    taskTitleSnapshot = '',         // @deprecated — use task.title via enrichment
    projectNameSnapshot = '',       // @deprecated — use project.name via enrichment
    assignedToName = '',            // @deprecated — use teamMember.displayName via enrichment
    statusSnapshot = TASK_STATUS.PENDING, // @deprecated — use task.status via enrichment
    priority = TASK_PRIORITY.MEDIUM,      // @deprecated — use task.priority via enrichment
    colorKey = 'indigo',                  // @deprecated — derive from projectColorMap
} = {}) {
    return {
        // ── Scheduling (required) ──
        taskId,
        weekStartDate,
        date,
        dayOfWeek,
        startDateTime,
        endDateTime,
        plannedHours,
        createdBy,

        // ── Optional (for queries) ──
        assignedTo,
        projectId,
        notes,

        // ── @deprecated — TRANSITIONAL (legacy snapshots) ──
        // TODO migration: remove these fields after migration is complete
        taskTitleSnapshot,
        projectNameSnapshot,
        assignedToName,
        statusSnapshot,
        priority,
        colorKey,

        // ── Timestamps ──
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    };
}

/**
 * TaskDependencies Collection
 * Represents a dependency link between two tasks.
 *
 * Document ID: auto-generated
 */
export function createTaskDependencyDocument({
    predecessorTaskId = null,       // ID of the task that must happen first
    successorTaskId = null,         // ID of the task that depends on the predecessor
    type = 'FS',                    // 'FS' (Finish-to-Start) | 'SS' (Start-to-Start)
    lagHours = 0,                   // Optional lag in hours between tasks
    projectId = null,               // Denormalized for query efficiency
    createdBy = null,
} = {}) {
    return {
        predecessorTaskId,
        successorTaskId,
        type,
        lagHours,
        projectId,
        createdBy,
        createdAt: new Date().toISOString(),
    };
}

/**
 * TaskTypeCategories Collection
 * Visual grouping of task types for Gantt color coding.
 *
 * Document ID: auto-generated
 */
export function createTaskTypeCategoryDocument({
    name = '',
    color = 'indigo',              // Tailwind color name — used for Gantt bar color
    icon = 'Layers',               // lucide-react icon name
    order = 0,
    active = true,
    createdBy = null,
} = {}) {
    const now = new Date().toISOString();
    return {
        name,
        color,
        icon,
        order,
        active,
        createdBy,
        updatedBy: createdBy,
        createdAt: now,
        updatedAt: now,
    };
}


// ============================================================
// MANAGEMENT INTELLIGENCE — DOCUMENT FACTORIES
// ============================================================

/**
 * AuditFindings Collection
 * Rule violations and methodology compliance issues detected by the Rule Engine.
 *
 * Document ID: auto-generated
 */
export function createAuditFindingDocument({
    entityType = 'task',            // 'task' | 'project' | 'user' | 'planner'
    entityId = null,                // ID of the affected entity
    ruleId = '',                    // Rule identifier (e.g., 'TASK_NO_ESTIMATE')
    severity = AUDIT_FINDING_SEVERITY.WARNING,
    status = AUDIT_FINDING_STATUS.OPEN,
    title = '',
    message = '',
    recommendedAction = '',
    scoreImpact = 0,                // Negative impact on compliance score
    assignedTo = null,              // User UID responsible for resolving
    resolvedAt = null,              // ISO string
    resolvedBy = null,              // User UID who resolved
    source = 'rule_engine',         // 'rule_engine' | 'manual' | 'ai'
    metadata = {},                  // Additional context data
} = {}) {
    return {
        entityType,
        entityId,
        ruleId,
        severity,
        status,
        title,
        message,
        recommendedAction,
        scoreImpact,
        assignedTo,
        resolvedAt,
        resolvedBy,
        source,
        metadata,
        detectedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    };
}

/**
 * AuditEvents Collection — OFFICIAL SCHEMA
 * =========================================
 * Immutable, append-only system audit trail.
 * Written by Cloud Functions (task transitions, scheduled audits)
 * and by client (audit run summaries only).
 *
 * IMPORTANT: All producers (CF + client) MUST follow this contract.
 * See: functions/index.js, src/services/auditPersistence.js
 *
 * Document ID: auto-generated
 */
export function createAuditEventDocument({
    eventType = '',           // 'task_transition' | 'audit_run' | 'delay_reported' | ...
    entityType = '',          // 'task' | 'project' | 'user' | 'delay' | 'system'
    entityId = '',            // Document ID of affected entity
    userId = null,            // Firebase Auth UID (or 'system' for scheduled)
    source = 'client',       // 'cloud_function' | 'scheduled' | 'client_audit'
    correlationId = null,     // Groups related events (audit runId, batch ops)
    details = {},             // Event-specific payload
} = {}) {
    return {
        eventType,
        entityType,
        entityId,
        userId,
        source,
        correlationId,
        details,
        timestamp: new Date().toISOString(),
    };
}

/**
 * AnalyticsSnapshots Collection
 * Periodic health/compliance snapshots for department, project, or user.
 *
 * Document ID: `{scope}_{scopeRefId}_{YYYY-MM-DD}` or auto-generated
 */
export function createAnalyticsSnapshotDocument({
    snapshotDate = '',              // YYYY-MM-DD
    scope = ANALYTICS_SCOPE.DEPARTMENT,  // 'department' | 'project' | 'user'
    scopeRefId = 'department',      // Reference ID (projectId, userId, or 'department')
    methodologyCompliance = 0,      // 0–100 score
    estimateAccuracy = 0,           // 0–100 score (actual vs estimated ratio)
    planningReliability = 0,        // 0–100 score
    dataDiscipline = 0,             // 0–100 score
    overdueTasks = 0,
    activeDelays = 0,
    teamUtilization = 0,            // 0–100 percentage
    totalTasksActive = 0,
    totalTasksCompleted = 0,
    totalHoursLogged = 0,
    topBottlenecks = [],            // Array of strings
    riskDistribution = {            // Count of projects by risk level
        low: 0,
        medium: 0,
        high: 0,
    },
    metadata = {},
} = {}) {
    return {
        snapshotDate,
        scope,
        scopeRefId,
        methodologyCompliance,
        estimateAccuracy,
        planningReliability,
        dataDiscipline,
        overdueTasks,
        activeDelays,
        teamUtilization,
        totalTasksActive,
        totalTasksCompleted,
        totalHoursLogged,
        topBottlenecks,
        riskDistribution,
        metadata,
        createdAt: new Date().toISOString(),
    };
}

/**
 * AIInsights Collection
 * Gemini-generated insights and recommendations.
 *
 * Document ID: auto-generated
 */
export function createAIInsightDocument({
    scope = 'weekly',               // 'daily' | 'weekly' | 'project' | 'team'
    scopeRefId = 'department',      // Reference ID
    type = AI_INSIGHT_TYPE.WEEKLY_SUMMARY,
    title = '',
    summary = '',
    recommendations = [],           // Array of strings
    sourceDataRefs = [],            // Array of document IDs used as input
    confidence = 0,                 // 0–100 confidence in the insight
    generatedBy = 'gemini',
    metadata = {},
} = {}) {
    return {
        scope,
        scopeRefId,
        type,
        title,
        summary,
        recommendations,
        sourceDataRefs,
        confidence,
        generatedBy,
        metadata,
        generatedAt: new Date().toISOString(),
    };
}

/**
 * ManagementBriefs Collection
 * Weekly management summaries generated by Gemini.
 *
 * Document ID: `brief_{YYYY-MM-DD}` or auto-generated
 */
export function createManagementBriefDocument({
    periodStart = '',               // ISO date string (YYYY-MM-DD)
    periodEnd = '',                 // ISO date string (YYYY-MM-DD)
    summary = '',                   // Natural language summary
    keyFindings = [],               // Array of strings
    recommendedActions = [],        // Array of strings
    metrics = {                     // Key metrics for the period
        tasksCompleted: 0,
        tasksCreated: 0,
        totalHoursLogged: 0,
        overtimeHours: 0,
        delaysReported: 0,
        delaysResolved: 0,
        avgEstimationAccuracy: 0,
        methodologyScore: 0,
    },
    generatedBy = 'gemini',
    metadata = {},
} = {}) {
    return {
        periodStart,
        periodEnd,
        summary,
        keyFindings,
        recommendedActions,
        metrics,
        generatedBy,
        metadata,
        generatedAt: new Date().toISOString(),
    };
}


// ============================================================
// V5 FOUNDATION — DOCUMENT FACTORIES
// ============================================================

/**
 * Milestones Collection — V5
 * Critical project milestones with areas, scoring, and traffic lights.
 * Supports: setup, commissioning, validation, and custom milestones.
 *
 * Score model:
 *   scoreGeneral = avg(workArea scores)
 *   trafficLight = computed from score + LOCK checks
 *   Locks override score-based traffic light (anti-false-greens)
 *
 * Document ID: auto-generated
 */
export function createMilestoneDocument({
    projectId = null,
    type = MILESTONE_TYPE.CUSTOM,
    name = '',
    description = '',
    status = MILESTONE_STATUS.PLANNING,
    startDate = null,
    dueDate = null,
    completedDate = null,
    ownerId = null,
    teamMemberIds = [],
    // ── Score System (computed — do NOT set manually) ──
    scoreGeneral = 0,
    trafficLight = TRAFFIC_LIGHT.GREEN,
    scoreLocks = [],                    // Active SCORE_LOCK_REASON values
    trafficLightOverride = null,        // Admin manual override
    trafficLightOverrideReason = '',    // Required if override is set
    trafficLightOverrideBy = null,      // UID — auditable
    trafficLightOverrideAt = null,      // ISO — auditable
    trafficLightOverrideExpires = null, // ISO — auto-reverts after 7 days
    trend = 'stable',                   // 'improving' | 'stable' | 'declining'
    // ── Score Penalties (computed) ──
    penalties = {
        criticalOverdue: 0,             // Count of critical tasks overdue > 3 days
        unresolvedBlockers: 0,          // Count of blockers unresolved > 48h
        staleAreas: 0,                  // Count of areas without updates > 5 days
        unownedCritical: 0,             // Count of critical tasks without owner
        totalPenalty: 0,                // Sum of penalty point deductions
    },
    // ── V5 Metadata ──
    createdBy = null,
} = {}) {
    const now = new Date().toISOString();
    return {
        projectId,
        type,
        name,
        description,
        status,
        startDate,
        dueDate,
        completedDate,
        ownerId,
        teamMemberIds,
        scoreGeneral,
        trafficLight,
        scoreLocks,
        trafficLightOverride,
        trafficLightOverrideReason,
        trafficLightOverrideBy,
        trafficLightOverrideAt,
        trafficLightOverrideExpires,
        trend,
        penalties,
        createdBy,
        updatedBy: createdBy,
        createdAt: now,
        updatedAt: now,
    };
}

/**
 * WorkAreas Collection — V5
 * Sub-areas within a milestone, each with its own score.
 * Tasks are linked via tag or type filters.
 *
 * Document ID: auto-generated
 */
export function createWorkAreaDocument({
    milestoneId = null,
    projectId = null,                   // Denormalized for queries
    name = '',
    order = 0,
    responsibleId = null,               // Area lead UID
    // ── Score (computed) ──
    score = 0,
    trend = 'stable',
    trafficLight = TRAFFIC_LIGHT.GREEN,
    // ── V5 Task Type Mapping ──
    taskTypeIds = [],                   // V5: explicit type→area mapping (persisted)
    // ── Legacy Task Filter Config (kept for backward compat) ──
    taskFilter = {
        tagMatch: null,
        typeMatch: null,
    },
    // ── V5 Metadata ──
    createdBy = null,
} = {}) {
    const now = new Date().toISOString();
    return {
        milestoneId,
        projectId,
        name,
        order,
        responsibleId,
        score,
        trend,
        trafficLight,
        taskTypeIds,
        taskFilter,
        createdBy,
        updatedBy: createdBy,
        createdAt: now,
        updatedAt: now,
    };
}

/**
 * AuditTrail Collection — V5
 * Immutable, append-only system audit trail.
 * Replaces and unifies: auditEvents + auditLogs
 *
 * IMPORTANT: This collection is APPEND-ONLY.
 * No updates, no deletes — ever.
 *
 * Document ID: auto-generated
 */
export function createAuditTrailDocument({
    eventType = AUDIT_TRAIL_EVENT_TYPE.ENTITY_CHANGE,
    entityType = '',                    // 'task' | 'project' | 'milestone' | 'workArea' | 'user' | 'system'
    entityId = '',
    action = '',                        // 'create' | 'update' | 'delete' | 'transition' | 'override'
    actorId = null,                     // UID | 'system' | 'ai:gemini'
    actorType = AUDIT_TRAIL_ACTOR_TYPE.USER,
    changes = {},                       // { field: { before, after } }
    reason = null,                      // REQUIRED for overrides
    source = 'client',                  // 'client' | 'cloud_function' | 'automation' | 'ai' | 'scheduled'
    correlationId = null,               // Groups related events
    metadata = {},
} = {}) {
    return {
        eventType,
        entityType,
        entityId,
        action,
        actorId,
        actorType,
        changes,
        reason,
        source,
        correlationId,
        metadata,
        timestamp: new Date().toISOString(),
        // NO updatedAt, NO updatedBy — immutable
    };
}

/**
 * AI Governance Collection — V5
 * Dedicated collection for AI capability control.
 * Each document defines one AI capability with permissions and limits.
 *
 * Admin controls ALL capabilities from Settings UI.
 * Hardcoded prohibitions (see AI_PROHIBITED_ACTIONS) cannot be overridden.
 *
 * Document ID: capability key (e.g., 'pdf_extraction')
 */
export function createAiGovernanceDocument({
    name = '',
    type = AI_GOVERNANCE_TYPE.RECOMMENDER,
    description = '',
    module = '',                        // 'bom' | 'automation' | 'intelligence' | 'optimization'
    // ── Permissions ──
    canRecommend = true,
    canExecute = false,
    canModifyData = false,
    requiresHumanApproval = true,
    // ── Admin Control ──
    enabled = true,
    maxExecutionsPerDay = 50,
    // ── Tracking ──
    totalExecutions = 0,
    lastExecutionAt = null,
    // ── V5 Metadata ──
    createdBy = null,
} = {}) {
    const now = new Date().toISOString();
    return {
        name,
        type,
        description,
        module,
        canRecommend,
        canExecute,
        canModifyData,
        requiresHumanApproval,
        enabled,
        maxExecutionsPerDay,
        totalExecutions,
        lastExecutionAt,
        createdBy,
        updatedBy: createdBy,
        createdAt: now,
        updatedAt: now,
    };
}

/**
 * Actions that AI is NEVER allowed to perform.
 * These are hardcoded and cannot be overridden by admin configuration.
 */
export const AI_PROHIBITED_ACTIONS = [
    'change_task_dates',
    'change_task_owner',
    'change_user_roles',
    'close_complete_tasks',
    'approve_deliverables',
    'execute_workflow_transitions',
    'modify_financial_data',
];

/**
 * OperationalKpiSnapshots Factory — V5 (Phase 4 documentation)
 * Periodic KPI snapshots written by scheduledAnalyticsRefresh CF.
 *
 * Document ID: `{periodStart}_{periodEnd}_{periodType}_{entityId}`
 */
export function createOperationalKpiSnapshotDocument({
    periodType = 'daily',               // 'daily' | 'weekly' | 'monthly'
    periodStart = '',                   // YYYY-MM-DD
    periodEnd = '',                     // YYYY-MM-DD
    entityType = 'global',              // 'global' | 'user' | 'routine' | 'role'
    entityId = 'global',
    metrics = {},                       // { [kpiName]: { value, numerator, denominator, source } }
    dataCounts = {},
    engineVersion = '4.4',
} = {}) {
    return {
        periodType,
        periodStart,
        periodEnd,
        entityType,
        entityId,
        metrics,
        dataCounts,
        engineVersion,
        generatedAt: new Date().toISOString(),
        generatedBy: 'system',
    };
}

/**
 * OptimizationOpportunities Factory — V5 (Phase 5 documentation)
 * Opportunities detected by the optimization engine.
 *
 * Document ID: auto-generated
 */
export function createOptimizationOpportunityDocument({
    type = '',                          // OPPORTUNITY_TYPE value
    category = '',
    description = '',
    impact = '',
    estimatedGain = '',
    priority = 'medium',
    periodStart = '',
} = {}) {
    return {
        type,
        category,
        description,
        impact,
        estimatedGain,
        priority,
        periodStart,
        generatedAt: new Date().toISOString(),
        generatedBy: 'system',
    };
}


// ============================================================
// ANALYTICS & OPTIMIZATION — MISSING FACTORIES (O8)
// ============================================================

/**
 * UserOperationalScores Factory
 * Per-user KPI scores computed by the analytics engine.
 * Document ID: `{periodStart}_{userId}`
 */
export function createUserOperationalScoreDocument({
    userId = '',
    periodType = 'daily',
    periodStart = '',
    periodEnd = '',
    metrics = {},
    overallScore = 0,
    trend = 'stable',
    engineVersion = '4.4',
} = {}) {
    return {
        userId, periodType, periodStart, periodEnd,
        metrics, overallScore, trend, engineVersion,
        generatedAt: new Date().toISOString(),
        generatedBy: 'system',
    };
}

/**
 * RoutineOperationalScores Factory
 * Per-routine execution scores computed by the analytics engine.
 * Document ID: `{periodStart}_{routineKey}`
 */
export function createRoutineOperationalScoreDocument({
    routineKey = '',
    periodType = 'daily',
    periodStart = '',
    periodEnd = '',
    metrics = {},
    overallScore = 0,
    trend = 'stable',
    engineVersion = '4.4',
} = {}) {
    return {
        routineKey, periodType, periodStart, periodEnd,
        metrics, overallScore, trend, engineVersion,
        generatedAt: new Date().toISOString(),
        generatedBy: 'system',
    };
}

/**
 * TeamOperationalSummaries Factory
 * Team/role-level aggregated summaries.
 * Document ID: `{periodStart}_{role}`
 */
export function createTeamOperationalSummaryDocument({
    role = '',
    periodType = 'daily',
    periodStart = '',
    periodEnd = '',
    memberCount = 0,
    metrics = {},
    highlights = [],
    engineVersion = '4.4',
} = {}) {
    return {
        role, periodType, periodStart, periodEnd,
        memberCount, metrics, highlights, engineVersion,
        generatedAt: new Date().toISOString(),
        generatedBy: 'system',
    };
}

/**
 * OperationalRiskFlags Factory
 * Active risk flags detected by the analytics engine.
 * Document ID: auto-generated
 */
export function createOperationalRiskFlagDocument({
    type = '',
    severity = 'medium',
    entityType = '',
    entityId = '',
    description = '',
    suggestedAction = '',
    periodStart = '',
    resolved = false,
    resolvedAt = null,
} = {}) {
    return {
        type, severity, entityType, entityId,
        description, suggestedAction, periodStart,
        resolved, resolvedAt,
        generatedAt: new Date().toISOString(),
        generatedBy: 'system',
    };
}

/**
 * OperationalRecommendations Factory
 * Actionable recommendations from the analytics engine.
 * Document ID: auto-generated
 */
export function createOperationalRecommendationDocument({
    type = '',
    category = '',
    priority = 'medium',
    description = '',
    expectedImpact = '',
    targetEntityType = '',
    targetEntityId = '',
    periodStart = '',
    status = 'pending',
    appliedAt = null,
} = {}) {
    return {
        type, category, priority, description,
        expectedImpact, targetEntityType, targetEntityId,
        periodStart, status, appliedAt,
        generatedAt: new Date().toISOString(),
        generatedBy: 'system',
    };
}

/**
 * AnalyticsRefreshLogs Factory
 * Audit log for each analytics refresh execution.
 * Document ID: auto-generated
 */
export function createAnalyticsRefreshLogDocument({
    periodType = 'daily',
    periodStart = '',
    periodEnd = '',
    engineVersion = '4.4',
    durationMs = 0,
    collectionsWritten = [],
    errors = [],
    status = 'success',
} = {}) {
    return {
        periodType, periodStart, periodEnd,
        engineVersion, durationMs, collectionsWritten,
        errors, status,
        executedAt: new Date().toISOString(),
        executedBy: 'system',
    };
}

/**
 * AIExecutions Factory
 * Audit trail for AI executions (Gemini calls).
 * Document ID: auto-generated
 */
export function createAiExecutionDocument({
    routineKey = '',
    capability = '',
    targetUserId = null,
    model = '',
    inputTokens = 0,
    outputTokens = 0,
    durationMs = 0,
    status = 'success',
    errorMessage = null,
    metadata = {},
} = {}) {
    return {
        routineKey, capability, targetUserId,
        model, inputTokens, outputTokens, durationMs,
        status, errorMessage, metadata,
        executedAt: new Date().toISOString(),
        executedBy: 'system',
    };
}

/**
 * OptimizationSimulations Factory
 * What-if simulation results.
 * Document ID: auto-generated
 */
export function createOptimizationSimulationDocument({
    opportunityId = null,
    scenarioType = '',
    parameters = {},
    baselineMetrics = {},
    projectedMetrics = {},
    estimatedGain = '',
    confidence = 0,
    periodStart = '',
} = {}) {
    return {
        opportunityId, scenarioType, parameters,
        baselineMetrics, projectedMetrics,
        estimatedGain, confidence, periodStart,
        generatedAt: new Date().toISOString(),
        generatedBy: 'system',
    };
}

/**
 * OperationalPlans Factory
 * Daily/weekly operational plans generated by optimization engine.
 * Document ID: `{periodStart}_{periodType}`
 */
export function createOperationalPlanDocument({
    periodType = 'daily',
    periodStart = '',
    periodEnd = '',
    recommendations = [],
    assignedTasks = [],
    expectedOutcomes = {},
    status = 'draft',
} = {}) {
    return {
        periodType, periodStart, periodEnd,
        recommendations, assignedTasks, expectedOutcomes,
        status,
        generatedAt: new Date().toISOString(),
        generatedBy: 'system',
    };
}

/**
 * AppliedRecommendations Factory
 * Tracking for recommendations that were applied (before/after).
 * Document ID: auto-generated
 */
export function createAppliedRecommendationDocument({
    recommendationId = '',
    opportunityId = null,
    type = '',
    description = '',
    appliedBy = null,
    beforeMetrics = {},
    afterMetrics = {},
    actualGain = '',
    status = 'applied',
} = {}) {
    return {
        recommendationId, opportunityId, type,
        description, appliedBy,
        beforeMetrics, afterMetrics, actualGain,
        status,
        appliedAt: new Date().toISOString(),
    };
}

/**
 * OptimizationHistory Factory
 * Audit trail for optimization engine runs.
 * Document ID: auto-generated
 */
export function createOptimizationHistoryDocument({
    periodType = 'daily',
    periodStart = '',
    engineVersion = '4.4',
    opportunitiesFound = 0,
    simulationsRun = 0,
    recommendationsGenerated = 0,
    durationMs = 0,
    status = 'success',
    errors = [],
} = {}) {
    return {
        periodType, periodStart, engineVersion,
        opportunitiesFound, simulationsRun,
        recommendationsGenerated, durationMs,
        status, errors,
        executedAt: new Date().toISOString(),
        executedBy: 'system',
    };
}


// ============================================================
// V5 SCORE SNAPSHOTS (Phase 2F)
// ============================================================

/**
 * ScoreSnapshots Factory
 * Point-in-time capture of milestone/area scores for trend analysis.
 * Document ID: `{milestoneId}_{timestamp}`
 */
export function createScoreSnapshotDocument({
    milestoneId = '',
    projectId = '',
    snapshotType = 'scheduled',  // 'scheduled' | 'manual' | 'event_triggered'
    milestoneScore = 0,
    milestoneTrafficLight = 'green',
    milestoneStatus = 'active',
    areaScores = [],             // [{ areaId, name, score, trafficLight, trend }]
    activeLocks = [],
    activePenalties = {},
    triggeredBy = 'system',
} = {}) {
    return {
        milestoneId, projectId, snapshotType,
        milestoneScore, milestoneTrafficLight, milestoneStatus,
        areaScores, activeLocks, activePenalties,
        triggeredBy,
        capturedAt: new Date().toISOString(),
    };
}


// ============================================================
// RISK CALCULATION HELPERS
// ============================================================

/**
 * Default risk formula weights (stored in settings, configurable)
 */
export const DEFAULT_RISK_WEIGHTS = {
    delayedTaskWeight: 20,
    overtimeHoursWeight: 2,
    activeDelaysWeight: 15,
    tasksInValidationWeight: 10,
    ownerOverloadedBonus: 15,
};

/**
 * Calculate risk score based on project metrics
 * @param {Object} metrics - { delayedTasks, overtimeHours, activeDelays, tasksInValidation, ownerOverloaded }
 * @param {Object} weights - Configurable weights (defaults to DEFAULT_RISK_WEIGHTS)
 * @returns {{ riskScore: number, riskLevel: string }}
 */
export function calculateRiskScore(metrics, weights = DEFAULT_RISK_WEIGHTS) {
    const {
        delayedTasks = 0,
        overtimeHours = 0,
        activeDelays = 0,
        tasksInValidation = 0,
        ownerOverloaded = false,
    } = metrics;

    const riskScore =
        (delayedTasks * weights.delayedTaskWeight) +
        (overtimeHours * weights.overtimeHoursWeight) +
        (activeDelays * weights.activeDelaysWeight) +
        (tasksInValidation * weights.tasksInValidationWeight) +
        (ownerOverloaded ? weights.ownerOverloadedBonus : 0);

    let riskLevel = RISK_LEVEL.LOW;
    if (riskScore >= 60) riskLevel = RISK_LEVEL.HIGH;
    else if (riskScore >= 30) riskLevel = RISK_LEVEL.MEDIUM;

    return { riskScore: Math.round(riskScore), riskLevel };
}

/**
 * Classify risk level from score
 */
export function getRiskLevel(score) {
    if (score >= 60) return RISK_LEVEL.HIGH;
    if (score >= 30) return RISK_LEVEL.MEDIUM;
    return RISK_LEVEL.LOW;
}


// ============================================================
// DEFAULT SEED DATA
// ============================================================

/**
 * Default delay causes to seed on first setup
 */
export const DEFAULT_DELAY_CAUSES = [
    { name: 'Material faltante', description: 'Materiales necesarios no disponibles', order: 0 },
    { name: 'Cambio de prioridad', description: 'Priorización de otras tareas por gerencia', order: 1 },
    { name: 'Soporte a producción', description: 'Atención a urgencias o soporte de línea', order: 2 },
    { name: 'Decisión de ingeniería', description: 'Esperando definición técnica o de diseño', order: 3 },
    { name: 'Problema técnico', description: 'Dificultad técnica no prevista', order: 4 },
    { name: 'Dependencia externa', description: 'Esperando respuesta de proveedor o tercero', order: 5 },
    { name: 'Esperando validación', description: 'En espera de aprobación o revisión', order: 6 },
    { name: 'Recurso no disponible', description: 'Personal o equipo no disponible', order: 7 },
];

/**
 * Default task types to seed on first setup
 */
export const DEFAULT_TASK_TYPES = [
    { name: 'Diseño', icon: 'Pencil', color: 'blue', order: 0 },
    { name: 'Fabricación', icon: 'Wrench', color: 'amber', order: 1 },
    { name: 'Ensamble', icon: 'Layers', color: 'purple', order: 2 },
    { name: 'Programación', icon: 'Code', color: 'green', order: 3 },
    { name: 'Pruebas', icon: 'FlaskConical', color: 'teal', order: 4 },
    { name: 'Instalación', icon: 'HardDrive', color: 'indigo', order: 5 },
    { name: 'Documentación', icon: 'FileText', color: 'slate', order: 6 },
    { name: 'Soporte', icon: 'LifeBuoy', color: 'red', order: 7 },
];

/**
 * Default system settings
 */
export const DEFAULT_SETTINGS = [
    {
        key: 'risk_weights',
        value: DEFAULT_RISK_WEIGHTS,
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
