/**
 * AI Monitoring Tests — V5 Phase 6
 * ===================================
 * Tests for riskDetector, escalationRules, and aiMonitoringEngine.
 */

import { describe, it, expect } from 'vitest';
import { detectRisks, summarizeRisks, RISK_SEVERITY, RISK_SIGNAL } from '../../src/core/ai-monitoring/riskDetector.js';
import { computeEscalations, isWithinCooldown, ESCALATION_LEVEL } from '../../src/core/ai-monitoring/escalationRules.js';
import { runMonitoringCycle, AI_SCHEDULE, AI_ACTION_TYPE } from '../../src/core/ai-monitoring/aiMonitoringEngine.js';

// ── Test helpers ──
function makeMilestoneResult(overrides = {}) {
    return {
        milestone: {
            score: 75,
            trafficLight: { value: 'green', source: 'score' },
            trend: 'stable',
            locks: [],
            ...overrides,
        },
        areas: {},
    };
}

function makeMilestone(overrides = {}) {
    return {
        id: 'ms-test',
        name: 'Test Setup',
        projectId: 'proj-1',
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        ...overrides,
    };
}

// ============================
// RISK DETECTOR
// ============================

describe('Risk Detector', () => {
    it('returns empty risks for healthy milestone', () => {
        const result = makeMilestoneResult();
        const milestone = makeMilestone();
        const risks = detectRisks(result, milestone, [], []);
        expect(risks).toEqual([]);
    });

    it('detects consecutive score decline (R1)', () => {
        const result = makeMilestoneResult({ score: 60 });
        const milestone = makeMilestone();
        const snapshots = [
            { milestoneScore: 80, capturedAt: new Date().toISOString() },
            { milestoneScore: 70, capturedAt: new Date().toISOString() },
            { milestoneScore: 60, capturedAt: new Date().toISOString() },
        ];
        const risks = detectRisks(result, milestone, [], snapshots);
        const declining = risks.find(r => r.signal === RISK_SIGNAL.SCORE_DECLINING);
        expect(declining).toBeTruthy();
        expect(declining.context.drop).toBe(20);
    });

    it('detects critical blocker on RED area (R2)', () => {
        const result = makeMilestoneResult();
        result.areas = {
            'area-ctl': {
                score: 30,
                trafficLight: { value: 'red' },
                locks: ['critical_overdue'],
                areaName: 'Controles',
            },
        };
        const risks = detectRisks(result, makeMilestone(), [], []);
        const blocker = risks.find(r => r.signal === RISK_SIGNAL.BLOCKER_CRITICAL);
        expect(blocker).toBeTruthy();
        expect(blocker.severity).toBe(RISK_SEVERITY.CRITICAL);
    });

    it('detects deadline approaching with low score (R4)', () => {
        const result = makeMilestoneResult({ score: 45 });
        const milestone = makeMilestone({
            dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
        });
        const risks = detectRisks(result, milestone, [], []);
        const deadline = risks.find(r => r.signal === RISK_SIGNAL.DEADLINE_APPROACHING);
        expect(deadline).toBeTruthy();
        expect(deadline.severity).toBe(RISK_SEVERITY.HIGH); // 45 is >=40, so high not critical
    });

    it('detects area deterioration (R5)', () => {
        const result = makeMilestoneResult();
        const snapshots = [
            { milestoneScore: 75, areaScores: [{ areaId: 'a1', score: 80, name: 'Eng' }], capturedAt: new Date().toISOString() },
            { milestoneScore: 70, areaScores: [{ areaId: 'a1', score: 60, name: 'Eng' }], capturedAt: new Date().toISOString() },
        ];
        const risks = detectRisks(result, makeMilestone(), [], snapshots);
        const det = risks.find(r => r.signal === RISK_SIGNAL.AREA_DETERIORATING);
        expect(det).toBeTruthy();
        expect(det.context.from).toBe(80);
        expect(det.context.to).toBe(60);
    });

    it('detects combo danger (R7)', () => {
        const result = makeMilestoneResult({
            score: 25,
            trafficLight: { value: 'red' },
            trend: 'declining',
        });
        const milestone = makeMilestone({
            dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
        });
        const risks = detectRisks(result, milestone, [], []);
        const combo = risks.find(r => r.signal === RISK_SIGNAL.COMBO_DANGER);
        expect(combo).toBeTruthy();
        expect(combo.severity).toBe(RISK_SEVERITY.CRITICAL);
    });

    it('sorts risks by severity', () => {
        const result = makeMilestoneResult({
            score: 25,
            trafficLight: { value: 'red' },
            trend: 'declining',
        });
        result.areas = {
            'a-red': { score: 20, trafficLight: { value: 'red' }, locks: ['critical_overdue'], areaName: 'X' },
        };
        const milestone = makeMilestone({
            dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
        });
        const risks = detectRisks(result, milestone, [], []);
        expect(risks.length).toBeGreaterThan(0);
        // First risks should be critical
        expect(risks[0].severity).toBe(RISK_SEVERITY.CRITICAL);
    });
});

describe('summarizeRisks', () => {
    it('returns "ok" for empty risks', () => {
        expect(summarizeRisks([]).level).toBe('ok');
    });

    it('returns "critical" for critical risks', () => {
        const risks = [{ severity: RISK_SEVERITY.CRITICAL, message: 'test' }];
        expect(summarizeRisks(risks).level).toBe('critical');
    });
});

