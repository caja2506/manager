/**
 * Performance Score Engine — Unit Tests
 * ======================================
 */

import { describe, it, expect } from 'vitest';
import {
    calculateIndividualScore,
    calculateTeamScores,
    IPS_LEVEL,
    DEFAULT_WEIGHTS,
} from '../../src/core/analytics/performanceScore';

// ── Test Fixtures ──

const now = new Date();
const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString();
const oneDayAgo = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000).toISOString();
const tenDaysAgo = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000).toISOString();

function makeTask(overrides = {}) {
    return {
        id: 'task-1',
        assignedTo: 'eng-1',
        status: 'in_progress',
        estimatedHours: 8,
        actualHours: 0,
        projectId: 'proj-1',
        title: 'Test Task',
        updatedAt: oneDayAgo,
        ...overrides,
    };
}

function makeTimeLog(overrides = {}) {
    return {
        userId: 'eng-1',
        taskId: 'task-1',
        startTime: oneDayAgo,
        endTime: oneDayAgo,
        totalHours: 4,
        overtimeHours: 0,
        ...overrides,
    };
}

function makeMember(overrides = {}) {
    return {
        uid: 'eng-1',
        displayName: 'Engineer One',
        email: 'eng1@test.com',
        teamRole: 'engineer',
        weeklyCapacityHours: 40,
        ...overrides,
    };
}

const baseData = {
    tasks: [],
    timeLogs: [],
    delays: [],
    teamMembers: [],
    assignments: [],
    plannerSlots: [],
    auditScores: null,
};

// ============================================================
// TEST SUITES
// ============================================================

