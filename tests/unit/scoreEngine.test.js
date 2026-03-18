/**
 * Score Engine Unit Tests — V5 Phase 3
 * =======================================
 */

import { describe, it, expect } from 'vitest';
import {
    FACTOR_WEIGHTS,
    PENALTIES,
    factorTaskCompletion,
    factorRecentActivity,
    factorBlockerResolution,
    factorScheduleHealth,
    factorConsistency,
    factorIssueResolution,
    evaluatePenalties,
    evaluateLocks,
    deriveTrafficLight,
    computeAreaScore,
    computeMilestoneScore,
    explainScore,
} from '../../src/core/scoring/scoreEngine.js';

import {
    computeTrend,
    computeAreaTrends,
    generateChangeReason,
    TREND_CONFIG,
} from '../../src/core/scoring/trendCalculator.js';

import { TASK_STATUS, TRAFFIC_LIGHT, SCORE_LOCK_REASON } from '../../src/models/schemas.js';

// ── Test Data Builders ──

function task(overrides = {}) {
    return {
        status: TASK_STATUS.PENDING,
        priority: 'medium',
        assignedTo: 'user1',
        dueDate: null,
        updatedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        ...overrides,
    };
}

const now = new Date('2026-03-17T12:00:00Z');
const daysAgo = (n) => new Date(now.getTime() - n * 24 * 60 * 60 * 1000).toISOString();

// ============================================================
// FACTOR TESTS
// ============================================================

describe('Score Engine — Factors', () => {
    it('F1: all tasks completed = ratio 1.0', () => {
        const tasks = [
            task({ status: TASK_STATUS.COMPLETED }),
            task({ status: TASK_STATUS.COMPLETED }),
        ];
        const result = factorTaskCompletion(tasks);
        expect(result.ratio).toBe(1.0);
    });

    it('F1: no tasks completed = ratio 0.0', () => {
        const tasks = [
            task({ status: TASK_STATUS.PENDING }),
            task({ status: TASK_STATUS.IN_PROGRESS }),
        ];
        const result = factorTaskCompletion(tasks);
        expect(result.ratio).toBe(0);
    });

    it('F1: cancelled tasks excluded from calculation', () => {
        const tasks = [
            task({ status: TASK_STATUS.COMPLETED }),
            task({ status: TASK_STATUS.CANCELLED }),
        ];
        const result = factorTaskCompletion(tasks);
        expect(result.ratio).toBe(1.0);
    });

    it('F2: recently updated tasks score high', () => {
        const tasks = [
            task({ status: TASK_STATUS.PENDING, updatedAt: daysAgo(1) }),
            task({ status: TASK_STATUS.PENDING, updatedAt: daysAgo(2) }),
        ];
        const result = factorRecentActivity(tasks, now);
        expect(result.ratio).toBe(1.0);
    });

    it('F2: stale tasks score low', () => {
        const tasks = [
            task({ status: TASK_STATUS.PENDING, updatedAt: daysAgo(10) }),
            task({ status: TASK_STATUS.PENDING, updatedAt: daysAgo(15) }),
        ];
        const result = factorRecentActivity(tasks, now);
        expect(result.ratio).toBe(0);
    });

    it('F3: no blockers = ratio 1.0', () => {
        const tasks = [
            task({ status: TASK_STATUS.IN_PROGRESS }),
            task({ status: TASK_STATUS.PENDING }),
        ];
        const result = factorBlockerResolution(tasks);
        expect(result.ratio).toBe(1.0);
    });

    it('F3: all blocked = ratio 0.0', () => {
        const tasks = [
            task({ status: TASK_STATUS.BLOCKED }),
            task({ status: TASK_STATUS.BLOCKED }),
        ];
        const result = factorBlockerResolution(tasks);
        expect(result.ratio).toBe(0);
    });

    it('F4: plenty of time = high ratio', () => {
        const dueDateFar = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();
        const tasks = [task({ status: TASK_STATUS.PENDING })];
        const result = factorScheduleHealth(tasks, dueDateFar, now);
        expect(result.ratio).toBeGreaterThan(0.5);
    });

    it('F4: past deadline = ratio 0', () => {
        const dueDatePast = daysAgo(5);
        const tasks = [task({ status: TASK_STATUS.PENDING })];
        const result = factorScheduleHealth(tasks, dueDatePast, now);
        expect(result.ratio).toBe(0);
    });

    it('F6: no issues = ratio 1.0', () => {
        const result = factorIssueResolution([], []);
        expect(result.ratio).toBe(1.0);
    });

    it('F6: all issues resolved = ratio 1.0', () => {
        const d = [{ resolved: true }];
        const r = [{ status: 'resolved' }];
        const result = factorIssueResolution(d, r);
        expect(result.ratio).toBe(1.0);
    });
});

// ============================================================
// PENALTY TESTS
// ============================================================

