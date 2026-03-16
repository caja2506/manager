/**
 * KPI Calculators — Backend (CJS)
 * ==================================
 * Pure functions that compute individual KPI values.
 * Each returns { value, numerator, denominator, source }
 * for full auditability.
 *
 * Operates on pre-fetched data arrays — NO Firestore calls.
 */

const { KPI_NAME } = require("./analyticsConstants");

/**
 * Safe division: returns 0 when denominator is 0.
 */
function safeRate(numerator, denominator) {
    if (!denominator || denominator === 0) return 0;
    return Math.round((numerator / denominator) * 10000) / 10000; // 4 decimal precision
}

/**
 * Build a standard KPI result object.
 */
function kpiResult(value, numerator, denominator, source) {
    return { value, numerator, denominator, source };
}

// ── Calculator functions ──

function calcResponseRate(data, filters = {}) {
    const deliveries = filterByEntity(data.deliveries, filters).filter(d => d.direction === "outbound");
    const responded = deliveries.filter(d => d.responded === true || d.responseReceived === true);
    return kpiResult(
        safeRate(responded.length, deliveries.length),
        responded.length,
        deliveries.length,
        "telegramDeliveries"
    );
}

function calcOnTimeResponseRate(data, filters = {}) {
    const reports = filterByEntity(data.reports, filters);
    const onTime = reports.filter(r => !r.isLate && r.isLate !== undefined);
    const withTimingData = reports.filter(r => r.isLate !== undefined);
    // Fallback: if no isLate field, use all reports as on-time
    const denom = withTimingData.length || reports.length;
    const num = withTimingData.length ? onTime.length : reports.length;
    return kpiResult(safeRate(num, denom), num, denom, "telegramReports");
}

function calcLateResponseRate(data, filters = {}) {
    const reports = filterByEntity(data.reports, filters);
    const late = reports.filter(r => r.isLate === true);
    const withTimingData = reports.filter(r => r.isLate !== undefined);
    const denom = withTimingData.length || reports.length;
    return kpiResult(safeRate(late.length, denom), late.length, denom, "telegramReports");
}

function calcEscalationRate(data, filters = {}) {
    const deliveries = filterByEntity(data.deliveries, filters).filter(d => d.direction === "outbound");
    const escalations = filterByEntity(data.escalations, filters);
    return kpiResult(
        safeRate(escalations.length, deliveries.length),
        escalations.length,
        deliveries.length,
        "telegramEscalations + telegramDeliveries"
    );
}

function calcIncidentRate(data, filters = {}) {
    const incidents = filterByEntity(data.incidents, filters);
    const activeUsers = data.users.filter(u => u.isAutomationParticipant);
    return kpiResult(
        safeRate(incidents.length, activeUsers.length),
        incidents.length,
        activeUsers.length,
        "operationIncidents + users"
    );
}

function calcReportCompletionRate(data, filters = {}) {
    const reports = filterByEntity(data.reports, filters);
    // Expected = runs of report-type routines × target users
    const reportRuns = data.runs.filter(r =>
        r.routineKey?.includes("report") || r.routineKey?.includes("digest")
    );
    const expected = Math.max(reportRuns.length, 1); // At least 1 to avoid division by 0
    return kpiResult(
        safeRate(reports.length, expected),
        reports.length,
        expected,
        "telegramReports + automationRuns"
    );
}

function calcRoutineSuccessRate(data, filters = {}) {
    const runs = filterByRoutine(data.runs, filters);
    const successful = runs.filter(r => r.status === "completed" || r.status === "success");
    return kpiResult(
        safeRate(successful.length, runs.length),
        successful.length,
        runs.length,
        "automationRuns"
    );
}

function calcAIAssistedRate(data, filters = {}) {
    const reports = filterByEntity(data.reports, filters);
    const aiReports = reports.filter(r =>
        r.source === "ai" || r.aiProcessed === true || r.inputType?.includes("ai")
    );
    return kpiResult(
        safeRate(aiReports.length, reports.length),
        aiReports.length,
        reports.length,
        "telegramReports"
    );
}

function calcConfirmationRequestRate(data) {
    const aiExecs = data.aiExecutions;
    const confirms = aiExecs.filter(e => e.confidenceAction === "confirm");
    return kpiResult(
        safeRate(confirms.length, aiExecs.length),
        confirms.length,
        aiExecs.length,
        "aiExecutions"
    );
}

function calcAudioUsageRate(data, filters = {}) {
    const reports = filterByEntity(data.reports, filters);
    const audioReports = reports.filter(r =>
        r.inputType === "audio" || r.inputType === "audio_ai"
    );
    return kpiResult(
        safeRate(audioReports.length, reports.length),
        audioReports.length,
        reports.length,
        "telegramReports"
    );
}