describe('calculateIndividualScore', () => {

    // ── Manager returns null score ──
    it('returns null score for managers', () => {
        const result = calculateIndividualScore('mgr-1', 'manager', baseData);
        expect(result.score).toBeNull();
        expect(result.isManager).toBe(true);
        expect(result.insufficientData).toBe(false);
    });

    // ── Insufficient data ──
    it('returns insufficientData when no tasks and no timeLogs', () => {
        const data = { ...baseData, teamMembers: [makeMember()] };
        const result = calculateIndividualScore('eng-1', 'engineer', data);
        expect(result.insufficientData).toBe(true);
        expect(result.score).toBeNull();
    });

    // ── Score always 0–100 ──
    it('score is always between 0 and 100', () => {
        const data = {
            ...baseData,
            tasks: [
                makeTask({ id: 't1', status: 'in_progress' }),
                makeTask({ id: 't2', status: 'blocked' }),
                makeTask({ id: 't3', status: 'blocked' }),
            ],
            timeLogs: [makeTimeLog()],
            delays: [
                { taskId: 't2', resolved: false },
                { taskId: 't3', resolved: false },
            ],
            teamMembers: [makeMember()],
        };
        const result = calculateIndividualScore('eng-1', 'engineer', data);
        expect(result.score).toBeGreaterThanOrEqual(0);
        expect(result.score).toBeLessThanOrEqual(100);
    });

    // ── Levels ──
    it('assigns correct levels based on score thresholds', () => {
        // High performer: completed tasks, recent logs, no blocks
        const data = {
            ...baseData,
            tasks: [
                makeTask({ id: 't1', status: 'completed', completedDate: oneDayAgo, actualHours: 8, estimatedHours: 8 }),
                makeTask({ id: 't2', status: 'in_progress' }),
            ],
            timeLogs: [
                makeTimeLog({ totalHours: 8 }),
                makeTimeLog({ taskId: 't2', totalHours: 8 }),
            ],
            teamMembers: [makeMember()],
        };
        const result = calculateIndividualScore('eng-1', 'engineer', data);
        expect(result.level).not.toBeNull();
        expect([IPS_LEVEL.EXCELLENT, IPS_LEVEL.GOOD, IPS_LEVEL.REGULAR, IPS_LEVEL.NEEDS_ATTENTION]).toContain(result.level);
        expect(result.levelCode).toBeGreaterThanOrEqual(1);
        expect(result.levelCode).toBeLessThanOrEqual(4);
    });

    // ── Engineer has 6 dimensions ──
    it('engineer has 6 dimensions including leadership', () => {
        const data = {
            ...baseData,
            tasks: [makeTask()],
            timeLogs: [makeTimeLog()],
            teamMembers: [makeMember()],
        };
        const result = calculateIndividualScore('eng-1', 'engineer', data);
        expect(result.dimensions).toHaveProperty('velocity');
        expect(result.dimensions).toHaveProperty('discipline');
        expect(result.dimensions).toHaveProperty('capacity');
        expect(result.dimensions).toHaveProperty('precision');
        expect(result.dimensions).toHaveProperty('collaboration');
        expect(result.dimensions).toHaveProperty('leadership');
        expect(result.dimensions).not.toHaveProperty('oversight');
    });

    // ── Technician has 4 dimensions (no capacity/leadership) ──
    it('technician has 4 dimensions: velocity, discipline, precision, collaboration', () => {
        const tech = makeMember({ uid: 'tech-1', teamRole: 'technician' });
        const data = {
            ...baseData,
            tasks: [makeTask({ assignedTo: 'tech-1' })],
            timeLogs: [makeTimeLog({ userId: 'tech-1' })],
            teamMembers: [tech],
        };
        const result = calculateIndividualScore('tech-1', 'technician', data);
        expect(result.dimensions).toHaveProperty('velocity');
        expect(result.dimensions).toHaveProperty('discipline');
        expect(result.dimensions).toHaveProperty('precision');
        expect(result.dimensions).toHaveProperty('collaboration');
        expect(result.dimensions).not.toHaveProperty('capacity');
        expect(result.dimensions).not.toHaveProperty('leadership');
        expect(result.dimensions).not.toHaveProperty('oversight');
    });

    // ── Team Lead has oversight ──
    it('team_lead has oversight dimension', () => {
        const lead = makeMember({ uid: 'lead-1', teamRole: 'team_lead' });
        const data = {
            ...baseData,
            tasks: [makeTask({ assignedTo: 'lead-1' })],
            timeLogs: [makeTimeLog({ userId: 'lead-1' })],
            teamMembers: [lead],
        };
        const result = calculateIndividualScore('lead-1', 'team_lead', data);
        expect(result.dimensions).toHaveProperty('oversight');
        expect(result.dimensions).not.toHaveProperty('leadership');
    });

    // ── Leadership: engineer penalized when tech has no tasks ──
    it('engineer penalized in leadership when technician has no in_progress tasks', () => {
        const eng = makeMember({ uid: 'eng-1', teamRole: 'engineer' });
        const tech = makeMember({ uid: 'tech-1', teamRole: 'technician' });
        const data = {
            ...baseData,
            tasks: [makeTask({ assignedTo: 'eng-1' })], // only eng has tasks, tech has none
            timeLogs: [makeTimeLog({ userId: 'eng-1' })],
            teamMembers: [eng, tech],
            assignments: [{ engineerId: 'eng-1', technicianId: 'tech-1', active: true }],
        };
        const result = calculateIndividualScore('eng-1', 'engineer', data);
        expect(result.dimensions.leadership.score).toBeLessThan(100);
        expect(result.dimensions.leadership.raw.techsWithoutTasks).toBe(1);
    });

    // ── Leadership: no techs = 100 ──
    it('engineer with no assigned technicians gets 100 leadership', () => {
        const eng = makeMember({ uid: 'eng-1', teamRole: 'engineer' });
        const data = {
            ...baseData,
            tasks: [makeTask({ assignedTo: 'eng-1' })],
            timeLogs: [makeTimeLog({ userId: 'eng-1' })],
            teamMembers: [eng],
            assignments: [], // no assignments
        };
        const result = calculateIndividualScore('eng-1', 'engineer', data);
        expect(result.dimensions.leadership.score).toBe(100);
        expect(result.dimensions.leadership.raw.techniciansManaged).toBe(0);
    });

    // ── Leadership: tech blocked = penalized ──
    it('engineer penalized when technician has blocked tasks', () => {
        const eng = makeMember({ uid: 'eng-1' });
        const data = {
            ...baseData,
            tasks: [
                makeTask({ assignedTo: 'eng-1' }),
                makeTask({ id: 'tech-task', assignedTo: 'tech-1', status: 'blocked' }),
            ],
            timeLogs: [makeTimeLog({ userId: 'eng-1' })],
            teamMembers: [eng],
            assignments: [{ engineerId: 'eng-1', technicianId: 'tech-1', active: true }],
        };
        const result = calculateIndividualScore('eng-1', 'engineer', data);
        expect(result.dimensions.leadership.raw.techsBlockedUnresolved).toBe(1);
        expect(result.dimensions.leadership.score).toBeLessThan(100);
    });

    // ── Collaboration: blocked tasks penalize ──
    it('collaboration score drops with blocked tasks', () => {
        const data = {
            ...baseData,
            tasks: [
                makeTask({ id: 't1', status: 'blocked' }),
                makeTask({ id: 't2', status: 'in_progress' }),
            ],
            timeLogs: [makeTimeLog()],
            delays: [{ taskId: 't1', resolved: false }],
            teamMembers: [makeMember()],
        };
        const result = calculateIndividualScore('eng-1', 'engineer', data);
        expect(result.dimensions.collaboration.score).toBeLessThan(100);
        expect(result.dimensions.collaboration.raw.blockedTasks).toBe(1);
        expect(result.dimensions.collaboration.raw.unresolvedDelays).toBe(1);
    });

    // ── Precision: perfect estimation ──
    it('precision = 100 when actual matches estimated', () => {
        const data = {
            ...baseData,
            tasks: [
                makeTask({ status: 'completed', completedDate: oneDayAgo, estimatedHours: 8, actualHours: 8 }),
                makeTask({ id: 't2', status: 'in_progress' }),
            ],
            timeLogs: [makeTimeLog()],
            teamMembers: [makeMember()],
        };
        const result = calculateIndividualScore('eng-1', 'engineer', data);
        expect(result.dimensions.precision.score).toBe(100);
        expect(result.dimensions.precision.raw.estimationRatio).toBe(1);
    });

    // ── Discipline: stale tasks penalize ──
    it('discipline penalized when tasks not updated in 5+ days', () => {
        const data = {
            ...baseData,
            tasks: [makeTask({ updatedAt: tenDaysAgo })],
            timeLogs: [makeTimeLog()],
            teamMembers: [makeMember()],
        };
        const result = calculateIndividualScore('eng-1', 'engineer', data);
        expect(result.dimensions.discipline.score).toBeLessThan(100);
        expect(result.dimensions.discipline.raw.staleUpdates).toBeGreaterThan(0);
    });

    // ── Weights sum to 1.0 for each role ──
    it('default weights sum to 1.0 for each role', () => {
        for (const [role, weights] of Object.entries(DEFAULT_WEIGHTS)) {
            const sum = Object.values(weights).reduce((a, b) => a + b, 0);
            expect(sum).toBeCloseTo(1.0, 5);
        }
    });

    // ── Each dimension has weight property ──
    it('each dimension includes weight property', () => {
        const data = {
            ...baseData,
            tasks: [makeTask()],
            timeLogs: [makeTimeLog()],
            teamMembers: [makeMember()],
        };
        const result = calculateIndividualScore('eng-1', 'engineer', data);
        for (const dim of Object.values(result.dimensions)) {
            expect(dim).toHaveProperty('weight');
            expect(dim).toHaveProperty('score');
            expect(dim).toHaveProperty('raw');
            expect(typeof dim.weight).toBe('number');
            expect(typeof dim.score).toBe('number');
        }
    });
});

