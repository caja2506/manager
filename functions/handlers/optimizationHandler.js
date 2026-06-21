/**
 * Optimization Handler — Backend (CJS)
 * =======================================
 * Orchestrates the full optimization pipeline:
 * 1. Load latest analytics snapshots/KPIs
 * 2. Run optimization engine (detect opportunities)
 * 3. Generate interventions
 * 4. Generate operational plan
 * 5. Generate insights narrative
 * 6. Persist all results to Supabase
 */

const { getAnalyticsDashboardData } = require("./analyticsRefreshHandler");
const { detectOpportunities, persistOpportunities } = require("../optimization/optimizationEngine");
const { generateInterventions } = require("../optimization/interventionSuggester");
const { generateDailyPlan, generateWeeklyOutlook, persistPlan } = require("../optimization/planningAssistant");
const { summarizeOptimizations, generateBriefing } = require("../optimization/insightGenerator");
const { simulateChange, persistSimulation } = require("../optimization/simulationEngine");
const { PERIOD_TYPE } = require("../analytics/analyticsConstants");
const { getSupabase, toCamel } = require("../db/supabaseAdmin");

/**
 * Run the full optimization scan.
 * Reads latest analytics, detects opportunities, generates
 * interventions and plans, persists all results.
 */
async function runOptimizationScan(adminDb, options = {}) {
    const startMs = Date.now();
    const periodType = options.periodType || PERIOD_TYPE.DAILY;
    const sb = getSupabase();

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

        // Log the scan to optimization_history
        const { error: logError } = await sb.from("optimization_history").insert({
            period_type: periodType,
            data_counts: {
                opportunityCount: opportunities.length,
                interventionCount: interventions.length,
                planId,
                latencyMs,
            },
            workloads: dailyPlan.userLoads || [],
            bottlenecks: {
                criticalRoutines: dailyPlan.criticalRoutines || [],
                riskWatchlist: dailyPlan.riskWatchlist || [],
            },
            recommendations: opportunities,
            score: 1.0,
            latency_ms: latencyMs,
        });

        if (logError) {
            console.error("[OptimizationHandler] Error writing optimization scan history:", logError.message);
        }

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
        const sb = getSupabase();

        // Load data from Supabase
        const [oppsRes, plansRes, historyRes] = await Promise.all([
            sb.from("operational_recommendations")
                .select("*")
                .eq("type", "opportunity")
                .order("created_at", { ascending: false })
                .limit(15),
            sb.from("management_briefs")
                .select("*")
                .in("type", ["daily_plan", "weekly_outlook"])
                .order("created_at", { ascending: false })
                .limit(5),
            sb.from("optimization_history")
                .select("*")
                .order("created_at", { ascending: false })
                .limit(10),
        ]);

        const opportunities = (oppsRes.data || []).map(toCamel);
        // Map back to expected structure
        const plans = (plansRes.data || []).map(r => ({ id: r.id, ...toCamel(r.content) }));
        const history = (historyRes.data || []).map(toCamel);
        const applied = []; // Deprecated / Empty fallback

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

    const result = simulateChange(proposedChange); // Note: simulateChange signature is proposedChange only in our file
    const simId = await persistSimulation(adminDb, result, userId);

    return { ...result, simulationId: simId };
}

module.exports = {
    runOptimizationScan,
    getOptimizationDashboardData,
    handleSimulation,
};

