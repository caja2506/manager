/**
 * Intervention Suggester — Backend (CJS)
 * =========================================
 * Converts deterioration signals into concrete intervention
 * suggestions with urgency levels and action steps.
 */

const { INTERVENTION_URGENCY, KPI_NAME, KPI_POLARITY } = require("../analytics/analyticsConstants");

/**
 * Generate intervention suggestions from KPIs and trends.
 *
 * @param {Object} params
 * @param {Object} params.globalKpis
 * @param {Object} params.byUser
 * @param {Object} params.trends
 * @param {Array}  params.riskFlags
 * @returns {Array<Object>} Interventions, sorted by urgency
 */
function generateInterventions({ globalKpis, byUser, trends, riskFlags }) {
    const interventions = [];

    // ── 1. Critical risk flags → Act Now ──
    const criticalFlags = (riskFlags || []).filter(f => f.severity === "critical");
    for (const flag of criticalFlags.slice(0, 3)) {
        interventions.push({
            urgency: INTERVENTION_URGENCY.ACT_NOW,
            target: { type: "kpi", id: flag.kpiName },
            action: flag.suggestedAction || `Investigar KPI crítico: ${flag.kpiName}`,
            reason: flag.justification,
            deadline: "Hoy",
            kpiName: flag.kpiName,
            currentValue: flag.currentValue,
        });
    }

    // ── 2. Rapid deterioration → Act Soon ──
    if (trends) {
        for (const [kpiName, trend] of Object.entries(trends)) {
            if (trend.hasHistory && trend.isImproving === false && Math.abs(trend.deltaPercent || 0) > 15) {
                interventions.push({
                    urgency: INTERVENTION_URGENCY.ACT_SOON,
                    target: { type: "kpi", id: kpiName },
                    action: `Revisar causa de deterioro rápido en ${formatKpi(kpiName)}`,
                    reason: `${formatKpi(kpiName)} cayó ${Math.abs(trend.deltaPercent)}% respecto al período anterior.`,
                    deadline: "Esta semana",
                    kpiName,
                    delta: trend.deltaPercent,
                });
            }
        }
    }

    // ── 3. Users in distress → Act Soon ──
    if (byUser) {
        for (const [userId, userData] of Object.entries(byUser)) {
            const responseRate = getVal(userData.kpis, KPI_NAME.RESPONSE_RATE);
            if (responseRate !== null && responseRate < 0.3) {
                interventions.push({
                    urgency: INTERVENTION_URGENCY.ACT_SOON,
                    target: { type: "user", id: userId, name: userData.userName },
                    action: `Contactar a ${userData.userName || "usuario"} — posible desconexión operativa`,
                    reason: `Tasa de respuesta del ${(responseRate * 100).toFixed(0)}% — muy por debajo del mínimo aceptable.`,
                    deadline: "Hoy o mañana",
                    kpiName: KPI_NAME.RESPONSE_RATE,
                    currentValue: responseRate,
                });
            }
        }
    }

    // ── 4. System-level deterioration → Watch ──
    const globalResponse = getVal(globalKpis, KPI_NAME.RESPONSE_RATE);
    const globalEscalation = getVal(globalKpis, KPI_NAME.ESCALATION_RATE);

    if (globalResponse !== null && globalResponse < 0.6 && globalResponse > 0.4) {
        interventions.push({
            urgency: INTERVENTION_URGENCY.WATCH,
            target: { type: "system", id: "global" },
            action: "Monitorear tasa de respuesta — en zona de alerta",
            reason: `Respuesta global al ${(globalResponse * 100).toFixed(0)}%, cerca del umbral crítico.`,
            deadline: "Próximos 3 días",
            kpiName: KPI_NAME.RESPONSE_RATE,
            currentValue: globalResponse,
        });
    }

    if (globalEscalation !== null && globalEscalation > 0.2 && globalEscalation < 0.4) {
        interventions.push({
            urgency: INTERVENTION_URGENCY.WATCH,
            target: { type: "system", id: "global" },
            action: "Revisar configuración de escalaciones — tasa elevándose",
            reason: `Escalaciones al ${(globalEscalation * 100).toFixed(0)}%, tendencia ascendente.`,
            deadline: "Esta semana",
            kpiName: KPI_NAME.ESCALATION_RATE,
            currentValue: globalEscalation,
        });
    }

    // Sort by urgency
    const urgencyOrder = {
        [INTERVENTION_URGENCY.ACT_NOW]: 0,
        [INTERVENTION_URGENCY.ACT_SOON]: 1,
        [INTERVENTION_URGENCY.WATCH]: 2,
    };

    interventions.sort((a, b) => (urgencyOrder[a.urgency] ?? 9) - (urgencyOrder[b.urgency] ?? 9));

    return interventions.map((i, idx) => ({
        ...i,
        id: `int_${Date.now()}_${idx}`,
        generatedAt: new Date().toISOString(),
    }));
}

// ── Helpers ──
function getVal(kpis, name) {
    if (!kpis) return null;
    const kpi = kpis[name];
    if (kpi === undefined || kpi === null) return null;
    return typeof kpi === "object" ? (kpi.value ?? null) : kpi;
}

function formatKpi(name) {
    const labels = {
        responseRate: "Tasa de Respuesta",
        onTimeResponseRate: "Puntualidad",
        escalationRate: "Escalaciones",
        routineSuccessRate: "Éxito de Rutinas",
        deliveryFailureRate: "Fallas de Envío",
    };
    return labels[name] || name;
}

module.exports = { generateInterventions };
