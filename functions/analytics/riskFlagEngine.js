/**
 * Risk Flag Engine — Backend (CJS)
 * ===================================
 * Evaluates KPI values against thresholds to generate
 * risk flags with severity, justification, and suggested action.
 */

const {
    DEFAULT_RISK_THRESHOLDS,
    RISK_SEVERITY,
    KPI_POLARITY,
    KPI_NAME,
} = require("./analyticsConstants");
const paths = require("../automation/firestorePaths");

/**
 * Evaluate global KPIs and generate risk flags.
 *
 * @param {Object} globalKpis - { kpiName: { value, ... } }
 * @param {Object} trends - Output of computeTrends()
 * @param {Object} [thresholds] - Custom thresholds (falls back to defaults)
 * @returns {Array<Object>} Risk flags
 */
function evaluateRiskFlags(globalKpis, trends, thresholds = DEFAULT_RISK_THRESHOLDS) {
    const flags = [];

    for (const [kpiName, threshold] of Object.entries(thresholds)) {
        const kpi = globalKpis[kpiName];
        if (!kpi) continue;

        const value = typeof kpi === "object" ? kpi.value : kpi;
        const polarity = KPI_POLARITY[kpiName] || "neutral";

        // For "higher is better" KPIs: flag when value drops below threshold
        // For "lower is better" KPIs: flag when value exceeds threshold
        let severity = null;
        if (polarity === "higher") {
            if (value < threshold.critical) severity = RISK_SEVERITY.CRITICAL;
            else if (value < threshold.warning) severity = RISK_SEVERITY.MEDIUM;
        } else if (polarity === "lower") {
            if (value > threshold.critical) severity = RISK_SEVERITY.CRITICAL;
            else if (value > threshold.warning) severity = RISK_SEVERITY.MEDIUM;
        }

        if (severity) {
            const trend = trends?.[kpiName];
            const isDeteriorating = trend?.isImproving === false;

            flags.push({
                kpiName,
                value,
                threshold: severity === RISK_SEVERITY.CRITICAL ? threshold.critical : threshold.warning,
                severity: isDeteriorating ? escalateSeverity(severity) : severity,
                isDeteriorating,
                justification: buildJustification(kpiName, value, severity, trend),
                suggestedAction: buildSuggestedAction(kpiName, severity),
                createdAt: new Date().toISOString(),
            });
        }
    }

    // Additional pattern-based flags
    flags.push(...evaluatePatternFlags(globalKpis, trends));

    return flags;
}

/**
 * Evaluate user-level KPIs for risk flags.
 */
function evaluateUserRiskFlags(userKpis, thresholds = DEFAULT_RISK_THRESHOLDS) {
    const flags = [];

    for (const [userId, userData] of Object.entries(userKpis)) {
        for (const [kpiName, threshold] of Object.entries(thresholds)) {
            const kpi = userData.kpis?.[kpiName];
            if (!kpi) continue;

            const value = typeof kpi === "object" ? kpi.value : kpi;
            const polarity = KPI_POLARITY[kpiName] || "neutral";

            let severity = null;
            if (polarity === "higher" && value < threshold.warning) severity = RISK_SEVERITY.MEDIUM;
            else if (polarity === "lower" && value > threshold.warning) severity = RISK_SEVERITY.MEDIUM;

            if (polarity === "higher" && value < threshold.critical) severity = RISK_SEVERITY.HIGH;
            else if (polarity === "lower" && value > threshold.critical) severity = RISK_SEVERITY.HIGH;

            if (severity) {
                flags.push({
                    entityType: "user",
                    entityId: userId,
                    entityName: userData.userName,
                    kpiName,
                    value,
                    severity,
                    justification: `${userData.userName}: ${kpiName} = ${(value * 100).toFixed(1)}%`,
                    createdAt: new Date().toISOString(),
                });
            }
        }
    }

    return flags;
}

/**
 * Check for pattern-based risks not covered by simple thresholds.
 */