function calcDeliveryFailureRate(data) {
    const allDeliveries = data.deliveries;
    const failed = allDeliveries.filter(d =>
        d.status === "failed" || d.deliveryFailed === true
    );
    return kpiResult(
        safeRate(failed.length, allDeliveries.length),
        failed.length,
        allDeliveries.length,
        "telegramDeliveries"
    );
}

function calcActiveParticipationRate(data, filters = {}) {
    const participants = data.users.filter(u => u.isAutomationParticipant);
    if (filters.role) {
        const roleParticipants = participants.filter(u => u.operationalRole === filters.role);
        const activeUserIds = new Set();
        data.deliveries.filter(d => d.userId && roleParticipants.find(u => u.id === d.userId))
            .forEach(d => activeUserIds.add(d.userId));
        data.reports.filter(r => r.userId && roleParticipants.find(u => u.id === r.userId))
            .forEach(r => activeUserIds.add(r.userId));
        return kpiResult(
            safeRate(activeUserIds.size, roleParticipants.length),
            activeUserIds.size,
            roleParticipants.length,
            "users + telegramDeliveries + telegramReports"
        );
    }

    const activeUserIds = new Set();
    data.deliveries.forEach(d => { if (d.userId) activeUserIds.add(d.userId); });
    data.reports.forEach(r => { if (r.userId) activeUserIds.add(r.userId); });
    // Also count by chatId for unlinked users
    data.deliveries.forEach(d => { if (d.chatId) activeUserIds.add(`chat_${d.chatId}`); });

    return kpiResult(
        safeRate(activeUserIds.size, participants.length || 1),
        activeUserIds.size,
        participants.length || 1,
        "users + telegramDeliveries + telegramReports"
    );
}

// ── Filter helpers ──

function filterByEntity(items, filters) {
    let result = items;
    if (filters.userId) {
        result = result.filter(i => i.userId === filters.userId || i.chatId === filters.userId);
    }
    if (filters.role) {
        // Need user lookup — return all and let caller handle
        // For now, filter by userId from role mapping
    }
    if (filters.channel) {
        result = result.filter(i => i.channel === filters.channel || i.provider === filters.channel);
    }
    return result;
}

function filterByRoutine(items, filters) {
    let result = items;
    if (filters.routineKey) {
        result = result.filter(i => i.routineKey === filters.routineKey);
    }
    return result;
}

// ── Calculator registry ──

const CALCULATORS = {
    [KPI_NAME.RESPONSE_RATE]: calcResponseRate,
    [KPI_NAME.ON_TIME_RESPONSE_RATE]: calcOnTimeResponseRate,
    [KPI_NAME.LATE_RESPONSE_RATE]: calcLateResponseRate,
    [KPI_NAME.ESCALATION_RATE]: calcEscalationRate,
    [KPI_NAME.INCIDENT_RATE]: calcIncidentRate,
    [KPI_NAME.REPORT_COMPLETION_RATE]: calcReportCompletionRate,
    [KPI_NAME.ROUTINE_SUCCESS_RATE]: calcRoutineSuccessRate,
    [KPI_NAME.AI_ASSISTED_RATE]: calcAIAssistedRate,
    [KPI_NAME.CONFIRMATION_REQUEST_RATE]: calcConfirmationRequestRate,
    [KPI_NAME.AUDIO_USAGE_RATE]: calcAudioUsageRate,
    [KPI_NAME.DELIVERY_FAILURE_RATE]: calcDeliveryFailureRate,
    [KPI_NAME.ACTIVE_PARTICIPATION_RATE]: calcActiveParticipationRate,
};

/**
 * Calculate a single KPI.
 * @param {string} kpiName
 * @param {Object} data - Pre-loaded analytics data
 * @param {Object} [filters] - { userId, role, routineKey, channel }
 * @returns {{ value, numerator, denominator, source }}
 */
function calculateKpi(kpiName, data, filters = {}) {
    const calculator = CALCULATORS[kpiName];
    if (!calculator) {
        console.warn(`[kpiCalculators] No calculator for: ${kpiName}`);
        return kpiResult(0, 0, 0, "unknown");
    }
    try {
        return calculator(data, filters);
    } catch (err) {
        console.error(`[kpiCalculators] Error calculating ${kpiName}:`, err.message);
        return kpiResult(0, 0, 0, `error: ${err.message}`);
    }
}

/**
 * Calculate all KPIs.
 */
function calculateAllKpis(data, filters = {}) {
    const results = {};
    for (const kpiName of Object.values(KPI_NAME)) {
        results[kpiName] = calculateKpi(kpiName, data, filters);
    }
    return results;
}

module.exports = { calculateKpi, calculateAllKpis, CALCULATORS, safeRate };
