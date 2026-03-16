/**
 * Simulation Engine — Backend (CJS)
 * ====================================
 * What-if analysis: takes a proposed operational change and
 * estimates impact on key metrics. Uses heuristic models
 * calibrated against operational patterns.
 *
 * NOTE: Estimates are heuristic, not predictive ML.
 * Always labeled with confidence % and assumptions.
 */

const { SIMULATION_TYPE } = require("../analytics/analyticsConstants");

/**
 * Simulate the impact of a proposed operational change.
 *
 * @param {Object} currentData - Current KPI/metric values
 * @param {Object} proposedChange
 * @param {string} proposedChange.type - SIMULATION_TYPE enum value
 * @param {Object} proposedChange.params - Change-specific parameters
 * @returns {Object} Simulation result with estimated impacts
 */
function simulateChange(currentData, proposedChange) {
    const { type, params = {} } = proposedChange;

    switch (type) {
        case SIMULATION_TYPE.SCHEDULE_CHANGE:
            return simulateScheduleChange(currentData, params);
        case SIMULATION_TYPE.GRACE_PERIOD_CHANGE:
            return simulateGracePeriodChange(currentData, params);
        case SIMULATION_TYPE.FREQUENCY_CHANGE:
            return simulateFrequencyChange(currentData, params);
        case SIMULATION_TYPE.ADD_CHECKPOINT:
            return simulateAddCheckpoint(currentData, params);
        case SIMULATION_TYPE.FORMAT_CHANGE:
            return simulateFormatChange(currentData, params);
        default:
            return {
                scenario: "Tipo de simulación no soportado",
                changes: {},
                estimatedImpact: {},
                confidence: 0,
                assumptions: ["Tipo no reconocido"],
                risks: ["No se puede estimar impacto"],
            };
    }
}

function simulateScheduleChange(data, params) {
    const { routineKey, routineName, shiftHours = 0, newHour } = params;
    const currentResponseRate = data.globalKpis?.responseRate?.value ?? data.globalKpis?.responseRate ?? 0.5;
    const currentOnTimeRate = data.globalKpis?.onTimeResponseRate?.value ?? data.globalKpis?.onTimeResponseRate ?? 0.5;
    const currentEscalationRate = data.globalKpis?.escalationRate?.value ?? data.globalKpis?.escalationRate ?? 0.3;

    // Heuristic: moving to morning (7-9 AM) or early afternoon (1-3 PM) improves response
    const targetHour = newHour || 8;
    const isOptimalWindow = targetHour >= 7 && targetHour <= 9 || targetHour >= 13 && targetHour <= 15;
    const responseBoost = isOptimalWindow ? 0.12 : 0.05;
    const onTimeBoost = isOptimalWindow ? 0.15 : 0.05;
    const escalationReduction = isOptimalWindow ? 0.08 : 0.03;

    return {
        scenario: `Mover "${routineName || routineKey}" a las ${targetHour}:00`,
        changes: { routineKey, shiftHours, newHour: targetHour },
        estimatedImpact: {
            responseRate: impact(currentResponseRate, responseBoost, "higher"),
            onTimeResponseRate: impact(currentOnTimeRate, onTimeBoost, "higher"),
            escalationRate: impact(currentEscalationRate, -escalationReduction, "lower"),
        },
        confidence: isOptimalWindow ? 0.65 : 0.45,
        assumptions: [
            "El equipo tiene mayor disponibilidad en horarios laborales estándar",
            "El patrón histórico de respuesta correlaciona con la hora del día",
        ],
        risks: [
            "Si el equipo tiene horarios variables, el cambio podría no tener efecto",
            shiftHours > 3 ? "Un cambio grande puede requerir período de adaptación" : null,
        ].filter(Boolean),
    };
}

function simulateGracePeriodChange(data, params) {
    const { currentMinutes = 30, newMinutes = 60 } = params;
    const currentOnTimeRate = data.globalKpis?.onTimeResponseRate?.value ?? data.globalKpis?.onTimeResponseRate ?? 0.5;
    const currentEscalationRate = data.globalKpis?.escalationRate?.value ?? data.globalKpis?.escalationRate ?? 0.3;
    const currentLateRate = data.globalKpis?.lateResponseRate?.value ?? data.globalKpis?.lateResponseRate ?? 0.3;

    const increase = newMinutes > currentMinutes;
    const ratio = newMinutes / currentMinutes;

    // More grace → better on-time, fewer escalations, but possibly slower feedback
    const onTimeBoost = increase ? Math.min(0.20 * (ratio - 1), 0.30) : -0.10;
    const escalationReduction = increase ? Math.min(0.10 * (ratio - 1), 0.20) : 0.05;
    const lateReduction = increase ? Math.min(0.15 * (ratio - 1), 0.25) : -0.10;

    return {
        scenario: `Cambiar grace period de ${currentMinutes}min → ${newMinutes}min`,
        changes: { currentMinutes, newMinutes },
        estimatedImpact: {
            onTimeResponseRate: impact(currentOnTimeRate, onTimeBoost, "higher"),
            escalationRate: impact(currentEscalationRate, -escalationReduction, "lower"),
            lateResponseRate: impact(currentLateRate, -lateReduction, "lower"),
        },
        confidence: increase ? 0.7 : 0.5,
        assumptions: [
            increase
                ? "Más tiempo de gracia permite respuestas dentro de ventana"
                : "Menor tiempo fuerza respuestas rápidas pero puede aumentar escalaciones",
            "El grado de mejora depende del margen de respuestas tardías por minutos",
        ],
        risks: [
            increase ? "Grace period muy largo reduce la urgencia de respuesta" : null,
            !increase ? "Reducir el grace period puede frustrar a usuarios" : null,
        ].filter(Boolean),
    };
}

