/**
 * Automation Operations & Accountability Foundation — Constants
 * =============================================================
 * 
 * Channel-agnostic enums and constants for the automation subsystem.
 * Telegram-specific constants live in ./telegram/telegramConstants.js
 * 
 * @module automation/constants
 */

// ============================================================
// CHANNELS & PROVIDERS
// ============================================================

/** Supported communication channels (extensible) */
export const AUTOMATION_CHANNELS = {
    TELEGRAM: 'telegram',
    EMAIL: 'email',
    WHATSAPP: 'whatsapp',
    SLACK: 'slack',
};

/** Provider implementations per channel */
export const AUTOMATION_PROVIDERS = {
    TELEGRAM_BOT: 'telegram_bot',
};

// ============================================================
// OPERATIONAL HIERARCHY
// ============================================================

/**
 * Operational roles for the automation subsystem.
 * Separate from RBAC roles (admin/editor/viewer) and TEAM_ROLES.
 * These define the escalation chain and briefing targets.
 */
export const OPERATIONAL_ROLES = {
    MANAGER: 'manager',
    TEAM_LEAD: 'team_lead',
    ENGINEER: 'engineer',
    TECHNICIAN: 'technician',
};

/** Role display config (Spanish UI) */
export const OPERATIONAL_ROLE_CONFIG = {
    [OPERATIONAL_ROLES.MANAGER]: {
        label: 'Manager',
        order: 0,
        canEscalateTo: null,
        receivesDigest: true,
    },
    [OPERATIONAL_ROLES.TEAM_LEAD]: {
        label: 'Team Lead',
        order: 1,
        canEscalateTo: OPERATIONAL_ROLES.MANAGER,
        receivesDigest: true,
    },
    [OPERATIONAL_ROLES.ENGINEER]: {
        label: 'Ingeniero',
        order: 2,
        canEscalateTo: OPERATIONAL_ROLES.TEAM_LEAD,
        receivesDigest: true,
    },
    [OPERATIONAL_ROLES.TECHNICIAN]: {
        label: 'Técnico',
        order: 3,
        canEscalateTo: OPERATIONAL_ROLES.ENGINEER,
        receivesDigest: false,
    },
};

// ============================================================
// ROUTINE MANAGEMENT
// ============================================================

/** Schedule types for automation routines */
export const SCHEDULE_TYPE = {
    DAILY: 'daily',
    MANUAL: 'manual',
    EVENT_DRIVEN: 'event_driven',
};

/** What triggered a run */
export const TRIGGER_TYPE = {
    SCHEDULED: 'scheduled',
    MANUAL: 'manual',
    EVENT: 'event',
};

/** Routine execution status */
export const RUN_STATUS = {
    RUNNING: 'running',
    SUCCESS: 'success',
    PARTIAL: 'partial',
    FAILED: 'failed',
    CANCELLED: 'cancelled',
};

export const RUN_STATUS_CONFIG = {
    [RUN_STATUS.RUNNING]: { label: 'Ejecutando', color: 'blue', icon: 'Loader2' },
    [RUN_STATUS.SUCCESS]: { label: 'Exitoso', color: 'green', icon: 'CheckCircle' },
    [RUN_STATUS.PARTIAL]: { label: 'Parcial', color: 'amber', icon: 'AlertTriangle' },
    [RUN_STATUS.FAILED]: { label: 'Fallido', color: 'red', icon: 'XCircle' },
    [RUN_STATUS.CANCELLED]: { label: 'Cancelado', color: 'slate', icon: 'Ban' },
};

// ============================================================
// DELIVERY STATUS
// ============================================================

/** Message delivery lifecycle */
export const DELIVERY_STATUS = {
    PENDING: 'pending',
    SENT: 'sent',
    DELIVERED: 'delivered',
    FAILED: 'failed',
    RESPONDED: 'responded',
};

export const DELIVERY_STATUS_CONFIG = {
    [DELIVERY_STATUS.PENDING]: { label: 'Pendiente', color: 'slate' },
    [DELIVERY_STATUS.SENT]: { label: 'Enviado', color: 'blue' },
    [DELIVERY_STATUS.DELIVERED]: { label: 'Entregado', color: 'green' },
    [DELIVERY_STATUS.FAILED]: { label: 'Fallido', color: 'red' },
    [DELIVERY_STATUS.RESPONDED]: { label: 'Respondido', color: 'emerald' },
};

