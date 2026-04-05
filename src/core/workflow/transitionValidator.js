/**
 * Transition Validator
 * ====================
 * 
 * Validates task status transitions against the workflow model.
 * Produces structured results with errors, warnings, and audit-ready outputs.
 */

import {
    isValidTransition,
    getAvailableTransitions,
    getRequiredFields,
    getStatusLabel,
    isTerminalStatus,
    WORKFLOW_STATUS,
} from './workflowModel';

// ============================================================
// VALIDATION RESULT STRUCTURE
// ============================================================

/**
 * @typedef {Object} ValidationResult
 * @property {boolean} valid - Whether the transition is allowed
 * @property {Array<{ code: string, message: string }>} errors - Blocking errors
 * @property {Array<{ code: string, message: string }>} warnings - Non-blocking warnings
 * @property {Object} auditData - Data for audit trail
 */

/**
 * Create a clean validation result.
 */
function createResult() {
    return {
        valid: true,
        errors: [],
        warnings: [],
        auditData: {},
    };
}

// ============================================================
// CORE VALIDATOR
// ============================================================

/**
 * Validate a task status transition.
 * 
 * @param {Object} task - The current task document
 * @param {string} newStatus - The desired target status
 * @param {Object} [context={}] - Additional context (timeLogs, delays, subtasks)
 * @param {Array} [context.timeLogs=[]] - Time logs for this task
 * @param {Array} [context.delays=[]] - Delays for this task
 * @param {Array} [context.subtasks=[]] - Subtasks for this task
 * @returns {ValidationResult}
 */
export function validateTransition(task, newStatus, context = {}) {
    const result = createResult();
    const currentStatus = task.status;

    // --- 1. Check transition validity ---
    if (!isValidTransition(currentStatus, newStatus)) {
        result.valid = false;
        result.errors.push({
            code: 'INVALID_TRANSITION',
            message: `No se puede cambiar de "${getStatusLabel(currentStatus)}" a "${getStatusLabel(newStatus)}"`,
        });
        return result; // Early return — no point checking further
    }

    // --- 2. Check required fields (warnings, overridable via confirmation) ---
    const requiredFields = getRequiredFields(newStatus);
    for (const req of requiredFields) {
        if (!req.validate(task)) {
            result.warnings.push({
                code: 'MISSING_REQUIRED_FIELD',
                message: `Campo recomendado faltante: ${req.label}`,
                field: req.field,
            });
        }
    }

    // --- 3. Contextual validations ---
    const { timeLogs = [], delays = [], subtasks = [] } = context;

    // Moving to COMPLETED: warn if no hours logged
    if (newStatus === WORKFLOW_STATUS.COMPLETED) {
        const totalHours = timeLogs.reduce((sum, log) => sum + (log.totalHours || 0), 0);
        const taskActualHours = task.actualHours || 0;
        if (totalHours === 0 && taskActualHours === 0) {
            result.warnings.push({
                code: 'NO_HOURS_LOGGED',
                message: 'Esta tarea se completará sin horas registradas',
            });
        }

        // Warn if subtasks are incomplete
        if (subtasks.length > 0) {
            const incompleteSubtasks = subtasks.filter(st => !st.completed);
            if (incompleteSubtasks.length > 0) {
                result.warnings.push({
                    code: 'INCOMPLETE_SUBTASKS',
                    message: `Hay ${incompleteSubtasks.length} subtarea(s) sin completar`,
                });
            }
        }
    }

    // Moving to BLOCKED: should have a delay record (warning, not error)
    if (newStatus === WORKFLOW_STATUS.BLOCKED) {
        const activeDelays = delays.filter(d => !d.resolved);
        if (activeDelays.length === 0) {
            result.warnings.push({
                code: 'NO_DELAY_RECORD',
                message: 'Se recomienda registrar un delay/bloqueo para esta tarea',
            });
        }
    }

    // Reopening from COMPLETED: warn about impact
    if (currentStatus === WORKFLOW_STATUS.COMPLETED && newStatus === WORKFLOW_STATUS.IN_PROGRESS) {
        result.warnings.push({
            code: 'TASK_REOPENED',
            message: 'Reabrir una tarea completada afectará las métricas de cumplimiento',
        });
    }

    // Reactivating from CANCELLED
    if (currentStatus === WORKFLOW_STATUS.CANCELLED && newStatus === WORKFLOW_STATUS.BACKLOG) {
        result.warnings.push({
            code: 'TASK_REACTIVATED',
            message: 'Esta tarea fue cancelada previamente y será reactivada',
        });
    }

    // Moving from active to terminal: check estimation accuracy
    if (isTerminalStatus(newStatus) && task.estimatedHours > 0) {
        const actualHours = task.actualHours || timeLogs.reduce((sum, log) => sum + (log.totalHours || 0), 0);
        if (actualHours > 0) {
            const ratio = actualHours / task.estimatedHours;
            if (ratio > 1.5) {
                result.warnings.push({
                    code: 'ESTIMATION_EXCEEDED',
                    message: `Las horas reales (${actualHours.toFixed(1)}h) exceden la estimación (${task.estimatedHours}h) en un ${((ratio - 1) * 100).toFixed(0)}%`,
                });
            }
        }
    }

    // --- 4. Build audit data ---
    result.auditData = {
        eventType: 'task_status_changed',
        entityType: 'task',
        entityId: task.id,
        previousValue: currentStatus,
        newValue: newStatus,
        errors: result.errors.map(e => e.code),
        warnings: result.warnings.map(w => w.code),
        timestamp: new Date().toISOString(),
    };

    return result;
}

/**
 * Quick check: can we transition without running full validation?
 * Use this for UI (e.g., enabling/disabling status buttons).
 * 
 * @param {string} currentStatus
 * @param {string} targetStatus
 * @returns {boolean}
 */
export function canTransitionQuick(currentStatus, targetStatus) {
    return isValidTransition(currentStatus, targetStatus);
}

/**
 * Get all valid transitions for a task with their validation status.
 * Useful for showing which transitions are possible and which have issues.
 * 
 * @param {Object} task - The current task document
 * @param {Object} [context={}] - Additional context
 * @returns {Array<{ status: string, label: string, validation: ValidationResult }>}
 */
export function getValidatedTransitions(task, context = {}) {
    const available = getAvailableTransitions(task.status);

    return available.map(targetStatus => ({
        status: targetStatus,
        label: getStatusLabel(targetStatus),
        validation: validateTransition(task, targetStatus, context),
    }));
}
