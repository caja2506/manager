/**
 * Tests for Automation Constants
 * 
 * Validates that all enum objects have expected keys and values,
 * no duplicates exist, and all config objects are complete.
 */
import { describe, it, expect } from 'vitest';
import {
    AUTOMATION_CHANNELS,
    AUTOMATION_PROVIDERS,
    OPERATIONAL_ROLES,
    OPERATIONAL_ROLE_CONFIG,
    SCHEDULE_TYPE,
    TRIGGER_TYPE,
    RUN_STATUS,
    RUN_STATUS_CONFIG,
    DELIVERY_STATUS,
    DELIVERY_STATUS_CONFIG,
    INCIDENT_STATUS,
    INCIDENT_STATUS_CONFIG,
    INCIDENT_SEVERITY,
    INCIDENT_SEVERITY_CONFIG,
    REPORT_STATUS,
    ESCALATION_TYPE,
    ESCALATION_STATUS,
    ROUTINE_KEYS,
    PERSONALITY_MODES,
} from '../../src/automation/constants.js';

describe('Automation Constants', () => {
    describe('AUTOMATION_CHANNELS', () => {
        it('should contain expected channels', () => {
            expect(AUTOMATION_CHANNELS.TELEGRAM).toBe('telegram');
            expect(AUTOMATION_CHANNELS.EMAIL).toBe('email');
            expect(AUTOMATION_CHANNELS.WHATSAPP).toBe('whatsapp');
            expect(AUTOMATION_CHANNELS.SLACK).toBe('slack');
        });

        it('should have no duplicate values', () => {
            const values = Object.values(AUTOMATION_CHANNELS);
            expect(new Set(values).size).toBe(values.length);
        });
    });

    describe('OPERATIONAL_ROLES', () => {
        it('should contain all 4 required roles', () => {
            expect(Object.keys(OPERATIONAL_ROLES)).toHaveLength(4);
            expect(OPERATIONAL_ROLES.MANAGER).toBe('manager');
            expect(OPERATIONAL_ROLES.TEAM_LEAD).toBe('team_lead');
            expect(OPERATIONAL_ROLES.ENGINEER).toBe('engineer');
            expect(OPERATIONAL_ROLES.TECHNICIAN).toBe('technician');
        });

        it('should have config entries for every role', () => {
            for (const role of Object.values(OPERATIONAL_ROLES)) {
                expect(OPERATIONAL_ROLE_CONFIG[role]).toBeDefined();
                expect(OPERATIONAL_ROLE_CONFIG[role].label).toBeTruthy();
                expect(typeof OPERATIONAL_ROLE_CONFIG[role].order).toBe('number');
            }
        });
    });

    describe('RUN_STATUS', () => {
        it('should contain all expected statuses', () => {
            expect(RUN_STATUS.RUNNING).toBe('running');
            expect(RUN_STATUS.SUCCESS).toBe('success');
            expect(RUN_STATUS.PARTIAL).toBe('partial');
            expect(RUN_STATUS.FAILED).toBe('failed');
            expect(RUN_STATUS.CANCELLED).toBe('cancelled');
        });

        it('should have config entries for every status', () => {
            for (const status of Object.values(RUN_STATUS)) {
                expect(RUN_STATUS_CONFIG[status]).toBeDefined();
                expect(RUN_STATUS_CONFIG[status].label).toBeTruthy();
                expect(RUN_STATUS_CONFIG[status].color).toBeTruthy();
            }
        });
    });

    describe('DELIVERY_STATUS', () => {
        it('should have no duplicate values', () => {
            const values = Object.values(DELIVERY_STATUS);
            expect(new Set(values).size).toBe(values.length);
        });

        it('should have config entries for every status', () => {
            for (const status of Object.values(DELIVERY_STATUS)) {
                expect(DELIVERY_STATUS_CONFIG[status]).toBeDefined();
            }
        });
    });

    describe('INCIDENT_STATUS', () => {
        it('should cover full lifecycle', () => {
            expect(INCIDENT_STATUS.OPEN).toBe('open');
            expect(INCIDENT_STATUS.ACKNOWLEDGED).toBe('acknowledged');
            expect(INCIDENT_STATUS.IN_PROGRESS).toBe('in_progress');
            expect(INCIDENT_STATUS.RESOLVED).toBe('resolved');
        });

        it('should have config entries for every status', () => {
            for (const status of Object.values(INCIDENT_STATUS)) {
                expect(INCIDENT_STATUS_CONFIG[status]).toBeDefined();
            }
        });
    });

    describe('INCIDENT_SEVERITY', () => {
        it('should have ordered severity levels', () => {
            const configs = Object.values(INCIDENT_SEVERITY).map(s => INCIDENT_SEVERITY_CONFIG[s]);
            for (let i = 1; i < configs.length; i++) {
                expect(configs[i].order).toBeGreaterThan(configs[i - 1].order);
            }
        });
    });

    describe('ROUTINE_KEYS', () => {
        it('should define all 7 routine keys', () => {
            expect(Object.keys(ROUTINE_KEYS)).toHaveLength(7);
            expect(ROUTINE_KEYS.MORNING_DIGEST_ALL).toBe('morning_digest_all');
            expect(ROUTINE_KEYS.TECHNICIAN_EVENING_CHECK).toBe('technician_evening_check');
            expect(ROUTINE_KEYS.MISSING_REPORT_ESCALATION).toBe('missing_report_escalation');
            expect(ROUTINE_KEYS.BLOCK_INCIDENT_ALERT).toBe('block_incident_alert');
            expect(ROUTINE_KEYS.MANAGER_SUMMARY).toBe('manager_summary');
            expect(ROUTINE_KEYS.ENGINEER_RISK_DIGEST).toBe('engineer_risk_digest');
            expect(ROUTINE_KEYS.MANUAL_TEST_MESSAGE).toBe('manual_test_message');
        });

        it('should have no duplicate values', () => {
            const values = Object.values(ROUTINE_KEYS);
            expect(new Set(values).size).toBe(values.length);
        });
    });

    describe('REPORT_STATUS', () => {
        it('should have expected statuses', () => {
            expect(REPORT_STATUS.PENDING).toBe('pending');
            expect(REPORT_STATUS.RECEIVED).toBe('received');
            expect(REPORT_STATUS.CONFIRMED).toBe('confirmed');
            expect(REPORT_STATUS.LATE).toBe('late');
            expect(REPORT_STATUS.ESCALATED).toBe('escalated');
        });
    });

    describe('ESCALATION_TYPE', () => {
        it('should have expected types', () => {
            expect(ESCALATION_TYPE.MISSING_REPORT).toBe('missing_report');
            expect(ESCALATION_TYPE.BLOCKER).toBe('blocker');
            expect(ESCALATION_TYPE.LATE_RESPONSE).toBe('late_response');
        });
    });
});
