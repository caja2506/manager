/**
 * Analytics Constants — Backend (CJS)
 * ======================================
 * Enums, defaults, and thresholds for the analytics engine.
 */

const PERIOD_TYPE = {
    DAILY: "daily",
    WEEKLY: "weekly",
    MONTHLY: "monthly",
};

const ENTITY_TYPE = {
    USER: "user",
    ROLE: "role",
    ROUTINE: "routine",
    CHANNEL: "channel",
    TEAM: "team",
    GLOBAL: "global",
};

const KPI_NAME = {
    RESPONSE_RATE: "responseRate",
    ON_TIME_RESPONSE_RATE: "onTimeResponseRate",
    LATE_RESPONSE_RATE: "lateResponseRate",
    ESCALATION_RATE: "escalationRate",
    INCIDENT_RATE: "incidentRate",
    REPORT_COMPLETION_RATE: "reportCompletionRate",
    ROUTINE_SUCCESS_RATE: "routineSuccessRate",
    AI_ASSISTED_RATE: "aiAssistedRate",
    CONFIRMATION_REQUEST_RATE: "confirmationRequestRate",
    AUDIO_USAGE_RATE: "audioUsageRate",
    DELIVERY_FAILURE_RATE: "deliveryFailureRate",
    ACTIVE_PARTICIPATION_RATE: "activeParticipationRate",
};

const RISK_SEVERITY = {
    LOW: "low",
    MEDIUM: "medium",
    HIGH: "high",
    CRITICAL: "critical",
};

const RECOMMENDATION_TYPE = {
    ROUTINE_ADJUSTMENT: "routine_adjustment",
    USER_INTERVENTION: "user_intervention",
    PROCESS_IMPROVEMENT: "process_improvement",
    AI_TUNING: "ai_tuning",
    ESCALATION_REVIEW: "escalation_review",
    ADOPTION_BOOST: "adoption_boost",
};

const RECOMMENDATION_PRIORITY = {
    LOW: "low",
    MEDIUM: "medium",
    HIGH: "high",
    URGENT: "urgent",
};

const TREND_DIRECTION = {
    UP: "up",
    DOWN: "down",
    STABLE: "stable",
};

// ── Default thresholds for risk flags ──
const DEFAULT_RISK_THRESHOLDS = {
    responseRate: { warning: 0.7, critical: 0.5 },
    onTimeResponseRate: { warning: 0.6, critical: 0.4 },
    escalationRate: { warning: 0.3, critical: 0.5 },
    incidentRate: { warning: 0.2, critical: 0.4 },
    routineSuccessRate: { warning: 0.7, critical: 0.5 },
    deliveryFailureRate: { warning: 0.2, critical: 0.4 },
    activeParticipationRate: { warning: 0.6, critical: 0.4 },
};

// ── Which KPIs "higher is better" vs "lower is better" ──
const KPI_POLARITY = {
    responseRate: "higher",
    onTimeResponseRate: "higher",
    lateResponseRate: "lower",
    escalationRate: "lower",
    incidentRate: "lower",
    reportCompletionRate: "higher",
    routineSuccessRate: "higher",
    aiAssistedRate: "higher",
    confirmationRequestRate: "neutral",
    audioUsageRate: "neutral",
    deliveryFailureRate: "lower",
    activeParticipationRate: "higher",
};

// Stable threshold: trend delta within ±2% is considered stable
const TREND_STABLE_THRESHOLD = 0.02;

// ── Phase 5: Optimization enums ──

const OPPORTUNITY_TYPE = {
    SCHEDULE: "schedule",
    PROCESS: "process",
    WORKLOAD: "workload",
    FORMAT: "format",
    FREQUENCY: "frequency",
    ELIMINATION: "elimination",
    AI_TUNING: "ai_tuning",
    ESCALATION: "escalation",
};

const SIMULATION_TYPE = {
    SCHEDULE_CHANGE: "schedule_change",
    GRACE_PERIOD_CHANGE: "grace_period_change",
    FREQUENCY_CHANGE: "frequency_change",
    ADD_CHECKPOINT: "add_checkpoint",
    FORMAT_CHANGE: "format_change",
};

const PLAN_TYPE = {
    DAILY: "daily",
    WEEKLY: "weekly",
};

const INTERVENTION_URGENCY = {
    WATCH: "watch",
    ACT_SOON: "act_soon",
    ACT_NOW: "act_now",
};

const IMPACT_STATUS = {
    PENDING: "pending",
    MEASURED: "measured",
    IMPROVED: "improved",
    NO_CHANGE: "no_change",
    WORSENED: "worsened",
};

module.exports = {
    PERIOD_TYPE,
    ENTITY_TYPE,
    KPI_NAME,
    RISK_SEVERITY,
    RECOMMENDATION_TYPE,
    RECOMMENDATION_PRIORITY,
    TREND_DIRECTION,
    DEFAULT_RISK_THRESHOLDS,
    KPI_POLARITY,
    TREND_STABLE_THRESHOLD,
    // Phase 5
    OPPORTUNITY_TYPE,
    SIMULATION_TYPE,
    PLAN_TYPE,
    INTERVENTION_URGENCY,
    IMPACT_STATUS,
};
