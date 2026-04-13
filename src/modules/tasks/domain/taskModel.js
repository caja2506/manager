/**
 * Tasks Domain Model
 * ==================
 * [Phase M.4] Ownership: task/project statuses, priorities, risks, delays,
 * and all related factories and helpers.
 */

// ── Enums ──

export const TASK_STATUS = {
    BACKLOG: 'backlog', PENDING: 'pending', IN_PROGRESS: 'in_progress',
    VALIDATION: 'validation', COMPLETED: 'completed', BLOCKED: 'blocked', CANCELLED: 'cancelled',
};

export const TASK_STATUS_CONFIG = {
    [TASK_STATUS.BACKLOG]:     { label: 'Backlog',      color: '#64748b', icon: 'Inbox',      order: 0 },
    [TASK_STATUS.PENDING]:     { label: 'Planificado',  color: '#ef4444', icon: 'Clock',      order: 1 },
    [TASK_STATUS.IN_PROGRESS]: { label: 'En Progreso',  color: '#f59e0b', icon: 'Play',       order: 2 },
    [TASK_STATUS.VALIDATION]:  { label: 'En Revisión',  color: '#8b5cf6', icon: 'CheckCircle', order: 3 },
    [TASK_STATUS.COMPLETED]:   { label: 'Completado',   color: '#22c55e', icon: 'CheckCheck', order: 4 },
    [TASK_STATUS.BLOCKED]:     { label: 'Bloqueado',    color: '#ef4444', icon: 'Ban',        order: 5 },
    [TASK_STATUS.CANCELLED]:   { label: 'Cancelado',    color: '#6b7280', icon: 'XCircle',    order: 6 },
};

export const TASK_PRIORITY = { LOW: 'low', MEDIUM: 'medium', HIGH: 'high', CRITICAL: 'critical' };

export const TASK_PRIORITY_CONFIG = {
    [TASK_PRIORITY.LOW]:      { label: 'Baja',    color: 'slate', order: 0 },
    [TASK_PRIORITY.MEDIUM]:   { label: 'Media',   color: 'blue',  order: 1 },
    [TASK_PRIORITY.HIGH]:     { label: 'Alta',    color: 'amber', order: 2 },
    [TASK_PRIORITY.CRITICAL]: { label: 'Crítica', color: 'red',   order: 3 },
};

export const PROJECT_STATUS = {
    PLANNING: 'planning', ACTIVE: 'active', ON_HOLD: 'on_hold',
    COMPLETED: 'completed', CANCELLED: 'cancelled',
};

export const PROJECT_STATUS_CONFIG = {
    [PROJECT_STATUS.PLANNING]:  { label: 'Planificación', color: 'blue',  order: 0 },
    [PROJECT_STATUS.ACTIVE]:    { label: 'Activo',        color: 'green', order: 1 },
    [PROJECT_STATUS.ON_HOLD]:   { label: 'En Pausa',      color: 'amber', order: 2 },
    [PROJECT_STATUS.COMPLETED]: { label: 'Completado',    color: 'slate', order: 3 },
    [PROJECT_STATUS.CANCELLED]: { label: 'Cancelado',     color: 'gray',  order: 4 },
};

export const RISK_LEVEL = { LOW: 'low', MEDIUM: 'medium', HIGH: 'high' };

export const RISK_LEVEL_CONFIG = {
    [RISK_LEVEL.LOW]:    { label: 'Bajo',  color: 'green', minScore: 0,  maxScore: 29,       icon: 'Shield' },
    [RISK_LEVEL.MEDIUM]: { label: 'Medio', color: 'amber', minScore: 30, maxScore: 59,       icon: 'AlertTriangle' },
    [RISK_LEVEL.HIGH]:   { label: 'Alto',  color: 'red',   minScore: 60, maxScore: Infinity, icon: 'AlertOctagon' },
};

