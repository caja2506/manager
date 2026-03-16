/**
 * Planner Validation — Unit Tests
 * ================================
 * Tests the blocking rules (B1-B7) and warning functions.
 */

import { describe, it, expect } from 'vitest';
import {
    validatePlanItem,
    validatePlanItemFull,
    checkOverlaps,
    checkWeeklyCapacity,
} from '../../src/utils/plannerUtils';

// Monday 2026-03-09
const VALID_ITEM = {
    taskId: 'task-1',
    assignedTo: 'user-1',
    weekStartDate: '2026-03-09',
    startDateTime: '2026-03-09T09:00:00.000Z',
    endDateTime: '2026-03-09T13:00:00.000Z',
    plannedHours: 4,
    date: '2026-03-09',
};

describe('plannerUtils', () => {

    describe('validatePlanItem — blocking rules', () => {
        it('passes for valid item', () => {
            const result = validatePlanItem(VALID_ITEM);
            expect(result.valid).toBe(true);
            expect(result.errors).toHaveLength(0);
        });

        it('B1: blocks missing taskId', () => {
            const result = validatePlanItem({ ...VALID_ITEM, taskId: '' });
            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.includes('taskId'))).toBe(true);
        });

        it('B2: blocks missing assignedTo', () => {
            const result = validatePlanItem({ ...VALID_ITEM, assignedTo: '' });
            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.includes('assignedTo'))).toBe(true);
        });

        it('B3: blocks non-Monday weekStartDate', () => {
            const result = validatePlanItem({ ...VALID_ITEM, weekStartDate: '2026-03-10' }); // Tuesday
            expect(result.valid).toBe(false);
        });

        it('B5: blocks endDateTime <= startDateTime', () => {
            const result = validatePlanItem({
                ...VALID_ITEM,
                endDateTime: '2026-03-09T08:00:00.000Z', // before start
            });
            expect(result.valid).toBe(false);
        });

        it('B6: blocks plannedHours <= 0', () => {
            const result = validatePlanItem({ ...VALID_ITEM, plannedHours: 0 });
            expect(result.valid).toBe(false);
        });
    });

    describe('checkOverlaps', () => {
        it('detects overlapping time blocks', () => {
            const existing = [
                { id: 'p1', assignedTo: 'user-1', date: '2026-03-09', startDateTime: '2026-03-09T09:00:00.000Z', endDateTime: '2026-03-09T12:00:00.000Z' },
            ];
            const newItem = {
                assignedTo: 'user-1', date: '2026-03-09',
                startDateTime: '2026-03-09T11:00:00.000Z', endDateTime: '2026-03-09T14:00:00.000Z',
            };
            const overlaps = checkOverlaps(newItem, existing);
            expect(overlaps.length).toBeGreaterThan(0);
        });

        it('allows non-overlapping blocks', () => {
            const existing = [
                { id: 'p1', assignedTo: 'user-1', date: '2026-03-09', startDateTime: '2026-03-09T09:00:00.000Z', endDateTime: '2026-03-09T11:00:00.000Z' },
            ];
            const newItem = {
                assignedTo: 'user-1', date: '2026-03-09',
                startDateTime: '2026-03-09T13:00:00.000Z', endDateTime: '2026-03-09T15:00:00.000Z',
            };
            const overlaps = checkOverlaps(newItem, existing);
            expect(overlaps).toHaveLength(0);
        });
    });

    describe('checkWeeklyCapacity', () => {
        it('warns when over capacity', () => {
            const existingItems = [
                { assignedTo: 'user-1', weekStartDate: '2026-03-09', plannedHours: 35 },
            ];
            const result = checkWeeklyCapacity('user-1', 8, existingItems, 40);
            expect(result).not.toBeNull();
            expect(result).toContain('Capacidad');
        });

        it('passes when under capacity', () => {
            const existingItems = [
                { assignedTo: 'user-1', weekStartDate: '2026-03-09', plannedHours: 20 },
            ];
            const result = checkWeeklyCapacity('user-1', 8, existingItems, 40);
            expect(result).toBeNull();
        });
    });
});
