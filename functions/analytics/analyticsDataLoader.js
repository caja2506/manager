/**
 * Analytics Data Loader — Backend (CJS)
 * ========================================
 * Centralized Firestore data fetching for the analytics engine.
 * Loads all operational data for a given date range.
 * Returns structured datasets for KPI calculators.
 */

const paths = require("../automation/firestorePaths");

/**
 * Get date string in YYYY-MM-DD for a Date object (Mexico City TZ).
 */
function toDateStr(d) {
    return d.toLocaleDateString("en-CA", { timeZone: "America/Mexico_City" });
}

/**
 * Build date range boundaries for queries.
 * @param {string} startDate - YYYY-MM-DD
 * @param {string} endDate - YYYY-MM-DD
 * @returns {{ startISO: string, endISO: string }}
 */
function dateRangeISO(startDate, endDate) {
    return {
        startISO: `${startDate}T00:00:00.000Z`,
        endISO: `${endDate}T23:59:59.999Z`,
    };
}

/**
 * Load all operational data for analytics calculations.
 *
 * @param {FirebaseFirestore.Firestore} adminDb
 * @param {string} startDate - YYYY-MM-DD
 * @param {string} endDate - YYYY-MM-DD
 * @returns {Promise<Object>} Structured datasets
 */
async function loadAnalyticsData(adminDb, startDate, endDate) {
    const { startISO, endISO } = dateRangeISO(startDate, endDate);

    const [
        runs,
        deliveries,
        reports,
        escalations,
        incidents,
        aiExecutions,
        users,
        routines,
        dailyMetrics,
    ] = await Promise.all([
        loadCollection(adminDb, paths.AUTOMATION_RUNS, "startedAt", startISO, endISO),
        loadCollection(adminDb, paths.TELEGRAM_DELIVERIES, "createdAt", startISO, endISO),
        loadCollection(adminDb, paths.TELEGRAM_REPORTS, "createdAt", startISO, endISO),
        loadCollection(adminDb, paths.TELEGRAM_ESCALATIONS, "createdAt", startISO, endISO),
        loadCollection(adminDb, paths.OPERATION_INCIDENTS, "createdAt", startISO, endISO),
        loadCollection(adminDb, paths.AI_EXECUTIONS, "executedAt", startISO, endISO),
        loadAllUsers(adminDb),
        loadAllRoutines(adminDb),
        loadDailyMetrics(adminDb, startDate, endDate),
    ]);

    return {
        runs,
        deliveries,
        reports,
        escalations,
        incidents,
        aiExecutions,
        users,
        routines,
        dailyMetrics,
        period: { startDate, endDate },
    };
}

/**
 * Load documents from a collection filtered by a timestamp field.
 */
async function loadCollection(adminDb, collectionPath, timestampField, startISO, endISO) {
    try {
        const snap = await adminDb.collection(collectionPath)
            .where(timestampField, ">=", startISO)
            .where(timestampField, "<=", endISO)
            .get();
        return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (err) {
        console.warn(`[analyticsDataLoader] Error loading ${collectionPath}:`, err.message);
        return [];
    }
}

/**
 * Load all users with automation participation.
 */
async function loadAllUsers(adminDb) {
    try {
        const snap = await adminDb.collection(paths.USERS).get();
        return snap.docs.map(d => ({
            id: d.id,
            name: d.data().displayName || d.data().name || "Unknown",
            email: d.data().email,
            operationalRole: d.data().operationalRole || d.data().teamRole || "unassigned",
            telegramChatId: d.data().telegramChatId || null,
            isAutomationParticipant: d.data().isAutomationParticipant || false,
        }));
    } catch (err) {
        console.warn("[analyticsDataLoader] Error loading users:", err.message);
        return [];
    }
}

/**
 * Load all automation routines.
 */
async function loadAllRoutines(adminDb) {
    try {
        const snap = await adminDb.collection(paths.AUTOMATION_ROUTINES).get();
        return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (err) {
        console.warn("[analyticsDataLoader] Error loading routines:", err.message);
        return [];
    }
}

/**
 * Load daily metrics for date range.
 */
async function loadDailyMetrics(adminDb, startDate, endDate) {
    try {
        const snap = await adminDb.collection(paths.AUTOMATION_METRICS_DAILY)
            .where("date", ">=", startDate)
            .where("date", "<=", endDate)
            .get();
        return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (err) {
        console.warn("[analyticsDataLoader] Error loading daily metrics:", err.message);
        return [];
    }
}

/**
 * Calculate date ranges for period comparisons.
 * @param {'daily'|'weekly'|'monthly'} periodType
 * @returns {{ current: {start, end}, previous: {start, end} }}
 */
function getPeriodDates(periodType) {
    const now = new Date();
    const today = toDateStr(now);

    if (periodType === "daily") {
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        const dayBefore = new Date(now);
        dayBefore.setDate(dayBefore.getDate() - 2);

        return {
            current: { start: today, end: today },
            previous: { start: toDateStr(yesterday), end: toDateStr(yesterday) },
        };
    }

    if (periodType === "weekly") {
        const weekAgo = new Date(now);
        weekAgo.setDate(weekAgo.getDate() - 6);
        const twoWeeksAgo = new Date(now);
        twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 13);
        const oneWeekAgo = new Date(now);
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

        return {
            current: { start: toDateStr(weekAgo), end: today },
            previous: { start: toDateStr(twoWeeksAgo), end: toDateStr(oneWeekAgo) },
        };
    }

    // monthly
    const monthAgo = new Date(now);
    monthAgo.setDate(monthAgo.getDate() - 29);
    const twoMonthsAgo = new Date(now);
    twoMonthsAgo.setDate(twoMonthsAgo.getDate() - 59);
    const oneMonthAgo = new Date(now);
    oneMonthAgo.setDate(oneMonthAgo.getDate() - 30);

    return {
        current: { start: toDateStr(monthAgo), end: today },
        previous: { start: toDateStr(twoMonthsAgo), end: toDateStr(oneMonthAgo) },
    };
}

module.exports = {
    loadAnalyticsData,
    getPeriodDates,
    toDateStr,
    dateRangeISO,
};
