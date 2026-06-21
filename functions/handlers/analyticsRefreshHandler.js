/**
 * Analytics Refresh Handler — Backend (CJS)
 * ============================================
 * Orchestrates the full analytics pipeline:
 * load data → compute KPIs → generate snapshots →
 * compute trends → evaluate risks → generate recommendations.
 */

const { loadAnalyticsData, getPeriodDates, toDateStr } = require("../analytics/analyticsDataLoader");
const { runKpiEngine } = require("../analytics/kpiEngine");
const { persistSnapshots, loadPreviousSnapshot } = require("../analytics/snapshotGenerator");
const { computeTrends, summarizeTrends } = require("../analytics/trendEngine");
const { buildAllScorecards } = require("../analytics/scorecardService");
const { evaluateRiskFlags, evaluateUserRiskFlags, persistRiskFlags } = require("../analytics/riskFlagEngine");
const { generateRecommendations, persistRecommendations } = require("../analytics/recommendationEngine");
const { PERIOD_TYPE } = require("../analytics/analyticsConstants");
const { getSupabase, toCamel } = require("../db/supabaseAdmin");

/**
 * Run the full analytics refresh pipeline.
 *
 * @param {any} adminDb - Deprecated, kept for signature compatibility
 * @param {Object} [options]
 * @param {string} [options.periodType='daily'] - 'daily' | 'weekly' | 'monthly'
 * @param {string} [options.startDate] - Override start date
 * @param {string} [options.endDate] - Override end date
 * @returns {Promise<Object>} Refresh summary
 */
async function runAnalyticsRefresh(adminDb, options = {}) {
    const startMs = Date.now();
    const periodType = options.periodType || PERIOD_TYPE.DAILY;
    const sb = getSupabase();

    console.log(`[analyticsRefresh] Starting ${periodType} refresh...`);

    // 1. Determine date ranges
    const periods = getPeriodDates(periodType);
    const currentStart = options.startDate || periods.current.start;
    const currentEnd = options.endDate || periods.current.end;

    // 2. Load data for current and previous periods
    const [currentData, previousData] = await Promise.all([
        loadAnalyticsData(adminDb, currentStart, currentEnd),
        loadAnalyticsData(adminDb, periods.previous.start, periods.previous.end),
    ]);

    console.log(`[analyticsRefresh] Data loaded. Current: ${JSON.stringify(summarizeDataCounts(currentData))}`);

    // 3. Compute KPIs
    const currentKpis = runKpiEngine(currentData);
    const previousKpis = runKpiEngine(previousData);

    // 4. Persist snapshots
    const snapshotWrites = await persistSnapshots(adminDb, currentKpis, periodType);

    // 5. Compute trends
    const globalTrends = computeTrends(currentKpis.global, previousKpis.global);
    const trendSummary = summarizeTrends(globalTrends);

    // 6. Build scorecards
    const scorecards = buildAllScorecards(currentKpis.byUser);

    // 7. Evaluate risk flags
    const globalFlags = evaluateRiskFlags(currentKpis.global, globalTrends);
    const userFlags = evaluateUserRiskFlags(currentKpis.byUser);
    const allFlags = [...globalFlags, ...userFlags];
    const flagsWritten = await persistRiskFlags(adminDb, allFlags, currentStart);

    // 8. Generate recommendations
    const recommendations = generateRecommendations(
        currentKpis.global, globalTrends, allFlags, currentKpis.byRoutine
    );
    const recsWritten = await persistRecommendations(adminDb, recommendations, currentStart);

    // 9. Log the refresh run in Supabase
    const latencyMs = Date.now() - startMs;
    const totalWrites = (snapshotWrites.global || 0) + (snapshotWrites.users || 0) + (snapshotWrites.routines || 0) + (snapshotWrites.team || 0);
    const refreshLog = {
        period_type: periodType,
        period_start: currentStart,
        period_end: currentEnd,
        completed_at: new Date().toISOString(),
        latency_ms: latencyMs,
        snapshot_writes: totalWrites,
        risk_flags_generated: allFlags.length,
        recommendations_generated: recommendations.length,
        trend_summary: trendSummary,
        scorecard_count: Object.keys(scorecards).length,
        data_counts: currentKpis.metadata.dataCounts,
    };

    const { error: logError } = await sb.from("analytics_refresh_logs").insert(refreshLog);
    if (logError) {
        console.error("[analyticsRefresh] Error logging refresh run:", logError.message);
    }
    
    console.log(`[analyticsRefresh] Complete in ${latencyMs}ms. Flags: ${allFlags.length}, Recs: ${recommendations.length}`);

    return {
        success: true,
        periodType,
        periodStart: currentStart,
        periodEnd: currentEnd,
        completedAt: refreshLog.completed_at,
        latencyMs,
        snapshotWrites,
        riskFlagsGenerated: allFlags.length,
        recommendationsGenerated: recommendations.length,
        trendSummary,
        scorecardCount: Object.keys(scorecards).length,
        dataCounts: currentKpis.metadata.dataCounts,
        globalKpis: currentKpis.global,
        trends: globalTrends,
        riskFlags: allFlags.slice(0, 10),
        recommendations: recommendations.slice(0, 10),
        scorecards,
    };
}

