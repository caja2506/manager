/**
 * Task Workflow — ESM Wrapper
 * ============================
 * Re-exports everything from the CJS source as proper ESM named exports.
 * This allows Vite to import it cleanly without CJS interop issues.
 * 
 * The CJS version (taskWorkflow.cjs) remains the source of truth
 * for Node.js Cloud Functions that use require().
 */

// Vite handles .cjs → ESM interop via named exports when using `import { ... }`
export {
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
} from './taskWorkflow.cjs';
