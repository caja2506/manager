/**
 * Escalation Rules — V5 Phase 6G
 * =================================
 * Pure-function escalation engine. Determines who should be notified,
 * when, and how urgently based on risk severity, time, and roles.
 *
 * @module core/ai-monitoring/escalationRules
 */

export const ESCALATION_LEVEL = {
    NONE: 'none',
    NOTIFY_RESPONSIBLE: 'notify_responsible',  // L1
    NOTIFY_TEAM_LEAD: 'notify_team_lead',      // L2
    NOTIFY_MANAGER: 'notify_manager',          // L3
    ESCALATE_ADMIN: 'escalate_admin',          // L4 — extreme cases
};

export const ESCALATION_CHANNEL = {
    IN_APP: 'in_app',
    TELEGRAM: 'telegram',
    EMAIL: 'email',
};

/**
 * Determine escalation actions based on risk signals.
 *
 * @param {RiskSignal[]} risks - From detectRisks()
 * @param {Object} context
 * @param {number} context.daysWithoutResponse - Days since last human update
 * @param {string} context.milestoneTrafficLight - Current traffic light
 * @param {number} context.daysUntilDue - Days until deadline
 * @param {Object} [governanceConfig] - AI governance settings
 * @returns {EscalationAction[]}
 */
export function computeEscalations(risks, context, governanceConfig = {}) {
    const { daysWithoutResponse = 0, milestoneTrafficLight = 'green', daysUntilDue = 999 } = context;
    const { maxEscalationLevel = ESCALATION_LEVEL.NOTIFY_MANAGER, enabledChannels = ['in_app'] } = governanceConfig;

    const actions = [];
    const maxLevel = Object.values(ESCALATION_LEVEL).indexOf(maxEscalationLevel);

    // ── Level 1: Responsible notification ──
    const hasAnyRisk = risks.length > 0;
    if (hasAnyRisk) {
        actions.push({
            level: ESCALATION_LEVEL.NOTIFY_RESPONSIBLE,
            target: 'responsible',
            reason: `${risks.length} señal(es) de atención detectada(s)`,
            channels: filterChannels(['in_app'], enabledChannels),
            urgency: 'normal',
            cooldownHours: 24,
        });
    }

    // ── Level 2: Team Lead if no response in 2 days ──
    if (daysWithoutResponse >= 2 && hasAnyRisk) {
        const levelIdx = Object.values(ESCALATION_LEVEL).indexOf(ESCALATION_LEVEL.NOTIFY_TEAM_LEAD);
        if (levelIdx <= maxLevel) {
            actions.push({
                level: ESCALATION_LEVEL.NOTIFY_TEAM_LEAD,
                target: 'teamLead',
                reason: `Sin respuesta del responsable hace ${daysWithoutResponse} días`,
                channels: filterChannels(['in_app', 'telegram'], enabledChannels),
                urgency: 'elevated',
                cooldownHours: 12,
            });
        }
    }

    // ── Level 3: Manager if critical/high risks ──
    const hasCritical = risks.some(r => r.severity === 'critical');
    const hasHigh = risks.filter(r => r.severity === 'high').length >= 2;
    if (hasCritical || hasHigh || (milestoneTrafficLight === 'red' && daysUntilDue <= 7)) {
        const levelIdx = Object.values(ESCALATION_LEVEL).indexOf(ESCALATION_LEVEL.NOTIFY_MANAGER);
        if (levelIdx <= maxLevel) {
            actions.push({
                level: ESCALATION_LEVEL.NOTIFY_MANAGER,
                target: 'manager',
                reason: hasCritical
                    ? 'Riesgo crítico detectado — escalación automática'
                    : `Múltiples riesgos altos + ${milestoneTrafficLight === 'red' ? 'semáforo rojo' : 'deterioro'}`,
                channels: filterChannels(['in_app', 'telegram'], enabledChannels),
                urgency: 'high',
                cooldownHours: 6,
            });
        }
    }

    // ── Level 4: Admin if combo danger + no response 3d ──
    if (hasCritical && daysWithoutResponse >= 3) {
        const levelIdx = Object.values(ESCALATION_LEVEL).indexOf(ESCALATION_LEVEL.ESCALATE_ADMIN);
        if (levelIdx <= maxLevel) {
            actions.push({
                level: ESCALATION_LEVEL.ESCALATE_ADMIN,
                target: 'admin',
                reason: `Riesgo crítico sin respuesta hace ${daysWithoutResponse} días — escalación a administrador`,
                channels: filterChannels(['in_app', 'telegram'], enabledChannels),
                urgency: 'critical',
                cooldownHours: 4,
            });
        }
    }

    return actions;
}

function filterChannels(desired, enabled) {
    return desired.filter(c => enabled.includes(c));
}

/**
 * Check if an escalation is within its cooldown period.
 */
export function isWithinCooldown(lastEscalatedAt, cooldownHours, now = new Date()) {
    if (!lastEscalatedAt) return false;
    const lastMs = new Date(lastEscalatedAt).getTime();
    const cooldownMs = cooldownHours * 60 * 60 * 1000;
    return (now.getTime() - lastMs) < cooldownMs;
}