function evaluatePatternFlags(globalKpis, trends) {
    const flags = [];

    // Sustained deterioration (3+ KPIs worsening)
    if (trends) {
        const deterioratingCount = Object.values(trends)
            .filter(t => t.hasHistory && t.isImproving === false).length;

        if (deterioratingCount >= 3) {
            flags.push({
                kpiName: "multi_kpi_deterioration",
                severity: RISK_SEVERITY.HIGH,
                value: deterioratingCount,
                justification: `${deterioratingCount} KPIs empeorando simultáneamente respecto al período anterior.`,
                suggestedAction: "Revisar operación general con el equipo. Posible problema sistémico.",
                createdAt: new Date().toISOString(),
            });
        }
    }

    return flags;
}

function escalateSeverity(severity) {
    if (severity === RISK_SEVERITY.MEDIUM) return RISK_SEVERITY.HIGH;
    if (severity === RISK_SEVERITY.HIGH) return RISK_SEVERITY.CRITICAL;
    return severity;
}

function buildJustification(kpiName, value, severity, trend) {
    const pct = (value * 100).toFixed(1);
    const trendStr = trend?.hasHistory
        ? ` (${trend.direction === "up" ? "↑" : trend.direction === "down" ? "↓" : "→"} vs período anterior)`
        : "";
    return `${kpiName} = ${pct}% [${severity}]${trendStr}`;
}

function buildSuggestedAction(kpiName, severity) {
    const actions = {
        responseRate: "Verificar si los usuarios reciben los mensajes y simplificar el proceso de respuesta.",
        onTimeResponseRate: "Considerar ampliar el gracePeriod o mover la rutina a otro horario.",
        escalationRate: "Revisar configuración de escalación y capacitación del equipo.",
        incidentRate: "Investigar causas raíz de incidentes y fortalecer prevención.",
        routineSuccessRate: "Revisar logs de rutinas fallidas y corregir configuración.",
        deliveryFailureRate: "Verificar chatIds válidos y estado del canal Telegram.",
        activeParticipationRate: "Incentivar adopción; verificar que los usuarios están vinculados.",
    };
    return actions[kpiName] || "Revisar métricas y tomar acción correctiva.";
}

/**
 * Persist risk flags to Supabase.
 */
async function persistRiskFlags(adminDb, flags, periodStart) {
    if (!flags.length) return 0;

    const { getSupabase } = require("../db/supabaseAdmin");
    const sb = getSupabase();

    // Clear previous flags for this period
    const { error: deleteError } = await sb.from("operational_risk_flags")
        .delete()
        .eq("period_start", periodStart);

    if (deleteError) {
        console.error("[riskFlagEngine] Error clearing previous risk flags:", deleteError.message);
    }

    // Map flags to table structure
    const records = flags.map(flag => {
        const scope = flag.entityType || "global";
        const entityId = flag.entityId || "global";
        
        return {
            kpi_name: flag.kpiName || "multi_kpi_deterioration",
            value: flag.value !== undefined ? flag.value : 0,
            threshold: flag.threshold !== undefined ? flag.threshold : 0,
            severity: flag.severity,
            is_deteriorating: flag.isDeteriorating || false,
            justification: flag.justification || "",
            suggested_action: flag.suggestedAction || (scope === "user" ? "Revisar desempeño individual de tareas con el usuario." : "Revisar métricas y tomar acción correctiva."),
            scope: scope,
            entity_id: entityId,
            period_start: periodStart
        };
    });

    // Write new flags in batches of 100
    const batchSize = 100;
    for (let i = 0; i < records.length; i += batchSize) {
        const batch = records.slice(i, i + batchSize);
        const { error: insertError } = await sb.from("operational_risk_flags").insert(batch);
        if (insertError) {
            console.error(`[riskFlagEngine] Error inserting risk flags batch [${i}]:`, insertError.message);
            throw insertError;
        }
    }

    console.log(`[riskFlagEngine] Persisted to Supabase: ${flags.length} flags.`);
    return flags.length;
}

module.exports = { evaluateRiskFlags, evaluateUserRiskFlags, persistRiskFlags };

