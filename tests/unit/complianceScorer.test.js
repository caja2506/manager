/**
 * Compliance Scorer — Unit Tests
 * ===============================
 * Tests the pure scoring functions used by both client audit and CF.
 */

import { describe, it, expect } from 'vitest';
import {
    calculateEntityScore,
    calculateMethodologyCompliance,
    calculatePlanningReliability,
    calculateEstimationAccuracy,
    calculateDataDiscipline,
    calculateProjectHealth,
} from '../../src/core/audit/complianceScorer';

describe('complianceScorer', () => {

    describe('calculateEntityScore', () => {
        it('returns 100 with no findings', () => {
            expect(calculateEntityScore([])).toBe(100);
        });

        it('subtracts score impacts', () => {
            const findings = [{ scoreImpact: -10 }, { scoreImpact: -5 }];
            expect(calculateEntityScore(findings)).toBe(85);
        });

        it('floors at 0', () => {
            const findings = [{ scoreImpact: -200 }];
            expect(calculateEntityScore(findings)).toBe(0);
        });
    });

    describe('calculateMethodologyCompliance', () => {
        it('returns 100 with no tasks', () => {
            expect(calculateMethodologyCompliance([], 0)).toBe(100);
        });

        it('returns 50% when half of tasks have issues', () => {
            const findings = [
                { entityId: 'task-1' },
                { entityId: 'task-1' }, // same task, deduped
                { entityId: 'task-2' },
            ];
            expect(calculateMethodologyCompliance(findings, 4)).toBe(50);
        });
    });

    describe('calculateEstimationAccuracy', () => {
        it('returns 100 with no completed tasks', () => {
            expect(calculateEstimationAccuracy([])).toBe(100);
        });

        it('returns 50 when no tasks have both hours', () => {
            const tasks = [{ estimatedHours: 0, actualHours: 5 }];
            expect(calculateEstimationAccuracy(tasks)).toBe(50);
        });

        it('returns 100 for perfect estimation', () => {
            const tasks = [{ estimatedHours: 8, actualHours: 8 }];
            expect(calculateEstimationAccuracy(tasks)).toBe(100);
        });

        it('penalizes over-estimation', () => {
            const tasks = [{ estimatedHours: 8, actualHours: 16 }];
            const score = calculateEstimationAccuracy(tasks);
            expect(score).toBeLessThan(100);
            expect(score).toBe(0); // ratio = 2.0, deviation = 1.0, accuracy = 0
        });

        it('penalizes under-estimation', () => {
            const tasks = [{ estimatedHours: 8, actualHours: 4 }];
            const score = calculateEstimationAccuracy(tasks);
            expect(score).toBe(50); // ratio = 0.5, deviation = 0.5, accuracy = 0.5
        });
    });

    describe('calculateDataDiscipline', () => {
        it('returns 100 with no users', () => {
            expect(calculateDataDiscipline([], 0)).toBe(100);
        });

        it('returns 0 when all users have issues', () => {
            const findings = [{ entityId: 'u1' }, { entityId: 'u2' }];
            expect(calculateDataDiscipline(findings, 2)).toBe(0);
        });
    });

    describe('calculateProjectHealth', () => {
        it('returns 100 with no projects', () => {
            expect(calculateProjectHealth([], 0)).toBe(100);
        });

        it('returns 50 when half have issues', () => {
            const findings = [{ entityId: 'p1' }];
            expect(calculateProjectHealth(findings, 2)).toBe(50);
        });
    });
});