export const DELAY_CAUSE_TYPE = {
    RESOURCE: 'resource', TECHNICAL: 'technical', EXTERNAL: 'external',
    PLANNING: 'planning', APPROVAL: 'approval', SUPPLIER: 'supplier', OTHER: 'other',
};

export const DELAY_CAUSE_TYPE_CONFIG = {
    [DELAY_CAUSE_TYPE.RESOURCE]:  { label: 'Recurso',       icon: 'Users',       color: '#3b82f6' },
    [DELAY_CAUSE_TYPE.TECHNICAL]: { label: 'Técnico',       icon: 'Wrench',      color: '#f59e0b' },
    [DELAY_CAUSE_TYPE.EXTERNAL]:  { label: 'Externo',       icon: 'Globe',       color: '#ef4444' },
    [DELAY_CAUSE_TYPE.PLANNING]:  { label: 'Planificación', icon: 'Calendar',    color: '#8b5cf6' },
    [DELAY_CAUSE_TYPE.APPROVAL]:  { label: 'Aprobación',    icon: 'CheckCircle', color: '#22c55e' },
    [DELAY_CAUSE_TYPE.SUPPLIER]:  { label: 'Proveedor',     icon: 'Truck',       color: '#6366f1' },
    [DELAY_CAUSE_TYPE.OTHER]:     { label: 'Otro',          icon: 'HelpCircle',  color: '#6b7280' },
};

export const RISK_TYPE = {
    SCHEDULE: 'schedule', RESOURCE: 'resource', TECHNICAL: 'technical',
    EXTERNAL: 'external', QUALITY: 'quality', SCOPE: 'scope',
};

export const RISK_TYPE_CONFIG = {
    [RISK_TYPE.SCHEDULE]:  { label: 'Cronograma', color: '#ef4444' },
    [RISK_TYPE.RESOURCE]:  { label: 'Recurso',    color: '#f59e0b' },
    [RISK_TYPE.TECHNICAL]: { label: 'Técnico',    color: '#3b82f6' },
    [RISK_TYPE.EXTERNAL]:  { label: 'Externo',    color: '#8b5cf6' },
    [RISK_TYPE.QUALITY]:   { label: 'Calidad',    color: '#22c55e' },
    [RISK_TYPE.SCOPE]:     { label: 'Alcance',    color: '#6366f1' },
};

// ── Risk Helpers ──

export const DEFAULT_RISK_WEIGHTS = {
    delayedTaskWeight: 20,
    overtimeHoursWeight: 2,
    activeDelaysWeight: 15,
    tasksInValidationWeight: 10,
    ownerOverloadedBonus: 15,
};

export function calculateRiskScore(metrics, weights = DEFAULT_RISK_WEIGHTS) {
    const { delayedTasks = 0, overtimeHours = 0, activeDelays = 0, tasksInValidation = 0, ownerOverloaded = false } = metrics;
    const riskScore =
        (delayedTasks * weights.delayedTaskWeight) +
        (overtimeHours * weights.overtimeHoursWeight) +
        (activeDelays * weights.activeDelaysWeight) +
        (tasksInValidation * weights.tasksInValidationWeight) +
        (ownerOverloaded ? weights.ownerOverloadedBonus : 0);
    let riskLevel = RISK_LEVEL.LOW;
    if (riskScore >= 60) riskLevel = RISK_LEVEL.HIGH;
    else if (riskScore >= 30) riskLevel = RISK_LEVEL.MEDIUM;
    return { riskScore: Math.round(riskScore), riskLevel };
}

export function getRiskLevel(score) {
    if (score >= 60) return RISK_LEVEL.HIGH;
    if (score >= 30) return RISK_LEVEL.MEDIUM;
    return RISK_LEVEL.LOW;
}

// ── Seed Data ──

