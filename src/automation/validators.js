/**
 * Automation Validators
 * ======================
 * 
 * Pure validation functions for automation documents.
 * No Firebase dependency — safe for testing and shared use.
 * 
 * @module automation/validators
 */

import {
    AUTOMATION_CHANNELS,
    OPERATIONAL_ROLES,
    SCHEDULE_TYPE,
    RUN_STATUS,
    INCIDENT_STATUS,
    INCIDENT_SEVERITY,
    DELIVERY_STATUS,
    REPORT_STATUS,
    ESCALATION_TYPE,
    ESCALATION_STATUS,
} from './constants.js';

/**
 * Validate that a value exists in an enum object.
 * @param {*} value
 * @param {Object} enumObj
 * @returns {boolean}
 */
export function isValidEnum(value, enumObj) {
    return Object.values(enumObj).includes(value);
}

/**
 * Validate a routine configuration object.
 * @param {Object} routine
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateRoutine(routine) {
    const errors = [];

    if (!routine.key || typeof routine.key !== 'string') {
        errors.push('Routine must have a valid key');
    }
    if (!routine.name || typeof routine.name !== 'string') {
        errors.push('Routine must have a name');
    }
    if (!isValidEnum(routine.channel, AUTOMATION_CHANNELS)) {
        errors.push(`Invalid channel: ${routine.channel}`);
    }
    if (!isValidEnum(routine.scheduleType, SCHEDULE_TYPE)) {
        errors.push(`Invalid scheduleType: ${routine.scheduleType}`);
    }
    if (routine.scheduleType === SCHEDULE_TYPE.DAILY && !routine.scheduleConfig) {
        errors.push('Daily routines require scheduleConfig with cron');
    }
    if (!Array.isArray(routine.allowedRoles)) {
        errors.push('allowedRoles must be an array');
    } else {
        for (const role of routine.allowedRoles) {
            if (!isValidEnum(role, OPERATIONAL_ROLES)) {
                errors.push(`Invalid operational role in allowedRoles: ${role}`);
            }
        }
    }
    if (typeof routine.priority !== 'number' || routine.priority < 1 || routine.priority > 10) {
        errors.push('priority must be a number between 1 and 10');
    }

    return { valid: errors.length === 0, errors };
}

/**
 * Validate a run status transition is logical.
 * @param {string} currentStatus
 * @param {string} newStatus
 * @returns {boolean}
 */
export function isValidRunTransition(currentStatus, newStatus) {
    const validTransitions = {
        [RUN_STATUS.RUNNING]: [RUN_STATUS.SUCCESS, RUN_STATUS.PARTIAL, RUN_STATUS.FAILED, RUN_STATUS.CANCELLED],
        [RUN_STATUS.SUCCESS]: [],
        [RUN_STATUS.PARTIAL]: [],
        [RUN_STATUS.FAILED]: [],
        [RUN_STATUS.CANCELLED]: [],
    };
    return (validTransitions[currentStatus] || []).includes(newStatus);
}

/**
 * Validate an incident document has minimum required fields.
 * @param {Object} incident
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateIncident(incident) {
    const errors = [];

    if (!incident.incidentType || typeof incident.incidentType !== 'string') {
        errors.push('Incident must have an incidentType');
    }
    if (!incident.title || typeof incident.title !== 'string') {
        errors.push('Incident must have a title');
    }
    if (!isValidEnum(incident.status, INCIDENT_STATUS)) {
        errors.push(`Invalid incident status: ${incident.status}`);
    }
    if (!isValidEnum(incident.severity, INCIDENT_SEVERITY)) {
        errors.push(`Invalid incident severity: ${incident.severity}`);
    }

    return { valid: errors.length === 0, errors };
}

/**
 * Validate an operational role value.
 * @param {string} role
 * @returns {boolean}
 */
export function isValidOperationalRole(role) {
    return isValidEnum(role, OPERATIONAL_ROLES);
}

/**
 * Get the escalation target role for a given operational role.
 * Returns null if no escalation is possible (top of chain).
 * @param {string} role
 * @returns {string|null}
 */
export function getEscalationTargetRole(role) {
    const chain = {
        [OPERATIONAL_ROLES.TECHNICIAN]: OPERATIONAL_ROLES.ENGINEER,
        [OPERATIONAL_ROLES.ENGINEER]: OPERATIONAL_ROLES.TEAM_LEAD,
        [OPERATIONAL_ROLES.TEAM_LEAD]: OPERATIONAL_ROLES.MANAGER,
        [OPERATIONAL_ROLES.MANAGER]: null,
    };
    return chain[role] ?? null;
}
