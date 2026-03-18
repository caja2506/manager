/**
 * Risk Detector — V5 Phase 6E
 * ==============================
 * Pure-function module that analyzes milestone/area data and
 * detects real operational risks beyond simple threshold checks.
 *
 * ALL functions are PURE — no Firestore reads/writes.
 *
 * @module core/ai-monitoring/riskDetector
 */

// ── RISK SEVERITY LEVELS ──
export const RISK_SEVERITY = {
    CRITICAL: 'critical',   // Immediate escalation needed
    HIGH: 'high',           // Manager attention required
    MEDIUM: 'medium',       // Team lead review recommended
    LOW: 'low',             // Monitor, informational
};

// ── RISK SIGNAL TYPES ──
export const RISK_SIGNAL = {
    SCORE_DECLINING:        'score_declining',
    BLOCKER_CRITICAL:       'blocker_critical',
    STALE_RESPONSIBLE:      'stale_responsible',
    DEADLINE_APPROACHING:   'deadline_approaching',
    AREA_DETERIORATING:     'area_deteriorating',
    HIDDEN_DETERIORATION:   'hidden_deterioration',
    TEAM_OVERLOAD:          'team_overload',
    COMBO_DANGER:           'combo_danger',
};

/**
 * Analyze a milestone and its areas for operational risks.
 *
 * @param {Object} milestoneResult - From computeFullScore
 * @param {Object} milestone - Milestone document data
 * @param {Object[]} workAreas - Work area documents
 * @param {Object[]} snapshots - Recent score snapshots
 * @param {Object} options
 * @returns {RiskSignal[]}
 */
