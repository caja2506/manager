/**
 * Rule Catalog
 * ============
 * 
 * Master registry of all rules in the system.
 * Provides metadata lookup and categorization.
 */

import { AUDIT_FINDING_SEVERITY } from '../../models/schemas';

// ============================================================
// RULE CATEGORIES
// ============================================================

export const RULE_CATEGORY = {
    TASK: 'task',
    PLANNER: 'planner',
    PROJECT: 'project',
    DISCIPLINE: 'discipline',
};

// ============================================================
// MASTER RULE CATALOG
// ============================================================

/**
 * Complete catalog of all rules in the system.
 * Each entry provides metadata — the actual evaluation logic lives in the rule files.
 */
export const RULE_CATALOG = {
    // ── Task Rules ──
    TASK_NO_ASSIGNEE: {
        id: 'TASK_NO_ASSIGNEE',
        category: RULE_CATEGORY.TASK,
        defaultSeverity: AUDIT_FINDING_SEVERITY.WARNING,
        title: 'Tarea sin responsable',
        description: 'La tarea no tiene un responsable asignado',
        scoreImpact: -5,
        enabled: true,
    },
    TASK_NO_ESTIMATE: {
        id: 'TASK_NO_ESTIMATE',
        category: RULE_CATEGORY.TASK,
        defaultSeverity: AUDIT_FINDING_SEVERITY.WARNING,
        title: 'Tarea sin estimación',
        description: 'La tarea no tiene horas estimadas',
        scoreImpact: -5,
        enabled: true,
    },
    TASK_OVERDUE: {
        id: 'TASK_OVERDUE',
        category: RULE_CATEGORY.TASK,
        defaultSeverity: AUDIT_FINDING_SEVERITY.WARNING,
        title: 'Tarea vencida',
        description: 'La tarea superó su fecha de entrega',
        scoreImpact: -10,
        enabled: true,
    },
    TASK_COMPLETED_NO_HOURS: {
        id: 'TASK_COMPLETED_NO_HOURS',
        category: RULE_CATEGORY.TASK,
        defaultSeverity: AUDIT_FINDING_SEVERITY.WARNING,
        title: 'Tarea completada sin horas',
        description: 'La tarea fue completada sin registrar horas',
        scoreImpact: -8,
        enabled: true,
    },
    TASK_BLOCKED_NO_DELAY: {
        id: 'TASK_BLOCKED_NO_DELAY',
        category: RULE_CATEGORY.TASK,
        defaultSeverity: AUDIT_FINDING_SEVERITY.WARNING,
        title: 'Tarea bloqueada sin delay',
        description: 'La tarea está bloqueada sin causa registrada',
        scoreImpact: -5,
        enabled: true,
    },
    TASK_LARGE_NO_SUBTASKS: {
        id: 'TASK_LARGE_NO_SUBTASKS',
        category: RULE_CATEGORY.TASK,
        defaultSeverity: AUDIT_FINDING_SEVERITY.INFO,
        title: 'Tarea grande sin subtareas',
        description: 'La tarea tiene >16h estimadas sin subtareas',
        scoreImpact: -3,
        enabled: true,
    },
    TASK_WITHOUT_PROJECT: {
        id: 'TASK_WITHOUT_PROJECT',
        category: RULE_CATEGORY.TASK,
        defaultSeverity: AUDIT_FINDING_SEVERITY.INFO,
        title: 'Tarea sin proyecto',
        description: 'La tarea no está asignada a ningún proyecto',
        scoreImpact: -3,
        enabled: true,
    },
    TASK_STALE_NO_UPDATE: {
        id: 'TASK_STALE_NO_UPDATE',
        category: RULE_CATEGORY.TASK,
        defaultSeverity: AUDIT_FINDING_SEVERITY.INFO,
        title: 'Tarea sin actualizar',
        description: 'La tarea no se ha actualizado en 7+ días',
        scoreImpact: -3,
        enabled: true,
    },

    // ── Planner Rules ──
    USER_OVER_CAPACITY: {
        id: 'USER_OVER_CAPACITY',
        category: RULE_CATEGORY.PLANNER,
        defaultSeverity: AUDIT_FINDING_SEVERITY.WARNING,
        title: 'Usuario sobrecargado',
        description: 'Horas planificadas exceden capacidad semanal',
        scoreImpact: -10,
        enabled: true,
    },
    USER_UNDERUTILIZED: {
        id: 'USER_UNDERUTILIZED',
        category: RULE_CATEGORY.PLANNER,
        defaultSeverity: AUDIT_FINDING_SEVERITY.INFO,
        title: 'Usuario subutilizado',
        description: 'Utilización por debajo del 60%',
        scoreImpact: -3,
        enabled: true,
    },
    CRITICAL_TASK_NOT_PLANNED: {
        id: 'CRITICAL_TASK_NOT_PLANNED',
        category: RULE_CATEGORY.PLANNER,
        defaultSeverity: AUDIT_FINDING_SEVERITY.WARNING,
        title: 'Tarea crítica no planificada',
        description: 'Tarea de alta prioridad sin bloques en planner',
        scoreImpact: -8,
        enabled: true,
    },
    PLANNER_INCOMPLETE_WEEK: {
        id: 'PLANNER_INCOMPLETE_WEEK',
        category: RULE_CATEGORY.PLANNER,
        defaultSeverity: AUDIT_FINDING_SEVERITY.INFO,
        title: 'Planner incompleto',
        description: 'Menos de 3 días planificados en la semana',
        scoreImpact: -3,
        enabled: true,
    },

    // ── Project Rules ──
    PROJECT_TOO_MANY_OVERDUE_TASKS: {
        id: 'PROJECT_TOO_MANY_OVERDUE_TASKS',
        category: RULE_CATEGORY.PROJECT,
        defaultSeverity: AUDIT_FINDING_SEVERITY.WARNING,
        title: 'Proyecto con muchas tareas vencidas',
        description: 'Más del 30% de las tareas activas están vencidas',
        scoreImpact: -12,
        enabled: true,
    },
    PROJECT_HIGH_DELAY_RATE: {
        id: 'PROJECT_HIGH_DELAY_RATE',
        category: RULE_CATEGORY.PROJECT,
        defaultSeverity: AUDIT_FINDING_SEVERITY.WARNING,
        title: 'Proyecto con alta tasa de delays',
        description: 'Más del 20% de las tareas tienen delays activos',
        scoreImpact: -10,
        enabled: true,
    },
    PROJECT_CRITICAL_DEPENDENCY_EXPIRED: {
        id: 'PROJECT_CRITICAL_DEPENDENCY_EXPIRED',
        category: RULE_CATEGORY.PROJECT,
        defaultSeverity: AUDIT_FINDING_SEVERITY.WARNING,
        title: 'Dependencia crítica vencida',
        description: 'Una tarea predecessora está vencida',
        scoreImpact: -8,
        enabled: true,
    },

    // ── User Discipline Rules ──
    USER_MISSING_TIMELOGS: {
        id: 'USER_MISSING_TIMELOGS',
        category: RULE_CATEGORY.DISCIPLINE,
        defaultSeverity: AUDIT_FINDING_SEVERITY.INFO,
        title: 'Sin registro de horas reciente',
        description: 'Tareas en progreso sin registro de horas en 3 días',
        scoreImpact: -5,
        enabled: true,
    },
    USER_LOW_UPDATE_DISCIPLINE: {
        id: 'USER_LOW_UPDATE_DISCIPLINE',
        category: RULE_CATEGORY.DISCIPLINE,
        defaultSeverity: AUDIT_FINDING_SEVERITY.INFO,
        title: 'Baja disciplina de actualización',
        description: 'Tareas activas sin actualización en 5 días',
        scoreImpact: -5,
        enabled: true,
    },
    TASK_REOPENED_TOO_MANY_TIMES: {
        id: 'TASK_REOPENED_TOO_MANY_TIMES',
        category: RULE_CATEGORY.DISCIPLINE,
        defaultSeverity: AUDIT_FINDING_SEVERITY.WARNING,
        title: 'Tarea reabierta muchas veces',
        description: 'La tarea fue reabierta 3+ veces',
        scoreImpact: -10,
        enabled: true,
    },
};

// ============================================================
// CATALOG HELPERS
// ============================================================

/**
 * Get all rules for a specific category.
 */
export function getRulesByCategory(category) {
    return Object.values(RULE_CATALOG).filter(r => r.category === category);
}

/**
 * Get a rule by its ID.
 */
export function getRuleById(ruleId) {
    return RULE_CATALOG[ruleId] || null;
}

/**
 * Get all enabled rules.
 */
export function getEnabledRules() {
    return Object.values(RULE_CATALOG).filter(r => r.enabled);
}

/**
 * Get total rule count.
 */
export function getRuleCount() {
    return Object.keys(RULE_CATALOG).length;
}
