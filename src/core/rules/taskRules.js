/**
 * Task Rules
 * ==========
 * 
 * Deterministic methodology compliance rules for tasks.
 * Each rule evaluator receives a task and context, returns a finding or null.
 * 
 * Rules:
 *   TASK_NO_ASSIGNEE        — task has no assignedTo
 *   TASK_NO_ESTIMATE        — task has estimatedHours === 0
 *   TASK_OVERDUE            — dueDate is past and status not terminal
 *   TASK_COMPLETED_NO_HOURS — completed with actualHours === 0
 *   TASK_BLOCKED_NO_DELAY   — blocked but no delay record
 *   TASK_LARGE_NO_SUBTASKS  — estimatedHours > 16 with no subtasks
 *   TASK_WITHOUT_PROJECT    — projectId is null
 *   TASK_STALE_NO_UPDATE    — no update in 7+ days while active
 */

import { AUDIT_FINDING_SEVERITY } from '../../models/schemas';
import { isActiveStatus, isTerminalStatus } from '../workflow/workflowModel';
import { getDaysUntil } from '../../utils/dateUtils';

// ============================================================
// RULE DEFINITIONS
// ============================================================

/**
 * TASK_NO_ASSIGNEE
 * Task has no assignee. Tasks should always have a responsible person.
 */
export function evaluateTaskNoAssignee(task) {
    if (isTerminalStatus(task.status)) return null;
    if (task.status === 'backlog') return null; // Backlog tasks may not have assignee yet

    if (!task.assignedTo) {
        return {
            ruleId: 'TASK_NO_ASSIGNEE',
            entityType: 'task',
            entityId: task.id,
            severity: AUDIT_FINDING_SEVERITY.WARNING,
            title: 'Tarea sin responsable',
            message: `La tarea "${task.title}" no tiene responsable asignado`,
            recommendedAction: 'Asignar un responsable antes de continuar',
            scoreImpact: -5,
        };
    }
    return null;
}

/**
 * TASK_NO_ESTIMATE
 * Task has no estimated hours. Estimation is critical for planning.
 */
export function evaluateTaskNoEstimate(task) {
    if (isTerminalStatus(task.status)) return null;
    if (task.status === 'backlog') return null;

    if (!task.estimatedHours || task.estimatedHours <= 0) {
        return {
            ruleId: 'TASK_NO_ESTIMATE',
            entityType: 'task',
            entityId: task.id,
            severity: AUDIT_FINDING_SEVERITY.WARNING,
            title: 'Tarea sin estimación',
            message: `La tarea "${task.title}" no tiene horas estimadas`,
            recommendedAction: 'Agregar estimación de horas antes de ejecución',
            scoreImpact: -5,
        };
    }
    return null;
}

/**
 * TASK_OVERDUE
 * Task is past its due date and not in a terminal status.
 */
export function evaluateTaskOverdue(task) {
    if (isTerminalStatus(task.status)) return null;
    if (!task.dueDate) return null;

    const daysUntil = getDaysUntil(task.dueDate);

    if (daysUntil < 0) {
        const daysOverdue = Math.abs(daysUntil);
        const severity = daysOverdue > 7
            ? AUDIT_FINDING_SEVERITY.CRITICAL
            : AUDIT_FINDING_SEVERITY.WARNING;

        return {
            ruleId: 'TASK_OVERDUE',
            entityType: 'task',
            entityId: task.id,
            severity,
            title: 'Tarea vencida',
            message: `La tarea "${task.title}" está vencida por ${daysOverdue} día(s)`,
            recommendedAction: 'Actualizar fecha de entrega o completar la tarea',
            scoreImpact: daysOverdue > 7 ? -15 : -10,
            metadata: { daysOverdue, dueDate: task.dueDate },
        };
    }
    return null;
}

/**
 * TASK_COMPLETED_NO_HOURS
 * Task was completed but has no actual hours logged.
 */
export function evaluateTaskCompletedNoHours(task, context = {}) {
    if (task.status !== 'completed') return null;

    const { timeLogs = [] } = context;
    const taskTimeLogs = timeLogs.filter(log => log.taskId === task.id);
    const totalHours = taskTimeLogs.reduce((sum, log) => sum + (log.totalHours || 0), 0);
    const actualHours = task.actualHours || totalHours;

    if (actualHours <= 0) {
        return {
            ruleId: 'TASK_COMPLETED_NO_HOURS',
            entityType: 'task',
            entityId: task.id,
            severity: AUDIT_FINDING_SEVERITY.WARNING,
            title: 'Tarea completada sin horas',
            message: `La tarea "${task.title}" fue completada sin registrar horas de trabajo`,
            recommendedAction: 'Registrar las horas trabajadas para mantener métricas correctas',
            scoreImpact: -8,
        };
    }
    return null;
}

/**
 * TASK_BLOCKED_NO_DELAY
 * Task is blocked but has no associated delay record.
 */
