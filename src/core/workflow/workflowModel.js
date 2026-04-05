/**
 * Workflow Model — Official Operational State Machine
 * ====================================================
 * 
 * Defines the official workflow for the Engineering Management Platform.
 * All task state transitions must go through this model.
 * 
 * Flow: Backlog → Planned → In Progress → Review → Completed
 *       (Blocked can occur from any active state)
 *       (Cancelled can occur from any state)
 * 
 * This module is the single source of truth for:
 *   - Valid task statuses
 *   - Allowed transitions between statuses
 *   - Required fields per status
 *   - Validation logic for status changes
 */

// ============================================================
// STATUS DEFINITIONS
// ============================================================

/**
 * Official workflow statuses.
 * Maps to TASK_STATUS from schemas.js with backward-compatible aliases.
 */
export const WORKFLOW_STATUS = {
    BACKLOG: 'backlog',
    PLANNED: 'pending',        // Alias: 'pending' in DB, displayed as 'Planned'
    IN_PROGRESS: 'in_progress',
    BLOCKED: 'blocked',
    REVIEW: 'validation',      // Alias: 'validation' in DB, displayed as 'Review'
    COMPLETED: 'completed',
    CANCELLED: 'cancelled',
};

/**
 * Display labels for each status (Spanish).
 */
export const WORKFLOW_STATUS_LABELS = {
    [WORKFLOW_STATUS.BACKLOG]: 'Backlog',
    [WORKFLOW_STATUS.PLANNED]: 'Planificado',
    [WORKFLOW_STATUS.IN_PROGRESS]: 'En Progreso',
    [WORKFLOW_STATUS.BLOCKED]: 'Bloqueado',
    [WORKFLOW_STATUS.REVIEW]: 'En Revisión',
    [WORKFLOW_STATUS.COMPLETED]: 'Completado',
    [WORKFLOW_STATUS.CANCELLED]: 'Cancelado',
};

/**
 * Status categories for grouping.
 */
export const STATUS_CATEGORY = {
    INACTIVE: 'inactive',    // backlog
    ACTIVE: 'active',        // planned, in_progress, review
    TERMINAL: 'terminal',    // completed, cancelled
    EXCEPTION: 'exception',  // blocked
};

export const STATUS_TO_CATEGORY = {
    [WORKFLOW_STATUS.BACKLOG]: STATUS_CATEGORY.INACTIVE,
    [WORKFLOW_STATUS.PLANNED]: STATUS_CATEGORY.ACTIVE,
    [WORKFLOW_STATUS.IN_PROGRESS]: STATUS_CATEGORY.ACTIVE,
    [WORKFLOW_STATUS.BLOCKED]: STATUS_CATEGORY.EXCEPTION,
    [WORKFLOW_STATUS.REVIEW]: STATUS_CATEGORY.ACTIVE,
    [WORKFLOW_STATUS.COMPLETED]: STATUS_CATEGORY.TERMINAL,
    [WORKFLOW_STATUS.CANCELLED]: STATUS_CATEGORY.TERMINAL,
};

// ============================================================
// TRANSITION MAP
// ============================================================

/**
 * Valid transitions: { [fromStatus]: [toStatus1, toStatus2, ...] }
 * 
 * Rules:
 *   - backlog → planned, in_progress, cancelled
 *   - planned → in_progress, backlog, blocked, cancelled
 *   - in_progress → review, blocked, cancelled
 *   - blocked → in_progress, planned, cancelled
 *   - review → completed, in_progress, blocked
 *   - completed → in_progress (reopen)
 *   - cancelled → backlog (reactivate)
 */
export const VALID_TRANSITIONS = {
    [WORKFLOW_STATUS.BACKLOG]: [
        WORKFLOW_STATUS.PLANNED,
        WORKFLOW_STATUS.IN_PROGRESS,
        WORKFLOW_STATUS.CANCELLED,
    ],
    [WORKFLOW_STATUS.PLANNED]: [
        WORKFLOW_STATUS.IN_PROGRESS,
        WORKFLOW_STATUS.BACKLOG,
        WORKFLOW_STATUS.BLOCKED,
        WORKFLOW_STATUS.CANCELLED,
    ],
    [WORKFLOW_STATUS.IN_PROGRESS]: [
        WORKFLOW_STATUS.REVIEW,
        WORKFLOW_STATUS.PLANNED,
        WORKFLOW_STATUS.BLOCKED,
        WORKFLOW_STATUS.CANCELLED,
    ],
    [WORKFLOW_STATUS.BLOCKED]: [
        WORKFLOW_STATUS.IN_PROGRESS,
        WORKFLOW_STATUS.PLANNED,
        WORKFLOW_STATUS.CANCELLED,
    ],
    [WORKFLOW_STATUS.REVIEW]: [
        WORKFLOW_STATUS.COMPLETED,
        WORKFLOW_STATUS.IN_PROGRESS,
        WORKFLOW_STATUS.BLOCKED,
    ],
    [WORKFLOW_STATUS.COMPLETED]: [
        WORKFLOW_STATUS.IN_PROGRESS, // reopen
    ],
    [WORKFLOW_STATUS.CANCELLED]: [
        WORKFLOW_STATUS.BACKLOG, // reactivate
    ],
};

