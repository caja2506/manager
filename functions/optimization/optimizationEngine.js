/**
 * Optimization Engine — Backend (CJS)
 * ======================================
 * Core pattern detector: analyzes KPIs, trends, risks, routine
 * analytics, and user scorecards to detect optimization opportunities.
 *
 * Each opportunity is a self-contained, auditable object that explains
 * WHAT was detected, WHY it matters, and WHAT action to take.
 */

const {
    OPPORTUNITY_TYPE,
    KPI_NAME,
    KPI_POLARITY,
} = require("../analytics/analyticsConstants");

/**
 * Run the optimization engine over analytics data.
 *
 * @param {Object} params
 * @param {Object} params.globalKpis
 * @param {Object} params.byUser
 * @param {Object} params.byRoutine
 * @param {Object} params.trends
 * @param {Array}  params.riskFlags
 * @returns {Array<Object>} Optimization opportunities, sorted by impact
 */
function detectOpportunities({ globalKpis, byUser, byRoutine, trends, riskFlags }) {
    const opportunities = [];

    // ── Rule 1: Low-effectiveness routines ──
    if (byRoutine) {
        for (const [key, routine] of Object.entries(byRoutine)) {
            const sr = getVal(routine.kpis, KPI_NAME.ROUTINE_SUCCESS_RATE);
            if (sr !== null && sr < 0.7 && (routine.totalRuns || 0) >= 5) {
                opportunities.push({
                    type: OPPORTUNITY_TYPE.PROCESS,
                    entityType: "routine",
                    entityId: key,
                    entityName: routine.routineName || key,
                    problemDetected: `Rutina "${routine.routineName}" tiene ${(sr * 100).toFixed(0)}% de tasa de éxito en ${routine.totalRuns} ejecuciones.`,
                    suggestedAction: sr < 0.4
                        ? "Considerar desactivar temporalmente y revisar configuración."
                        : "Revisar logs de error y ajustar templates/targets.",
                    impactEstimate: {
                        metric: "routineSuccessRate",
                        currentValue: sr,
                        expectedValue: Math.min(sr + 0.20, 0.95),
                        confidence: 0.7,
                    },
                    confidence: 0.8,
                    explanation: "Rutinas con éxito < 70% generan ruido operativo y desconfianza en el sistema.",
                    supportingMetrics: [
                        { kpi: "routineSuccessRate", value: sr, threshold: 0.7 },
                    ],
                    rule: "low_routine_effectiveness",
                });
            }
        }
    }

    // ── Rule 2: Excessive escalations ──
    const escalationRate = getVal(globalKpis, KPI_NAME.ESCALATION_RATE);
    if (escalationRate !== null && escalationRate > 0.3) {
        opportunities.push({
            type: OPPORTUNITY_TYPE.ESCALATION,
            entityType: "global",
            entityId: "system",
            problemDetected: `Tasa de escalación del ${(escalationRate * 100).toFixed(0)}% — más del 30% de deliveries escalan.`,
            suggestedAction: "Revisar grace periods, simplificar formato de respuesta, o ajustar horarios de envío.",
            impactEstimate: {
                metric: "escalationRate",
                currentValue: escalationRate,
                expectedValue: Math.max(escalationRate - 0.15, 0.05),
                confidence: 0.65,
            },
            confidence: 0.75,
            explanation: "Altas escalaciones saturan al admin y generan fatiga operativa.",
            supportingMetrics: [
                { kpi: "escalationRate", value: escalationRate, threshold: 0.3 },
            ],
            rule: "excessive_escalations",
        });
    }

    // ── Rule 3: Inefficient schedules ──
    const onTimeRate = getVal(globalKpis, KPI_NAME.ON_TIME_RESPONSE_RATE);
    const lateRate = getVal(globalKpis, KPI_NAME.LATE_RESPONSE_RATE);
    if (onTimeRate !== null && onTimeRate < 0.5 && lateRate > 0.3) {
        opportunities.push({
            type: OPPORTUNITY_TYPE.SCHEDULE,
            entityType: "global",
            entityId: "system",
            problemDetected: `Solo ${(onTimeRate * 100).toFixed(0)}% de respuestas a tiempo y ${(lateRate * 100).toFixed(0)}% tardías.`,
            suggestedAction: "Mover rutinas al horario donde el equipo tiene mayor disponibilidad o extender grace period.",
            impactEstimate: {
                metric: "onTimeResponseRate",
                currentValue: onTimeRate,
                expectedValue: Math.min(onTimeRate + 0.25, 0.85),
                confidence: 0.6,
            },
            confidence: 0.7,
            explanation: "Alta tasa de respuestas tardías sugiere que el horario no coincide con la disponibilidad real.",
            supportingMetrics: [
                { kpi: "onTimeResponseRate", value: onTimeRate, threshold: 0.5 },
                { kpi: "lateResponseRate", value: lateRate, threshold: 0.3 },
            ],
            rule: "inefficient_schedule",
        });
    }

    // ── Rule 4: Low report completion ──
    const reportRate = getVal(globalKpis, KPI_NAME.REPORT_COMPLETION_RATE);
    if (reportRate !== null && reportRate < 0.6) {
        opportunities.push({
            type: OPPORTUNITY_TYPE.FORMAT,
            entityType: "global",
            entityId: "system",
            problemDetected: `Solo ${(reportRate * 100).toFixed(0)}% de reportes completados.`,
            suggestedAction: "Simplificar formato de reporte o integrar respuesta por voz.",
            impactEstimate: {
                metric: "reportCompletionRate",
                currentValue: reportRate,
                expectedValue: Math.min(reportRate + 0.25, 0.9),
                confidence: 0.6,
            },
            confidence: 0.7,
            explanation: "Baja completitud indica que el formato es demasiado pesado o el horario no conviene.",
            supportingMetrics: [
                { kpi: "reportCompletionRate", value: reportRate, threshold: 0.6 },
            ],
            rule: "low_report_completion",
        });
    }

    // ── Rule 5: Overloaded users ──
    if (byUser) {
        for (const [userId, userData] of Object.entries(byUser)) {
            const userKpis = userData.kpis || {};
            let deterioratingCount = 0;
            for (const [kpiName, kpiResult] of Object.entries(userKpis)) {
                const val = typeof kpiResult === "object" ? kpiResult?.value : kpiResult;
                const polarity = KPI_POLARITY[kpiName] || "higher";
                if (polarity === "higher" && val < 0.5) deterioratingCount++;
                if (polarity === "lower" && val > 0.4) deterioratingCount++;
            }
            if (deterioratingCount >= 3) {
                opportunities.push({
                    type: OPPORTUNITY_TYPE.WORKLOAD,
                    entityType: "user",
                    entityId: userId,
                    entityName: userData.userName || userId,
                    problemDetected: `${userData.userName || "Usuario"} tiene ${deterioratingCount} KPIs en zona crítica.`,
                    suggestedAction: "Revisar carga operativa, reasignar rutinas o contactar al usuario.",
                    impactEstimate: {
                        metric: "multiple",
                        currentValue: deterioratingCount,
                        expectedValue: Math.max(deterioratingCount - 2, 0),
                        confidence: 0.5,
                    },
                    confidence: 0.65,
                    explanation: "Múltiples KPIs deteriorados indican sobrecarga o desconexión operativa.",
                    supportingMetrics: Object.entries(userKpis)
                        .filter(([_, v]) => {
                            const val = typeof v === "object" ? v?.value : v;
                            return val !== null && val !== undefined;
                        })
                        .slice(0, 4)
                        .map(([kpi, v]) => ({
                            kpi,
                            value: typeof v === "object" ? v.value : v,
                        })),
                    rule: "overloaded_user",
                });
            }
        }
    }

    // ── Rule 6: High operational noise ──
    const deliveryFailure = getVal(globalKpis, KPI_NAME.DELIVERY_FAILURE_RATE);
    if (deliveryFailure > 0.2 && escalationRate > 0.25) {
        opportunities.push({
            type: OPPORTUNITY_TYPE.PROCESS,
            entityType: "global",
            entityId: "system",
            problemDetected: `Alto ruido operativo: ${(deliveryFailure * 100).toFixed(0)}% fallas de envío + ${(escalationRate * 100).toFixed(0)}% escalaciones.`,
            suggestedAction: "Auditar canal de comunicación, verificar vinculación de usuarios y revisar configuración de Telegram.",
            impactEstimate: {
                metric: "deliveryFailureRate",
                currentValue: deliveryFailure,
                expectedValue: Math.max(deliveryFailure - 0.15, 0.02),
                confidence: 0.6,
            },
            confidence: 0.7,
            explanation: "Combinación de fallas de envío y escalaciones indica problemas de infraestructura o configuración.",
            supportingMetrics: [
                { kpi: "deliveryFailureRate", value: deliveryFailure, threshold: 0.2 },
                { kpi: "escalationRate", value: escalationRate, threshold: 0.25 },
            ],
            rule: "high_operational_noise",
        });
    }

    // ── Rule 7: Underused AI ──
    const aiRate = getVal(globalKpis, KPI_NAME.AI_ASSISTED_RATE);
    const audioRate = getVal(globalKpis, KPI_NAME.AUDIO_USAGE_RATE);
    if (aiRate < 0.3 && audioRate > 0) {
        opportunities.push({
            type: OPPORTUNITY_TYPE.AI_TUNING,
            entityType: "global",
            entityId: "system",
            problemDetected: `Solo ${(aiRate * 100).toFixed(0)}% de procesamiento asistido por IA pese a ${(audioRate * 100).toFixed(0)}% de uso de audio.`,
            suggestedAction: "Verificar configuración de IA, habilitar procesamiento automático o ajustar umbrales de confianza.",
            impactEstimate: {
                metric: "aiAssistedRate",
                currentValue: aiRate,
                expectedValue: Math.min(aiRate + 0.30, 0.8),
                confidence: 0.6,
            },
            confidence: 0.65,
            explanation: "El equipo envía audio pero la IA no procesa — se pierde capacidad de automatización.",
            supportingMetrics: [
                { kpi: "aiAssistedRate", value: aiRate, threshold: 0.3 },
                { kpi: "audioUsageRate", value: audioRate },
            ],
            rule: "underused_ai",
        });
    }

    // ── Rule 8: Trend deterioration pattern ──
    if (trends) {
        const deteriorating = Object.entries(trends)
            .filter(([_, t]) => t.hasHistory && t.isImproving === false)
            .map(([name, t]) => ({ name, delta: t.deltaPercent }));

        if (deteriorating.length >= 3) {
            opportunities.push({
                type: OPPORTUNITY_TYPE.PROCESS,
                entityType: "global",
                entityId: "system",
                problemDetected: `${deteriorating.length} KPIs con tendencia negativa: ${deteriorating.map(d => d.name).join(", ")}.`,
                suggestedAction: "Reunión de revisión operativa urgente — investigar cambios recientes.",
                impactEstimate: {
                    metric: "multiple",
                    currentValue: deteriorating.length,
                    expectedValue: 0,
                    confidence: 0.5,
                },
                confidence: 0.75,
                explanation: "Deterioro simultáneo de múltiples KPIs indica un problema sistémico.",
                supportingMetrics: deteriorating.map(d => ({ kpi: d.name, delta: d.delta })),
                rule: "multi_kpi_deterioration",
            });
        }
    }

    // Sort by confidence * estimated improvement (rough impact score)
    opportunities.sort((a, b) => {
        const scoreA = (a.confidence || 0) * (a.impactEstimate?.confidence || 0);
        const scoreB = (b.confidence || 0) * (b.impactEstimate?.confidence || 0);
        return scoreB - scoreA;
    });

    return opportunities.map((opp, i) => ({
        ...opp,
        id: `opp_${Date.now()}_${i}`,
        generatedAt: new Date().toISOString(),
        status: "active",
    }));
}

/**
 * Persist opportunities to Firestore.
 */
async function persistOpportunities(adminDb, opportunities, periodStart) {
    const paths = require("../automation/firestorePaths");
    if (!opportunities.length) return 0;

    const batch = adminDb.batch();
    for (const opp of opportunities.slice(0, 15)) {
        const ref = adminDb.collection(paths.OPTIMIZATION_OPPORTUNITIES).doc();
        batch.set(ref, { ...opp, periodStart });
    }
    await batch.commit();
    return opportunities.length;
}

// ── Helper ──
function getVal(kpis, name) {
    if (!kpis) return null;
    const kpi = kpis[name];
    if (kpi === undefined || kpi === null) return null;
    return typeof kpi === "object" ? (kpi.value ?? null) : kpi;
}

module.exports = { detectOpportunities, persistOpportunities };
