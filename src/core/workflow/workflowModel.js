/**
 * Workflow Model — Frontend Wrapper
 * ===================================
 * 
 * ★ Derives from shared/taskWorkflow.js (Single Source of Truth) ★
 * 
 * This module re-exports the canonical workflow contract and adds
 * frontend-specific aliases for backward compatibility.
 * 
 * Consumers should import from this file or from core/workflow/index.js.
 * 
 * IMPORTANT: Do NOT redefine statuses, transitions, or required fields here.
 * All canonical definitions live in shared/taskWorkflow.js.
 */

import {
    STATUS, STATUS_LABELS, CATEGORY, STATUS_TO_CATEGORY as _STATUS_TO_CATEGORY,
    TRANSITIONS as _TRANSITIONS, REQUIRED_FIELDS as _REQUIRED_FIELDS, SEQUENCE as _SEQUENCE,
    isValidTransition as _isValidTransition, getAvailableTransitions as _getAvailableTransitions,
    getStatusLabel as _getStatusLabel, getStatusCategory as _getStatusCategory,
    isActiveStatus as _isActiveStatus, isTerminalStatus as _isTerminalStatus,
} from '../../../shared/taskWorkflow.js';

// ============================================================
// RE-EXPORT canonical contract with backward-compatible names
// ============================================================

/**
 * WORKFLOW_STATUS — backward-compatible alias mapping.
 * Keys like PLANNED and REVIEW map to DB values 'pending' and 'validation'.
 */
export const WORKFLOW_STATUS = {
    BACKLOG: STATUS.BACKLOG,
    PLANNED: STATUS.PENDING,        // Alias: 'pending' in DB
    IN_PROGRESS: STATUS.IN_PROGRESS,
    BLOCKED: STATUS.BLOCKED,
    REVIEW: STATUS.VALIDATION,      // Alias: 'validation' in DB
    COMPLETED: STATUS.COMPLETED,
    CANCELLED: STATUS.CANCELLED,
};

/**
 * Display labels — derived from shared contract.
 */
export const WORKFLOW_STATUS_LABELS = STATUS_LABELS;

/**
 * Status categories.
 */
export { CATEGORY as STATUS_CATEGORY };

/**
 * Status → category mapping.
 */
export { _STATUS_TO_CATEGORY as STATUS_TO_CATEGORY };

/**
 * Valid transitions map.
 */
export { _TRANSITIONS as VALID_TRANSITIONS };

/**
 * Required fields per status.
 * The shared contract uses `check(task)`, but the frontend transitionValidator
 * expects `validate(task)`. We map `check` → `validate` here for compatibility.
 */
export const REQUIRED_FIELDS_BY_STATUS = Object.fromEntries(
    Object.entries(_REQUIRED_FIELDS).map(([status, fields]) => [
        status,
        fields.map(f => ({
            field: f.field,
            label: f.label,
            validate: f.check, // alias: frontend uses `validate`, shared uses `check`
        })),
    ])
);

// ============================================================
// FUNCTIONS — re-export from shared contract
// ============================================================

export { _isValidTransition as isValidTransition };
export { _getAvailableTransitions as getAvailableTransitions };
export { _getStatusLabel as getStatusLabel };
export { _getStatusCategory as getStatusCategory };
export { _isActiveStatus as isActiveStatus };
export { _isTerminalStatus as isTerminalStatus };

/**
 * Get required fields for a status (with `validate` function for frontend).
 */
export function getRequiredFields(status) {
    return REQUIRED_FIELDS_BY_STATUS[status] || [];
}

/**
 * Get the official workflow sequence (happy path, for display).
 */
export function getWorkflowSequence() {
    return [..._SEQUENCE];
}
