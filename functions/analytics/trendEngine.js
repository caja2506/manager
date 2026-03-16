/**
 * Trend Engine — Backend (CJS)
 * ===============================
 * Compares current KPI snapshot vs previous period.
 * Produces delta values and trend direction.
 */

const { TREND_DIRECTION, TREND_STABLE_THRESHOLD, KPI_POLARITY } = require("./analyticsConstants");

/**
 * Compare two KPI result sets and produce trend analysis.
 *
 * @param {Object} currentKpis - { kpiName: { value, ... } }
 * @param {Object} previousKpis - { kpiName: { value, ... } } (can be null)
 * @returns {Object} { kpiName: { current, previous, delta, direction, isImproving } }
 */
function computeTrends(currentKpis, previousKpis) {
    const trends = {};

    for (const [kpiName, current] of Object.entries(currentKpis)) {
        const currentVal = typeof current === "object" ? (current.value ?? 0) : (current ?? 0);
        const prev = previousKpis?.[kpiName];
        const prevVal = prev ? (typeof prev === "object" ? (prev.value ?? 0) : (prev ?? 0)) : null;

        if (prevVal === null || prevVal === undefined) {
            trends[kpiName] = {
                current: currentVal,
                previous: null,
                delta: null,
                direction: TREND_DIRECTION.STABLE,
                isImproving: null,
                hasHistory: false,
            };
            continue;
        }

        const delta = currentVal - prevVal;
        const absDelta = Math.abs(delta);
        const polarity = KPI_POLARITY[kpiName] || "neutral";

        let direction;
        if (absDelta <= TREND_STABLE_THRESHOLD) {
            direction = TREND_DIRECTION.STABLE;
        } else if (delta > 0) {
            direction = TREND_DIRECTION.UP;
        } else {
            direction = TREND_DIRECTION.DOWN;
        }

        let isImproving = null;
        if (polarity === "higher") {
            isImproving = delta > TREND_STABLE_THRESHOLD;
        } else if (polarity === "lower") {
            isImproving = delta < -TREND_STABLE_THRESHOLD;
        }

        trends[kpiName] = {
            current: currentVal,
            previous: prevVal,
            delta: Math.round(delta * 10000) / 10000,
            deltaPercent: prevVal !== 0 ? Math.round((delta / prevVal) * 100) : null,
            direction,
            isImproving,
            hasHistory: true,
        };
    }

    return trends;
}

/**
 * Summarize overall trend: how many KPIs improving vs deteriorating.
 */
function summarizeTrends(trends) {
    const entries = Object.values(trends).filter(t => t.hasHistory && t.isImproving !== null);
    const improving = entries.filter(t => t.isImproving === true).length;
    const deteriorating = entries.filter(t => t.isImproving === false).length;
    const stable = entries.filter(t => t.direction === TREND_DIRECTION.STABLE).length;

    return {
        improving,
        deteriorating,
        stable,
        total: entries.length,
        overallDirection: improving > deteriorating ? "improving"
            : deteriorating > improving ? "deteriorating"
                : "stable",
    };
}

module.exports = { computeTrends, summarizeTrends };