export function evaluateTaskBlockedNoDelay(task, context = {}) {
    if (task.status !== 'blocked') return null;

    const { delays = [] } = context;
    const taskDelays = delays.filter(d => d.taskId === task.id && !d.resolved);

    if (taskDelays.length === 0) {
        return {
            ruleId: 'TASK_BLOCKED_NO_DELAY',
            entityType: 'task',
            entityId: task.id,
            severity: AUDIT_FINDING_SEVERITY.WARNING,
            title: 'Tarea bloqueada sin delay registrado',
            message: `La tarea "${task.title}" está bloqueada pero no tiene un delay/causa registrada`,
            recommendedAction: 'Registrar la causa del bloqueo para seguimiento',
            scoreImpact: -5,
        };
    }
    return null;
}

/**
 * TASK_LARGE_NO_SUBTASKS
 * Task has > 16 estimated hours but no subtasks — should be broken down.
 */
export function evaluateTaskLargeNoSubtasks(task, context = {}) {
    if (isTerminalStatus(task.status)) return null;
    if (!task.estimatedHours || task.estimatedHours <= 16) return null;

    const { subtasks = [] } = context;
    const taskSubtasks = subtasks.filter(st => st.taskId === task.id);

    if (taskSubtasks.length === 0) {
        return {
            ruleId: 'TASK_LARGE_NO_SUBTASKS',
            entityType: 'task',
            entityId: task.id,
            severity: AUDIT_FINDING_SEVERITY.INFO,
            title: 'Tarea grande sin subtareas',
            message: `La tarea "${task.title}" tiene ${task.estimatedHours}h estimadas sin subtareas. Se recomienda descomponerla.`,
            recommendedAction: 'Dividir la tarea en subtareas más pequeñas (< 16h cada una)',
            scoreImpact: -3,
        };
    }
    return null;
}

/**
 * TASK_WITHOUT_PROJECT
 * Task has no project assignment.
 */
export function evaluateTaskWithoutProject(task) {
    if (isTerminalStatus(task.status)) return null;
    if (task.status === 'backlog') return null;

    if (!task.projectId) {
        return {
            ruleId: 'TASK_WITHOUT_PROJECT',
            entityType: 'task',
            entityId: task.id,
            severity: AUDIT_FINDING_SEVERITY.INFO,
            title: 'Tarea sin proyecto',
            message: `La tarea "${task.title}" no está asignada a ningún proyecto`,
            recommendedAction: 'Asignar la tarea a un proyecto para mejor trazabilidad',
            scoreImpact: -3,
        };
    }
    return null;
}

/**
 * TASK_STALE_NO_UPDATE
 * Task has not been updated in 7+ days while in an active status.
 */
export function evaluateTaskStaleNoUpdate(task) {
    if (!isActiveStatus(task.status)) return null;

    const updatedAt = task.updatedAt ? new Date(task.updatedAt) : null;
    if (!updatedAt) return null;

    const now = new Date();
    const daysSinceUpdate = Math.floor((now - updatedAt) / (1000 * 60 * 60 * 24));

    if (daysSinceUpdate >= 7) {
        return {
            ruleId: 'TASK_STALE_NO_UPDATE',
            entityType: 'task',
            entityId: task.id,
            severity: daysSinceUpdate >= 14
                ? AUDIT_FINDING_SEVERITY.WARNING
                : AUDIT_FINDING_SEVERITY.INFO,
            title: 'Tarea sin actualizar',
            message: `La tarea "${task.title}" no ha sido actualizada en ${daysSinceUpdate} días`,
            recommendedAction: 'Actualizar el estado y progreso de la tarea',
            scoreImpact: daysSinceUpdate >= 14 ? -8 : -3,
            metadata: { daysSinceUpdate, lastUpdated: task.updatedAt },
        };
    }
    return null;
}

// ============================================================
// AGGREGATE EVALUATOR
// ============================================================

/**
 * All task rules in evaluation order.
 */
export const TASK_RULES = [
    { id: 'TASK_NO_ASSIGNEE', evaluate: evaluateTaskNoAssignee, needsContext: false },
    { id: 'TASK_NO_ESTIMATE', evaluate: evaluateTaskNoEstimate, needsContext: false },
    { id: 'TASK_OVERDUE', evaluate: evaluateTaskOverdue, needsContext: false },
    { id: 'TASK_COMPLETED_NO_HOURS', evaluate: evaluateTaskCompletedNoHours, needsContext: true },
    { id: 'TASK_BLOCKED_NO_DELAY', evaluate: evaluateTaskBlockedNoDelay, needsContext: true },
    { id: 'TASK_LARGE_NO_SUBTASKS', evaluate: evaluateTaskLargeNoSubtasks, needsContext: true },
    { id: 'TASK_WITHOUT_PROJECT', evaluate: evaluateTaskWithoutProject, needsContext: false },
    { id: 'TASK_STALE_NO_UPDATE', evaluate: evaluateTaskStaleNoUpdate, needsContext: false },
];

/**
 * Evaluate all task rules against a single task.
 * 
 * @param {Object} task - The task document
 * @param {Object} [context={}] - { timeLogs, delays, subtasks }
 * @returns {Array} findings
 */
export function evaluateAllTaskRules(task, context = {}) {
    const findings = [];

    for (const rule of TASK_RULES) {
        const finding = rule.needsContext
            ? rule.evaluate(task, context)
            : rule.evaluate(task);

        if (finding) {
            findings.push(finding);
        }
    }

    return findings;
}
