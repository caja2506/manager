/**
 * Task Workflow — Shared Contract (Isomorphic)
 * =============================================
 * 
 * ★ SINGLE SOURCE OF TRUTH for task states, transitions, and requirements ★
 * 
 * This module is consumed by BOTH:
 *   - Frontend: src/core/workflow/workflowModel.js (ESM import)
 *   - Backend:  functions/exports/tasks.js (CJS require)
 * 
 * Written as CJS (module.exports) so Node.js Cloud Functions can require()
 * it directly, and the frontend Vite build can import it via interop.
 * 
 * DO NOT add React, Firebase, or any environment-specific dependencies here.
 * This is pure data + pure functions only.
 * 
 * LAST UPDATED: 2026-04-12
 */

// ============================================================
// STATUS VALUES (stored in Firestore)
// ============================================================

const STATUS = {
    BACKLOG: 'backlog',
    PENDING: 'pending',          // UI alias: "Planificado" / "Planned"
    IN_PROGRESS: 'in_progress',
    BLOCKED: 'blocked',
    VALIDATION: 'validation',    // UI alias: "En Revisión" / "Review"
    COMPLETED: 'completed',
    CANCELLED: 'cancelled',
};

// ============================================================
// STATUS DISPLAY LABELS (Spanish)
// ============================================================

const STATUS_LABELS = {
    [STATUS.BACKLOG]: 'Backlog',
    [STATUS.PENDING]: 'Planificado',
    [STATUS.IN_PROGRESS]: 'En Progreso',
    [STATUS.BLOCKED]: 'Bloqueado',
    [STATUS.VALIDATION]: 'En Revisión',
    [STATUS.COMPLETED]: 'Completado',
    [STATUS.CANCELLED]: 'Cancelado',
};

// ============================================================
// STATUS CATEGORIES
// ============================================================

const CATEGORY = {
    INACTIVE: 'inactive',     // backlog
    ACTIVE: 'active',         // pending, in_progress, validation
    TERMINAL: 'terminal',     // completed, cancelled
    EXCEPTION: 'exception',   // blocked
};

const STATUS_TO_CATEGORY = {
    [STATUS.BACKLOG]: CATEGORY.INACTIVE,
    [STATUS.PENDING]: CATEGORY.ACTIVE,
    [STATUS.IN_PROGRESS]: CATEGORY.ACTIVE,
    [STATUS.BLOCKED]: CATEGORY.EXCEPTION,
    [STATUS.VALIDATION]: CATEGORY.ACTIVE,
    [STATUS.COMPLETED]: CATEGORY.TERMINAL,
    [STATUS.CANCELLED]: CATEGORY.TERMINAL,
};

// ============================================================
// VALID TRANSITIONS (state machine)
// ============================================================
//
// Rules:
//   backlog      → pending, in_progress, cancelled
//   pending      → in_progress, backlog, blocked, cancelled
//   in_progress  → validation, pending, blocked, cancelled
//   blocked      → in_progress, pending, cancelled
//   validation   → completed, in_progress, blocked
//   completed    → in_progress (reopen)
//   cancelled    → backlog (reactivate)
//

const TRANSITIONS = {
    [STATUS.BACKLOG]: [STATUS.PENDING, STATUS.IN_PROGRESS, STATUS.CANCELLED],
    [STATUS.PENDING]: [STATUS.IN_PROGRESS, STATUS.BACKLOG, STATUS.BLOCKED, STATUS.CANCELLED],
    [STATUS.IN_PROGRESS]: [STATUS.VALIDATION, STATUS.PENDING, STATUS.BLOCKED, STATUS.CANCELLED],
    [STATUS.BLOCKED]: [STATUS.IN_PROGRESS, STATUS.PENDING, STATUS.CANCELLED],
    [STATUS.VALIDATION]: [STATUS.COMPLETED, STATUS.IN_PROGRESS, STATUS.BLOCKED],
    [STATUS.COMPLETED]: [STATUS.IN_PROGRESS],
    [STATUS.CANCELLED]: [STATUS.BACKLOG],
};

// ============================================================
// REQUIRED FIELDS PER TARGET STATUS
// ============================================================
//
// Each entry: { field, label, check(task) → boolean }
// `check` is a pure function for backend (no DOM, no React).
// Frontend wraps these with richer `validate` if needed.
//
// ★ IMPORTANT: These are the CANONICAL requirements.
//   Both frontend and backend MUST derive from this list.
//

const REQUIRED_FIELDS = {
    [STATUS.BACKLOG]: [],
    [STATUS.PENDING]: [
        { field: 'assignedTo', label: 'Responsable asignado',   check: (t) => !!t.assignedTo },
        { field: 'projectId',  label: 'Proyecto asignado',      check: (t) => !!t.projectId },
    ],
    [STATUS.IN_PROGRESS]: [
        { field: 'assignedTo',     label: 'Responsable asignado', check: (t) => !!t.assignedTo },
        { field: 'estimatedHours', label: 'Horas estimadas',      check: (t) => t.estimatedHours > 0 },
    ],
    [STATUS.BLOCKED]: [
        { field: 'blockedReason', label: 'Razón de bloqueo', check: (t) => !!t.blockedReason && String(t.blockedReason).trim().length > 0 },
    ],
    [STATUS.VALIDATION]: [
        { field: 'assignedTo', label: 'Responsable asignado', check: (t) => !!t.assignedTo },
    ],
    [STATUS.COMPLETED]: [
        { field: 'assignedTo', label: 'Responsable asignado', check: (t) => !!t.assignedTo },
    ],
    [STATUS.CANCELLED]: [],
};

// ============================================================
// WORKFLOW SEQUENCE (happy path, for display)
// ============================================================

const SEQUENCE = [
    STATUS.BACKLOG,
    STATUS.PENDING,
    STATUS.IN_PROGRESS,
    STATUS.VALIDATION,
    STATUS.COMPLETED,
];

// ============================================================
// PURE HELPER FUNCTIONS
// ============================================================

function isValidTransition(from, to) {
    const allowed = TRANSITIONS[from];
    return !!allowed && allowed.includes(to);
}

function getAvailableTransitions(current) {
    return TRANSITIONS[current] || [];
}

function getRequiredFields(status) {
    return REQUIRED_FIELDS[status] || [];
}

function getStatusLabel(status) {
    return STATUS_LABELS[status] || status;
}

function getStatusCategory(status) {
    return STATUS_TO_CATEGORY[status] || CATEGORY.INACTIVE;
}

function isActiveStatus(status) {
    return getStatusCategory(status) === CATEGORY.ACTIVE;
}

function isTerminalStatus(status) {
    return getStatusCategory(status) === CATEGORY.TERMINAL;
}

// ============================================================
// EXPORTS (CJS for Node.js / Cloud Functions compatibility)
// ============================================================

module.exports = {
    STATUS,
    STATUS_LABELS,
    CATEGORY,
    STATUS_TO_CATEGORY,
    TRANSITIONS,
    REQUIRED_FIELDS,
    SEQUENCE,
    isValidTransition,
    getAvailableTransitions,
    getRequiredFields,
    getStatusLabel,
    getStatusCategory,
    isActiveStatus,
    isTerminalStatus,
};
