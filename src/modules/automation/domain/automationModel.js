/**
 * Automation Domain Model
 * =======================
 * [Phase M.4] Ownership: AI governance, insights, management briefs,
 * AI executions, optimization engine, and all related factories.
 */

// ── Enums ──

export const AI_GOVERNANCE_TYPE = { RECOMMENDER: 'recommender', EXECUTOR_CONTROLLED: 'executor_controlled', EXECUTOR_AUTONOMOUS: 'executor_autonomous' };
export const AI_INSIGHT_TYPE = { TEAM_OVERLOAD: 'team_overload_report', ESTIMATION_DRIFT: 'estimation_drift', BOTTLENECK_ANALYSIS: 'bottleneck_analysis', RISK_ASSESSMENT: 'risk_assessment', WEEKLY_SUMMARY: 'weekly_summary' };
export const AI_EVENT_TYPE = { BRIEFING: 'briefing', EXTRACTION: 'extraction', RECOMMENDATION: 'recommendation', ESCALATION_HINT: 'escalation_hint', TRANSCRIPTION: 'transcription', ANALYSIS: 'analysis' };

export const AI_PROHIBITED_ACTIONS = [
    'change_task_dates', 'change_task_owner', 'change_user_roles',
    'close_complete_tasks', 'approve_deliverables', 'execute_workflow_transitions', 'modify_financial_data',
];

// ── Factories ──

export function createAIInsightDocument({
    scope = 'weekly', scopeRefId = 'department', type = AI_INSIGHT_TYPE.WEEKLY_SUMMARY,
    title = '', summary = '', recommendations = [], sourceDataRefs = [],
    confidence = 0, generatedBy = 'gemini', metadata = {},
} = {}) {
    return { scope, scopeRefId, type, title, summary, recommendations, sourceDataRefs, confidence, generatedBy, metadata, generatedAt: new Date().toISOString() };
}

export function createManagementBriefDocument({
    periodStart = '', periodEnd = '', summary = '', keyFindings = [], recommendedActions = [],
    metrics = { tasksCompleted: 0, tasksCreated: 0, totalHoursLogged: 0, overtimeHours: 0, delaysReported: 0, delaysResolved: 0, avgEstimationAccuracy: 0, methodologyScore: 0 },
    generatedBy = 'gemini', metadata = {},
} = {}) {
    return { periodStart, periodEnd, summary, keyFindings, recommendedActions, metrics, generatedBy, metadata, generatedAt: new Date().toISOString() };
}

export function createAiGovernanceDocument({
    name = '', type = AI_GOVERNANCE_TYPE.RECOMMENDER, description = '', module = '',
    canRecommend = true, canExecute = false, canModifyData = false, requiresHumanApproval = true,
    enabled = true, maxExecutionsPerDay = 50, totalExecutions = 0, lastExecutionAt = null, createdBy = null,
} = {}) {
    const now = new Date().toISOString();
    return {
        name, type, description, module, canRecommend, canExecute, canModifyData,
        requiresHumanApproval, enabled, maxExecutionsPerDay, totalExecutions, lastExecutionAt,
        createdBy, updatedBy: createdBy, createdAt: now, updatedAt: now,
    };
}

export function createAiExecutionDocument({
    routineKey = '', capability = '', targetUserId = null, model = '',
    inputTokens = 0, outputTokens = 0, durationMs = 0, status = 'success',
    errorMessage = null, metadata = {},
} = {}) {
    return { routineKey, capability, targetUserId, model, inputTokens, outputTokens, durationMs, status, errorMessage, metadata, executedAt: new Date().toISOString(), executedBy: 'system' };
}

export function createOptimizationOpportunityDocument({
    type = '', category = '', description = '', impact = '',
    estimatedGain = '', priority = 'medium', periodStart = '',
} = {}) {
    return { type, category, description, impact, estimatedGain, priority, periodStart, generatedAt: new Date().toISOString(), generatedBy: 'system' };
}

export function createOptimizationSimulationDocument({
    opportunityId = null, scenarioType = '', parameters = {},
    baselineMetrics = {}, projectedMetrics = {}, estimatedGain = '', confidence = 0, periodStart = '',
} = {}) {
    return { opportunityId, scenarioType, parameters, baselineMetrics, projectedMetrics, estimatedGain, confidence, periodStart, generatedAt: new Date().toISOString(), generatedBy: 'system' };
}

export function createOperationalPlanDocument({
    periodType = 'daily', periodStart = '', periodEnd = '',
    recommendations = [], assignedTasks = [], expectedOutcomes = {}, status = 'draft',
} = {}) {
    return { periodType, periodStart, periodEnd, recommendations, assignedTasks, expectedOutcomes, status, generatedAt: new Date().toISOString(), generatedBy: 'system' };
}

export function createAppliedRecommendationDocument({
    recommendationId = '', opportunityId = null, type = '', description = '',
    appliedBy = null, beforeMetrics = {}, afterMetrics = {}, actualGain = '', status = 'applied',
} = {}) {
    return { recommendationId, opportunityId, type, description, appliedBy, beforeMetrics, afterMetrics, actualGain, status, appliedAt: new Date().toISOString() };
}

export function createOptimizationHistoryDocument({
    periodType = 'daily', periodStart = '', engineVersion = '4.4',
    opportunitiesFound = 0, simulationsRun = 0, recommendationsGenerated = 0,
    durationMs = 0, status = 'success', errors = [],
} = {}) {
    return { periodType, periodStart, engineVersion, opportunitiesFound, simulationsRun, recommendationsGenerated, durationMs, status, errors, executedAt: new Date().toISOString(), executedBy: 'system' };
}