// ============================================================
// INCIDENTS
// ============================================================

/** Operational incident statuses */
export const INCIDENT_STATUS = {
    OPEN: 'open',
    ACKNOWLEDGED: 'acknowledged',
    IN_PROGRESS: 'in_progress',
    RESOLVED: 'resolved',
};

export const INCIDENT_STATUS_CONFIG = {
    [INCIDENT_STATUS.OPEN]: { label: 'Abierto', color: 'red', icon: 'AlertCircle' },
    [INCIDENT_STATUS.ACKNOWLEDGED]: { label: 'Reconocido', color: 'amber', icon: 'Eye' },
    [INCIDENT_STATUS.IN_PROGRESS]: { label: 'En Progreso', color: 'blue', icon: 'Loader2' },
    [INCIDENT_STATUS.RESOLVED]: { label: 'Resuelto', color: 'green', icon: 'CheckCircle' },
};

/** Incident severity levels */
export const INCIDENT_SEVERITY = {
    LOW: 'low',
    MEDIUM: 'medium',
    HIGH: 'high',
    CRITICAL: 'critical',
};

export const INCIDENT_SEVERITY_CONFIG = {
    [INCIDENT_SEVERITY.LOW]: { label: 'Bajo', color: 'slate', order: 0 },
    [INCIDENT_SEVERITY.MEDIUM]: { label: 'Medio', color: 'amber', order: 1 },
    [INCIDENT_SEVERITY.HIGH]: { label: 'Alto', color: 'orange', order: 2 },
    [INCIDENT_SEVERITY.CRITICAL]: { label: 'Crítico', color: 'red', order: 3 },
};

/** Incident types (extensible) */
export const INCIDENT_TYPE = {
    BLOCKER: 'blocker',
    MISSING_REPORT: 'missing_report',
    SYSTEM_ERROR: 'system_error',
    ESCALATION_TIMEOUT: 'escalation_timeout',
    DELIVERY_FAILURE: 'delivery_failure',
};

// ============================================================
// REPORTS & ESCALATIONS
// ============================================================

/** Daily report processing status */
export const REPORT_STATUS = {
    PENDING: 'pending',
    RECEIVED: 'received',
    CONFIRMED: 'confirmed',
    LATE: 'late',
    ESCALATED: 'escalated',
};

/** Escalation types */
export const ESCALATION_TYPE = {
    MISSING_REPORT: 'missing_report',
    BLOCKER: 'blocker',
    LATE_RESPONSE: 'late_response',
};

/** Escalation resolution statuses */
export const ESCALATION_STATUS = {
    PENDING: 'pending',
    ACKNOWLEDGED: 'acknowledged',
    RESOLVED: 'resolved',
    EXPIRED: 'expired',
};

// ============================================================
// PREDEFINED ROUTINE KEYS
// ============================================================

/**
 * Well-known routine identifiers.
 * Used as document IDs in automationRoutines collection.
 */
export const ROUTINE_KEYS = {
    MORNING_DIGEST_ALL: 'morning_digest_all',
    TECHNICIAN_EVENING_CHECK: 'technician_evening_check',
    MISSING_REPORT_ESCALATION: 'missing_report_escalation',
    BLOCK_INCIDENT_ALERT: 'block_incident_alert',
    MANAGER_SUMMARY: 'manager_summary',
    ENGINEER_RISK_DIGEST: 'engineer_risk_digest',
    MANUAL_TEST_MESSAGE: 'manual_test_message',
    CLOSE_DAY_REPORT: 'close_day_report',
    OPEN_DAY: 'open_day',
    DAILY_PERFORMANCE_REPORT: 'daily_performance_report',
};


// ============================================================
// PERSONALITY MODES (for AI-generated messages)
// ============================================================

export const PERSONALITY_MODES = {
    PROFESSIONAL: 'professional',
    FRIENDLY: 'friendly',
    DIRECT: 'direct',
    MOTIVATIONAL: 'motivational',
};
