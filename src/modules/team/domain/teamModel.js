/**
 * Team Domain Model
 * =================
 * [Phase M.4] Ownership: roles, user profiles, notifications.
 */

// ── Enums ──

export const TEAM_ROLES = {
    MANAGER: 'manager',
    TEAM_LEAD: 'team_lead',
    ENGINEER: 'engineer',
    TECHNICIAN: 'technician',
};

export const RBAC_ROLES = {
    ADMIN: 'admin',
    EDITOR: 'editor',
    VIEWER: 'viewer',
};

export const NOTIFICATION_TYPE = {
    TASK_ASSIGNED: 'task_assigned',
    TASK_STATUS_CHANGED: 'task_status_changed',
    TASK_BLOCKED: 'task_blocked',
    DELAY_REPORTED: 'delay_reported',
    RISK_ALERT: 'risk_alert',
    OVERTIME_ALERT: 'overtime_alert',
    REPORT_GENERATED: 'report_generated',
    SYSTEM: 'system',
};

// ── Factories ──

export function createUserDocument({
    displayName = '',
    email = '',
    photoURL = '',
    rbacRole = RBAC_ROLES.VIEWER,
    role = RBAC_ROLES.VIEWER,
    teamRole = null,
    department = 'Engineering',
    weeklyCapacityHours = 40,
    active = true,
    reportsTo = null,
    channels = {
        telegram: { chatId: null, linkedAt: null, active: false },
    },
    automation = {
        isParticipant: false,
        shift: null,
        schedule: { start: '08:00', end: '17:00' },
    },
    createdBy = 'system',
    name = '',
    operationalRole = null,
    providerLinks = {},
    isAutomationParticipant = false,
    escalationTargetUserId = null,
    activeShift = null,
    workSchedule = null,
} = {}) {
    const now = new Date().toISOString();
    return {
        displayName: displayName || name,
        email, photoURL, rbacRole,
        role: rbacRole,
        teamRole, department, weeklyCapacityHours, active, reportsTo,
        channels, automation,
        name: displayName || name,
        operationalRole, providerLinks,
        isAutomationParticipant: isAutomationParticipant || automation.isParticipant,
        escalationTargetUserId,
        activeShift: activeShift || automation.shift,
        workSchedule: workSchedule || automation.schedule,
        createdBy, updatedBy: createdBy,
        createdAt: now, updatedAt: now,
    };
}

export function createNotificationDocument({
    userId = null,
    type = NOTIFICATION_TYPE.SYSTEM,
    title = '',
    message = '',
    read = false,
    actionUrl = null,
    relatedId = null,
    relatedCollection = null,
    createdBy = 'system',
} = {}) {
    const now = new Date().toISOString();
    return {
        userId, type, title, message, read,
        actionUrl, relatedId, relatedCollection,
        createdBy, createdAt: now, updatedAt: now,
    };
}
