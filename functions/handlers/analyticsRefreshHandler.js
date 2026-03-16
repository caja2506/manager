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
const paths = require("../automation/firestorePaths");

/**
 * Run the full analytics refresh pipeline.
 *
 * @param {FirebaseFirestore.Firestore} adminDb
 * @param {Object} [options]
 * @param {string} [options.periodType='daily'] - 'daily' | 'weekly' | 'monthly'
 * @param {string} [options.startDate] - Override start date
 * @param {string} [options.endDate] - Override end date
 * @returns {Object} Refresh summary
 */
async function runAnalyticsRefresh(adminDb, options = {}) {
    const startMs = Date.now();
    const periodType = options.periodType || PERIOD_TYPE.DAILY;
    const now = new Date();

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

    // 9. Log the refresh run
    const latencyMs = Date.now() - startMs;
    const refreshLog = {
        periodType,
        periodStart: currentStart,
        periodEnd: currentEnd,
        completedAt: new Date().toISOString(),
        latencyMs,
        snapshotWrites,
        riskFlagsGenerated: allFlags.length,
        recommendationsGenerated: recommendations.length,
        trendSummary,
        scorecardCount: Object.keys(scorecards).length,
        dataCounts: currentKpis.metadata.dataCounts,
    };

    await adminDb.collection(paths.ANALYTICS_REFRESH_LOGS).add(refreshLog);
    console.log(`[analyticsRefresh] Complete in ${latencyMs}ms. Flags: ${allFlags.length}, Recs: ${recommendations.length}`);

    return {
        success: true,
        ...refreshLog,
        globalKpis: currentKpis.global,
        trends: globalTrends,
        trendSummary,
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

    // Load latest snapshots
    const [globalSnapshot, userScores, routineScores, riskFlags, recommendations, refreshLogs] =
        await Promise.all([
            loadLatestSnapshot(adminDb, paths.OPERATIONAL_KPI_SNAPSHOTS, currentStart, periodType, "global"),
            loadLatestScores(adminDb, paths.USER_OPERATIONAL_SCORES, currentStart, periodType),
            loadLatestScores(adminDb, paths.ROUTINE_OPERATIONAL_SCORES, currentStart, periodType),
            loadActiveFlags(adminDb, currentStart),
            loadActiveRecommendations(adminDb, currentStart),
            loadRecentRefreshLogs(adminDb),
        ]);

    // Load previous for trends
    const previousGlobal = await loadLatestSnapshot(
        adminDb, paths.OPERATIONAL_KPI_SNAPSHOTS,
        periods.previous.start, periodType, "global"
    );

    const trends = globalSnapshot && previousGlobal
        ? computeTrends(globalSnapshot.metrics || {}, previousGlobal.metrics || {})
        : {};
    const trendSummary = summarizeTrends(trends);

    return {
        period: { start: currentStart, end: currentEnd, type: periodType },
        globalKpis: globalSnapshot?.metrics || {},
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

// ── Internal helpers ──

async function loadLatestSnapshot(adminDb, collection, periodStart, periodType, entityId) {
    const docId = `${periodStart}_${periodStart}_${periodType}_${entityId}`;
    const doc = await adminDb.collection(collection).doc(docId).get();
    if (doc.exists) return doc.data();

    // Fallback: query for any snapshot matching period
    const snap = await adminDb.collection(collection)
        .where("periodStart", "==", periodStart)
        .where("periodType", "==", periodType)
        .where("entityId", "==", entityId)
        .limit(1)
        .get();
    return snap.empty ? null : snap.docs[0].data();
}

async function loadLatestScores(adminDb, collection, periodStart, periodType) {
    const snap = await adminDb.collection(collection)
        .where("periodStart", "==", periodStart)
        .where("periodType", "==", periodType)
        .limit(50)
        .get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function loadActiveFlags(adminDb, periodStart) {
    const snap = await adminDb.collection(paths.OPERATIONAL_RISK_FLAGS)
        .where("periodStart", "==", periodStart)
        .limit(30)
        .get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function loadActiveRecommendations(adminDb, periodStart) {
    const snap = await adminDb.collection(paths.OPERATIONAL_RECOMMENDATIONS)
        .where("periodStart", "==", periodStart)
        .limit(20)
        .get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function loadRecentRefreshLogs(adminDb) {
    const snap = await adminDb.collection(paths.ANALYTICS_REFRESH_LOGS)
        .orderBy("completedAt", "desc")
        .limit(5)
        .get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
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
