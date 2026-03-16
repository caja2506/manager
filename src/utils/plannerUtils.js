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
 *
 * VALIDATION CONTRACT:
 *   Blocking (B1-B7): prevent persistence — throw in service layer
 *   Warnings (W1-W5): flagged but allowed — returned to UI for display
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
    const taskMap = new Map(tasks.map(t => [t.id, t]));
    const projectMap = new Map(projects.map(p => [p.id, p]));
    const memberMap = new Map(teamMembers.map(m => [m.uid, m]));

    return planItems.map(item => {
        const task = item.taskId ? taskMap.get(item.taskId) : null;
        const project = (task?.projectId || item.projectId)
            ? projectMap.get(task?.projectId || item.projectId)
            : null;
        const member = (task?.assignedTo || item.assignedTo)
            ? memberMap.get(task?.assignedTo || item.assignedTo)
            : null;

        const memberName = member?.displayName || member?.email || '';

        return {
            ...item,

            // ── Live data (preferred) with snapshot fallback ──
            title: task?.title ?? item.taskTitleSnapshot ?? '(Sin título)',
            projectName: project?.name ?? item.projectNameSnapshot ?? '',
            status: task?.status ?? item.statusSnapshot ?? 'pending',
            priority: task?.priority ?? item.priority ?? 'medium',
            assigneeDisplayName: memberName || item.assignedToName || '',
            estimatedHours: task?.estimatedHours ?? 0,

            // ── Resolved IDs (prefer live) ──
            assignedTo: task?.assignedTo ?? item.assignedTo ?? null,
            projectId: task?.projectId ?? item.projectId ?? null,

            // ── Orphan flag ──
            _taskNotFound: item.taskId ? !task : false,
        };
    });
}


// ─── Blocking Validation (B1–B7) ──────────────────────────────

/**
 * Validate plan item data before persisting.
 *
 * Returns { valid, errors[], warnings[] }
 *
 * BLOCKING rules (B1–B7) — violations in `errors` prevent persistence.
 *
 * @param {Object} data — plan item fields to validate
 * @returns {{ valid: boolean, errors: string[], warnings: string[] }}
 */
export function validatePlanItem(data) {
    const errors = [];
    const warnings = [];

    // B1: taskId is required
    if (!data.taskId) {
        errors.push('taskId es obligatorio para crear un plan item.');
    }

    // B2: assignedTo is required
    if (!data.assignedTo) {
        errors.push('assignedTo es obligatorio — cada bloque debe tener un responsable.');
    }

    // B3: weekStartDate is required and must be a valid Monday
    if (!data.weekStartDate) {
        errors.push('weekStartDate es obligatorio.');
    } else {
        const wsd = new Date(data.weekStartDate + 'T00:00:00');
        if (isNaN(wsd.getTime())) {
            errors.push('weekStartDate no es una fecha válida.');
        } else if (wsd.getDay() !== 1) {
            errors.push('weekStartDate debe ser un lunes.');
        }
    }

    // B4: startDateTime and endDateTime must be valid ISO strings
    const start = data.startDateTime ? new Date(data.startDateTime) : null;
    const end = data.endDateTime ? new Date(data.endDateTime) : null;

    if (!start || isNaN(start.getTime())) {
        errors.push('startDateTime no es una fecha válida.');
    }
    if (!end || isNaN(end.getTime())) {
        errors.push('endDateTime no es una fecha válida.');
    }

    // B5: endDateTime must be after startDateTime
    if (start && end && !isNaN(start.getTime()) && !isNaN(end.getTime())) {
        if (end <= start) {
            errors.push('endDateTime debe ser posterior a startDateTime.');
        }
    }

    // B6: plannedHours > 0
    if (typeof data.plannedHours !== 'number' || data.plannedHours <= 0) {
        errors.push('plannedHours debe ser mayor a 0.');
    }

    // B7: date must fall within the target week (Mon-Fri of weekStartDate)
    if (data.date && data.weekStartDate) {
        const blockDate = new Date(data.date + 'T00:00:00');
        const weekMon = new Date(data.weekStartDate + 'T00:00:00');
        const weekFri = new Date(weekMon);
        weekFri.setDate(weekFri.getDate() + 4); // Friday

        if (!isNaN(blockDate.getTime()) && !isNaN(weekMon.getTime())) {
            if (blockDate < weekMon || blockDate > weekFri) {
                errors.push('La fecha del bloque debe estar dentro de la semana (Lun-Vie).');
            }
        }
    }

    return {
        valid: errors.length === 0,
        errors,
        warnings,
    };
}


// ─── Contextual Validation (W1–W5) ───────────────────────────

/**
 * Full validation: blocking rules + contextual warnings.
 *
 * Call this when you have access to existing plan items, the linked task,
 * and the user's weekly capacity. Returns the combined result.
 *
 * @param {Object} data — plan item fields
 * @param {Object} context
 * @param {Array}  context.existingItems — all plan items for the target week
 * @param {Object} context.linkedTask — the task referenced by data.taskId (or null)
 * @param {number} context.weeklyCapacityHours — user's weekly capacity (default 40)
 * @param {Array}  context.allItemsForTask — all plan items across all weeks for this task
 * @returns {{ valid: boolean, errors: string[], warnings: string[] }}
 */