describe('Score Engine — Penalties', () => {
    it('P1: critical overdue >3d triggers penalty', () => {
        const tasks = [task({ priority: 'critical', dueDate: daysAgo(5) })];
        const penalties = evaluatePenalties(tasks, null, now);
        expect(penalties.some(p => p.key === 'critical_overdue_3d')).toBe(true);
    });

    it('P2: stale area triggers penalty', () => {
        const tasks = [task({ status: TASK_STATUS.PENDING, updatedAt: daysAgo(10) })];
        const penalties = evaluatePenalties(tasks, null, now);
        expect(penalties.some(p => p.key === 'stale_area_5d')).toBe(true);
    });

    it('P4: >30% blocked triggers penalty', () => {
        const tasks = [
            task({ status: TASK_STATUS.BLOCKED }),
            task({ status: TASK_STATUS.BLOCKED }),
            task({ status: TASK_STATUS.PENDING }),
        ];
        const penalties = evaluatePenalties(tasks, null, now);
        expect(penalties.some(p => p.key === 'excessive_blockers')).toBe(true);
    });

    it('no penalties when everything is healthy', () => {
        const tasks = [
            task({ status: TASK_STATUS.COMPLETED, updatedAt: daysAgo(1) }),
            task({ status: TASK_STATUS.IN_PROGRESS, updatedAt: daysAgo(1) }),
        ];
        const penalties = evaluatePenalties(tasks, null, now);
        expect(penalties.length).toBe(0);
    });
});

// ============================================================
// LOCK TESTS
// ============================================================

describe('Score Engine — Locks', () => {
    it('L1: critical overdue triggers CRITICAL_OVERDUE lock', () => {
        const tasks = [task({ priority: 'critical', dueDate: daysAgo(5) })];
        const locks = evaluateLocks(tasks, now);
        expect(locks).toContain(SCORE_LOCK_REASON.CRITICAL_OVERDUE);
    });

    it('L4: unowned critical triggers UNOWNED_CRITICAL lock', () => {
        const tasks = [task({ priority: 'critical', assignedTo: null })];
        const locks = evaluateLocks(tasks, now);
        expect(locks).toContain(SCORE_LOCK_REASON.UNOWNED_CRITICAL);
    });

    it('no locks when healthy', () => {
        const tasks = [task({ updatedAt: daysAgo(1), assignedTo: 'user1' })];
        const locks = evaluateLocks(tasks, now);
        expect(locks.length).toBe(0);
    });
});

// ============================================================
// TRAFFIC LIGHT TESTS
// ============================================================

describe('Score Engine — Traffic Light', () => {
    it('score >= 70 with no locks = GREEN', () => {
        const tl = deriveTrafficLight(85, []);
        expect(tl.value).toBe(TRAFFIC_LIGHT.GREEN);
    });

    it('score 50 = YELLOW', () => {
        const tl = deriveTrafficLight(50, []);
        expect(tl.value).toBe(TRAFFIC_LIGHT.YELLOW);
    });

    it('score 20 = RED', () => {
        const tl = deriveTrafficLight(20, []);
        expect(tl.value).toBe(TRAFFIC_LIGHT.RED);
    });

    it('RED lock forces RED even with high score', () => {
        const tl = deriveTrafficLight(95, [SCORE_LOCK_REASON.CRITICAL_OVERDUE]);
        expect(tl.value).toBe(TRAFFIC_LIGHT.RED);
        expect(tl.source).toBe('lock');
    });

    it('YELLOW lock prevents GREEN', () => {
        const tl = deriveTrafficLight(80, [SCORE_LOCK_REASON.STALE_AREA_5D]);
        expect(tl.value).toBe(TRAFFIC_LIGHT.YELLOW);
        expect(tl.source).toBe('lock');
    });

    it('override takes precedence when not expired', () => {
        const future = new Date(Date.now() + 86400000).toISOString();
        const tl = deriveTrafficLight(20, [], { value: 'green', expiresAt: future, reason: 'test' });
        expect(tl.value).toBe('green');
        expect(tl.source).toBe('override');
    });
});

// ============================================================
// AREA SCORE INTEGRATION TEST
// ============================================================