function simulateFrequencyChange(data, params) {
    const { routineKey, routineName, currentFrequency = "daily", newFrequency = "weekly" } = params;
    const currentResponseRate = data.globalKpis?.responseRate?.value ?? 0.5;

    const reducing = newFrequency === "weekly" && currentFrequency === "daily";

    return {
        scenario: `Cambiar frecuencia de "${routineName || routineKey}" de ${currentFrequency} → ${newFrequency}`,
        changes: { routineKey, currentFrequency, newFrequency },
        estimatedImpact: {
            responseRate: impact(currentResponseRate, reducing ? 0.10 : -0.08, "higher"),
            operationalLoad: {
                before: currentFrequency === "daily" ? 7 : 1,
                after: newFrequency === "daily" ? 7 : 1,
                delta: reducing ? -6 : 6,
                unit: "ejecuciones/semana",
            },
        },
        confidence: 0.6,
        assumptions: [
            reducing
                ? "Menor frecuencia reduce fatiga y aumenta atención por ejecución"
                : "Mayor frecuencia mantiene al equipo más conectado pero puede causar fatiga",
        ],
        risks: [
            reducing ? "Se pierde granularidad de seguimiento diario" : null,
            !reducing ? "Riesgo de fatiga por demasiadas notificaciones" : null,
        ].filter(Boolean),
    };
}

function simulateAddCheckpoint(data, params) {
    const { routineKey, routineName, checkpointDescription = "Checkpoint adicional" } = params;
    const currentSuccessRate = data.byRoutine?.[routineKey]?.kpis?.routineSuccessRate?.value ?? 0.7;

    return {
        scenario: `Agregar checkpoint a "${routineName || routineKey}": ${checkpointDescription}`,
        changes: { routineKey, checkpointDescription },
        estimatedImpact: {
            routineSuccessRate: impact(currentSuccessRate, 0.10, "higher"),
            operationalLoad: {
                before: 1, after: 1.2, delta: 0.2,
                unit: "factor de carga",
            },
        },
        confidence: 0.5,
        assumptions: [
            "El checkpoint detecta fallos antes de que escalen",
            "El equipo responde al checkpoint de forma consistente",
        ],
        risks: [
            "Un checkpoint adicional agrega carga operativa",
            "Si el checkpoint no es útil, genera ruido",
        ],
    };
}

function simulateFormatChange(data, params) {
    const { simplify = true } = params;
    const currentReportRate = data.globalKpis?.reportCompletionRate?.value ?? 0.5;
    const currentResponseRate = data.globalKpis?.responseRate?.value ?? 0.5;

    return {
        scenario: simplify ? "Simplificar formato de reporte" : "Agregar campos al reporte",
        changes: { simplify },
        estimatedImpact: {
            reportCompletionRate: impact(currentReportRate, simplify ? 0.20 : -0.10, "higher"),
            responseRate: impact(currentResponseRate, simplify ? 0.10 : -0.05, "higher"),
        },
        confidence: simplify ? 0.65 : 0.5,
        assumptions: [
            simplify
                ? "Menos campos → menos fricción → mayor completitud"
                : "Más campos capturan más datos pero reducen adherencia",
        ],
        risks: [
            simplify ? "Se pierde detalle de información" : null,
            !simplify ? "Mayor complejidad puede reducir adopción" : null,
        ].filter(Boolean),
    };
}

// ── Helper ──
function impact(current, delta, polarity) {
    const after = polarity === "higher"
        ? Math.min(Math.max(current + delta, 0), 1)
        : Math.max(Math.min(current + delta, 1), 0);
    return {
        before: parseFloat(current.toFixed(4)),
        after: parseFloat(after.toFixed(4)),
        delta: parseFloat((after - current).toFixed(4)),
    };
}

/**
 * Persist simulation result to Firestore.
 */
async function persistSimulation(adminDb, simulation, userId) {
    const paths = require("../automation/firestorePaths");
    const ref = adminDb.collection(paths.OPTIMIZATION_SIMULATIONS).doc();
    await ref.set({
        ...simulation,
        simulatedBy: userId,
        simulatedAt: new Date().toISOString(),
    });
    return ref.id;
}

module.exports = { simulateChange, persistSimulation };
