/**
 * Automation Schemas — Generic Layer
 * ====================================
 * 
 * Factory functions for all channel-agnostic automation documents.
 * Telegram-specific schemas live in ./telegram/telegramSchemas.js
 * 
 * Each factory returns a plain object with all fields set to defaults.
 * Timestamps use ISO strings for Firestore consistency with the rest
 * of the codebase (see src/models/schemas.js pattern).
 * 
 * @module automation/schemas
 */

import {
    AUTOMATION_CHANNELS,
    AUTOMATION_PROVIDERS,
    RUN_STATUS,
    INCIDENT_STATUS,
    INCIDENT_SEVERITY,
    SCHEDULE_TYPE,
    TRIGGER_TYPE,
    PERSONALITY_MODES,
} from './constants.js';

// ============================================================
// SYSTEM SETTINGS — automationCore
// ============================================================

/**
 * Global automation platform configuration.
 * Stored as: settings/automationCore
 * 
 * @param {Object} [overrides] - Override default field values
 * @returns {Object} automationCore config document
 */
export function createAutomationCoreConfig(overrides = {}) {
    return {
        enabled: false,
        debugMode: false,
        dryRun: true,                          // Safe default: dry-run ON
        metricsEnabled: true,
        opsConsoleEnabled: true,
        defaultTimezone: 'America/Costa_Rica',
        allowedChannels: [AUTOMATION_CHANNELS.TELEGRAM],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        ...overrides,
    };
}

// ============================================================
// SYSTEM SETTINGS — telegramOps
// ============================================================

/**
 * Telegram provider operational configuration.
 * Stored as: settings/telegramOps
 * 
 * @param {Object} [overrides] - Override default field values
 * @returns {Object} telegramOps config document
 */
export function createTelegramOpsConfig(overrides = {}) {
    return {
        enabled: false,
        globalMorningTime: '07:00',            // HH:mm format
        techCheckTime: '16:00',                // HH:mm format
        gracePeriodMinutes: 30,
        alertGroupId: null,                    // Telegram group chat ID
        timezone: 'America/Costa_Rica',
        escalationEnabled: true,
        multimodalEnabled: false,              // Audio processing OFF by default
        debugMode: false,
        dryRun: true,
        personalityModes: {
            default: PERSONALITY_MODES.PROFESSIONAL,
            escalation: PERSONALITY_MODES.DIRECT,
        },
        weekdayRules: {
            activeDays: [1, 2, 3, 4, 5],      // Monday–Friday
            skipHolidays: true,
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        ...overrides,
    };
}

// ============================================================
// AUTOMATION ROUTINES
// ============================================================

/**
 * Individual automation routine definition.
 * Stored in: automationRoutines/{routineKey}
 * 
 * @param {Object} [overrides]
 * @returns {Object} routine document
 */
export function createAutomationRoutineDocument(overrides = {}) {
    return {
        key: '',
        name: '',
        description: '',
        channel: AUTOMATION_CHANNELS.TELEGRAM,
        provider: AUTOMATION_PROVIDERS.TELEGRAM_BOT,
        enabled: false,
        scheduleType: SCHEDULE_TYPE.DAILY,
        scheduleConfig: null,                  // e.g. { cron: '0 7 * * 1-5', timezone: '...' }
        delayMinutes: 0,
        gracePeriodMinutes: 30,
        personalityMode: PERSONALITY_MODES.PROFESSIONAL,
        allowedRoles: [],                      // Which operational roles receive this routine
        dryRun: false,
        debugMode: false,
        priority: 5,                           // 1 = highest, 10 = lowest
        lastRunAt: null,
        lastStatus: null,
        lastError: null,
        metadata: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        ...overrides,
    };
}

// ============================================================
// AUTOMATION RUNS
// ============================================================

/**
 * Execution record for a single routine run.
 * Stored in: automationRuns/{auto-id}
 * 
 * @param {Object} [overrides]
 * @returns {Object} run document
 */
export function createAutomationRunDocument(overrides = {}) {
    return {
        routineKey: '',
        channel: AUTOMATION_CHANNELS.TELEGRAM,
        provider: AUTOMATION_PROVIDERS.TELEGRAM_BOT,
        triggerType: TRIGGER_TYPE.SCHEDULED,
        startedAt: new Date().toISOString(),
        finishedAt: null,
        status: RUN_STATUS.RUNNING,
        targetsCount: 0,
        sentCount: 0,
        deliveredCount: 0,
        respondedCount: 0,
        escalatedCount: 0,
        dryRun: false,
        errorSummary: null,
        metadata: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        ...overrides,
    };
}

// ============================================================
// AUTOMATION METRICS DAILY
// ============================================================

/**
 * Daily aggregated metrics for observability.
 * Stored in: automationMetricsDaily/{YYYY-MM-DD_channel}
 * 
 * @param {Object} [overrides]
 * @returns {Object} daily metrics document
 */
export function createAutomationMetricsDailyDocument(overrides = {}) {
    return {
        date: '',                              // YYYY-MM-DD
        channel: AUTOMATION_CHANNELS.TELEGRAM,
        provider: AUTOMATION_PROVIDERS.TELEGRAM_BOT,
        messagesSent: 0,
        messagesDelivered: 0,
        responsesReceived: 0,
        responsesOnTime: 0,
        responsesLate: 0,
        escalationsTriggered: 0,
        incidentsOpened: 0,
        audioReportsCount: 0,
        textReportsCount: 0,
        failedDeliveries: 0,
        activeRoutines: 0,
        updatedAt: new Date().toISOString(),
        ...overrides,
    };
}

// ============================================================
// OPERATION INCIDENTS
// ============================================================

/**
 * Generic operational incident.
 * Channel-agnostic — Telegram blockers are one type.
 * Stored in: operationIncidents/{auto-id}
 * 
 * @param {Object} [overrides]
 * @returns {Object} incident document
 */
export function createOperationIncidentDocument(overrides = {}) {
    return {
        incidentType: '',                      // From INCIDENT_TYPE constants
        channel: null,                         // null for non-channel incidents
        provider: null,
        userId: null,                          // Who reported or is affected
        taskId: null,                          // Optional linked task
        title: '',
        description: '',
        cause: '',
        status: INCIDENT_STATUS.OPEN,
        severity: INCIDENT_SEVERITY.MEDIUM,
        assignedOwnerId: null,                 // Who owns resolution
        reportedVia: null,                     // 'telegram' | 'web' | 'system'
        reportedAt: new Date().toISOString(),
        resolvedAt: null,
        resolution: '',
        metadata: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        ...overrides,
    };
}