describe('calculateTeamScores', () => {
    it('returns sorted array with scores for each member', () => {
        const members = [
            makeMember({ uid: 'eng-1', teamRole: 'engineer' }),
            makeMember({ uid: 'tech-1', displayName: 'Tech One', teamRole: 'technician' }),
            makeMember({ uid: 'mgr-1', displayName: 'Manager One', teamRole: 'manager' }),
        ];
        const data = {
            ...baseData,
            tasks: [
                makeTask({ assignedTo: 'eng-1' }),
                makeTask({ id: 't2', assignedTo: 'tech-1' }),
            ],
            timeLogs: [
                makeTimeLog({ userId: 'eng-1' }),
                makeTimeLog({ userId: 'tech-1' }),
            ],
            teamMembers: members,
        };
        const scores = calculateTeamScores(members, data);

        expect(scores).toHaveLength(3);
        // Manager should be last
        expect(scores[scores.length - 1].isManager).toBe(true);
        // Each entry has required fields
        for (const s of scores) {
            expect(s).toHaveProperty('userId');
            expect(s).toHaveProperty('displayName');
            expect(s).toHaveProperty('teamRole');
        }
    });

    it('non-manager scores are numeric', () => {
        const members = [makeMember({ uid: 'eng-1', teamRole: 'engineer' })];
        const data = {
            ...baseData,
            tasks: [makeTask({ assignedTo: 'eng-1' })],
            timeLogs: [makeTimeLog({ userId: 'eng-1' })],
            teamMembers: members,
        };
        const scores = calculateTeamScores(members, data);
        expect(typeof scores[0].score).toBe('number');
        expect(scores[0].score).toBeGreaterThanOrEqual(0);
        expect(scores[0].score).toBeLessThanOrEqual(100);
    });
});
