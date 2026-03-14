/**
 * Project Rules
 * =============
 * 
 * Deterministic compliance rules for projects.
 * 
 * Rules:
 *   PROJECT_TOO_MANY_OVERDUE_TASKS     — >30% of tasks overdue
 *   PROJECT_HIGH_DELAY_RATE            — >20% of tasks have delays
 *   PROJECT_CRITICAL_DEPENDENCY_EXPIRED — dependency predecessor overdue
 */

import { AUDIT_FINDING_SEVERITY } from '../../models/schemas';
import { isTerminalStatus } from '../workflow/workflowModel';

// ============================================================
// RULE DEFINITIONS
// ============================================================

/**
 * PROJECT_TOO_MANY_OVERDUE_TASKS
 * More than 30% of active tasks in the project are overdue.
 */
export function evaluateProjectOverdueTasks(project, projectTasks) {
    if (!projectTasks || projectTasks.length === 0) return null;

    const activeTasks = projectTasks.filter(t => !isTerminalStatus(t.status));
    if (activeTasks.length === 0) return null;

    const now = new Date();
    const overdueTasks = activeTasks.filter(t =>
        t.dueDate && new Date(t.dueDate) < now
    );

    const overdueRate = overdueTasks.length / activeTasks.length;

    if (overdueRate > 0.3) {
        return {
            ruleId: 'PROJECT_TOO_MANY_OVERDUE_TASKS',
            entityType: 'project',
            entityId: project.id,
            severity: overdueRate > 0.5
                ? AUDIT_FINDING_SEVERITY.CRITICAL
                : AUDIT_FINDING_SEVERITY.WARNING,
            title: 'Proyecto con demasiadas tareas vencidas',
            message: `El proyecto "${project.name}" tiene ${overdueTasks.length} de ${activeTasks.length} tareas activas vencidas (${(overdueRate * 100).toFixed(0)}%)`,
            recommendedAction: 'Revisar prioridades y fechas límite del proyecto',
            scoreImpact: overdueRate > 0.5 ? -20 : -12,
            metadata: {
                activeTasks: activeTasks.length,
                overdueTasks: overdueTasks.length,
                overdueRate: Number((overdueRate * 100).toFixed(1)),
            },
        };
    }
    return null;
}

/**
 * PROJECT_HIGH_DELAY_RATE
 * More than 20% of tasks in the project have open delays.
 */
export function evaluateProjectHighDelayRate(project, projectTasks, projectDelays) {
    if (!projectTasks || projectTasks.length === 0) return null;

    const activeTasks = projectTasks.filter(t => !isTerminalStatus(t.status));
    if (activeTasks.length === 0) return null;

    const openDelays = (projectDelays || []).filter(d => !d.resolved);
    const tasksWithDelays = new Set(openDelays.map(d => d.taskId).filter(Boolean));
    const delayRate = tasksWithDelays.size / activeTasks.length;

    if (delayRate > 0.2) {
        return {
            ruleId: 'PROJECT_HIGH_DELAY_RATE',
            entityType: 'project',
            entityId: project.id,
            severity: delayRate > 0.4
                ? AUDIT_FINDING_SEVERITY.CRITICAL
                : AUDIT_FINDING_SEVERITY.WARNING,
            title: 'Proyecto con alta tasa de delays',
            message: `El proyecto "${project.name}" tiene ${tasksWithDelays.size} tareas con delays activos (${(delayRate * 100).toFixed(0)}% de las tareas activas)`,
            recommendedAction: 'Investigar causas raíz de delays y tomar acciones correctivas',
            scoreImpact: delayRate > 0.4 ? -15 : -10,
            metadata: {
                activeTasks: activeTasks.length,
                tasksWithDelays: tasksWithDelays.size,
                openDelays: openDelays.length,
                delayRate: Number((delayRate * 100).toFixed(1)),
            },
        };
    }
    return null;
}

/**
 * PROJECT_CRITICAL_DEPENDENCY_EXPIRED
 * A dependency predecessor task is overdue, potentially blocking the successor.
 */
export function evaluateProjectCriticalDependencyExpired(project, projectTasks, dependencies) {
    if (!dependencies || dependencies.length === 0) return null;

    const findings = [];
    const now = new Date();
    const taskMap = new Map(projectTasks.map(t => [t.id, t]));

    for (const dep of dependencies) {
        const predecessor = taskMap.get(dep.predecessorTaskId);
        const successor = taskMap.get(dep.successorTaskId);

        if (!predecessor || !successor) continue;
        if (isTerminalStatus(predecessor.status)) continue;

        // Predecessor is overdue
        if (predecessor.dueDate && new Date(predecessor.dueDate) < now) {
            findings.push({
                ruleId: 'PROJECT_CRITICAL_DEPENDENCY_EXPIRED',
                entityType: 'project',
                entityId: project.id,
                severity: dep.isCritical
                    ? AUDIT_FINDING_SEVERITY.CRITICAL
                    : AUDIT_FINDING_SEVERITY.WARNING,
                title: 'Dependencia crítica vencida',
                message: `La tarea predecessora "${predecessor.title}" está vencida, bloqueando "${successor.title}"`,
                recommendedAction: 'Completar la tarea predecessora o ajustar la dependencia',
                scoreImpact: dep.isCritical ? -15 : -8,
                metadata: {
                    predecessorId: predecessor.id,
                    predecessorTitle: predecessor.title,
                    successorId: successor.id,
                    successorTitle: successor.title,
                    dependencyType: dep.type,
                },
            });
        }
    }

    return findings.length > 0 ? findings : null;
}

// ============================================================
// AGGREGATE
// ============================================================

export const PROJECT_RULES = [
    { id: 'PROJECT_TOO_MANY_OVERDUE_TASKS', evaluate: evaluateProjectOverdueTasks },
    { id: 'PROJECT_HIGH_DELAY_RATE', evaluate: evaluateProjectHighDelayRate },
    { id: 'PROJECT_CRITICAL_DEPENDENCY_EXPIRED', evaluate: evaluateProjectCriticalDependencyExpired },
];
