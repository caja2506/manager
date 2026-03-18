/**
 * Trend Calculator — V5 Phase 3F
 * =================================
 * Computes score trends from historical snapshots.
 * All functions are PURE — no Firestore access.
 *
 * @module core/scoring/trendCalculator
 */

/**
 * Default trend configuration.
 */
export const TREND_CONFIG = {
    WINDOW_DAYS: 7,          // Compare to snapshot from N days ago
    THRESHOLD: 5,            // Minimum change to count as improving/declining
    NOISE_FILTER_HOURS: 48,  // Ignore snapshots within this window of each other
};

/**
 * Compute trend for a single score value.
 *
 * @param {number} currentScore - Current computed score
 * @param {Array<{ capturedAt: string, milestoneScore: number }>} snapshots - Historical snapshots, newest first
 * @param {Object} [config] - Override trend config
 * @returns {'improving' | 'stable' | 'declining'}
 */
export function computeTrend(currentScore, snapshots, config = TREND_CONFIG) {
    if (!snapshots || snapshots.length === 0) return 'stable';

    // Find the comparison snapshot (closest to WINDOW_DAYS ago)
    const now = new Date();
    const targetDate = new Date(now.getTime() - config.WINDOW_DAYS * 24 * 60 * 60 * 1000);

    // Filter out snapshots too close together (noise filter)
    const filtered = filterNoise(snapshots, config.NOISE_FILTER_HOURS);
    if (filtered.length === 0) return 'stable';

    // Find snapshot closest to target date
    const comparison = findClosestSnapshot(filtered, targetDate);
    if (!comparison) return 'stable';

    const delta = currentScore - comparison.milestoneScore;

    if (delta > config.THRESHOLD) return 'improving';
    if (delta < -config.THRESHOLD) return 'declining';
    return 'stable';
}

/**
 * Compute trends for each area in a milestone.
 *
 * @param {Array<{ areaId: string, score: number }>} currentAreaScores
 * @param {Array<{ capturedAt: string, areaScores: Array<{ areaId: string, score: number }> }>} snapshots
 * @param {Object} [config]
 * @returns {Object<string, 'improving' | 'stable' | 'declining'>} Map of areaId → trend
 */
export function computeAreaTrends(currentAreaScores, snapshots, config = TREND_CONFIG) {
    const trends = {};

    if (!currentAreaScores || !snapshots || snapshots.length === 0) {
        for (const area of (currentAreaScores || [])) {
            trends[area.areaId] = 'stable';
        }
        return trends;
    }

    // Get comparison snapshot
    const now = new Date();
    const targetDate = new Date(now.getTime() - config.WINDOW_DAYS * 24 * 60 * 60 * 1000);
    const filtered = filterNoise(snapshots, config.NOISE_FILTER_HOURS);
    const comparison = findClosestSnapshot(filtered, targetDate);

    for (const area of currentAreaScores) {
        if (!comparison?.areaScores) {
            trends[area.areaId] = 'stable';
            continue;
        }

        const prevArea = comparison.areaScores.find(a => a.areaId === area.areaId);
        if (!prevArea) {
            trends[area.areaId] = 'stable';
            continue;
        }

        const delta = area.score - prevArea.score;
        if (delta > config.THRESHOLD) trends[area.areaId] = 'improving';
        else if (delta < -config.THRESHOLD) trends[area.areaId] = 'declining';
        else trends[area.areaId] = 'stable';
    }

    return trends;
}

/**
 * Generate a short change reason for a snapshot.
 *
 * @param {number} previousScore
 * @param {number} currentScore
 * @param {string[]} currentLocks
 * @param {{ key: string, deduction: number }[]} currentPenalties
 * @returns {string} Human-readable change reason
 */
export function generateChangeReason(previousScore, currentScore, currentLocks = [], currentPenalties = []) {
    const delta = currentScore - previousScore;

    if (Math.abs(delta) < 2) return 'Sin cambio significativo';

    const parts = [];

    if (delta > 0) {
        parts.push(`↑ +${delta} pts`);
    } else {
        parts.push(`↓ ${delta} pts`);
    }

    if (currentPenalties.length > 0) {
        parts.push(`Penalizaciones: ${currentPenalties.map(p => p.key).join(', ')}`);
    }

    if (currentLocks.length > 0) {
        parts.push(`Locks: ${currentLocks.join(', ')}`);
    }

    return parts.join(' | ');
}


// ── Internal Helpers ──

function filterNoise(snapshots, noiseFilterHours) {
    if (snapshots.length <= 1) return snapshots;

    const filtered = [snapshots[0]];
    for (let i = 1; i < snapshots.length; i++) {
        const prev = new Date(filtered[filtered.length - 1].capturedAt);
        const curr = new Date(snapshots[i].capturedAt);
        const hoursDiff = Math.abs(prev - curr) / (1000 * 60 * 60);
        if (hoursDiff >= noiseFilterHours) {
            filtered.push(snapshots[i]);
        }
    }
    return filtered;
}

function findClosestSnapshot(snapshots, targetDate) {
    let closest = null;
    let minDiff = Infinity;

    for (const snap of snapshots) {
        const diff = Math.abs(new Date(snap.capturedAt) - targetDate);
        if (diff < minDiff) {
            minDiff = diff;
            closest = snap;
        }
    }

    return closest;
}
