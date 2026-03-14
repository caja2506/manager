/**
 * Planner Rules
 * =============
 * 
 * Deterministic compliance rules for the Weekly Planner.
 * 
 * Rules:
 *   USER_OVER_CAPACITY          — weekly planned hours > weeklyCapacityHours
 *   USER_UNDERUTILIZED          — weekly planned hours < 60% of capacity
 *   CRITICAL_TASK_NOT_PLANNED   — high/critical tasks with no planner slots
 *   PLANNER_INCOMPLETE_WEEK     — user has fewer than 3 days planned
 */

import { AUDIT_FINDING_SEVERITY } from '../../models/schemas';

// ============================================================
// RULE DEFINITIONS
// ============================================================

/**
 * USER_OVER_CAPACITY
 * User's weekly planned hours exceed their capacity.
 */
export function evaluateUserOverCapacity(userId, plannerSlots, userProfile) {
    const capacity = userProfile?.weeklyCapacityHours || 40;
    const totalPlanned = plannerSlots.reduce((sum, slot) => sum + (slot.plannedHours || 0), 0);

    if (totalPlanned > capacity) {
        const excessHours = (totalPlanned - capacity).toFixed(1);
        return {
            ruleId: 'USER_OVER_CAPACITY',
            entityType: 'user',
            entityId: userId,
            severity: totalPlanned > capacity * 1.3
                ? AUDIT_FINDING_SEVERITY.CRITICAL
                : AUDIT_FINDING_SEVERITY.WARNING,
            title: 'Usuario sobrecargado',
            message: `Capacidad semanal excedida por ${excessHours}h (planificado: ${totalPlanned.toFixed(1)}h, capacidad: ${capacity}h)`,
            recommendedAction: 'Redistribuir carga o priorizar tareas',
            scoreImpact: -10,
            metadata: { totalPlanned, capacity, excessHours: Number(excessHours) },
        };
    }
    return null;
}

/**
 * USER_UNDERUTILIZED
 * User's weekly planned hours are below 60% of capacity.
 */
export function evaluateUserUnderutilized(userId, plannerSlots, userProfile) {
    const capacity = userProfile?.weeklyCapacityHours || 40;
    const totalPlanned = plannerSlots.reduce((sum, slot) => sum + (slot.plannedHours || 0), 0);
    const threshold = capacity * 0.6;

    if (totalPlanned < threshold && totalPlanned > 0) {
        const utilizationPct = ((totalPlanned / capacity) * 100).toFixed(0);
        return {
            ruleId: 'USER_UNDERUTILIZED',
            entityType: 'user',
            entityId: userId,
            severity: AUDIT_FINDING_SEVERITY.INFO,
            title: 'Usuario subutilizado',
            message: `Utilización semanal al ${utilizationPct}% (planificado: ${totalPlanned.toFixed(1)}h de ${capacity}h)`,
            recommendedAction: 'Asignar más tareas o revisar la planificación',
            scoreImpact: -3,
            metadata: { totalPlanned, capacity, utilizationPct: Number(utilizationPct) },
        };
    }
    return null;
}

/**
 * CRITICAL_TASK_NOT_PLANNED
 * High or critical priority tasks that have no planner slots in the current week.
 */
export function evaluateCriticalTaskNotPlanned(task, plannerSlots) {
    if (!['high', 'critical'].includes(task.priority)) return null;
    if (['completed', 'cancelled', 'backlog'].includes(task.status)) return null;

    const hasSlots = plannerSlots.some(slot => slot.taskId === task.id);

    if (!hasSlots) {
        return {
            ruleId: 'CRITICAL_TASK_NOT_PLANNED',
            entityType: 'task',
            entityId: task.id,
            severity: task.priority === 'critical'
                ? AUDIT_FINDING_SEVERITY.CRITICAL
                : AUDIT_FINDING_SEVERITY.WARNING,
            title: 'Tarea crítica no planificada',
            message: `La tarea "${task.title}" (prioridad ${task.priority}) no tiene bloques planificados esta semana`,
            recommendedAction: 'Incluir la tarea en el planner semanal',
            scoreImpact: task.priority === 'critical' ? -12 : -8,
        };
    }
    return null;
}

/**
 * PLANNER_INCOMPLETE_WEEK
 * User has fewer than 3 days with planned work in the current week.
 */
export function evaluatePlannerIncompleteWeek(userId, plannerSlots) {
    if (plannerSlots.length === 0) return null; // No data = no warning

    const uniqueDays = new Set(plannerSlots.map(slot => slot.date || slot.dayOfWeek));

    if (uniqueDays.size < 3) {
        return {
            ruleId: 'PLANNER_INCOMPLETE_WEEK',
            entityType: 'user',
            entityId: userId,
            severity: AUDIT_FINDING_SEVERITY.INFO,
            title: 'Planner incompleto',
            message: `Solo ${uniqueDays.size} día(s) con trabajo planificado esta semana`,
            recommendedAction: 'Completar la planificación semanal (mínimo 3 días)',
            scoreImpact: -3,
            metadata: { daysPlanned: uniqueDays.size },
        };
    }
    return null;
}

// ============================================================
// AGGREGATE
// ============================================================

export const PLANNER_RULES = [
    { id: 'USER_OVER_CAPACITY', evaluate: evaluateUserOverCapacity },
    { id: 'USER_UNDERUTILIZED', evaluate: evaluateUserUnderutilized },
    { id: 'CRITICAL_TASK_NOT_PLANNED', evaluate: evaluateCriticalTaskNotPlanned },
    { id: 'PLANNER_INCOMPLETE_WEEK', evaluate: evaluatePlannerIncompleteWeek },
];
