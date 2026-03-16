/**
 * Workflow Model — Unit Tests
 * ===========================
 * Tests the official state machine: statuses, transitions, required fields, categories.
 */

import { describe, it, expect } from 'vitest';
import {
    WORKFLOW_STATUS,
    VALID_TRANSITIONS,
    isValidTransition,
    getAvailableTransitions,
    getRequiredFields,
    getStatusLabel,
    isTerminalStatus,
    STATUS_TO_CATEGORY,
    STATUS_CATEGORY,
} from '../../src/core/workflow/workflowModel';

describe('workflowModel', () => {

    describe('WORKFLOW_STATUS', () => {
        it('defines all 7 statuses', () => {
            expect(Object.keys(WORKFLOW_STATUS)).toHaveLength(7);
        });

        it('maps PLANNED to "pending" in DB', () => {
            expect(WORKFLOW_STATUS.PLANNED).toBe('pending');
        });

        it('maps REVIEW to "validation" in DB', () => {
            expect(WORKFLOW_STATUS.REVIEW).toBe('validation');
        });
    });

    describe('isValidTransition', () => {
        it('allows backlog → planned', () => {
            expect(isValidTransition('backlog', 'pending')).toBe(true);
        });

        it('allows in_progress → validation', () => {
            expect(isValidTransition('in_progress', 'validation')).toBe(true);
        });

        it('allows completed → in_progress (reopen)', () => {
            expect(isValidTransition('completed', 'in_progress')).toBe(true);
        });

        it('blocks backlog → completed (skip)', () => {
            expect(isValidTransition('backlog', 'completed')).toBe(false);
        });

        it('blocks completed → validation', () => {
            expect(isValidTransition('completed', 'validation')).toBe(false);
        });

        it('blocks same-status transition', () => {
            expect(isValidTransition('in_progress', 'in_progress')).toBe(false);
        });

        it('returns false for unknown status', () => {
            expect(isValidTransition('unknown', 'backlog')).toBe(false);
        });
    });

    describe('getAvailableTransitions', () => {
        it('returns 3 transitions from backlog', () => {
            const transitions = getAvailableTransitions('backlog');
            expect(transitions).toContain('pending');
            expect(transitions).toContain('in_progress');
            expect(transitions).toContain('cancelled');
            expect(transitions).toHaveLength(3);
        });

        it('returns only in_progress from completed', () => {
            const transitions = getAvailableTransitions('completed');
            expect(transitions).toEqual(['in_progress']);
        });

        it('returns empty for unknown status', () => {
            expect(getAvailableTransitions('nonexistent')).toEqual([]);
        });
    });

    describe('getRequiredFields', () => {
        it('requires blockedReason for blocked status', () => {
            const fields = getRequiredFields('blocked');
            const fieldNames = fields.map(f => f.field);
            expect(fieldNames).toContain('blockedReason');
        });

        it('requires assignedTo for pending', () => {
            const fields = getRequiredFields('pending');
            const fieldNames = fields.map(f => f.field);
            expect(fieldNames).toContain('assignedTo');
        });
    });

    describe('isTerminalStatus', () => {
        it('completed is terminal', () => {
            expect(isTerminalStatus('completed')).toBe(true);
        });

        it('cancelled is terminal', () => {
            expect(isTerminalStatus('cancelled')).toBe(true);
        });

        it('in_progress is not terminal', () => {
            expect(isTerminalStatus('in_progress')).toBe(false);
        });
    });

    describe('STATUS_TO_CATEGORY', () => {
        it('backlog is inactive', () => {
            expect(STATUS_TO_CATEGORY['backlog']).toBe(STATUS_CATEGORY.INACTIVE);
        });

        it('blocked is exception', () => {
            expect(STATUS_TO_CATEGORY['blocked']).toBe(STATUS_CATEGORY.EXCEPTION);
        });

        it('pending is active', () => {
            expect(STATUS_TO_CATEGORY['pending']).toBe(STATUS_CATEGORY.ACTIVE);
        });
    });
});
