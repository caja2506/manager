/**
 * Shared Task Workflow — Unit Tests
 * ===================================
 * Tests the canonical contract: statuses, transitions, required fields, helpers.
 * This is the Single Source of Truth — if these tests pass, both frontend and
 * backend are guaranteed to agree on workflow behavior.
 */

import { describe, it, expect } from 'vitest';

// Import via the frontend wrapper (which derives from shared/taskWorkflow.js)
import {
    WORKFLOW_STATUS,
    VALID_TRANSITIONS,
    REQUIRED_FIELDS_BY_STATUS,
    isValidTransition,
    getAvailableTransitions,
    getRequiredFields,
    getStatusLabel,
    isTerminalStatus,
    isActiveStatus,
    STATUS_TO_CATEGORY,
    STATUS_CATEGORY,
    getWorkflowSequence,
} from '../../src/core/workflow/workflowModel';

// Also import the shared module directly to verify isomorphic consistency
const sharedWorkflow = require('../../shared/taskWorkflow.cjs');

describe('Shared Workflow Contract (Single Source of Truth)', () => {

    describe('STATUS values', () => {
        it('defines all 7 statuses', () => {
            expect(Object.keys(sharedWorkflow.STATUS)).toHaveLength(7);
        });

        it('frontend WORKFLOW_STATUS maps correctly to shared STATUS', () => {
            expect(WORKFLOW_STATUS.BACKLOG).toBe(sharedWorkflow.STATUS.BACKLOG);
            expect(WORKFLOW_STATUS.PLANNED).toBe(sharedWorkflow.STATUS.PENDING);
            expect(WORKFLOW_STATUS.IN_PROGRESS).toBe(sharedWorkflow.STATUS.IN_PROGRESS);
            expect(WORKFLOW_STATUS.BLOCKED).toBe(sharedWorkflow.STATUS.BLOCKED);
            expect(WORKFLOW_STATUS.REVIEW).toBe(sharedWorkflow.STATUS.VALIDATION);
            expect(WORKFLOW_STATUS.COMPLETED).toBe(sharedWorkflow.STATUS.COMPLETED);
            expect(WORKFLOW_STATUS.CANCELLED).toBe(sharedWorkflow.STATUS.CANCELLED);
        });
    });

    describe('TRANSITIONS parity (frontend === shared)', () => {
        it('frontend VALID_TRANSITIONS matches shared TRANSITIONS', () => {
            for (const [status, targets] of Object.entries(sharedWorkflow.TRANSITIONS)) {
                expect(VALID_TRANSITIONS[status]).toEqual(targets);
            }
        });

        it('all 7 statuses have transition entries', () => {
            expect(Object.keys(VALID_TRANSITIONS)).toHaveLength(7);
        });
    });

    describe('REQUIRED_FIELDS parity (frontend === shared)', () => {
        it('same field names and labels for each status', () => {
            for (const [status, sharedFields] of Object.entries(sharedWorkflow.REQUIRED_FIELDS)) {
                const frontendFields = REQUIRED_FIELDS_BY_STATUS[status] || [];
                expect(frontendFields.length).toBe(sharedFields.length);
                for (let i = 0; i < sharedFields.length; i++) {
                    expect(frontendFields[i].field).toBe(sharedFields[i].field);
                    expect(frontendFields[i].label).toBe(sharedFields[i].label);
                }
            }
        });

        it('in_progress requires estimatedHours > 0 (I1 fix)', () => {
            const fields = getRequiredFields('in_progress');
            const estField = fields.find(f => f.field === 'estimatedHours');
            expect(estField).toBeDefined();
            // check() and validate() should both reject 0
            expect(estField.validate({ estimatedHours: 0 })).toBe(false);
            expect(estField.validate({ estimatedHours: 8 })).toBe(true);

            const sharedFields = sharedWorkflow.getRequiredFields('in_progress');
            const sharedEst = sharedFields.find(f => f.field === 'estimatedHours');
            expect(sharedEst.check({ estimatedHours: 0 })).toBe(false);
            expect(sharedEst.check({ estimatedHours: 8 })).toBe(true);
        });

        it('blocked requires non-empty blockedReason (I3 fix)', () => {
            const sharedFields = sharedWorkflow.getRequiredFields('blocked');
            const reason = sharedFields.find(f => f.field === 'blockedReason');
            expect(reason.check({ blockedReason: '' })).toBe(false);
            expect(reason.check({ blockedReason: '   ' })).toBe(false);
            expect(reason.check({ blockedReason: 'Parts delayed' })).toBe(true);
        });
    });

    describe('LABELS parity (I2 fix)', () => {
        it('shared labels match frontend labels', () => {
            expect(getStatusLabel('pending')).toBe('Planificado');
            expect(getStatusLabel('validation')).toBe('En Revisión');
            expect(sharedWorkflow.getStatusLabel('pending')).toBe('Planificado');
            expect(sharedWorkflow.getStatusLabel('validation')).toBe('En Revisión');
        });
    });

    describe('isValidTransition (functional parity)', () => {
        const testCases = [
            ['backlog', 'pending', true],
            ['backlog', 'in_progress', true],
            ['backlog', 'completed', false],
            ['in_progress', 'validation', true],
            ['in_progress', 'in_progress', false],
            ['completed', 'in_progress', true],
            ['completed', 'validation', false],
            ['cancelled', 'backlog', true],
            ['cancelled', 'completed', false],
        ];

        testCases.forEach(([from, to, expected]) => {
            it(`${from} → ${to} = ${expected}`, () => {
                expect(isValidTransition(from, to)).toBe(expected);
                expect(sharedWorkflow.isValidTransition(from, to)).toBe(expected);
            });
        });
    });

    describe('Category helpers', () => {
        it('isTerminalStatus', () => {
            expect(isTerminalStatus('completed')).toBe(true);
            expect(isTerminalStatus('cancelled')).toBe(true);
            expect(isTerminalStatus('in_progress')).toBe(false);
        });

        it('isActiveStatus', () => {
            expect(isActiveStatus('pending')).toBe(true);
            expect(isActiveStatus('in_progress')).toBe(true);
            expect(isActiveStatus('validation')).toBe(true);
            expect(isActiveStatus('backlog')).toBe(false);
            expect(isActiveStatus('blocked')).toBe(false);
        });

        it('STATUS_TO_CATEGORY maps correctly', () => {
            expect(STATUS_TO_CATEGORY['backlog']).toBe(STATUS_CATEGORY.INACTIVE);
            expect(STATUS_TO_CATEGORY['blocked']).toBe(STATUS_CATEGORY.EXCEPTION);
            expect(STATUS_TO_CATEGORY['pending']).toBe(STATUS_CATEGORY.ACTIVE);
            expect(STATUS_TO_CATEGORY['completed']).toBe(STATUS_CATEGORY.TERMINAL);
        });
    });

    describe('getWorkflowSequence', () => {
        it('returns 5-step happy path', () => {
            const seq = getWorkflowSequence();
            expect(seq).toEqual(['backlog', 'pending', 'in_progress', 'validation', 'completed']);
        });
    });
});
