/**
 * Recommendation Engine — Backend (CJS)
 * ========================================
 * Generates actionable recommendations based on KPIs,
 * risk flags, and trends. Rule-based core with optional
 * AI narrative enrichment.
 */

const {
    RECOMMENDATION_TYPE,
    RECOMMENDATION_PRIORITY,
    KPI_NAME,
} = require("./analyticsConstants");
const paths = require("../automation/firestorePaths");

/**
 * Generate recommendations from KPI results and risk flags.
 *
 * @param {Object} globalKpis - Global KPI results
 * @param {Object} trends - Trend analysis
 * @param {Array} riskFlags - Active risk flags
 * @param {Object} routineKpis - Per-routine KPI results
 * @returns {Array<Object>} Prioritized recommendations
 */
function generateRecommendations(globalKpis, trends, riskFlags, routineKpis) {
    const recs = [];

    // 1. Response-based recommendations
    const responseRate = getKpiValue(globalKpis, KPI_NAME.RESPONSE_RATE);
    if (responseRate < 0.5) {
        recs.push({
            type: RECOMMENDATION_TYPE.ADOPTION_BOOST,
            priority: RECOMMENDATION_PRIORITY.URGENT,
            title: "Tasa de respuesta crítica",
            description: `Solo ${(responseRate * 100).toFixed(0)}% de los mensajes reciben respuesta. Considerar simplificar el formato de reporte o cambiar horarios.`,
            metricBacking: `responseRate = ${(responseRate * 100).toFixed(1)}%`,
            suggestedActions: [
                "Simplificar formato de respuesta",
                "Revisar horario de envío de rutina",
                "Verificar que los usuarios están vinculados correctamente",
            ],
        });
    } else if (responseRate < 0.7) {
        recs.push({
            type: RECOMMENDATION_TYPE.ADOPTION_BOOST,
            priority: RECOMMENDATION_PRIORITY.HIGH,
            title: "Tasa de respuesta baja",
            description: `${(responseRate * 100).toFixed(0)}% de tasa de respuesta. Hay margen de mejora.`,
            metricBacking: `responseRate = ${(responseRate * 100).toFixed(1)}%`,
            suggestedActions: [
                "Enviar recordatorios a usuarios que no respondieron",
                "Evaluar si el horario es conveniente",
            ],
        });
    }

    // 2. Punctuality recommendations
    const onTimeRate = getKpiValue(globalKpis, KPI_NAME.ON_TIME_RESPONSE_RATE);
    if (onTimeRate < 0.6) {
        recs.push({
            type: RECOMMENDATION_TYPE.PROCESS_IMPROVEMENT,
            priority: RECOMMENDATION_PRIORITY.HIGH,
            title: "Baja puntualidad en respuestas",
            description: `Solo ${(onTimeRate * 100).toFixed(0)}% de respuestas llegan a tiempo. Considerar ampliar el gracePeriod.`,
            metricBacking: `onTimeResponseRate = ${(onTimeRate * 100).toFixed(1)}%`,
            suggestedActions: [
                "Ampliar gracePeriod de 30 a 60 minutos",
                "Mover la rutina a un horario donde el equipo esté más disponible",
            ],
        });
    }

    // 3. Escalation recommendations
    const escalationRate = getKpiValue(globalKpis, KPI_NAME.ESCALATION_RATE);
    if (escalationRate > 0.3) {
        recs.push({
            type: RECOMMENDATION_TYPE.ESCALATION_REVIEW,
            priority: RECOMMENDATION_PRIORITY.HIGH,
            title: "Alta tasa de escalaciones",
            description: `${(escalationRate * 100).toFixed(0)}% de deliveries terminan en escalación.`,
            metricBacking: `escalationRate = ${(escalationRate * 100).toFixed(1)}%`,
            suggestedActions: [
                "Revisar configuración de escalación",
                "Evaluar si el equipo necesita capacitación",
                "Verificar que los tiempos de gracia son razonables",
            ],
        });
    }

    // 4. Routine health recommendations
    if (routineKpis) {
        for (const [routineKey, routineData] of Object.entries(routineKpis)) {
            const successRate = routineData.kpis?.[KPI_NAME.ROUTINE_SUCCESS_RATE];
            const value = typeof successRate === "object" ? successRate?.value : successRate;
            if (value !== undefined && value < 0.7 && routineData.totalRuns > 2) {
                recs.push({
                    type: RECOMMENDATION_TYPE.ROUTINE_ADJUSTMENT,
                    priority: RECOMMENDATION_PRIORITY.MEDIUM,
                    title: `Rutina "${routineData.routineName}" con baja efectividad`,
                    description: `Tasa de éxito: ${((value || 0) * 100).toFixed(0)}% en ${routineData.totalRuns} ejecuciones.`,
                    metricBacking: `routineSuccessRate = ${((value || 0) * 100).toFixed(1)}%`,
                    suggestedActions: [
                        "Revisar logs de errores de la rutina",
                        "Verificar templates y targets",
                        "Considerar desactivar temporalmente si no aporta valor",
                    ],
                });
            }
        }
    }

    // 5. AI tuning recommendations
    const confirmRate = getKpiValue(globalKpis, KPI_NAME.CONFIRMATION_REQUEST_RATE);
    if (confirmRate > 0.5) {
        recs.push({
            type: RECOMMENDATION_TYPE.AI_TUNING,
            priority: RECOMMENDATION_PRIORITY.MEDIUM,
            title: "Alta tasa de confirmación IA",
            description: `${(confirmRate * 100).toFixed(0)}% de las extracciones IA requieren confirmación. Los prompts podrían necesitar ajuste.`,
            metricBacking: `confirmationRequestRate = ${(confirmRate * 100).toFixed(1)}%`,
            suggestedActions: [
                "Ajustar umbrales de confianza",
                "Mejorar prompts de extracción",
                "Revisar casos que causan baja confianza",
            ],
        });
    }

    // 6. Deterioration-based recommendations from trends
    if (trends) {
        const deteriorating = Object.entries(trends)
            .filter(([_, t]) => t.hasHistory && t.isImproving === false)
            .map(([name]) => name);

        if (deteriorating.length >= 2) {
            recs.push({
                type: RECOMMENDATION_TYPE.PROCESS_IMPROVEMENT,
                priority: RECOMMENDATION_PRIORITY.HIGH,
                title: "Tendencia de deterioro detectada",
                description: `${deteriorating.length} KPIs empeorando: ${deteriorating.join(", ")}`,
                metricBacking: deteriorating.map(k => {
                    const t = trends[k];
                    return `${k}: ${t.deltaPercent}%`;
                }).join(", "),
                suggestedActions: [
                    "Reunión de equipo para revisar operación",
                    "Identificar cambios recientes que puedan explicar el deterioro",
                ],
            });
        }
    }

    // Sort by priority
    const priorityOrder = {
        [RECOMMENDATION_PRIORITY.URGENT]: 0,
        [RECOMMENDATION_PRIORITY.HIGH]: 1,
        [RECOMMENDATION_PRIORITY.MEDIUM]: 2,
        [RECOMMENDATION_PRIORITY.LOW]: 3,
    };
    recs.sort((a, b) => (priorityOrder[a.priority] || 9) - (priorityOrder[b.priority] || 9));

    return recs.map((r, i) => ({
        ...r,
        id: `rec_${i + 1}`,
        generatedAt: new Date().toISOString(),
    }));
}

/**
 * Persist recommendations to Firestore.
 */
async function persistRecommendations(adminDb, recommendations, periodStart) {
    if (!recommendations.length) return 0;

    // Clear previous recommendations for this period
    const existing = await adminDb.collection(paths.OPERATIONAL_RECOMMENDATIONS)
        .where("periodStart", "==", periodStart)
        .get();
    const deleteBatch = adminDb.batch();
    existing.docs.forEach(d => deleteBatch.delete(d.ref));
    if (!existing.empty) await deleteBatch.commit();

    // Write new
    const batch = adminDb.batch();
    for (const rec of recommendations.slice(0, 20)) {
        const ref = adminDb.collection(paths.OPERATIONAL_RECOMMENDATIONS).doc();
        batch.set(ref, { ...rec, periodStart });
    }
    await batch.commit();
    return recommendations.length;
}

function getKpiValue(kpis, name) {
    const kpi = kpis?.[name];
    if (!kpi) return 0;
    return typeof kpi === "object" ? (kpi.value ?? 0) : (kpi ?? 0);
}

module.exports = { generateRecommendations, persistRecommendations };
