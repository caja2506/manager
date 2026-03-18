/**
 * AI Monitoring Engine — V5 Phase 6A
 * =====================================
 * Orchestrates risk detection, follow-up generation, escalation,
 * and AI trace recording for a milestone.
 *
 * This is the main entry point for AI monitoring operations.
 *
 * @module core/ai-monitoring/aiMonitoringEngine
 */

import { detectRisks, summarizeRisks, RISK_SEVERITY } from './riskDetector.js';
import { computeEscalations, isWithinCooldown, ESCALATION_LEVEL } from './escalationRules.js';

// ── SCHEDULE CONFIG (D) ──
export const AI_SCHEDULE = {
    MORNING: { label: 'Mañana', cron: '0 7 * * 1-5', description: 'Evaluación matutina L-V' },
    AFTERNOON: { label: 'Tarde', cron: '0 14 * * 1-5', description: 'Revisión vespertina L-V' },
    EVENING: { label: 'Nocturno', cron: '0 20 * * 1-5', description: 'Consolidación nocturna (opcional)' },
    EVENT: { label: 'Por evento', cron: null, description: 'Trigger inmediato por evento crítico' },
};

// ── ACTION TYPES ──
export const AI_ACTION_TYPE = {
    RECALCULATE_SCORE: 'recalculate_score',
    CAPTURE_SNAPSHOT: 'capture_snapshot',
    CREATE_ALERT: 'create_alert',
    REQUEST_UPDATE: 'request_update',
    SEND_FOLLOWUP: 'send_followup',
    SEND_SUMMARY: 'send_summary',
    REGISTER_OBSERVATION: 'register_observation',
    ESCALATE: 'escalate',
};

/**
 * Run full AI monitoring cycle for a milestone.
 * This is the main orchestration function.
 *
 * @param {Object} params
 * @param {Object} params.milestoneResult - From computeFullScore
 * @param {Object} params.milestone - Milestone document
 * @param {Object[]} params.workAreas - Work area documents
 * @param {Object[]} params.snapshots - Recent snapshots
 * @param {Object} params.governanceConfig - AI governance settings
 * @param {string} params.triggerSource - 'scheduled:morning' | 'event:{type}' | 'manual'
 * @returns {AIMonitoringResult}
 */
