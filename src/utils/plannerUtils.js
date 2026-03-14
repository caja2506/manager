/**
 * plannerUtils.js — Weekly Planner Enrichment & Validation Utilities
 * ==================================================================
 *
 * This module provides the "join layer" between weeklyPlanItems (scheduling)
 * and tasks (master records). Instead of relying on snapshot fields stored
 * inside each plan item, the frontend enriches plan items at read-time with
 * live data from tasks, projects, and team members.
 *
 * Architecture principle:
 *   tasks        = source of truth (title, status, priority, assignedTo, …)
 *   planItems    = scheduling only  (taskId, dates, plannedHours, …)
 *   enriched     = merged view for UI rendering
 */

// ─── Enrichment ────────────────────────────────────────────────

/**
 * Enrich an array of raw weeklyPlanItems with live data from tasks,
 * projects, and team members. Falls back to legacy snapshot fields
 * when the referenced task no longer exists.
 *
 * Each enriched item receives:
 *   - title              (from task.title OR legacy taskTitleSnapshot)
 *   - projectName        (from project.name OR legacy projectNameSnapshot)
 *   - status             (from task.status OR legacy statusSnapshot)
 *   - priority           (from task.priority OR legacy item.priority)
 *   - assigneeDisplayName(from teamMember OR legacy assignedToName)
 *   - estimatedHours     (from task.estimatedHours)
 *   - _taskNotFound      (boolean — true when taskId doesn't match any task)
 *
 * @param {Array} planItems   — raw Firestore weeklyPlanItem docs
 * @param {Array} tasks       — engTasks array from AppDataContext
 * @param {Array} projects    — engProjects array from AppDataContext
 * @param {Array} teamMembers — teamMembers array from AppDataContext
 * @returns {Array} enriched plan items ready for rendering
 */
export function enrichPlanItemsWithTasks(planItems, tasks, projects, teamMembers) {
    // Build lookup maps for O(1) access
    const taskMap    = new Map(tasks.map(t => [t.id, t]));
    const projectMap = new Map(projects.map(p => [p.id, p]));
    const memberMap  = new Map(teamMembers.map(m => [m.uid, m]));

    return planItems.map(item => {
        const task    = item.taskId ? taskMap.get(item.taskId) : null;
        const project = (task?.projectId || item.projectId)
            ? projectMap.get(task?.projectId || item.projectId)
            : null;
        const member  = (task?.assignedTo || item.assignedTo)
            ? memberMap.get(task?.assignedTo || item.assignedTo)
            : null;

        const memberName = member?.displayName || member?.email || '';

        return {
            ...item,

            // ── Live data (preferred) with snapshot fallback ──
            title:               task?.title    ?? item.taskTitleSnapshot    ?? '(Sin título)',
            projectName:         project?.name  ?? item.projectNameSnapshot  ?? '',
            status:              task?.status   ?? item.statusSnapshot       ?? 'pending',
            priority:            task?.priority ?? item.priority             ?? 'medium',
            assigneeDisplayName: memberName     || item.assignedToName       || '',
            estimatedHours:      task?.estimatedHours ?? 0,

            // ── Resolved IDs (prefer live) ──
            assignedTo:          task?.assignedTo ?? item.assignedTo ?? null,
            projectId:           task?.projectId  ?? item.projectId  ?? null,

            // ── Orphan flag ──
            _taskNotFound:       item.taskId ? !task : false,
        };
    });
}


// ─── Validation ────────────────────────────────────────────────

/**
 * Validate plan item data before persisting.
 *
 * Returns { valid: true } or { valid: false, errors: string[] }
 *
 * Rules (Phase 7 requirements):
 *   - taskId is required
 *   - startDateTime and endDateTime must be valid ISO strings
 *   - endDateTime must be after startDateTime
 *   - plannedHours must be > 0
 *
 * @param {Object} data — plan item fields to validate
 * @returns {{ valid: boolean, errors?: string[] }}
 */
export function validatePlanItem(data) {
    const errors = [];

    // taskId obligatorio
    if (!data.taskId) {
        errors.push('taskId es obligatorio para crear un plan item.');
    }

    // Validar fechas
    const start = data.startDateTime ? new Date(data.startDateTime) : null;
    const end   = data.endDateTime   ? new Date(data.endDateTime)   : null;

    if (!start || isNaN(start.getTime())) {
        errors.push('startDateTime no es una fecha válida.');
    }
    if (!end || isNaN(end.getTime())) {
        errors.push('endDateTime no es una fecha válida.');
    }
    if (start && end && !isNaN(start.getTime()) && !isNaN(end.getTime())) {
        if (end <= start) {
            errors.push('endDateTime debe ser posterior a startDateTime.');
        }
    }

    // plannedHours > 0
    if (typeof data.plannedHours !== 'number' || data.plannedHours <= 0) {
        errors.push('plannedHours debe ser mayor a 0.');
    }

    return errors.length > 0 ? { valid: false, errors } : { valid: true };
}


// ─── Capacity Warning ──────────────────────────────────────────

/**
 * Check if total planned hours for a task across all plan items
 * exceeds its estimated hours. Returns a warning message or null.
 *
 * @param {string} taskId
 * @param {number} estimatedHours — from the task master record
 * @param {Array}  allPlanItems   — all plan items (not just the current week)
 * @returns {string|null} warning message or null
 */
export function checkOverPlanning(taskId, estimatedHours, allPlanItems) {
    if (!taskId || !estimatedHours || estimatedHours <= 0) return null;

    const totalPlanned = allPlanItems
        .filter(pi => pi.taskId === taskId)
        .reduce((sum, pi) => sum + (pi.plannedHours || 0), 0);

    if (totalPlanned > estimatedHours) {
        const excess = (totalPlanned - estimatedHours).toFixed(1);
        return `⚠ La tarea tiene ${totalPlanned.toFixed(1)}h planificadas vs ${estimatedHours}h estimadas (+${excess}h de exceso).`;
    }
    return null;
}