export function validatePlanItemFull(data, context = {}) {
    // Start with blocking validation
    const result = validatePlanItem(data);

    const {
        existingItems = [],
        linkedTask = null,
        weeklyCapacityHours = 40,
        allItemsForTask = [],
    } = context;

    // W1: Overlap with same-user blocks on the same day
    const overlaps = checkOverlaps(data, existingItems);
    if (overlaps.length > 0) {
        result.warnings.push(
            `⚠ Solape detectado con ${overlaps.length} bloque(s) del mismo usuario en el mismo horario.`
        );
    }

    // W2: Weekly capacity exceeded
    const capacityCheck = checkWeeklyCapacity(
        data.assignedTo,
        data.plannedHours || 0,
        existingItems,
        weeklyCapacityHours
    );
    if (capacityCheck) {
        result.warnings.push(capacityCheck);
    }

    // W3: Task over-planned (total planned > estimated hours)
    if (linkedTask && linkedTask.estimatedHours > 0) {
        const currentTotalForTask = allItemsForTask
            .filter(pi => pi.taskId === data.taskId)
            .reduce((sum, pi) => sum + (pi.plannedHours || 0), 0);
        const newTotal = currentTotalForTask + (data.plannedHours || 0);

        if (newTotal > linkedTask.estimatedHours) {
            const excess = (newTotal - linkedTask.estimatedHours).toFixed(1);
            result.warnings.push(
                `⚠ Tarea sobre-planificada: ${newTotal.toFixed(1)}h planificadas vs ${linkedTask.estimatedHours}h estimadas (+${excess}h).`
            );
        }
    }

    // W4: Task is completed or cancelled
    if (linkedTask && ['completed', 'cancelled'].includes(linkedTask.status)) {
        result.warnings.push(
            `⚠ La tarea está ${linkedTask.status === 'completed' ? 'completada' : 'cancelada'}. ¿Seguro que quieres planificarla?`
        );
    }

    // W5: Block > 4 hours (low planning granularity)
    if (data.plannedHours && data.plannedHours > 4) {
        result.warnings.push(
            `⚠ Bloque de ${data.plannedHours}h — considera dividir en bloques más granulares (≤ 4h).`
        );
    }

    return result;
}


// ─── Overlap Detection ─────────────────────────────────────────

/**
 * Check if a new plan item overlaps with existing items for the same user
 * on the same day.
 *
 * @param {Object} newItem — the plan item being created
 * @param {Array}  existingItems — all plan items for the target week
 * @returns {Array} overlapping items (empty if no overlap)
 */
export function checkOverlaps(newItem, existingItems) {
    if (!newItem.startDateTime || !newItem.endDateTime || !newItem.assignedTo) {
        return [];
    }

    const newStart = new Date(newItem.startDateTime);
    const newEnd = new Date(newItem.endDateTime);

    return existingItems.filter(item => {
        // Same user, same day
        if (item.assignedTo !== newItem.assignedTo) return false;
        if (item.date !== newItem.date) return false;
        // Exclude self (for updates)
        if (item.id && item.id === newItem.id) return false;

        const itemStart = new Date(item.startDateTime);
        const itemEnd = new Date(item.endDateTime);

        // Time overlap: A.start < B.end && A.end > B.start
        return newStart < itemEnd && newEnd > itemStart;
    });
}


// ─── Capacity Check ────────────────────────────────────────────

/**
 * Check if adding plannedHours would exceed the user's weekly capacity.
 *
 * @param {string} userId — assignedTo uid
 * @param {number} addingHours — hours being added
 * @param {Array}  existingItems — all plan items for the target week
 * @param {number} weeklyCapacityHours — user's weekly capacity
 * @returns {string|null} warning message or null
 */
export function checkWeeklyCapacity(userId, addingHours, existingItems, weeklyCapacityHours = 40) {
    if (!userId || !weeklyCapacityHours) return null;

    const currentTotal = existingItems
        .filter(pi => pi.assignedTo === userId)
        .reduce((sum, pi) => sum + (pi.plannedHours || 0), 0);

    const newTotal = currentTotal + addingHours;

    if (newTotal > weeklyCapacityHours) {
        return `⚠ Capacidad semanal excedida: ${newTotal.toFixed(1)}h planificadas de ${weeklyCapacityHours}h disponibles (+${(newTotal - weeklyCapacityHours).toFixed(1)}h).`;
    }

    return null;
}


// ─── Legacy Compat: checkOverPlanning ──────────────────────────

/**
 * Check if total planned hours for a task across all plan items
 * exceeds its estimated hours. Returns a warning message or null.
 *
 * @deprecated Use validatePlanItemFull() W3 instead.
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