export function runMonitoringCycle({
    milestoneResult, milestone, workAreas, snapshots,
    governanceConfig = {}, triggerSource = 'manual',
}) {
    const now = new Date();
    const correlationId = `ai_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    // 1. Detect risks
    const risks = detectRisks(milestoneResult, milestone, workAreas, snapshots, { now });
    const riskSummary = summarizeRisks(risks);

    // 2. Generate follow-ups
    const followUps = generateFollowUps(risks, milestone, milestoneResult, { now });

    // 3. Compute escalations
    const daysWithoutResponse = computeDaysSinceLastUpdate(workAreas, now);
    const escalations = computeEscalations(risks, {
        daysWithoutResponse,
        milestoneTrafficLight: milestoneResult?.milestone?.trafficLight?.value || 'green',
        daysUntilDue: milestone?.dueDate
            ? (new Date(milestone.dueDate) - now) / (1000 * 60 * 60 * 24)
            : 999,
    }, governanceConfig);

    // 4. Determine actions (what AI should execute)
    const actions = determineActions(risks, followUps, escalations, governanceConfig);

    // 5. Generate executive summary
    const executiveSummary = generateExecutiveSummary(milestoneResult, risks, milestone, { now });

    return {
        correlationId,
        timestamp: now.toISOString(),
        triggerSource,
        milestoneId: milestone?.id,
        projectId: milestone?.projectId,

        // Risk assessment
        risks,
        riskSummary,

        // Actions
        followUps,
        escalations,
        actions,

        // Summary
        executiveSummary,

        // Traceability
        traceRecord: {
            correlationId,
            triggerSource,
            timestamp: now.toISOString(),
            entityType: 'milestone',
            entityId: milestone?.id,
            signalsDetected: risks.length,
            actionsProposed: actions.length,
            riskLevel: riskSummary.level,
            milestoneScore: milestoneResult?.milestone?.score,
            milestoneTrafficLight: milestoneResult?.milestone?.trafficLight?.value,
        },
    };
}

// ── FOLLOW-UP GENERATION (F) ──

function generateFollowUps(risks, milestone, milestoneResult, { now }) {
    const followUps = [];

    for (const risk of risks) {
        switch (risk.signal) {
            case 'stale_responsible':
                followUps.push({
                    type: 'request_update',
                    target: risk.context.responsible,
                    message: `📋 Se requiere actualización en área "${risk.context.areaId}". Última actividad hace >5 días. Por favor actualice el estado de sus tareas.`,
                    entityType: risk.entityType,
                    entityId: risk.entityId,
                    priority: 'normal',
                });
                break;

            case 'blocker_critical':
                followUps.push({
                    type: 'alert_blocker',
                    target: 'teamLead',
                    message: `🚨 Bloqueo crítico en "${risk.context.areaId}" — score ${risk.context.score}/100. ${risk.context.locks.length} candado(s) activo(s). Requiere intervención.`,
                    entityType: risk.entityType,
                    entityId: risk.entityId,
                    priority: 'high',
                });
                break;

            case 'deadline_approaching':
                followUps.push({
                    type: 'deadline_warning',
                    target: 'manager',
                    message: `⏰ "${milestone?.name}" a ${risk.context.daysUntilDue} días de fecha límite con score ${risk.context.score}/100. Evaluación de riesgo recomendada.`,
                    entityType: risk.entityType,
                    entityId: risk.entityId,
                    priority: 'high',
                });
                break;

            case 'combo_danger':
                followUps.push({
                    type: 'escalation_alert',
                    target: 'manager',
                    message: `⚠️ COMBO CRÍTICO en "${milestone?.name}": Rojo + bajando + ${risk.context.daysUntilDue}d restantes. Score ${risk.context.score}. Requiere acción inmediata.`,
                    entityType: risk.entityType,
                    entityId: risk.entityId,
                    priority: 'critical',
                });
                break;

            case 'area_deteriorating':
                followUps.push({
                    type: 'observation',
                    target: 'responsible',
                    message: `📉 Área "${risk.context.areaId}" cayó ${risk.context.from - risk.context.to} puntos (de ${risk.context.from} a ${risk.context.to}). Revisar causas.`,
                    entityType: risk.entityType,
                    entityId: risk.entityId,
                    priority: 'normal',
                });
                break;

            default:
                break;
        }
    }

    return followUps;
}

// ── ACTION DETERMINATION ──

function determineActions(risks, followUps, escalations, governanceConfig) {
    const actions = [];
    const { enabledActions = Object.values(AI_ACTION_TYPE) } = governanceConfig;

    // Always: snapshot + recalculate (safe, reversible)
    if (enabledActions.includes(AI_ACTION_TYPE.RECALCULATE_SCORE)) {
        actions.push({ type: AI_ACTION_TYPE.RECALCULATE_SCORE, auto: true });
    }
    if (enabledActions.includes(AI_ACTION_TYPE.CAPTURE_SNAPSHOT)) {
        actions.push({ type: AI_ACTION_TYPE.CAPTURE_SNAPSHOT, auto: true });
    }

    // Conditionally: alerts, follow-ups, observations
    if (risks.length > 0 && enabledActions.includes(AI_ACTION_TYPE.CREATE_ALERT)) {
        actions.push({ type: AI_ACTION_TYPE.CREATE_ALERT, auto: true, count: risks.length });
    }
    if (followUps.length > 0 && enabledActions.includes(AI_ACTION_TYPE.SEND_FOLLOWUP)) {
        actions.push({ type: AI_ACTION_TYPE.SEND_FOLLOWUP, auto: true, count: followUps.length });
    }
    if (escalations.length > 0 && enabledActions.includes(AI_ACTION_TYPE.ESCALATE)) {
        actions.push({ type: AI_ACTION_TYPE.ESCALATE, auto: false, count: escalations.length }); // escalation requires approval
    }

    return actions;
}

// ── EXECUTIVE SUMMARY (I) ──

function generateExecutiveSummary(milestoneResult, risks, milestone, { now }) {
    const ms = milestoneResult?.milestone;
    if (!ms) return { text: 'Sin datos suficientes para generar resumen.' };

    const dueDate = milestone?.dueDate ? new Date(milestone.dueDate) : null;
    const daysLeft = dueDate ? Math.round((dueDate - now) / (1000 * 60 * 60 * 24)) : null;

    const lines = [];

    // Header
    lines.push(`📊 **${milestone?.name || 'Milestone'}** — Score ${ms.score}/100`);

    // Traffic light
    const tlLabel = { green: '🟢 Verde', yellow: '🟡 Amarillo', red: '🔴 Rojo' };
    lines.push(`Semáforo: ${tlLabel[ms.trafficLight?.value] || ms.trafficLight?.value}`);

    // Trend
    const trendLabel = { improving: '↑ Subiendo', stable: '→ Estable', declining: '↓ Bajando' };
    lines.push(`Tendencia: ${trendLabel[ms.trend] || ms.trend}`);

    // Days left
    if (daysLeft !== null) {
        lines.push(`Días restantes: ${daysLeft}`);
    }

    // Risks
    if (risks.length > 0) {
        lines.push('');
        lines.push(`📌 **${risks.length} señal(es) de atención:**`);
        risks.slice(0, 5).forEach(r => {
            const icon = r.severity === 'critical' ? '🔴' : r.severity === 'high' ? '🟠' : '🔸';
            lines.push(`${icon} ${r.message}`);
        });
    } else {
        lines.push('');
        lines.push('✅ Sin riesgos detectados.');
    }

    // Areas summary
    const areas = milestoneResult.areas || {};
    const areaEntries = Object.entries(areas);
    if (areaEntries.length > 0) {
        lines.push('');
        lines.push(`📋 **Áreas (${areaEntries.length}):**`);
        areaEntries.sort((a, b) => a[1].score - b[1].score);
        areaEntries.forEach(([, result]) => {
            const dot = result.trafficLight?.value === 'green' ? '🟢'
                : result.trafficLight?.value === 'yellow' ? '🟡' : '🔴';
            lines.push(`${dot} ${result.areaName || 'Área'}: ${result.score}/100`);
        });
    }

    return {
        text: lines.join('\n'),
        timestamp: now.toISOString(),
        type: 'executive_summary',
    };
}

// ── HELPERS ──

function computeDaysSinceLastUpdate(workAreas, now) {
    if (!workAreas || workAreas.length === 0) return 0;

    let mostRecent = null;
    for (const area of workAreas) {
        if (area.updatedAt) {
            const d = new Date(area.updatedAt);
            if (!mostRecent || d > mostRecent) mostRecent = d;
        }
    }
    if (!mostRecent) return 30; // Assume stale if no data

    return Math.floor((now - mostRecent) / (1000 * 60 * 60 * 24));
}