// ============================================================
// REQUIRED FIELDS PER STATUS
// ============================================================

/**
 * Fields that MUST be populated before a task can enter a given status.
 * Returns { field: string, label: string, validate: (task) => boolean }
 */
export const REQUIRED_FIELDS_BY_STATUS = {
    [WORKFLOW_STATUS.BACKLOG]: [],
    [WORKFLOW_STATUS.PLANNED]: [
        {
            field: 'assignedTo',
            label: 'Responsable asignado',
            validate: (task) => !!task.assignedTo,
        },
        {
            field: 'projectId',
            label: 'Proyecto asignado',
            validate: (task) => !!task.projectId,
        },
    ],
    [WORKFLOW_STATUS.IN_PROGRESS]: [
        {
            field: 'assignedTo',
            label: 'Responsable asignado',
            validate: (task) => !!task.assignedTo,
        },
        {
            field: 'estimatedHours',
            label: 'Horas estimadas',
            validate: (task) => task.estimatedHours > 0,
        },
    ],
    [WORKFLOW_STATUS.BLOCKED]: [
        {
            field: 'blockedReason',
            label: 'Razón de bloqueo',
            validate: (task) => !!task.blockedReason && task.blockedReason.trim().length > 0,
        },
    ],
    [WORKFLOW_STATUS.REVIEW]: [
        {
            field: 'assignedTo',
            label: 'Responsable asignado',
            validate: (task) => !!task.assignedTo,
        },
    ],
    [WORKFLOW_STATUS.COMPLETED]: [
        {
            field: 'assignedTo',
            label: 'Responsable asignado',
            validate: (task) => !!task.assignedTo,
        },
    ],
    [WORKFLOW_STATUS.CANCELLED]: [],
};

// ============================================================
// WORKFLOW FUNCTIONS
// ============================================================

/**
 * Check if a status transition is valid according to the state machine.
 * 
 * @param {string} fromStatus - Current task status
 * @param {string} toStatus - Desired target status
 * @returns {boolean}
 */
export function isValidTransition(fromStatus, toStatus) {
    const allowed = VALID_TRANSITIONS[fromStatus];
    if (!allowed) return false;
    return allowed.includes(toStatus);
}

/**
 * Get all valid target statuses from a given status.
 * 
 * @param {string} currentStatus
 * @returns {string[]}
 */
export function getAvailableTransitions(currentStatus) {
    return VALID_TRANSITIONS[currentStatus] || [];
}

/**
 * Get the required fields for a given status.
 * 
 * @param {string} status
 * @returns {Array<{ field: string, label: string, validate: Function }>}
 */
export function getRequiredFields(status) {
    return REQUIRED_FIELDS_BY_STATUS[status] || [];
}

/**
 * Get the display label for a status.
 * 
 * @param {string} status
 * @returns {string}
 */
export function getStatusLabel(status) {
    return WORKFLOW_STATUS_LABELS[status] || status;
}

/**
 * Get the category of a status (inactive, active, terminal, exception).
 * 
 * @param {string} status
 * @returns {string}
 */
export function getStatusCategory(status) {
    return STATUS_TO_CATEGORY[status] || STATUS_CATEGORY.INACTIVE;
}

/**
 * Check if a status is considered "active" (task is being worked on).
 * 
 * @param {string} status
 * @returns {boolean}
 */
export function isActiveStatus(status) {
    return getStatusCategory(status) === STATUS_CATEGORY.ACTIVE;
}

/**
 * Check if a status is terminal (completed or cancelled).
 * 
 * @param {string} status
 * @returns {boolean}
 */
export function isTerminalStatus(status) {
    return getStatusCategory(status) === STATUS_CATEGORY.TERMINAL;
}

/**
 * Get the official workflow sequence (for display purposes).
 * 
 * @returns {string[]}
 */
export function getWorkflowSequence() {
    return [
        WORKFLOW_STATUS.BACKLOG,
        WORKFLOW_STATUS.PLANNED,
        WORKFLOW_STATUS.IN_PROGRESS,
        WORKFLOW_STATUS.REVIEW,
        WORKFLOW_STATUS.COMPLETED,
    ];
}
