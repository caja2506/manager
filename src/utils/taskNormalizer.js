/**
 * Task Normalizer
 * ===============
 * 
 * Normalizes legacy task documents at read-time to match the official
 * data contract. This ensures backward compatibility without requiring
 * a bulk Firestore migration.
 * 
 * OFFICIAL FIELD CONTRACT (see schemas.js createTaskDocument):
 *   - completedDate (not completedAt)
 *   - blockedReason (not blockReason)
 *   - status values: backlog, pending, in_progress, blocked, validation, completed, cancelled
 * 
 * Usage:
 *   import { normalizeTask, normalizeTasks } from '../utils/taskNormalizer';
 *   const task = normalizeTask(rawFirestoreDoc);
 *   const tasks = normalizeTasks(rawDocs);
 */

/**
 * Normalize a single task document from Firestore.
 * Maps legacy field names to official names.
 * 
 * @param {Object} raw — raw Firestore task document
 * @returns {Object} normalized task with official field names
 */
export function normalizeTask(raw) {
    if (!raw) return raw;

    const normalized = { ...raw };

    // ── completedAt → completedDate ──
    // Legacy docs may have completedAt; official field is completedDate.
    if (raw.completedAt && !raw.completedDate) {
        normalized.completedDate = raw.completedAt;
    }

    // ── blockReason → blockedReason ──
    // Typo variant that may exist in some legacy docs.
    if (raw.blockReason && !raw.blockedReason) {
        normalized.blockedReason = raw.blockReason;
    }

    return normalized;
}

/**
 * Normalize an array of task documents.
 * 
 * @param {Array} tasks — raw Firestore task documents
 * @returns {Array} normalized tasks
 */
export function normalizeTasks(tasks) {
    if (!Array.isArray(tasks)) return tasks;
    return tasks.map(normalizeTask);
}