export const DEFAULT_DELAY_CAUSES = [
    { name: 'Material faltante', description: 'Materiales necesarios no disponibles', order: 0 },
    { name: 'Cambio de prioridad', description: 'Priorización de otras tareas por gerencia', order: 1 },
    { name: 'Soporte a producción', description: 'Atención a urgencias o soporte de línea', order: 2 },
    { name: 'Decisión de ingeniería', description: 'Esperando definición técnica o de diseño', order: 3 },
    { name: 'Problema técnico', description: 'Dificultad técnica no prevista', order: 4 },
    { name: 'Dependencia externa', description: 'Esperando respuesta de proveedor o tercero', order: 5 },
    { name: 'Esperando validación', description: 'En espera de aprobación o revisión', order: 6 },
    { name: 'Recurso no disponible', description: 'Personal o equipo no disponible', order: 7 },
];

export const DEFAULT_TASK_TYPES = [
    { name: 'Diseño', icon: 'Pencil', color: 'blue', order: 0 },
    { name: 'Fabricación', icon: 'Wrench', color: 'amber', order: 1 },
    { name: 'Ensamble', icon: 'Layers', color: 'purple', order: 2 },
    { name: 'Programación', icon: 'Code', color: 'green', order: 3 },
    { name: 'Pruebas', icon: 'FlaskConical', color: 'teal', order: 4 },
    { name: 'Instalación', icon: 'HardDrive', color: 'indigo', order: 5 },
    { name: 'Documentación', icon: 'FileText', color: 'slate', order: 6 },
    { name: 'Soporte', icon: 'LifeBuoy', color: 'red', order: 7 },
];

// ── Factories ──

export function createProjectDocument({
    name = '', description = '', client = '', priority = TASK_PRIORITY.MEDIUM,
    status = PROJECT_STATUS.PLANNING, ownerId = null, teamMemberIds = [],
    startDate = null, dueDate = null, completedDate = null, progress = 0,
    bomProjectId = null, tags = [],
} = {}) {
    return {
        name, description, client, priority, status,
        ownerId, teamMemberIds, startDate, dueDate, completedDate, progress,
        bomProjectId, tags,
        riskScore: 0, riskLevel: RISK_LEVEL.LOW, riskFactors: [], riskSummary: '', riskUpdatedAt: null,
        createdBy: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    };
}

export function createTaskDocument({
    projectId = null, subprojectId = null, title = '', description = '',
    status = TASK_STATUS.BACKLOG, priority = TASK_PRIORITY.MEDIUM, taskTypeId = null,
    milestoneId = null, areaId = null, countsForScore = false, stationId = null,
    assignedBy = null, assignedTo = null, estimatedHours = 0, actualHours = 0,
    dueDate = null, completedDate = null, blockedReason = '', tags = [], order = 0,
    showInGantt = false, plannedStartDate = null, plannedEndDate = null,
    plannedDurationHours = 0, percentComplete = 0, milestone = false,
    summaryTask = false, parentTaskId = null, ganttViewModeDefault = null,
} = {}) {
    return {
        projectId, subprojectId, title, description, status, priority, taskTypeId,
        milestoneId, areaId, countsForScore: milestoneId ? true : countsForScore, stationId,
        assignedBy, assignedTo, estimatedHours, actualHours, dueDate, completedDate,
        blockedReason, tags, order,
        showInGantt, plannedStartDate, plannedEndDate, plannedDurationHours,
        percentComplete, milestone, summaryTask, parentTaskId, ganttViewModeDefault,
        createdBy: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    };
}

export function createSubtaskDocument({ taskId = null, title = '', completed = false, order = 0, createdBy = null } = {}) {
    const now = new Date().toISOString();
    return { taskId, title, completed, order, createdBy, updatedBy: createdBy, createdAt: now, updatedAt: now };
}

