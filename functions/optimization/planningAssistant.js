/**
 * Planning Assistant — Backend (CJS)
 * =====================================
 * Generates operational plans (daily/weekly) based on
 * current KPIs, active risks, user workloads, and
 * routine criticality.
 */

const { PLAN_TYPE, KPI_NAME } = require("../analytics/analyticsConstants");
const paths = require("../automation/firestorePaths");

/**
 * Generate a daily operational plan.
 */
function generateDailyPlan(data, date) {
    const dateStr = date || new Date().toISOString().slice(0, 10);

    // Identify critical routines (low success or high escalation)
    const criticalRoutines = [];
    if (data.byRoutine) {
        for (const [key, routine] of Object.entries(data.byRoutine)) {
            const sr = getVal(routine.kpis, KPI_NAME.ROUTINE_SUCCESS_RATE);
            const esc = routine.kpis?.escalationCount || 0;
            if ((sr !== null && sr < 0.7) || esc > 3) {
                criticalRoutines.push({
                    routineKey: key,
                    routineName: routine.routineName,
                    successRate: sr,
                    escalations: esc,
                    reason: sr < 0.7 ? "Baja tasa de éxito" : "Exceso de escalaciones",
                });
            }
        }
    }

    // Risk watchlist from active risk flags
    const riskWatchlist = (data.riskFlags || [])
        .filter(f => f.severity === "high" || f.severity === "critical")
        .slice(0, 5)
        .map(f => ({
            kpi: f.kpiName,
            severity: f.severity,
            justification: f.justification,
        }));

    // User load analysis
    const userLoads = [];
    if (data.byUser) {
        for (const [userId, userData] of Object.entries(data.byUser)) {
            const responseRate = getVal(userData.kpis, KPI_NAME.RESPONSE_RATE);
            const onTimeRate = getVal(userData.kpis, KPI_NAME.ON_TIME_RESPONSE_RATE);
            let loadLevel = "normal";
            if (responseRate < 0.5 || onTimeRate < 0.4) loadLevel = "high";
            else if (responseRate > 0.85 && onTimeRate > 0.8) loadLevel = "low";

            userLoads.push({
                userId,
                userName: userData.userName,
                role: userData.userRole,
                loadLevel,
                responseRate,
                onTimeRate,
            });
        }
    }

    // Focus areas
    const focusAreas = [];
    const globalResponse = getVal(data.globalKpis, KPI_NAME.RESPONSE_RATE);
    if (globalResponse !== null && globalResponse < 0.6) focusAreas.push("🔴 Priorizar adopción — tasa de respuesta muy baja");
    if (criticalRoutines.length > 0) focusAreas.push(`⚠️ ${criticalRoutines.length} rutina(s) crítica(s) requieren atención`);
    if (riskWatchlist.length > 0) focusAreas.push(`🚨 ${riskWatchlist.length} riesgo(s) activo(s) en watchlist`);
    const overloaded = userLoads.filter(u => u.loadLevel === "high");
    if (overloaded.length > 0) focusAreas.push(`👤 ${overloaded.length} usuario(s) con carga alta`);
    if (focusAreas.length === 0) focusAreas.push("✅ Operación estable — mantener monitoreo regular");

    return {
        planType: PLAN_TYPE.DAILY,
        date: dateStr,
        criticalRoutines,
        riskWatchlist,
        userLoads: userLoads.sort((a, b) =>
            (a.loadLevel === "high" ? 0 : a.loadLevel === "normal" ? 1 : 2)
            - (b.loadLevel === "high" ? 0 : b.loadLevel === "normal" ? 1 : 2)
        ),
        focusAreas,
        generatedAt: new Date().toISOString(),
    };
}

/**
 * Generate a weekly operational outlook.
 */
function generateWeeklyOutlook(data, weekStart) {
    const weekStartStr = weekStart || getMonday().toISOString().slice(0, 10);
    const dailyPlan = generateDailyPlan(data, weekStartStr);

    // Trend-based predictions
    const trendPredictions = [];
    if (data.trends) {
        for (const [kpiName, trend] of Object.entries(data.trends)) {
            if (trend.hasHistory && trend.isImproving === false && Math.abs(trend.deltaPercent || 0) > 5) {
                trendPredictions.push({
                    kpi: kpiName,
                    direction: "deteriorating",
                    delta: trend.deltaPercent,
                    prediction: `Si la tendencia continúa, ${kpiName} podría caer otro ${Math.abs(trend.deltaPercent)}% esta semana.`,
                });
            }
            if (trend.hasHistory && trend.isImproving === true && Math.abs(trend.deltaPercent || 0) > 5) {
                trendPredictions.push({
                    kpi: kpiName,
                    direction: "improving",
                    delta: trend.deltaPercent,
                    prediction: `${kpiName} mejorando — mantener las acciones actuales.`,
                });
            }
        }
    }

    // Priority areas for the week
    const priorityAreas = [...dailyPlan.focusAreas];
    if (trendPredictions.filter(t => t.direction === "deteriorating").length > 0) {
        priorityAreas.unshift("📉 Tendencias negativas detectadas — revisar acciones correctivas");
    }

    return {
        ...dailyPlan,
        planType: PLAN_TYPE.WEEKLY,
        weekStart: weekStartStr,
        trendPredictions,
        priorityAreas,
        generatedAt: new Date().toISOString(),
    };
}

/**
 * Persist plan to Firestore.
 */
async function persistPlan(adminDb, plan) {
    const ref = adminDb.collection(paths.OPERATIONAL_PLANS).doc();
    await ref.set(plan);
    return ref.id;
}

// ── Helpers ──
function getVal(kpis, name) {
    if (!kpis) return null;
    const kpi = kpis[name];
    if (kpi === undefined || kpi === null) return null;
    return typeof kpi === "object" ? (kpi.value ?? null) : kpi;
}

function getMonday() {
    const d = new Date();
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(d.setDate(diff));
}

module.exports = { generateDailyPlan, generateWeeklyOutlook, persistPlan };
