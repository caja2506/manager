/**
 * Impact Tracker — Backend (CJS)
 * =================================
 * Tracks before/after metrics when recommendations are applied.
 * Evaluates whether changes actually improved operations.
 */

const { IMPACT_STATUS } = require("../analytics/analyticsConstants");
const paths = require("../automation/firestorePaths");

/**
 * Record a baseline snapshot before applying a recommendation.
 *
 * @param {FirebaseFirestore.Firestore} adminDb
 * @param {string} recommendationId
 * @param {Object} currentMetrics - key KPIs at time of application
 * @param {string} appliedBy - userId who applied it
 * @returns {string} Document ID
 */
async function recordBaseline(adminDb, recommendationId, currentMetrics, appliedBy) {
    const ref = adminDb.collection(paths.APPLIED_RECOMMENDATIONS).doc();
    await ref.set({
        recommendationId,
        appliedAt: new Date().toISOString(),
        appliedBy,
        baselineMetrics: sanitize(currentMetrics),
        currentMetrics: null,
        impactStatus: IMPACT_STATUS.PENDING,
        evaluatedAt: null,
        evaluation: null,
    });
    return ref.id;
}

/**
 * Measure impact after N days by comparing baseline vs new metrics.
 *
 * @param {FirebaseFirestore.Firestore} adminDb
 * @param {string} appliedRecId - applied recommendation doc ID
 * @param {Object} currentMetrics - current KPI values
 */
async function measureImpact(adminDb, appliedRecId, currentMetrics) {
    const ref = adminDb.collection(paths.APPLIED_RECOMMENDATIONS).doc(appliedRecId);
    const doc = await ref.get();
    if (!doc.exists) throw new Error(`Applied recommendation ${appliedRecId} not found`);

    const data = doc.data();
    const baseline = data.baselineMetrics || {};
    const evaluation = evaluateSuccess(baseline, currentMetrics);

    await ref.update({
        currentMetrics: sanitize(currentMetrics),
        impactStatus: evaluation.status,
        evaluatedAt: new Date().toISOString(),
        evaluation,
    });

    // Log to optimization history
    await adminDb.collection(paths.OPTIMIZATION_HISTORY).doc().set({
        action: "impact_measured",
        appliedRecId,
        recommendationId: data.recommendationId,
        baseline: sanitize(baseline),
        after: sanitize(currentMetrics),
        evaluation,
        timestamp: new Date().toISOString(),
    });

    return evaluation;
}

/**
 * Compare before and after metrics to determine outcome.
 *
 * @param {Object} before
 * @param {Object} after
 * @returns {{ status, improvements, regressions, details }}
 */
function evaluateSuccess(before, after) {
    const improvements = [];
    const regressions = [];
    const details = [];

    const higherBetter = [
        "responseRate", "onTimeResponseRate", "reportCompletionRate",
        "routineSuccessRate", "aiAssistedRate", "activeParticipationRate",
    ];
    const lowerBetter = [
        "lateResponseRate", "escalationRate", "incidentRate", "deliveryFailureRate",
    ];

    for (const metric of [...higherBetter, ...lowerBetter]) {
        const bVal = before[metric];
        const aVal = after[metric];
        if (bVal === undefined || bVal === null || aVal === undefined || aVal === null) continue;

        const isHigherBetter = higherBetter.includes(metric);
        const delta = aVal - bVal;
        const improved = isHigherBetter ? delta > 0.02 : delta < -0.02;
        const worsened = isHigherBetter ? delta < -0.02 : delta > 0.02;

        if (improved) improvements.push(metric);
        if (worsened) regressions.push(metric);

        details.push({
            metric,
            before: bVal,
            after: aVal,
            delta: parseFloat(delta.toFixed(4)),
            improved,
            worsened,
        });
    }

    let status;
    if (improvements.length > 0 && regressions.length === 0) {
        status = IMPACT_STATUS.IMPROVED;
    } else if (regressions.length > 0 && improvements.length === 0) {
        status = IMPACT_STATUS.WORSENED;
    } else if (improvements.length === 0 && regressions.length === 0) {
        status = IMPACT_STATUS.NO_CHANGE;
    } else {
        // Mixed — net positive if more improvements
        status = improvements.length >= regressions.length
            ? IMPACT_STATUS.IMPROVED
            : IMPACT_STATUS.WORSENED;
    }

    return {
        status,
        improvements,
        regressions,
        details,
        summary: `${improvements.length} KPIs mejoraron, ${regressions.length} empeoraron.`,
    };
}

/**
 * Get all pending impact measurements (for scheduled evaluation).
 */
async function getPendingMeasurements(adminDb) {
    const snap = await adminDb.collection(paths.APPLIED_RECOMMENDATIONS)
        .where("impactStatus", "==", IMPACT_STATUS.PENDING)
        .get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// Sanitize: remove undefined values
function sanitize(obj) {
    if (!obj) return {};
    const clean = {};
    for (const [k, v] of Object.entries(obj)) {
        if (v !== undefined) clean[k] = v;
    }
    return clean;
}

module.exports = {
    recordBaseline,
    measureImpact,
    evaluateSuccess,
    getPendingMeasurements,
};
