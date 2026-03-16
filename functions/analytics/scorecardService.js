/**
 * Scorecard Service — Backend (CJS)
 * ====================================
 * Builds role-specific scorecards from user KPI data.
 * Applies role-relevant KPI weighting.
 */

const { KPI_NAME } = require("./analyticsConstants");

// Role-specific KPI weights (which KPIs matter most per role)
const ROLE_KPI_WEIGHTS = {
    technician: {
        [KPI_NAME.RESPONSE_RATE]: 0.25,
        [KPI_NAME.ON_TIME_RESPONSE_RATE]: 0.25,
        [KPI_NAME.REPORT_COMPLETION_RATE]: 0.20,
        [KPI_NAME.ESCALATION_RATE]: 0.15,
        [KPI_NAME.AUDIO_USAGE_RATE]: 0.05,
        [KPI_NAME.LATE_RESPONSE_RATE]: 0.10,
    },
    engineer: {
        [KPI_NAME.RESPONSE_RATE]: 0.20,
        [KPI_NAME.ON_TIME_RESPONSE_RATE]: 0.20,
        [KPI_NAME.REPORT_COMPLETION_RATE]: 0.25,
        [KPI_NAME.ESCALATION_RATE]: 0.15,
        [KPI_NAME.INCIDENT_RATE]: 0.10,
        [KPI_NAME.LATE_RESPONSE_RATE]: 0.10,
    },
    teamLead: {
        [KPI_NAME.RESPONSE_RATE]: 0.15,
        [KPI_NAME.ESCALATION_RATE]: 0.25,
        [KPI_NAME.INCIDENT_RATE]: 0.20,
        [KPI_NAME.ACTIVE_PARTICIPATION_RATE]: 0.20,
        [KPI_NAME.REPORT_COMPLETION_RATE]: 0.20,
    },
    manager: {
        [KPI_NAME.ACTIVE_PARTICIPATION_RATE]: 0.20,
        [KPI_NAME.ESCALATION_RATE]: 0.20,
        [KPI_NAME.INCIDENT_RATE]: 0.15,
        [KPI_NAME.ROUTINE_SUCCESS_RATE]: 0.15,
        [KPI_NAME.REPORT_COMPLETION_RATE]: 0.15,
        [KPI_NAME.AI_ASSISTED_RATE]: 0.15,
    },
};

// Default weights if role not matched
const DEFAULT_WEIGHTS = {
    [KPI_NAME.RESPONSE_RATE]: 0.20,
    [KPI_NAME.ON_TIME_RESPONSE_RATE]: 0.20,
    [KPI_NAME.REPORT_COMPLETION_RATE]: 0.20,
    [KPI_NAME.ESCALATION_RATE]: 0.15,
    [KPI_NAME.INCIDENT_RATE]: 0.10,
    [KPI_NAME.LATE_RESPONSE_RATE]: 0.15,
};

/**
 * Build a scorecard for a single user.
 *
 * @param {Object} userKpiData - { kpis: {...}, userName, userRole }
 * @returns {Object} Scorecard with composite score and per-KPI breakdown
 */
function buildUserScorecard(userKpiData) {
    const { kpis, userName, userRole } = userKpiData;
    const weights = ROLE_KPI_WEIGHTS[userRole] || DEFAULT_WEIGHTS;

    let compositeScore = 0;
    let totalWeight = 0;
    const breakdown = [];

    for (const [kpiName, weight] of Object.entries(weights)) {
        const kpi = kpis[kpiName];
        if (!kpi) continue;

        const rawValue = typeof kpi === "object" ? (kpi.value ?? 0) : (kpi ?? 0);

        // Normalize: for "lower is better" KPIs, invert the score
        const polarity = getPolarity(kpiName);
        const normalizedValue = polarity === "lower" ? (1 - rawValue) : rawValue;
        const weightedValue = normalizedValue * weight;

        compositeScore += weightedValue;
        totalWeight += weight;

        breakdown.push({
            kpiName,
            rawValue,
            normalizedValue,
            weight,
            weightedContribution: weightedValue,
        });
    }

    // Normalize composite score to 0-100
    const finalScore = totalWeight > 0
        ? Math.round((compositeScore / totalWeight) * 100)
        : 0;

    return {
        userName,
        userRole,
        compositeScore: finalScore,
        grade: scoreToGrade(finalScore),
        breakdown,
        kpiCount: breakdown.length,
    };
}

/**
 * Build scorecards for all users.
 */
function buildAllScorecards(userKpiResults) {
    const scorecards = {};
    for (const [userId, userData] of Object.entries(userKpiResults)) {
        scorecards[userId] = buildUserScorecard(userData);
    }
    return scorecards;
}

/**
 * Convert numeric score to letter grade.
 */
function scoreToGrade(score) {
    if (score >= 90) return "A";
    if (score >= 80) return "B";
    if (score >= 70) return "C";
    if (score >= 60) return "D";
    return "F";
}

function getPolarity(kpiName) {
    const lower = ["lateResponseRate", "escalationRate", "incidentRate", "deliveryFailureRate"];
    return lower.includes(kpiName) ? "lower" : "higher";
}

module.exports = { buildUserScorecard, buildAllScorecards, ROLE_KPI_WEIGHTS, scoreToGrade };