// ============================
// ESCALATION RULES
// ============================

describe('Escalation Rules', () => {
    it('returns no escalations when no risks', () => {
        const esc = computeEscalations([], { daysWithoutResponse: 0 });
        expect(esc).toEqual([]);
    });

    it('adds responsible notification for any risk', () => {
        const risks = [{ severity: 'medium', message: 'test' }];
        const esc = computeEscalations(risks, { daysWithoutResponse: 0 }, { enabledChannels: ['in_app'] });
        expect(esc.some(e => e.level === ESCALATION_LEVEL.NOTIFY_RESPONSIBLE)).toBe(true);
    });

    it('escalates to team lead after 2 days without response', () => {
        const risks = [{ severity: 'medium', message: 'test' }];
        const esc = computeEscalations(risks, { daysWithoutResponse: 3 }, { enabledChannels: ['in_app', 'telegram'] });
        expect(esc.some(e => e.level === ESCALATION_LEVEL.NOTIFY_TEAM_LEAD)).toBe(true);
    });

    it('escalates to manager for critical risks', () => {
        const risks = [{ severity: 'critical', message: 'combo' }];
        const esc = computeEscalations(risks, { daysWithoutResponse: 0 }, { enabledChannels: ['in_app', 'telegram'] });
        expect(esc.some(e => e.level === ESCALATION_LEVEL.NOTIFY_MANAGER)).toBe(true);
    });

    it('escalates to admin for critical + 3 days no response', () => {
        const risks = [{ severity: 'critical', message: 'combo' }];
        const esc = computeEscalations(risks, { daysWithoutResponse: 4 }, {
            maxEscalationLevel: ESCALATION_LEVEL.ESCALATE_ADMIN,
            enabledChannels: ['in_app'],
        });
        expect(esc.some(e => e.level === ESCALATION_LEVEL.ESCALATE_ADMIN)).toBe(true);
    });

    it('respects maxEscalationLevel', () => {
        const risks = [{ severity: 'critical', message: 'combo' }];
        const esc = computeEscalations(risks, { daysWithoutResponse: 5 }, {
            maxEscalationLevel: ESCALATION_LEVEL.NOTIFY_TEAM_LEAD,
            enabledChannels: ['in_app'],
        });
        expect(esc.every(e => e.level !== ESCALATION_LEVEL.ESCALATE_ADMIN)).toBe(true);
    });

    it('cooldown check works', () => {
        const recentDate = new Date(Date.now() - 30 * 60 * 1000).toISOString(); // 30min ago
        expect(isWithinCooldown(recentDate, 1)).toBe(true);
        expect(isWithinCooldown(recentDate, 0.25)).toBe(false);
    });
});

// ============================
// AI MONITORING ENGINE
// ============================

describe('AI Monitoring Engine', () => {
    it('runs a complete monitoring cycle', () => {
        const result = runMonitoringCycle({
            milestoneResult: makeMilestoneResult({ score: 35, trafficLight: { value: 'red' }, trend: 'declining' }),
            milestone: makeMilestone({ dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString() }),
            workAreas: [],
            snapshots: [],
        });

        expect(result.correlationId).toBeTruthy();
        expect(result.timestamp).toBeTruthy();
        expect(result.riskSummary).toBeTruthy();
        expect(result.traceRecord).toBeTruthy();
        expect(result.traceRecord.entityType).toBe('milestone');
        expect(result.executiveSummary.text).toContain('Score 35/100');
    });

    it('generates follow-ups for stale responsible', () => {
        const msResult = makeMilestoneResult();
        msResult.areas = {
            'area-1': {
                score: 50,
                trafficLight: { value: 'yellow' },
                locks: [],
                areaName: 'Ingeniería',
                factors: [{ key: 'RECENT_ACTIVITY', ratio: 0.1 }],
            },
        };
        const result = runMonitoringCycle({
            milestoneResult: msResult,
            milestone: makeMilestone(),
            workAreas: [{ id: 'area-1', name: 'Ingeniería', responsibleId: 'user-abc' }],
            snapshots: [],
        });

        const staleFollowUp = result.followUps.find(f => f.type === 'request_update');
        expect(staleFollowUp).toBeTruthy();
        expect(staleFollowUp.target).toBe('user-abc');
    });

    it('includes executive summary', () => {
        const result = runMonitoringCycle({
            milestoneResult: makeMilestoneResult(),
            milestone: makeMilestone(),
            workAreas: [],
            snapshots: [],
        });
        expect(result.executiveSummary.text).toContain('Score 75/100');
        expect(result.executiveSummary.text).toContain('Sin riesgos detectados');
    });

    it('schedule config exists', () => {
        expect(AI_SCHEDULE.MORNING.cron).toBeTruthy();
        expect(AI_SCHEDULE.AFTERNOON.cron).toBeTruthy();
        expect(AI_SCHEDULE.EVENT.cron).toBeNull();
    });

    it('action types are defined', () => {
        expect(Object.keys(AI_ACTION_TYPE).length).toBeGreaterThanOrEqual(7);
    });
});
