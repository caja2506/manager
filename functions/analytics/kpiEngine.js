/**
 * KPI Engine — Backend (CJS)
 * ============================
 * Core orchestrator: loads data, calculates KPIs at multiple
 * aggregation levels (global, per-user, per-role, per-routine).
 */

const { calculateAllKpis, calculateKpi } = require("./kpiCalculators");
const { KPI_NAME, ENTITY_TYPE } = require("./analyticsConstants");

/**
 * Compute all KPIs at the global level.
 * @param {Object} data - Pre-loaded analytics data from analyticsDataLoader
 * @returns {Object} { kpiName: { value, numerator, denominator, source } }
 */
function computeGlobalKpis(data) {
    return calculateAllKpis(data);
}

/**
 * Compute KPIs per user.
 * @param {Object} data
 * @returns {Object} { userId: { kpis: {...}, userName, userRole } }
 */
function computeUserKpis(data) {
    const participants = data.users.filter(u => u.isAutomationParticipant);
    const results = {};

    for (const user of participants) {
        const filters = { userId: user.id };
        const kpis = {};

        // User-level KPIs
        const userKpiNames = [
            KPI_NAME.RESPONSE_RATE,
            KPI_NAME.ON_TIME_RESPONSE_RATE,
            KPI_NAME.LATE_RESPONSE_RATE,
            KPI_NAME.ESCALATION_RATE,
            KPI_NAME.REPORT_COMPLETION_RATE,
            KPI_NAME.AUDIO_USAGE_RATE,
        ];

        for (const kpiName of userKpiNames) {
            kpis[kpiName] = calculateKpi(kpiName, data, filters);
        }

        results[user.id] = {
            kpis,
            userName: user.name,
            userRole: user.operationalRole,
            userEmail: user.email,
        };
    }

    return results;
}

/**
 * Compute KPIs per role.
 * @param {Object} data
 * @returns {Object} { role: { kpis: {...}, userCount } }
 */
function computeRoleKpis(data) {
    const roles = [...new Set(data.users.map(u => u.operationalRole).filter(Boolean))];
    const results = {};

    for (const role of roles) {
        const roleUsers = data.users.filter(u => u.operationalRole === role);
        const roleUserIds = new Set(roleUsers.map(u => u.id));

        // Create filtered data subset for this role
        const roleData = {
            ...data,
            deliveries: data.deliveries.filter(d => roleUserIds.has(d.userId)),
            reports: data.reports.filter(r => roleUserIds.has(r.userId)),
            escalations: data.escalations.filter(e => roleUserIds.has(e.userId)),
            incidents: data.incidents.filter(i => roleUserIds.has(i.userId)),
            users: roleUsers,
        };

        results[role] = {
            kpis: calculateAllKpis(roleData),
            userCount: roleUsers.length,
        };
    }

    return results;
}

/**
 * Compute KPIs per routine.
 * @param {Object} data
 * @returns {Object} { routineKey: { kpis: {...}, routineName, totalRuns } }
 */
function computeRoutineKpis(data) {
    const results = {};

    for (const routine of data.routines) {
        const routineKey = routine.key || routine.id;
        const filters = { routineKey };

        const routineRuns = data.runs.filter(r => r.routineKey === routineKey);
        const successRate = calculateKpi(KPI_NAME.ROUTINE_SUCCESS_RATE, data, filters);

        // Routine-level escalations
        const routineEscalations = data.escalations.filter(e => e.routineKey === routineKey);
        const routineDeliveries = data.deliveries.filter(d => d.routineKey === routineKey);

        results[routineKey] = {
            kpis: {
                [KPI_NAME.ROUTINE_SUCCESS_RATE]: successRate,
                escalationCount: routineEscalations.length,
                deliveryCount: routineDeliveries.length,
            },
            routineName: routine.name || routineKey,
            totalRuns: routineRuns.length,
            enabled: routine.enabled !== false,
        };
    }

    return results;
}

/**
 * Run the full KPI computation pipeline.
 * @param {Object} data - Analytics data from analyticsDataLoader
 * @returns {Object} Complete KPI results at all aggregation levels
 */
function runKpiEngine(data) {
    const startMs = Date.now();

    const global = computeGlobalKpis(data);
    const byUser = computeUserKpis(data);
    const byRole = computeRoleKpis(data);
    const byRoutine = computeRoutineKpis(data);

    const latencyMs = Date.now() - startMs;

    return {
        global,
        byUser,
        byRole,
        byRoutine,
        metadata: {
            calculatedAt: new Date().toISOString(),
            period: data.period,
            latencyMs,
            dataCounts: {
                runs: data.runs.length,
                deliveries: data.deliveries.length,
                reports: data.reports.length,
                escalations: data.escalations.length,
                incidents: data.incidents.length,
                aiExecutions: data.aiExecutions.length,
                users: data.users.length,
                routines: data.routines.length,
            },
        },
    };
}

module.exports = {
    runKpiEngine,
    computeGlobalKpis,
    computeUserKpis,
    computeRoleKpis,
    computeRoutineKpis,
};
