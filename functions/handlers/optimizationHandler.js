/**
 * Optimization Handler — Backend (CJS)
 * =======================================
 * Orchestrates the full optimization pipeline:
 * 1. Load latest analytics snapshots/KPIs
 * 2. Run optimization engine (detect opportunities)
 * 3. Generate interventions
 * 4. Generate operational plan
 * 5. Generate insights narrative
 * 6. Persist all results
 */

const { getAnalyticsDashboardData } = require("./analyticsRefreshHandler");
const { detectOpportunities, persistOpportunities } = require("../optimization/optimizationEngine");
const { generateInterventions } = require("../optimization/interventionSuggester");
const { generateDailyPlan, generateWeeklyOutlook, persistPlan } = require("../optimization/planningAssistant");
const { summarizeOptimizations, generateBriefing } = require("../optimization/insightGenerator");
const { simulateChange, persistSimulation } = require("../optimization/simulationEngine");
const { PERIOD_TYPE } = require("../analytics/analyticsConstants");
const paths = require("../automation/firestorePaths");

/**
 * Run the full optimization scan.
 * Reads latest analytics, detects opportunities, generates
 * interventions and plans, persists all results.
 */
async function runOptimizationScan(adminDb, options = {}) {
    const startMs = Date.now();
    const periodType = options.periodType || PERIOD_TYPE.DAILY;

    try {
        // 1. Load latest analytics dashboard data
        const dashData = await getAnalyticsDashboardData(adminDb, periodType);

        // Package data for optimization engines
        const engineInput = {
            globalKpis: dashData.globalKpis || {},
            byUser: dashData.userScores || {},
            byRoutine: dashData.routineScores || {},
            trends: dashData.trends || {},
            riskFlags: dashData.riskFlags || [],
        };

        // 2. Detect optimization opportunities
        const opportunities = detectOpportunities(engineInput);
        const oppsStored = await persistOpportunities(adminDb, opportunities, dashData.periodStart || new Date().toISOString().slice(0, 10));

        // 3. Generate interventions
        const interventions = generateInterventions(engineInput);

        // 4. Generate operational plan
        const dailyPlan = generateDailyPlan({
            ...engineInput,
            riskFlags: engineInput.riskFlags,
        });
        const planId = await persistPlan(adminDb, dailyPlan);

        // 5. Generate insight narratives
        const optimizationSummary = summarizeOptimizations(opportunities);
        const managerBriefing = generateBriefing(dailyPlan, "manager");

        const latencyMs = Date.now() - startMs;

        const result = {
            success: true,
            opportunities: opportunities.length,
            interventions: interventions.length,
            planId,
            optimizationSummary,
            latencyMs,
        };

        // Log the scan
        await adminDb.collection(paths.OPTIMIZATION_HISTORY).doc().set({
            action: "optimization_scan",
            periodType,
            result: {
                opportunityCount: opportunities.length,
                interventionCount: interventions.length,
                planId,
                latencyMs,
            },
            timestamp: new Date().toISOString(),
        });

        console.log(`[OptimizationHandler] Scan complete: ${opportunities.length} opportunities, ${interventions.length} interventions in ${latencyMs}ms`);

        return result;
    } catch (error) {
        console.error("[OptimizationHandler] Scan failed:", error.message);
        return {
            success: false,
            error: error.message,
            latencyMs: Date.now() - startMs,
        };
    }
}

/**
 * Get optimization dashboard data for the callable.
 */
async function getOptimizationDashboardData(adminDb) {
    try {
        const [opportunities, plans, history, applied] = await Promise.all([
            loadRecentDocs(adminDb, paths.OPTIMIZATION_OPPORTUNITIES, 15),
            loadRecentDocs(adminDb, paths.OPERATIONAL_PLANS, 5),
            loadRecentDocs(adminDb, paths.OPTIMIZATION_HISTORY, 10),
            loadRecentDocs(adminDb, paths.APPLIED_RECOMMENDATIONS, 10),
        ]);

        // Also load analytics data for simulation capabilities
        let dashData = {};
        try {
            dashData = await getAnalyticsDashboardData(adminDb, PERIOD_TYPE.DAILY);
        } catch (e) {
            console.warn("[OptimizationHandler] Could not load analytics for dashboard:", e.message);
        }

        // Generate live interventions
        let interventions = [];
        try {
            interventions = generateInterventions({
                globalKpis: dashData.globalKpis || {},
                byUser: dashData.userScores || {},
                trends: dashData.trends || {},
                riskFlags: dashData.riskFlags || [],
            });
        } catch (e) {
            console.warn("[OptimizationHandler] Intervention generation failed:", e.message);
        }

        // Generate insight summary
        let insightSummary = "";
        try {
            insightSummary = summarizeOptimizations(opportunities);
        } catch (e) {
            console.warn("[OptimizationHandler] Insight generation failed:", e.message);
        }

        return {
            opportunities,
            interventions,
            plans,
            history,
            applied,
            insightSummary,
            analyticsData: dashData,
            loadedAt: new Date().toISOString(),
        };
    } catch (error) {
        console.error("[OptimizationHandler] Dashboard load error:", error.message);
        return {
            opportunities: [],
            interventions: [],
            plans: [],
            history: [],
            applied: [],
            insightSummary: "Error al cargar datos de optimización.",
            analyticsData: {},
            loadedAt: new Date().toISOString(),
            error: error.message,
        };
    }
}

/**
 * Handle what-if simulation request.
 */
async function handleSimulation(adminDb, proposedChange, userId) {
    let analyticsData = {};
    try {
        analyticsData = await getAnalyticsDashboardData(adminDb, PERIOD_TYPE.DAILY);
    } catch (e) {
        console.warn("[OptimizationHandler] Could not load analytics for simulation:", e.message);
    }

    const currentData = {
        globalKpis: analyticsData.globalKpis || {},
        byRoutine: analyticsData.routineScores || {},
    };

    const result = simulateChange(currentData, proposedChange);
    const simId = await persistSimulation(adminDb, result, userId);

    return { ...result, simulationId: simId };
}

// ── Internal helpers ──

async function loadRecentDocs(adminDb, collection, limit = 10) {
    try {
        const snap = await adminDb.collection(collection)
            .orderBy("generatedAt", "desc")
            .limit(limit)
            .get();
        return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (e) {
        // Fallback: try without ordering (collection might be empty or field missing)
        try {
            const snap = await adminDb.collection(collection)
                .limit(limit)
                .get();
            return snap.docs.map(d => ({ id: d.id, ...d.data() }));
        } catch (e2) {
            console.warn(`[OptimizationHandler] Could not load ${collection}:`, e2.message);
            return [];
        }
    }
}

module.exports = {
    runOptimizationScan,
    getOptimizationDashboardData,
    handleSimulation,
};
