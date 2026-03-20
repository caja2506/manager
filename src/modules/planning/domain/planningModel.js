/**
 * Planning Domain Model
 * =====================
 * [Phase M.4] Ownership: milestones, work areas, traffic lights,
 * score locks, weekly planner, score snapshots.
 */

import { TASK_STATUS, TASK_PRIORITY } from '../../../modules/tasks/domain/taskModel';

// ── Enums ──

export const MILESTONE_STATUS = { PLANNING: 'planning', ACTIVE: 'active', COMPLETED: 'completed', ON_HOLD: 'on_hold' };
export const MILESTONE_TYPE = { SETUP: 'setup', COMMISSIONING: 'commissioning', VALIDATION: 'validation', CUSTOM: 'custom' };

export const TRAFFIC_LIGHT = { GREEN: 'green', YELLOW: 'yellow', RED: 'red' };

export const SCORE_LOCK_REASON = {
    CRITICAL_OVERDUE: 'critical_task_overdue_3d',
    UNRESOLVED_BLOCKER_48H: 'unresolved_blocker_48h',
    STALE_AREA_5D: 'stale_area_no_update_5d',
    UNOWNED_CRITICAL: 'unowned_critical_tasks',
};

export const WORK_AREA_TYPE = {
    ENGINEERING: 'engineering', PROCUREMENT: 'procurement', COMMISSIONING: 'commissioning',
    DOCUMENTATION: 'documentation', QUALITY: 'quality', CUSTOM: 'custom',
};

export const WORK_AREA_TYPE_CONFIG = {
    [WORK_AREA_TYPE.ENGINEERING]:    { label: 'Ingeniería',       icon: 'Wrench',       color: '#3b82f6' },
    [WORK_AREA_TYPE.PROCUREMENT]:    { label: 'Procura',          icon: 'ShoppingCart',  color: '#f59e0b' },
    [WORK_AREA_TYPE.COMMISSIONING]:  { label: 'Comisionamiento',  icon: 'Zap',          color: '#ef4444' },
    [WORK_AREA_TYPE.DOCUMENTATION]:  { label: 'Documentación',    icon: 'FileText',     color: '#8b5cf6' },
    [WORK_AREA_TYPE.QUALITY]:        { label: 'Calidad',          icon: 'Shield',       color: '#22c55e' },
    [WORK_AREA_TYPE.CUSTOM]:         { label: 'Personalizada',    icon: 'Settings',     color: '#6b7280' },
};

export const OVERRIDE_REASON_TYPE = {
    MANAGEMENT_DECISION: 'management_decision', EXTERNAL_DEPENDENCY: 'external_dependency',
    CLIENT_CHANGE: 'client_change', EMERGENCY: 'emergency', AWAITING_INFO: 'awaiting_info', OTHER: 'other',
};

export const OVERRIDE_REASON_TYPE_CONFIG = {
    [OVERRIDE_REASON_TYPE.MANAGEMENT_DECISION]: { label: 'Decisión gerencial' },
    [OVERRIDE_REASON_TYPE.EXTERNAL_DEPENDENCY]: { label: 'Dependencia externa' },
    [OVERRIDE_REASON_TYPE.CLIENT_CHANGE]:       { label: 'Cambio del cliente' },
    [OVERRIDE_REASON_TYPE.EMERGENCY]:           { label: 'Emergencia' },
    [OVERRIDE_REASON_TYPE.AWAITING_INFO]:       { label: 'En espera de información' },
    [OVERRIDE_REASON_TYPE.OTHER]:               { label: 'Otro' },
};

// ── Factories ──

export function createMilestoneDocument({
    projectId = null, type = MILESTONE_TYPE.CUSTOM, name = '', description = '',
    status = MILESTONE_STATUS.PLANNING, startDate = null, dueDate = null, completedDate = null,
    ownerId = null, teamMemberIds = [],
    scoreGeneral = 0, trafficLight = TRAFFIC_LIGHT.GREEN, scoreLocks = [],
    trafficLightOverride = null, trafficLightOverrideReason = '',
    trafficLightOverrideBy = null, trafficLightOverrideAt = null,
    trafficLightOverrideExpires = null, trend = 'stable',
    penalties = { criticalOverdue: 0, unresolvedBlockers: 0, staleAreas: 0, unownedCritical: 0, totalPenalty: 0 },
    createdBy = null,
} = {}) {
    const now = new Date().toISOString();
    return {
        projectId, type, name, description, status, startDate, dueDate, completedDate,
        ownerId, teamMemberIds, scoreGeneral, trafficLight, scoreLocks,
        trafficLightOverride, trafficLightOverrideReason, trafficLightOverrideBy,
        trafficLightOverrideAt, trafficLightOverrideExpires, trend, penalties,
        createdBy, updatedBy: createdBy, createdAt: now, updatedAt: now,
    };
}

export function createWorkAreaDocument({
    milestoneId = null, projectId = null, name = '', order = 0, responsibleId = null,
    score = 0, trend = 'stable', trafficLight = TRAFFIC_LIGHT.GREEN,
    taskTypeIds = [], taskFilter = { tagMatch: null, typeMatch: null }, createdBy = null,
} = {}) {
    const now = new Date().toISOString();
    return {
        milestoneId, projectId, name, order, responsibleId,
        score, trend, trafficLight, taskTypeIds, taskFilter,
        createdBy, updatedBy: createdBy, createdAt: now, updatedAt: now,
    };
}

export function createWeeklyPlanItemDocument({
    taskId = null, weekStartDate = '', date = '', dayOfWeek = 1,
    startDateTime = null, endDateTime = null, plannedHours = 0, createdBy = null,
    assignedTo = null, projectId = null, notes = '',
    taskTitleSnapshot = '', projectNameSnapshot = '', assignedToName = '',
    statusSnapshot = TASK_STATUS.PENDING, priority = TASK_PRIORITY.MEDIUM, colorKey = 'indigo',
} = {}) {
    return {
        taskId, weekStartDate, date, dayOfWeek, startDateTime, endDateTime, plannedHours, createdBy,
        assignedTo, projectId, notes,
        taskTitleSnapshot, projectNameSnapshot, assignedToName, statusSnapshot, priority, colorKey,
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    };
}

export function createScoreSnapshotDocument({
    milestoneId = '', projectId = '', snapshotType = 'scheduled',
    milestoneScore = 0, milestoneTrafficLight = 'green', milestoneStatus = 'active',
    areaScores = [], activeLocks = [], activePenalties = {}, triggeredBy = 'system',
} = {}) {
    return {
        milestoneId, projectId, snapshotType,
        milestoneScore, milestoneTrafficLight, milestoneStatus,
        areaScores, activeLocks, activePenalties, triggeredBy,
        capturedAt: new Date().toISOString(),
    };
}
