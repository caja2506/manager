/**
 * User Discipline Rules
 * =====================
 * 
 * Deterministic rules checking user operational discipline.
 * 
 * Rules:
 *   USER_MISSING_TIMELOGS         — user has in_progress tasks with no time logs in 3 days
 *   USER_LOW_UPDATE_DISCIPLINE    — user has tasks not updated in 5+ days
 *   TASK_REOPENED_TOO_MANY_TIMES  — task moved back to backlog/pending 3+ times
 */

import { AUDIT_FINDING_SEVERITY } from '../../models/schemas';
import { isActiveStatus } from '../workflow/workflowModel';

// ============================================================
// RULE DEFINITIONS
// ============================================================

/**
 * USER_MISSING_TIMELOGS
 * User has in_progress tasks with no time logs in the past 3 days.
 */
export function evaluateUserMissingTimelogs(userId, userTasks, timeLogs) {
    const inProgressTasks = userTasks.filter(t =>
        t.status === 'in_progress' && t.assignedTo === userId
    );

    if (inProgressTasks.length === 0) return null;

    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

    const recentLogs = timeLogs.filter(log =>
        log.userId === userId &&
        log.startTime &&
        new Date(log.startTime) >= threeDaysAgo
    );

    const tasksWithRecentLogs = new Set(recentLogs.map(log => log.taskId));
    const tasksWithoutLogs = inProgressTasks.filter(t => !tasksWithRecentLogs.has(t.id));

    if (tasksWithoutLogs.length > 0) {
        return {
            ruleId: 'USER_MISSING_TIMELOGS',
            entityType: 'user',
            entityId: userId,
            severity: tasksWithoutLogs.length >= 3
                ? AUDIT_FINDING_SEVERITY.WARNING
                : AUDIT_FINDING_SEVERITY.INFO,
            title: 'Tareas sin registro de horas reciente',
            message: `${tasksWithoutLogs.length} tarea(s) en progreso sin registro de horas en los últimos 3 días`,
            recommendedAction: 'Registrar horas de trabajo o actualizar estado de las tareas',
            scoreImpact: -5,
            metadata: {
                tasksWithoutLogs: tasksWithoutLogs.map(t => ({
                    id: t.id,
                    title: t.title,
                })),
            },
        };
    }
    return null;
}

/**
 * USER_LOW_UPDATE_DISCIPLINE
 * User has active tasks not updated in 5+ days.
 */
export function evaluateUserLowUpdateDiscipline(userId, userTasks) {
    const activeTasks = userTasks.filter(t =>
        isActiveStatus(t.status) && t.assignedTo === userId
    );

    if (activeTasks.length === 0) return null;

    const fiveDaysAgo = new Date();
    fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);

    const staleTasks = activeTasks.filter(t => {
        const updatedAt = t.updatedAt ? new Date(t.updatedAt) : null;
        return !updatedAt || updatedAt < fiveDaysAgo;
    });

    if (staleTasks.length > 0) {
        return {
            ruleId: 'USER_LOW_UPDATE_DISCIPLINE',
            entityType: 'user',
            entityId: userId,
            severity: staleTasks.length >= 3
                ? AUDIT_FINDING_SEVERITY.WARNING
                : AUDIT_FINDING_SEVERITY.INFO,
            title: 'Baja disciplina de actualización',
            message: `${staleTasks.length} tarea(s) activa(s) no actualizada(s) en los últimos 5 días`,
            recommendedAction: 'Actualizar el estado y progreso de las tareas asignadas',
            scoreImpact: -5,
            metadata: {
                staleTasks: staleTasks.map(t => ({
                    id: t.id,
                    title: t.title,
                    lastUpdated: t.updatedAt,
                })),
            },
        };
    }
    return null;
}

/**
 * TASK_REOPENED_TOO_MANY_TIMES
 * Task has audit events showing it was moved back to backlog/pending 3+ times.
 * 
 * NOTE: This rule requires auditEvents data. If not available, it falls back
 * to checking a `reopenCount` field on the task (if present).
 */
export function evaluateTaskReopenedTooManyTimes(task, auditEvents = []) {
    // Check auditEvents for status changes back to backlog/pending
    const reopenEvents = auditEvents.filter(event =>
        event.entityId === task.id &&
        event.eventType === 'task_status_changed' &&
        ['backlog', 'pending'].includes(event.newValue) &&
        !['backlog', 'pending'].includes(event.previousValue)
    );

    const reopenCount = reopenEvents.length || (task.reopenCount || 0);

    if (reopenCount >= 3) {
        return {
            ruleId: 'TASK_REOPENED_TOO_MANY_TIMES',
            entityType: 'task',
            entityId: task.id,
            severity: AUDIT_FINDING_SEVERITY.WARNING,
            title: 'Tarea reabierta demasiadas veces',
            message: `La tarea "${task.title}" ha sido reabierta ${reopenCount} veces`,
            recommendedAction: 'Revisar la definición de la tarea y criterios de aceptación',
            scoreImpact: -10,
            metadata: { reopenCount },
        };
    }
    return null;
}

// ============================================================
// AGGREGATE
// ============================================================

export const USER_DISCIPLINE_RULES = [
    { id: 'USER_MISSING_TIMELOGS', evaluate: evaluateUserMissingTimelogs },
    { id: 'USER_LOW_UPDATE_DISCIPLINE', evaluate: evaluateUserLowUpdateDiscipline },
    { id: 'TASK_REOPENED_TOO_MANY_TIMES', evaluate: evaluateTaskReopenedTooManyTimes },
];
