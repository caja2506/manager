/**
 * Analytics Domain Model
 * ======================
 * [Phase M.4] Ownership: audit findings, audit events, audit trail,
 * analytics snapshots, operational KPI snapshots, and related factories.
 */

// ── Enums ──

export const AUDIT_FINDING_SEVERITY = { INFO: 'info', WARNING: 'warning', CRITICAL: 'critical' };

export const AUDIT_FINDING_SEVERITY_CONFIG = {
    [AUDIT_FINDING_SEVERITY.INFO]:     { label: 'Información', color: 'blue',  icon: 'Info',           order: 0 },
    [AUDIT_FINDING_SEVERITY.WARNING]:  { label: 'Advertencia', color: 'amber', icon: 'AlertTriangle',  order: 1 },
    [AUDIT_FINDING_SEVERITY.CRITICAL]: { label: 'Crítico',     color: 'red',   icon: 'AlertOctagon',   order: 2 },
};

export const AUDIT_FINDING_STATUS = { OPEN: 'open', RESOLVED: 'resolved', DISMISSED: 'dismissed' };

export const ANALYTICS_SCOPE = { DEPARTMENT: 'department', PROJECT: 'project', USER: 'user' };

export const AUDIT_TRAIL_EVENT_TYPE = {
    TASK_TRANSITION: 'task_transition', ENTITY_CHANGE: 'entity_change',
    OVERRIDE: 'override', AI_ACTION: 'ai_action', ADMIN_ACTION: 'admin_action',
};

export const AUDIT_TRAIL_ACTOR_TYPE = { USER: 'user', SYSTEM: 'system', AI: 'ai', AUTOMATION: 'automation' };

// ── Factories ──

export function createAuditFindingDocument({
    entityType = 'task', entityId = null, ruleId = '',
    severity = AUDIT_FINDING_SEVERITY.WARNING, status = AUDIT_FINDING_STATUS.OPEN,
    title = '', message = '', recommendedAction = '', scoreImpact = 0,
    assignedTo = null, resolvedAt = null, resolvedBy = null,
    source = 'rule_engine', metadata = {},
} = {}) {
    return {
        entityType, entityId, ruleId, severity, status, title, message,
        recommendedAction, scoreImpact, assignedTo, resolvedAt, resolvedBy, source, metadata,
        detectedAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    };
}

export function createAuditEventDocument({
    eventType = '', entityType = '', entityId = '', userId = null,
    source = 'client', correlationId = null, details = {},
} = {}) {
    return { eventType, entityType, entityId, userId, source, correlationId, details, timestamp: new Date().toISOString() };
}

export function createAnalyticsSnapshotDocument({
    snapshotDate = '', scope = ANALYTICS_SCOPE.DEPARTMENT, scopeRefId = 'department',
    methodologyCompliance = 0, estimateAccuracy = 0, planningReliability = 0, dataDiscipline = 0,
    overdueTasks = 0, activeDelays = 0, teamUtilization = 0,
    totalTasksActive = 0, totalTasksCompleted = 0, totalHoursLogged = 0,
    topBottlenecks = [], riskDistribution = { low: 0, medium: 0, high: 0 }, metadata = {},
} = {}) {
    return {
        snapshotDate, scope, scopeRefId, methodologyCompliance, estimateAccuracy,
        planningReliability, dataDiscipline, overdueTasks, activeDelays, teamUtilization,
        totalTasksActive, totalTasksCompleted, totalHoursLogged, topBottlenecks,
        riskDistribution, metadata, createdAt: new Date().toISOString(),
    };
}

export function createAuditLogDocument({
    action = '', userId = null, userName = '', collection = '', documentId = '',
    changes = {}, metadata = {},
} = {}) {
    return { action, userId, userName, collection, documentId, changes, metadata, timestamp: new Date().toISOString() };
}

export function createAuditTrailDocument({
    eventType = AUDIT_TRAIL_EVENT_TYPE.ENTITY_CHANGE, entityType = '', entityId = '',
    action = '', actorId = null, actorType = AUDIT_TRAIL_ACTOR_TYPE.USER,
    changes = {}, reason = null, source = 'client', correlationId = null, metadata = {},
} = {}) {
    return {
        eventType, entityType, entityId, action, actorId, actorType,
        changes, reason, source, correlationId, metadata,
        timestamp: new Date().toISOString(),
    };
}

export function createOperationalKpiSnapshotDocument({
    periodType = 'daily', periodStart = '', periodEnd = '', entityType = 'global',
    entityId = 'global', metrics = {}, dataCounts = {}, engineVersion = '4.4',
} = {}) {
    return { periodType, periodStart, periodEnd, entityType, entityId, metrics, dataCounts, engineVersion, generatedAt: new Date().toISOString(), generatedBy: 'system' };
}

export function createUserOperationalScoreDocument({
    userId = '', periodType = 'daily', periodStart = '', periodEnd = '',
    metrics = {}, overallScore = 0, trend = 'stable', engineVersion = '4.4',
} = {}) {
    return { userId, periodType, periodStart, periodEnd, metrics, overallScore, trend, engineVersion, generatedAt: new Date().toISOString(), generatedBy: 'system' };
}

export function createRoutineOperationalScoreDocument({
    routineKey = '', periodType = 'daily', periodStart = '', periodEnd = '',
    metrics = {}, overallScore = 0, trend = 'stable', engineVersion = '4.4',
} = {}) {
    return { routineKey, periodType, periodStart, periodEnd, metrics, overallScore, trend, engineVersion, generatedAt: new Date().toISOString(), generatedBy: 'system' };
}

export function createTeamOperationalSummaryDocument({
    role = '', periodType = 'daily', periodStart = '', periodEnd = '',
    memberCount = 0, metrics = {}, highlights = [], engineVersion = '4.4',
} = {}) {
    return { role, periodType, periodStart, periodEnd, memberCount, metrics, highlights, engineVersion, generatedAt: new Date().toISOString(), generatedBy: 'system' };
}

export function createOperationalRiskFlagDocument({
    type = '', severity = 'medium', entityType = '', entityId = '',
    description = '', suggestedAction = '', periodStart = '', resolved = false, resolvedAt = null,
} = {}) {
    return { type, severity, entityType, entityId, description, suggestedAction, periodStart, resolved, resolvedAt, generatedAt: new Date().toISOString(), generatedBy: 'system' };
}

export function createOperationalRecommendationDocument({
    type = '', category = '', priority = 'medium', description = '', expectedImpact = '',
    targetEntityType = '', targetEntityId = '', periodStart = '', status = 'pending', appliedAt = null,
} = {}) {
    return { type, category, priority, description, expectedImpact, targetEntityType, targetEntityId, periodStart, status, appliedAt, generatedAt: new Date().toISOString(), generatedBy: 'system' };
}

export function createAnalyticsRefreshLogDocument({
    periodType = 'daily', periodStart = '', periodEnd = '', engineVersion = '4.4',
    durationMs = 0, collectionsWritten = [], errors = [], status = 'success',
} = {}) {
    return { periodType, periodStart, periodEnd, engineVersion, durationMs, collectionsWritten, errors, status, executedAt: new Date().toISOString(), executedBy: 'system' };
}
