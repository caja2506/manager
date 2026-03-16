/**
 * Tests for Telegram State Machine
 * 
 * Validates all state transitions, event handling, timeout logic,
 * and helper functions.
 */
import { describe, it, expect } from 'vitest';
import {
    getNextState,
    isValidTransition,
    getAvailableEvents,
    getPossibleNextStates,
    isSessionExpired,
    getStateTimeout,
    getAllStates,
    getAllEvents,
    STATE_METADATA,
} from '../../src/automation/telegram/telegramStateMachine.js';
import {
    TELEGRAM_SESSION_STATE as STATE,
    TELEGRAM_SESSION_EVENT as EVENT,
} from '../../src/automation/telegram/telegramConstants.js';

describe('Telegram State Machine', () => {
    describe('getNextState()', () => {
        // --- From IDLE ---
        it('idle + LINK_REQUESTED → awaiting_identity_link', () => {
            const result = getNextState(STATE.IDLE, EVENT.LINK_REQUESTED);
            expect(result.valid).toBe(true);
            expect(result.state).toBe(STATE.AWAITING_IDENTITY_LINK);
        });

        it('idle + REPORT_REQUESTED → awaiting_daily_report', () => {
            const result = getNextState(STATE.IDLE, EVENT.REPORT_REQUESTED);
            expect(result.valid).toBe(true);
            expect(result.state).toBe(STATE.AWAITING_DAILY_REPORT);
        });

        it('idle + BLOCK_REPORTED → awaiting_block_cause', () => {
            const result = getNextState(STATE.IDLE, EVENT.BLOCK_REPORTED);
            expect(result.valid).toBe(true);
            expect(result.state).toBe(STATE.AWAITING_BLOCK_CAUSE);
        });

        // --- From AWAITING_IDENTITY_LINK ---
        it('awaiting_identity_link + IDENTITY_CONFIRMED → idle', () => {
            const result = getNextState(STATE.AWAITING_IDENTITY_LINK, EVENT.IDENTITY_CONFIRMED);
            expect(result.valid).toBe(true);
            expect(result.state).toBe(STATE.IDLE);
        });

        it('awaiting_identity_link + IDENTITY_FAILED → idle', () => {
            const result = getNextState(STATE.AWAITING_IDENTITY_LINK, EVENT.IDENTITY_FAILED);
            expect(result.valid).toBe(true);
            expect(result.state).toBe(STATE.IDLE);
        });

        // --- From AWAITING_DAILY_REPORT ---
        it('awaiting_daily_report + REPORT_SUBMITTED → awaiting_report_confirmation', () => {
            const result = getNextState(STATE.AWAITING_DAILY_REPORT, EVENT.REPORT_SUBMITTED);
            expect(result.valid).toBe(true);
            expect(result.state).toBe(STATE.AWAITING_REPORT_CONFIRMATION);
        });

        it('awaiting_daily_report + GRACE_PERIOD_EXPIRED → escalated', () => {
            const result = getNextState(STATE.AWAITING_DAILY_REPORT, EVENT.GRACE_PERIOD_EXPIRED);
            expect(result.valid).toBe(true);
            expect(result.state).toBe(STATE.ESCALATED);
        });

        // --- From AWAITING_REPORT_CONFIRMATION ---
        it('awaiting_report_confirmation + REPORT_CONFIRMED → report_received', () => {
            const result = getNextState(STATE.AWAITING_REPORT_CONFIRMATION, EVENT.REPORT_CONFIRMED);
            expect(result.valid).toBe(true);
            expect(result.state).toBe(STATE.REPORT_RECEIVED);
        });

        it('awaiting_report_confirmation + REPORT_REJECTED → awaiting_daily_report', () => {
            const result = getNextState(STATE.AWAITING_REPORT_CONFIRMATION, EVENT.REPORT_REJECTED);
            expect(result.valid).toBe(true);
            expect(result.state).toBe(STATE.AWAITING_DAILY_REPORT);
        });

        // --- From AWAITING_BLOCK_CAUSE ---
        it('awaiting_block_cause + BLOCK_CAUSE_RECEIVED → idle', () => {
            const result = getNextState(STATE.AWAITING_BLOCK_CAUSE, EVENT.BLOCK_CAUSE_RECEIVED);
            expect(result.valid).toBe(true);
            expect(result.state).toBe(STATE.IDLE);
        });

        // --- Terminal states ---
        it('report_received + RESET → idle', () => {
            const result = getNextState(STATE.REPORT_RECEIVED, EVENT.RESET);
            expect(result.valid).toBe(true);
            expect(result.state).toBe(STATE.IDLE);
        });

        it('escalated + RESET → idle', () => {
            const result = getNextState(STATE.ESCALATED, EVENT.RESET);
            expect(result.valid).toBe(true);
            expect(result.state).toBe(STATE.IDLE);
        });

        it('blocked_flow + ADMIN_RESET → idle', () => {
            const result = getNextState(STATE.BLOCKED_FLOW, EVENT.ADMIN_RESET);
            expect(result.valid).toBe(true);
            expect(result.state).toBe(STATE.IDLE);
        });

        // --- Global ERROR transition ---
        it('ERROR from any state → blocked_flow', () => {
            for (const state of getAllStates()) {
                const result = getNextState(state, EVENT.ERROR);
                expect(result.valid).toBe(true);
                expect(result.state).toBe(STATE.BLOCKED_FLOW);
            }
        });

        // --- Invalid transitions ---
        it('should reject invalid event for state', () => {
            const result = getNextState(STATE.IDLE, EVENT.REPORT_CONFIRMED);
            expect(result.valid).toBe(false);
            expect(result.state).toBe(STATE.IDLE); // stays in current state
        });

        it('should reject unknown state', () => {
            const result = getNextState('nonexistent_state', EVENT.RESET);
            expect(result.valid).toBe(false);
            expect(result.error).toContain('Unknown state');
        });
    });

    describe('isValidTransition()', () => {
        it('should accept valid direct transitions', () => {
            expect(isValidTransition(STATE.IDLE, STATE.AWAITING_DAILY_REPORT)).toBe(true);
            expect(isValidTransition(STATE.AWAITING_DAILY_REPORT, STATE.AWAITING_REPORT_CONFIRMATION)).toBe(true);
        });

        it('should reject invalid direct transitions', () => {
            expect(isValidTransition(STATE.IDLE, STATE.REPORT_RECEIVED)).toBe(false);
            expect(isValidTransition(STATE.REPORT_RECEIVED, STATE.AWAITING_BLOCK_CAUSE)).toBe(false);
        });

        it('should always accept transition to blocked_flow', () => {
            for (const state of getAllStates()) {
                expect(isValidTransition(state, STATE.BLOCKED_FLOW)).toBe(true);
            }
        });
    });

    describe('getAvailableEvents()', () => {
        it('should include ERROR for all states', () => {
            for (const state of getAllStates()) {
                const events = getAvailableEvents(state);
                expect(events).toContain(EVENT.ERROR);
            }
        });

        it('idle should have 4 available events', () => {
            const events = getAvailableEvents(STATE.IDLE);
            // ERROR + LINK_REQUESTED + REPORT_REQUESTED + BLOCK_REPORTED
            expect(events).toHaveLength(4);
            expect(events).toContain(EVENT.LINK_REQUESTED);
            expect(events).toContain(EVENT.REPORT_REQUESTED);
            expect(events).toContain(EVENT.BLOCK_REPORTED);
        });

        it('blocked_flow should only have ERROR and ADMIN_RESET', () => {
            const events = getAvailableEvents(STATE.BLOCKED_FLOW);
            expect(events).toContain(EVENT.ERROR);
            expect(events).toContain(EVENT.ADMIN_RESET);
            expect(events).toHaveLength(2);
        });
    });

    describe('getPossibleNextStates()', () => {
        it('idle should lead to 4 possible states', () => {
            const states = getPossibleNextStates(STATE.IDLE);
            expect(states).toContain(STATE.BLOCKED_FLOW); // via ERROR
            expect(states).toContain(STATE.AWAITING_IDENTITY_LINK);
            expect(states).toContain(STATE.AWAITING_DAILY_REPORT);
            expect(states).toContain(STATE.AWAITING_BLOCK_CAUSE);
        });
    });

    describe('STATE_METADATA', () => {
        it('should have metadata for all states', () => {
            for (const state of getAllStates()) {
                expect(STATE_METADATA[state]).toBeDefined();
                expect(STATE_METADATA[state].description).toBeTruthy();
                expect(typeof STATE_METADATA[state].hasTimeout).toBe('boolean');
            }
        });

        it('states with timeout should have timeoutMs', () => {
            for (const state of getAllStates()) {
                const meta = STATE_METADATA[state];
                if (meta.hasTimeout) {
                    expect(typeof meta.timeoutMs).toBe('number');
                    expect(meta.timeoutMs).toBeGreaterThan(0);
                }
            }
        });
    });

    describe('isSessionExpired()', () => {
        it('should return false for session without timeout state', () => {
            const session = {
                currentState: STATE.IDLE,
                stateExpiresAt: new Date(Date.now() - 100000).toISOString(),
            };
            expect(isSessionExpired(session)).toBe(false);
        });

        it('should return true for timed-out session in timeout state', () => {
            const session = {
                currentState: STATE.AWAITING_DAILY_REPORT,
                stateExpiresAt: new Date(Date.now() - 100000).toISOString(),
            };
            expect(isSessionExpired(session)).toBe(true);
        });

        it('should return false for non-expired session in timeout state', () => {
            const session = {
                currentState: STATE.AWAITING_DAILY_REPORT,
                stateExpiresAt: new Date(Date.now() + 100000).toISOString(),
            };
            expect(isSessionExpired(session)).toBe(false);
        });
    });

    describe('getStateTimeout()', () => {
        it('should return null for states without timeout', () => {
            expect(getStateTimeout(STATE.IDLE)).toBeNull();
            expect(getStateTimeout(STATE.REPORT_RECEIVED)).toBeNull();
        });

        it('should return a number for states with timeout', () => {
            expect(getStateTimeout(STATE.AWAITING_DAILY_REPORT)).toBeGreaterThan(0);
            expect(getStateTimeout(STATE.AWAITING_IDENTITY_LINK)).toBeGreaterThan(0);
        });
    });

    describe('getAllStates() / getAllEvents()', () => {
        it('should return 8 states', () => {
            expect(getAllStates()).toHaveLength(8);
        });

        it('should return 13 events', () => {
            expect(getAllEvents()).toHaveLength(13);
        });
    });
});
