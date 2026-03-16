/**
 * Transition Validator — Unit Tests
 * ==================================
 * Tests task status transition validation: errors, warnings, and audit data.
 */

import { describe, it, expect } from 'vitest';
import { validateTransition, canTransitionQuick } from '../../src/core/workflow/transitionValidator';

// Helper: minimal task object
const makeTask = (overrides = {}) => ({
    id: 'task-1',
    title: 'Test Task',
    status: 'in_progress',
    assignedTo: 'user-1',
    projectId: 'proj-1',
    estimatedHours: 8,
    actualHours: 0,
    blockedReason: '',
    ...overrides,
});

describe('transitionValidator', () => {

    describe('validateTransition — valid transitions', () => {
        it('allows in_progress → validation (valid)', () => {
            const task = makeTask({ status: 'in_progress' });
            const result = validateTransition(task, 'validation');
            expect(result.valid).toBe(true);
            expect(result.errors).toHaveLength(0);
        });

        it('generates audit data for valid transition', () => {
            const task = makeTask({ status: 'in_progress' });
            const result = validateTransition(task, 'validation');
            expect(result.auditData.eventType).toBe('task_status_changed');
            expect(result.auditData.previousValue).toBe('in_progress');
            expect(result.auditData.newValue).toBe('validation');
        });
    });

    describe('validateTransition — invalid transitions', () => {
        it('blocks backlog → completed', () => {
            const task = makeTask({ status: 'backlog' });
            const result = validateTransition(task, 'completed');
            expect(result.valid).toBe(false);
            expect(result.errors[0].code).toBe('INVALID_TRANSITION');
        });
    });

    describe('validateTransition — required fields', () => {
        it('fails pending → blocked without blockedReason', () => {
            const task = makeTask({ status: 'pending', blockedReason: '' });
            const result = validateTransition(task, 'blocked');
            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.code === 'MISSING_REQUIRED_FIELD')).toBe(true);
        });

        it('passes pending → blocked with blockedReason', () => {
            const task = makeTask({ status: 'pending', blockedReason: 'Waiting for parts' });
            const result = validateTransition(task, 'blocked');
            expect(result.valid).toBe(true);
        });
    });

    describe('validateTransition — contextual warnings', () => {
        it('warns when completing without hours', () => {
            const task = makeTask({ status: 'validation', actualHours: 0 });
            const result = validateTransition(task, 'completed', { timeLogs: [] });
            expect(result.warnings.some(w => w.code === 'NO_HOURS_LOGGED')).toBe(true);
        });

        it('warns when completing with incomplete subtasks', () => {
            const task = makeTask({ status: 'validation' });
            const subtasks = [{ id: 's1', completed: false }, { id: 's2', completed: true }];
            const result = validateTransition(task, 'completed', { subtasks });
            expect(result.warnings.some(w => w.code === 'INCOMPLETE_SUBTASKS')).toBe(true);
        });

        it('warns when reopening completed task', () => {
            const task = makeTask({ status: 'completed' });
            const result = validateTransition(task, 'in_progress');
            expect(result.warnings.some(w => w.code === 'TASK_REOPENED')).toBe(true);
        });

        it('warns when estimation exceeded', () => {
            const task = makeTask({ status: 'validation', estimatedHours: 8, actualHours: 14 });
            const result = validateTransition(task, 'completed');
            expect(result.warnings.some(w => w.code === 'ESTIMATION_EXCEEDED')).toBe(true);
        });
    });

    describe('canTransitionQuick', () => {
        it('returns true for valid transition', () => {
            expect(canTransitionQuick('backlog', 'pending')).toBe(true);
        });

        it('returns false for invalid transition', () => {
            expect(canTransitionQuick('backlog', 'completed')).toBe(false);
        });
    });
});