export function detectRisks(milestoneResult, milestone, workAreas, snapshots, options = {}) {
    const { now = new Date() } = options;
    const risks = [];

    if (!milestoneResult?.milestone) return risks;

    const ms = milestoneResult.milestone;
    const areas = milestoneResult.areas || {};
    const dueDate = milestone?.dueDate ? new Date(milestone.dueDate) : null;
    const daysUntilDue = dueDate ? (dueDate - now) / (1000 * 60 * 60 * 24) : null;

    // ── R1: Score declining continuously ──
    if (snapshots.length >= 3) {
        const recent3 = snapshots.slice(-3);
        const allDeclining = recent3.every((s, i) =>
            i === 0 || s.milestoneScore < recent3[i - 1].milestoneScore
        );
        if (allDeclining) {
            const drop = recent3[0].milestoneScore - recent3[recent3.length - 1].milestoneScore;
            risks.push({
                signal: RISK_SIGNAL.SCORE_DECLINING,
                severity: drop > 15 ? RISK_SEVERITY.HIGH : RISK_SEVERITY.MEDIUM,
                message: `Score cayendo 3 snapshots consecutivos (−${drop} pts total)`,
                context: { drop, snapshots: recent3.length },
                entityType: 'milestone',
                entityId: milestone?.id,
            });
        }
    }

    // ── R2: Critical blockers on RED areas ──
    Object.entries(areas).forEach(([areaId, result]) => {
        if (result.trafficLight?.value === 'red' && result.locks?.length > 0) {
            risks.push({
                signal: RISK_SIGNAL.BLOCKER_CRITICAL,
                severity: RISK_SEVERITY.CRITICAL,
                message: `Área "${result.areaName || areaId}" en ROJO con ${result.locks.length} candado(s)`,
                context: { areaId, locks: result.locks, score: result.score },
                entityType: 'workArea',
                entityId: areaId,
            });
        }
    });

    // ── R3: Responsible without update (stale responsible) ──
    Object.entries(areas).forEach(([areaId, result]) => {
        const area = workAreas.find(a => a.id === areaId);
        if (result.trafficLight?.value !== 'green' && area?.responsibleId) {
            const staleFactor = result.factors?.find(f => f.key === 'RECENT_ACTIVITY');
            if (staleFactor && staleFactor.ratio < 0.3) {
                risks.push({
                    signal: RISK_SIGNAL.STALE_RESPONSIBLE,
                    severity: RISK_SEVERITY.MEDIUM,
                    message: `${area.responsibleId} sin actualización significativa en área "${result.areaName || areaId}"`,
                    context: { areaId, responsible: area.responsibleId, activityRatio: staleFactor.ratio },
                    entityType: 'user',
                    entityId: area.responsibleId,
                });
            }
        }
    });

    // ── R4: Deadline approaching with low score ──
    if (daysUntilDue !== null && daysUntilDue > 0 && daysUntilDue <= 7 && ms.score < 70) {
        risks.push({
            signal: RISK_SIGNAL.DEADLINE_APPROACHING,
            severity: ms.score < 40 ? RISK_SEVERITY.CRITICAL : RISK_SEVERITY.HIGH,
            message: `${Math.round(daysUntilDue)} días para fecha límite, score ${ms.score}/100`,
            context: { daysUntilDue: Math.round(daysUntilDue), score: ms.score },
            entityType: 'milestone',
            entityId: milestone?.id,
        });
    }

    // ── R5: Area deteriorating (score dropped >10 pts from last snapshot) ──
    if (snapshots.length >= 2) {
        const latest = snapshots[snapshots.length - 1];
        const prev = snapshots[snapshots.length - 2];
        (latest?.areaScores || []).forEach(areaScore => {
            const prevArea = (prev?.areaScores || []).find(a => a.areaId === areaScore.areaId);
            if (prevArea && areaScore.score < prevArea.score - 10) {
                risks.push({
                    signal: RISK_SIGNAL.AREA_DETERIORATING,
                    severity: RISK_SEVERITY.HIGH,
                    message: `"${areaScore.name || areaScore.areaId}" cayó ${prevArea.score - areaScore.score} pts`,
                    context: { areaId: areaScore.areaId, from: prevArea.score, to: areaScore.score },
                    entityType: 'workArea',
                    entityId: areaScore.areaId,
                });
            }
        });
    }

    // ── R6: Hidden deterioration (score acceptable but trend declining + penalties) ──
    if (ms.score >= 60 && ms.score < 80) {
        const hasPenalties = Object.values(areas).some(a => a.penalties?.length > 0);
        const hasDecliningTrend = ms.trend === 'declining';
        if (hasPenalties && hasDecliningTrend) {
            risks.push({
                signal: RISK_SIGNAL.HIDDEN_DETERIORATION,
                severity: RISK_SEVERITY.MEDIUM,
                message: `Score ${ms.score} aparentemente estable pero con penalizaciones activas y tendencia bajando`,
                context: { score: ms.score, trend: ms.trend },
                entityType: 'milestone',
                entityId: milestone?.id,
            });
        }
    }

    // ── R7: Combo danger (RED + declining + deadline) ──
    if (ms.trafficLight?.value === 'red' && ms.trend === 'declining' && daysUntilDue !== null && daysUntilDue <= 14) {
        risks.push({
            signal: RISK_SIGNAL.COMBO_DANGER,
            severity: RISK_SEVERITY.CRITICAL,
            message: `COMBO CRÍTICO: Rojo + bajando + ${Math.round(daysUntilDue)} días restantes`,
            context: { score: ms.score, trend: ms.trend, daysUntilDue: Math.round(daysUntilDue) },
            entityType: 'milestone',
            entityId: milestone?.id,
        });
    }

    // Sort by severity
    const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    risks.sort((a, b) => (severityOrder[a.severity] || 3) - (severityOrder[b.severity] || 3));

    return risks;
}

/**
 * Summarize risks into a human-readable assessment.
 */
export function summarizeRisks(risks) {
    if (risks.length === 0) return { level: 'ok', summary: 'Sin riesgos detectados. Todos los indicadores en orden.' };

    const critical = risks.filter(r => r.severity === RISK_SEVERITY.CRITICAL);
    const high = risks.filter(r => r.severity === RISK_SEVERITY.HIGH);

    if (critical.length > 0) {
        return {
            level: 'critical',
            summary: `⚠️ ${critical.length} riesgo(s) crítico(s) detectado(s). Atención inmediata requerida.`,
            topRisks: critical.slice(0, 3).map(r => r.message),
        };
    }

    if (high.length > 0) {
        return {
            level: 'high',
            summary: `🔶 ${high.length} riesgo(s) alto(s) detectado(s). Revisión de manager requerida.`,
            topRisks: high.slice(0, 3).map(r => r.message),
        };
    }

    return {
        level: 'medium',
        summary: `🔸 ${risks.length} señal(es) de atención. Monitoreo recomendado.`,
        topRisks: risks.slice(0, 3).map(r => r.message),
    };
}
