/**
 * Trend Calculator
 * ================
 * 
 * Computes trends and deltas between analytics snapshots.
 * Used to show improvement/degradation over time.
 */

// ============================================================
// TREND DIRECTION
// ============================================================

export const TREND_DIRECTION = {
    UP: 'up',
    DOWN: 'down',
    STABLE: 'stable',
};

// ============================================================
// TREND CALCULATORS
// ============================================================

/**
 * Calculate the trend between two values.
 * 
 * @param {number} current - Current value
 * @param {number} previous - Previous value
 * @param {Object} [options] - { higherIsBetter = true, threshold = 5 }
 * @returns {Object} { direction, delta, deltaPercent, sentiment }
 */
export function calculateTrend(current, previous, options = {}) {
    const { higherIsBetter = true, threshold = 5 } = options;

    if (previous === null || previous === undefined || current === null || current === undefined) {
        return { direction: TREND_DIRECTION.STABLE, delta: 0, deltaPercent: 0, sentiment: 'neutral' };
    }

    const delta = current - previous;
    const deltaPercent = previous !== 0 ? parseFloat(((delta / previous) * 100).toFixed(1)) : 0;

    let direction = TREND_DIRECTION.STABLE;
    if (Math.abs(deltaPercent) >= threshold) {
        direction = delta > 0 ? TREND_DIRECTION.UP : TREND_DIRECTION.DOWN;
    }

    // Sentiment: is this trend good or bad?
    let sentiment = 'neutral';
    if (direction !== TREND_DIRECTION.STABLE) {
        if (higherIsBetter) {
            sentiment = direction === TREND_DIRECTION.UP ? 'positive' : 'negative';
        } else {
            sentiment = direction === TREND_DIRECTION.DOWN ? 'positive' : 'negative';
        }
    }

    return { direction, delta, deltaPercent, sentiment };
}

/**
 * Calculate trends for a set of metrics between two snapshots.
 * 
 * @param {Object} currentMetrics - Current snapshot metrics
 * @param {Object} previousMetrics - Previous snapshot metrics
 * @returns {Object} Trend data for each metric
 */
export function calculateMetricTrends(currentMetrics, previousMetrics) {
    if (!previousMetrics) {
        return {
            hasPreviousData: false,
            trends: {},
        };
    }

    const trendConfig = {
        // Higher is better
        weeklyVelocity: { higherIsBetter: true },
        completedTasks: { higherIsBetter: true },
        onTimeDeliveryRate: { higherIsBetter: true },
        weeklyHoursLogged: { higherIsBetter: true },

        // Lower is better
        blockedTasks: { higherIsBetter: false },
        activeDelays: { higherIsBetter: false },
        weeklyOvertime: { higherIsBetter: false },

        // Compliance scores (higher is better)
        'complianceScores.methodologyCompliance': { higherIsBetter: true },
        'complianceScores.planningReliability': { higherIsBetter: true },
        'complianceScores.estimationAccuracy': { higherIsBetter: true },
        'complianceScores.dataDiscipline': { higherIsBetter: true },
        'complianceScores.projectHealth': { higherIsBetter: true },
    };

    const trends = {};

    for (const [key, config] of Object.entries(trendConfig)) {
        const current = getNestedValue(currentMetrics, key);
        const previous = getNestedValue(previousMetrics, key);
        if (current !== undefined && current !== null) {
            trends[key] = calculateTrend(current, previous, config);
        }
    }

    return { hasPreviousData: true, trends };
}

/**
 * Build a trend summary from multiple snapshots (daily/weekly).
 * 
 * @param {Array} snapshots - Ordered array of snapshots (oldest first)
 * @param {string} metricKey - Key to track (e.g., 'weeklyVelocity')
 * @returns {Object} { values, labels, trend }
 */
export function buildTrendSeries(snapshots, metricKey) {
    const values = snapshots.map(s => getNestedValue(s.metrics, metricKey) ?? 0);
    const labels = snapshots.map(s => s.snapshotDate);

    const first = values[0];
    const last = values[values.length - 1];
    const trend = values.length >= 2
        ? calculateTrend(last, first, { higherIsBetter: true })
        : { direction: TREND_DIRECTION.STABLE, delta: 0, deltaPercent: 0, sentiment: 'neutral' };

    return { values, labels, trend };
}

// ============================================================
// HELPERS
// ============================================================

function getNestedValue(obj, path) {
    return path.split('.').reduce((current, key) => current?.[key], obj);
}