/**
 * Get analytics dashboard data (for the callable).
 * Reads latest snapshots instead of recomputing.
 */
async function getAnalyticsDashboardData(adminDb, periodType = PERIOD_TYPE.DAILY) {
    const periods = getPeriodDates(periodType);
    const currentStart = periods.current.start;
    const currentEnd = periods.current.end;

    // Load latest snapshots from Supabase
    const [globalSnapshot, userScores, routineScores, riskFlags, recommendations, refreshLogs] =
        await Promise.all([
            loadLatestSnapshot(currentStart, periodType, "global"),
            loadLatestScores("user", currentStart, periodType),
            loadLatestScores("routine", currentStart, periodType),
            loadActiveFlags(currentStart),
            loadActiveRecommendations(currentStart),
            loadRecentRefreshLogs(),
        ]);

    // Load previous global for trends
    const previousGlobal = await loadLatestSnapshot(periods.previous.start, periodType, "global");

    const trends = globalSnapshot && previousGlobal
        ? computeTrends(globalSnapshot.metrics?.metrics || {}, previousGlobal.metrics?.metrics || {})
        : {};
    const trendSummary = summarizeTrends(trends);

    return {
        period: { start: currentStart, end: currentEnd, type: periodType },
        globalKpis: globalSnapshot?.metrics?.metrics || {},
        userScores,
        routineScores,
        trends,
        trendSummary,
        riskFlags,
        recommendations,
        lastRefresh: refreshLogs[0] || null,
        hasData: !!globalSnapshot,
    };
}

// ── Internal helpers (Supabase Migrated) ──

async function loadLatestSnapshot(periodStart, periodType, entityId) {
    const sb = getSupabase();
    const { data, error } = await sb.from("analytics_snapshots")
        .select("*")
        .eq("scope", entityId === "global" ? "global" : "compliance")
        .eq("entity_id", entityId)
        .eq("snapshot_date", periodStart)
        .eq("metrics->>periodType", periodType)
        .limit(1)
        .maybeSingle();

    if (error) {
        console.warn("[analyticsRefreshHandler] loadLatestSnapshot error:", error.message);
        return null;
    }
    return data ? toCamel(data) : null;
}

async function loadLatestScores(scope, periodStart, periodType) {
    const sb = getSupabase();
    const { data, error } = await sb.from("analytics_snapshots")
        .select("*")
        .eq("scope", scope)
        .eq("snapshot_date", periodStart)
        .eq("metrics->>periodType", periodType)
        .limit(100);

    if (error) {
        console.warn("[analyticsRefreshHandler] loadLatestScores error:", error.message);
        return [];
    }
    
    return (data || []).map(row => ({
        id: row.id,
        scope: row.scope,
        entityId: row.entity_id,
        snapshotDate: row.snapshot_date,
        ...(row.metrics || {})
    }));
}

async function loadActiveFlags(periodStart) {
    const sb = getSupabase();
    const { data, error } = await sb.from("operational_risk_flags")
        .select("*")
        .eq("period_start", periodStart)
        .limit(50);

    if (error) {
        console.warn("[analyticsRefreshHandler] loadActiveFlags error:", error.message);
        return [];
    }
    return (data || []).map(toCamel);
}

async function loadActiveRecommendations(periodStart) {
    const sb = getSupabase();
    const { data, error } = await sb.from("operational_recommendations")
        .select("*")
        .eq("period_start", periodStart)
        .limit(30);

    if (error) {
        console.warn("[analyticsRefreshHandler] loadActiveRecommendations error:", error.message);
        return [];
    }
    return (data || []).map(toCamel);
}

async function loadRecentRefreshLogs() {
    const sb = getSupabase();
    const { data, error } = await sb.from("analytics_refresh_logs")
        .select("*")
        .order("completed_at", { ascending: false })
        .limit(5);

    if (error) {
        console.warn("[analyticsRefreshHandler] loadRecentRefreshLogs error:", error.message);
        return [];
    }
    return (data || []).map(toCamel);
}

function summarizeDataCounts(data) {
    return {
        runs: data.runs.length,
        deliveries: data.deliveries.length,
        reports: data.reports.length,
        escalations: data.escalations.length,
        incidents: data.incidents.length,
        aiExecutions: data.aiExecutions.length,
    };
}

module.exports = { runAnalyticsRefresh, getAnalyticsDashboardData };

