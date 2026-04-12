/**
 * Tests for Automation Schemas
 * 
 * Validates that factory functions produce documents with all required
 * fields, correct defaults, and proper structure.
 */
import { describe, it, expect } from 'vitest';
import {
    createAutomationCoreConfig,
    createTelegramOpsConfig,
    createAutomationRoutineDocument,
    createAutomationRunDocument,
    createAutomationMetricsDailyDocument,
    createOperationIncidentDocument,
} from '../../src/automation/schemas.js';
import {
    createTelegramSessionDocument,
    createTelegramReportDocument,
    createTelegramEscalationDocument,
    createTelegramDeliveryDocument,
    createTelegramBotLogDocument,
} from '../../src/automation/telegram/telegramSchemas.js';
import { RUN_STATUS, INCIDENT_STATUS, INCIDENT_SEVERITY } from '../../src/automation/constants.js';
import { TELEGRAM_SESSION_STATE } from '../../src/automation/telegram/telegramConstants.js';

describe('Automation Schemas — Generic', () => {
    describe('createAutomationCoreConfig()', () => {
        it('should create config with safe defaults', () => {
            const config = createAutomationCoreConfig();
            expect(config.enabled).toBe(false);
            expect(config.dryRun).toBe(true);  // Safe default
            expect(config.debugMode).toBe(false);
            expect(config.metricsEnabled).toBe(true);
            expect(config.defaultTimezone).toBe('America/Costa_Rica');
            expect(Array.isArray(config.allowedChannels)).toBe(true);
            expect(config.createdAt).toBeTruthy();
            expect(config.updatedAt).toBeTruthy();
        });

        it('should accept overrides', () => {
            const config = createAutomationCoreConfig({ enabled: true, dryRun: false });
            expect(config.enabled).toBe(true);
            expect(config.dryRun).toBe(false);
        });
    });

    describe('createTelegramOpsConfig()', () => {
        it('should create Telegram config with safe defaults', () => {
            const config = createTelegramOpsConfig();
            expect(config.enabled).toBe(false);
            expect(config.globalMorningTime).toBe('07:00');
            expect(config.techCheckTime).toBe('16:00');
            expect(config.gracePeriodMinutes).toBe(30);
            expect(config.escalationEnabled).toBe(true);
            expect(config.multimodalEnabled).toBe(false);
            expect(config.dryRun).toBe(true);
            expect(config.weekdayRules.activeDays).toEqual([1, 2, 3, 4, 5]);
        });
    });

    describe('createAutomationRoutineDocument()', () => {
        it('should have all required fields', () => {
            const doc = createAutomationRoutineDocument();
            expect(doc).toHaveProperty('key');
            expect(doc).toHaveProperty('name');
            expect(doc).toHaveProperty('channel');
            expect(doc).toHaveProperty('provider');
            expect(doc).toHaveProperty('enabled');
            expect(doc).toHaveProperty('scheduleType');
            expect(doc).toHaveProperty('allowedRoles');
            expect(doc).toHaveProperty('priority');
            expect(doc).toHaveProperty('lastRunAt');
            expect(doc).toHaveProperty('createdAt');
        });

        it('should default to disabled', () => {
            const doc = createAutomationRoutineDocument();
            expect(doc.enabled).toBe(false);
        });
    });

    describe('createAutomationRunDocument()', () => {
        it('should default status to running', () => {
            const doc = createAutomationRunDocument();
            expect(doc.status).toBe(RUN_STATUS.RUNNING);
        });

        it('should have all counter fields', () => {
            const doc = createAutomationRunDocument();
            expect(doc.targetsCount).toBe(0);
            expect(doc.sentCount).toBe(0);
            expect(doc.deliveredCount).toBe(0);
            expect(doc.respondedCount).toBe(0);
            expect(doc.escalatedCount).toBe(0);
        });
    });

    describe('createAutomationMetricsDailyDocument()', () => {
        it('should have all metric counters initialized to 0', () => {
            const doc = createAutomationMetricsDailyDocument();
            expect(doc.messagesSent).toBe(0);
            expect(doc.messagesDelivered).toBe(0);
            expect(doc.responsesReceived).toBe(0);
            expect(doc.escalationsTriggered).toBe(0);
            expect(doc.audioReportsCount).toBe(0);
            expect(doc.textReportsCount).toBe(0);
        });
    });

    describe('createOperationIncidentDocument()', () => {
        it('should default to open with medium severity', () => {
            const doc = createOperationIncidentDocument();
            expect(doc.status).toBe(INCIDENT_STATUS.OPEN);
            expect(doc.severity).toBe(INCIDENT_SEVERITY.MEDIUM);
        });
    });
});

describe('Automation Schemas — Telegram', () => {
    describe('createTelegramSessionDocument()', () => {
        it('should default to idle state', () => {
            const doc = createTelegramSessionDocument();
            expect(doc.currentState).toBe(TELEGRAM_SESSION_STATE.IDLE);
        });

        it('should set expiration timestamp', () => {
            const doc = createTelegramSessionDocument();
            expect(doc.stateExpiresAt).toBeTruthy();
            expect(new Date(doc.stateExpiresAt).getTime()).toBeGreaterThan(Date.now());
        });
    });

    describe('createTelegramReportDocument()', () => {
        it('should default to pending with text input', () => {
            const doc = createTelegramReportDocument();
            expect(doc.status).toBe('pending');
            expect(doc.inputType).toBe('text');
            expect(doc.requiresConfirmation).toBe(true);
        });
    });

    describe('createTelegramEscalationDocument()', () => {
        it('should default to pending status', () => {
            const doc = createTelegramEscalationDocument();
            expect(doc.status).toBe('pending');
            expect(doc.resolvedAt).toBeNull();
        });
    });

    describe('createTelegramDeliveryDocument()', () => {
        it('should default to pending outbound', () => {
            const doc = createTelegramDeliveryDocument();
            expect(doc.deliveryStatus).toBe('pending');
            expect(doc.direction).toBe('outbound');
        });
    });

    describe('createTelegramBotLogDocument()', () => {
        it('should default to internal direction with info severity', () => {
            const doc = createTelegramBotLogDocument();
            expect(doc.direction).toBe('internal');
            expect(doc.severity).toBe('info');
        });
    });
});