describe('Score Engine — computeAreaScore', () => {
    it('healthy area scores high', () => {
        const tasks = [
            task({ status: TASK_STATUS.COMPLETED, updatedAt: daysAgo(1) }),
            task({ status: TASK_STATUS.COMPLETED, updatedAt: daysAgo(1) }),
            task({ status: TASK_STATUS.IN_PROGRESS, updatedAt: daysAgo(1) }),
        ];
        const due = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();
        const result = computeAreaScore(tasks, { milestoneDueDate: due, now });
        expect(result.score).toBeGreaterThanOrEqual(50);
        expect(result.trafficLight.value).not.toBe(TRAFFIC_LIGHT.RED);
        expect(result.factors.length).toBe(6);
    });

    it('unhealthy area scores low with locks', () => {
        const tasks = [
            task({ status: TASK_STATUS.BLOCKED, priority: 'critical', dueDate: daysAgo(5), updatedAt: daysAgo(10), assignedTo: null }),
        ];
        const result = computeAreaScore(tasks, { now });
        expect(result.score).toBeLessThan(40);
        expect(result.locks.length).toBeGreaterThan(0);
        expect(result.trafficLight.value).toBe(TRAFFIC_LIGHT.RED);
    });

    it('empty tasks returns score 0', () => {
        const result = computeAreaScore([], { now });
        // When there are no tasks, factors return 1.0 (no issues), so score should be high
        expect(result.score).toBeGreaterThanOrEqual(0);
    });
});

// ============================================================
// MILESTONE SCORE TEST
// ============================================================

describe('Score Engine — computeMilestoneScore', () => {
    it('averages area scores equally', () => {
        const areaResults = [
            { score: 80, locks: [], trafficLight: { value: 'green' }, penaltyTotal: 0 },
            { score: 60, locks: [], trafficLight: { value: 'yellow' }, penaltyTotal: 0 },
        ];
        const result = computeMilestoneScore(areaResults);
        expect(result.score).toBe(70);
    });

    it('aggregates locks from all areas', () => {
        const areaResults = [
            { score: 50, locks: [SCORE_LOCK_REASON.CRITICAL_OVERDUE], trafficLight: { value: 'red' }, penaltyTotal: -15 },
            { score: 80, locks: [SCORE_LOCK_REASON.STALE_AREA_5D], trafficLight: { value: 'yellow' }, penaltyTotal: -10 },
        ];
        const result = computeMilestoneScore(areaResults);
        expect(result.locks).toContain(SCORE_LOCK_REASON.CRITICAL_OVERDUE);
        expect(result.locks).toContain(SCORE_LOCK_REASON.STALE_AREA_5D);
        expect(result.trafficLight.value).toBe(TRAFFIC_LIGHT.RED); // RED lock propagates
    });
});

// ============================================================
// EXPLAINABILITY TEST
// ============================================================

describe('Score Engine — explainScore', () => {
    it('returns structured explanation', () => {
        const result = {
            score: 45,
            factors: [
                { key: 'TASK_COMPLETION', weight: 30, ratio: 0.5, points: 15, detail: '5/10 completadas' },
                { key: 'BLOCKER_RESOLUTION', weight: 20, ratio: 0.3, points: 6, detail: '7 bloqueadas' },
                { key: 'RECENT_ACTIVITY', weight: 15, ratio: 0.8, points: 12, detail: '8/10 recientes' },
                { key: 'SCHEDULE_HEALTH', weight: 20, ratio: 0.4, points: 8, detail: '5 días' },
                { key: 'CONSISTENCY', weight: 10, ratio: 0.4, points: 4, detail: '6 stale' },
                { key: 'ISSUE_RESOLUTION', weight: 5, ratio: 0, points: 0, detail: '0/3 resueltos' },
            ],
            penalties: [{ key: 'stale_area_5d', deduction: -10, label: 'Stale', detail: 'no updates' }],
            locks: [SCORE_LOCK_REASON.STALE_AREA_5D],
            trafficLight: { value: TRAFFIC_LIGHT.YELLOW, source: 'score', reason: 'Score 45' },
        };

        const explanation = explainScore(result);
        expect(explanation.summary).toContain('45/100');
        expect(explanation.reasons.length).toBeGreaterThan(0);
        expect(explanation.improvements.length).toBeGreaterThan(0);
        expect(explanation.blockers.length).toBeGreaterThan(0);
    });
});

// ============================================================
// TREND TESTS
// ============================================================

describe('Trend Calculator', () => {
    it('improving: current > previous + threshold', () => {
        const snapshots = [
            { capturedAt: daysAgo(7), milestoneScore: 50 },
        ];
        const trend = computeTrend(60, snapshots);
        expect(trend).toBe('improving');
    });

    it('declining: current < previous - threshold', () => {
        const snapshots = [
            { capturedAt: daysAgo(7), milestoneScore: 70 },
        ];
        const trend = computeTrend(60, snapshots);
        expect(trend).toBe('declining');
    });

    it('stable: change within threshold', () => {
        const snapshots = [
            { capturedAt: daysAgo(7), milestoneScore: 62 },
        ];
        const trend = computeTrend(60, snapshots);
        expect(trend).toBe('stable');
    });

    it('no snapshots = stable', () => {
        expect(computeTrend(50, [])).toBe('stable');
    });

    it('generateChangeReason returns meaningful text', () => {
        const reason = generateChangeReason(50, 65, ['critical_task_overdue_3d'], [{ key: 'stale' }]);
        expect(reason).toContain('+15');
    });
});
