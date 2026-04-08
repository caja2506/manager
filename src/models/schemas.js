/**
 * Firestore Collection Schemas — BRIDGE FILE
 * ===========================================
 * [Phase M.4] This file is now a COMPATIBILITY BRIDGE.
 *
 * The actual model ownership has been moved to domain-specific files:
 *   - src/modules/common/domain/collections.js    (COLLECTIONS, LEGACY_FIELDS, DEFAULT_SETTINGS)
 *   - src/modules/tasks/domain/taskModel.js        (task/project/risk/delay enums + factories)
 *   - src/modules/planning/domain/planningModel.js (milestone/workArea/traffic light + factories)
 *   - src/modules/team/domain/teamModel.js         (roles/notifications + factories)
 *   - src/modules/analytics/domain/analyticsModel.js (audit/analytics + factories)
 *   - src/modules/automation/domain/automationModel.js (AI/optimization + factories)
 *
 * This file re-exports everything for backward compatibility.
 * Existing imports from 'models/schemas' continue to work unchanged.
 */

// ── Common / Shared ──
export {
    COLLECTIONS,
    LEGACY_FIELDS,
    DEFAULT_SETTINGS,
    createSettingDocument,
} from '../modules/common/domain/collections';

// ── Team Domain ──
export {
    TEAM_ROLES,
    RBAC_ROLES,
    NOTIFICATION_TYPE,
    createUserDocument,
    createNotificationDocument,
} from '../modules/team/domain/teamModel';

// ── Tasks Domain ──
export {
    TASK_STATUS,
    TASK_STATUS_CONFIG,
    TASK_PRIORITY,
    TASK_PRIORITY_CONFIG,
    PROJECT_STATUS,
    PROJECT_STATUS_CONFIG,
    RISK_LEVEL,
    RISK_LEVEL_CONFIG,
    DELAY_CAUSE_TYPE,
    DELAY_CAUSE_TYPE_CONFIG,
    RISK_TYPE,
    RISK_TYPE_CONFIG,
    DEFAULT_RISK_WEIGHTS,
    calculateRiskScore,
    getRiskLevel,
    DEFAULT_DELAY_CAUSES,
    DEFAULT_TASK_TYPES,
    createProjectDocument,
    createTaskDocument,
    createSubtaskDocument,
    createTimeLogDocument,
    createDelayCauseDocument,
    createDelayDocument,
    createRiskDocument,
    createDailyReportDocument,
    createTaskTypeDocument,
    createTaskTypeCategoryDocument,
    createTaskDependencyDocument,
    createStationDocument,
    formatStationLabel,
} from '../modules/tasks/domain/taskModel';

// ── Planning Domain ──
export {
    MILESTONE_STATUS,
    MILESTONE_TYPE,
    TRAFFIC_LIGHT,
    SCORE_LOCK_REASON,
    WORK_AREA_TYPE,
    WORK_AREA_TYPE_CONFIG,
    OVERRIDE_REASON_TYPE,
    OVERRIDE_REASON_TYPE_CONFIG,
    createMilestoneDocument,
    createWorkAreaDocument,
    createWeeklyPlanItemDocument,
    createScoreSnapshotDocument,
} from '../modules/planning/domain/planningModel';

// ── Analytics Domain ──
export {
    AUDIT_FINDING_SEVERITY,
    AUDIT_FINDING_SEVERITY_CONFIG,
    AUDIT_FINDING_STATUS,
    ANALYTICS_SCOPE,
    AUDIT_TRAIL_EVENT_TYPE,
    AUDIT_TRAIL_ACTOR_TYPE,
    createAuditFindingDocument,
    createAuditEventDocument,
    createAnalyticsSnapshotDocument,
    createAuditLogDocument,
    createAuditTrailDocument,
    createOperationalKpiSnapshotDocument,
    createUserOperationalScoreDocument,
    createRoutineOperationalScoreDocument,
    createTeamOperationalSummaryDocument,
    createOperationalRiskFlagDocument,
    createOperationalRecommendationDocument,
    createAnalyticsRefreshLogDocument,
} from '../modules/analytics/domain/analyticsModel';

// ── Automation Domain ──
export {
    AI_GOVERNANCE_TYPE,
    AI_INSIGHT_TYPE,
    AI_EVENT_TYPE,
    AI_PROHIBITED_ACTIONS,
    createAIInsightDocument,
    createManagementBriefDocument,
    createAiGovernanceDocument,
    createAiExecutionDocument,
    createOptimizationOpportunityDocument,
    createOptimizationSimulationDocument,
    createOperationalPlanDocument,
    createAppliedRecommendationDocument,
    createOptimizationHistoryDocument,
} from '../modules/automation/domain/automationModel';
