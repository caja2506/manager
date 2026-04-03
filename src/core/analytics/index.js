/**
 * Analytics Module — Barrel Export
 * ================================
 */

export { buildDepartmentSnapshot, buildProjectSnapshot, buildUserSnapshot } from './snapshotBuilder';
export { TREND_DIRECTION, calculateTrend, calculateMetricTrends, buildTrendSeries } from './trendCalculator';
export {
    UTILIZATION_LEVEL, UTILIZATION_CONFIG,
    calculateMemberUtilization, calculateTeamUtilization,
    getUtilizationLevel,
} from './teamUtilization';
export {
    IPS_LEVEL, IPS_LEVEL_CODE, IPS_LEVEL_CONFIG, DEFAULT_WEIGHTS,
    calculateIndividualScore, calculateTeamScores, buildRawMetrics,
} from './performanceScore';

