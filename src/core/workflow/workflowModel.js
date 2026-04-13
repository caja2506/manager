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

import sharedWorkflow from '../../../shared/taskWorkflow.cjs';

// ============================================================
// RE-EXPORT canonical contract with backward-compatible names
// ============================================================

/**
 * WORKFLOW_STATUS — backward-compatible alias mapping.
 * Keys like PLANNED and REVIEW map to DB values 'pending' and 'validation'.
 */
export const WORKFLOW_STATUS = {
    BACKLOG: sharedWorkflow.STATUS.BACKLOG,
    PLANNED: sharedWorkflow.STATUS.PENDING,        // Alias: 'pending' in DB
    IN_PROGRESS: sharedWorkflow.STATUS.IN_PROGRESS,
    BLOCKED: sharedWorkflow.STATUS.BLOCKED,
    REVIEW: sharedWorkflow.STATUS.VALIDATION,      // Alias: 'validation' in DB
    COMPLETED: sharedWorkflow.STATUS.COMPLETED,
    CANCELLED: sharedWorkflow.STATUS.CANCELLED,
};

/**
 * Display labels — derived from shared contract.
 */
export const WORKFLOW_STATUS_LABELS = sharedWorkflow.STATUS_LABELS;

/**
 * Status categories.
 */
export const STATUS_CATEGORY = sharedWorkflow.CATEGORY;

/**
 * Status → category mapping.
 */
export const STATUS_TO_CATEGORY = sharedWorkflow.STATUS_TO_CATEGORY;

/**
 * Valid transitions map.
 */
export const VALID_TRANSITIONS = sharedWorkflow.TRANSITIONS;

/**
 * Required fields per status.
 * The shared contract uses `check(task)`, but the frontend transitionValidator
 * expects `validate(task)`. We map `check` → `validate` here for compatibility.
 */
export const REQUIRED_FIELDS_BY_STATUS = Object.fromEntries(
    Object.entries(sharedWorkflow.REQUIRED_FIELDS).map(([status, fields]) => [
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

export const isValidTransition = sharedWorkflow.isValidTransition;
export const getAvailableTransitions = sharedWorkflow.getAvailableTransitions;
export const getStatusLabel = sharedWorkflow.getStatusLabel;
export const getStatusCategory = sharedWorkflow.getStatusCategory;
export const isActiveStatus = sharedWorkflow.isActiveStatus;
export const isTerminalStatus = sharedWorkflow.isTerminalStatus;

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
    return [...sharedWorkflow.SEQUENCE];
}