export function createTimeLogDocument({
    taskId = null, projectId = null, userId = null, startTime = null, endTime = null,
    totalHours = 0, overtime = false, overtimeHours = 0, notes = '', createdBy = null,
    taskTitle = '', projectName = '', displayName = '',
    source = 'manual', // 'manual' | 'planner_auto' | 'kanban_auto' | 'open_day' | 'legacy'
} = {}) {
    const now = new Date().toISOString();
    return {
        taskId, projectId, userId, startTime, endTime, totalHours, overtime, overtimeHours, notes,
        taskTitle, projectName, displayName, source,
        createdBy: createdBy || userId, updatedBy: createdBy || userId, createdAt: now, updatedAt: now,
    };
}

export function createDelayCauseDocument({ name = '', description = '', active = true, order = 0, createdBy = null } = {}) {
    const now = new Date().toISOString();
    return { name, description, active, order, createdBy, updatedBy: createdBy, createdAt: now, updatedAt: now };
}

export function createDelayDocument({
    projectId = null, taskId = null, causeId = null, causeName = '', comment = '',
    impact = '', resolved = false, resolvedAt = null, createdBy = null,
} = {}) {
    return { projectId, taskId, causeId, causeName, comment, impact, resolved, resolvedAt, createdBy, createdAt: new Date().toISOString() };
}

export function createRiskDocument({
    projectId = null, riskScore = 0, riskLevel = RISK_LEVEL.LOW, riskFactors = [], riskSummary = '',
    metrics = { delayedTasks: 0, overtimeHours: 0, activeDelays: 0, tasksInValidation: 0, ownerOverloaded: false },
} = {}) {
    return { projectId, riskScore, riskLevel, riskFactors, riskSummary, metrics, calculatedAt: new Date().toISOString() };
}

export function createDailyReportDocument({
    date = '', userId = null, userName = '',
    data = { tasksWorked: [], totalHours: 0, overtimeHours: 0, tasksCompleted: 0, delaysReported: 0, notesSummary: '' },
    createdBy = 'system', source = 'system',
} = {}) {
    const now = new Date().toISOString();
    return { date, userId, userName, data, source, createdBy, updatedBy: createdBy, createdAt: now, updatedAt: now };
}

export function createTaskTypeDocument({ name = '', icon = 'Wrench', color = 'indigo', active = true, order = 0, createdBy = null } = {}) {
    const now = new Date().toISOString();
    return { name, icon, color, active, order, createdBy, updatedBy: createdBy, createdAt: now, updatedAt: now };
}

export function createTaskTypeCategoryDocument({ name = '', color = 'indigo', icon = 'Layers', order = 0, active = true, createdBy = null } = {}) {
    const now = new Date().toISOString();
    return { name, color, icon, order, active, createdBy, updatedBy: createdBy, createdAt: now, updatedAt: now };
}

export function createTaskDependencyDocument({
    predecessorTaskId = null, successorTaskId = null, type = 'FS', lagHours = 0, projectId = null, createdBy = null,
} = {}) {
    return { predecessorTaskId, successorTaskId, type, lagHours, projectId, createdBy, createdAt: new Date().toISOString() };
}

// ── Station Factories & Helpers ──

export function createStationDocument({
    indx = 1,
    stn = '',
    abbreviation = '',
    description = '',
    order = 0,
    active = true,
    createdBy = null,
} = {}) {
    const now = new Date().toISOString();
    return {
        indx,
        stn,
        abbreviation,
        description,
        order,
        active,
        createdBy,
        updatedBy: createdBy,
        createdAt: now,
        updatedAt: now,
    };
}

/**
 * Format a station label for display.
 * - If the project has multiple indexers: "2-STN01"
 * - If only one indexer: "STN01"
 * @param {object} station - station document
 * @param {boolean} hasMultipleIndexers - whether to show indexer prefix
 * @returns {string}
 */
export function formatStationLabel(station, hasMultipleIndexers = false) {
    if (!station) return '—';
    const stnNum = String(station.stn).padStart(2, '0');
    return hasMultipleIndexers
        ? `${station.indx}-STN${stnNum}`
        : `STN${stnNum}`;
}
