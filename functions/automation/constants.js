/**
 * Automation Constants — Backend (CJS)
 * =====================================
 * CommonJS mirror of automation constants for Cloud Functions.
 * Must stay in sync with src/automation/constants.js
 */

const RUN_STATUS = {
    RUNNING: "running",
    SUCCESS: "success",
    PARTIAL: "partial",
    FAILED: "failed",
    CANCELLED: "cancelled",
};

const TRIGGER_TYPE = {
    SCHEDULED: "scheduled",
    MANUAL: "manual",
    EVENT: "event",
    DAY_SCHEDULE: "day_schedule",
};

const OPERATIONAL_ROLES = {
    MANAGER: "manager",
    TEAM_LEAD: "team_lead",
    ENGINEER: "engineer",
    TECHNICIAN: "technician",
};

const SCHEDULE_TYPE = {
    DAILY: "daily",
    MANUAL: "manual",
    EVENT_DRIVEN: "event_driven",
};

const DELIVERY_STATUS = {
    PENDING: "pending",
    SENT: "sent",
    DELIVERED: "delivered",
    FAILED: "failed",
    RESPONDED: "responded",
};

const INCIDENT_STATUS = {
    OPEN: "open",
    ACKNOWLEDGED: "acknowledged",
    IN_PROGRESS: "in_progress",
    RESOLVED: "resolved",
};

const INCIDENT_SEVERITY = {
    LOW: "low",
    MEDIUM: "medium",
    HIGH: "high",
    CRITICAL: "critical",
};

const REPORT_STATUS = {
    PENDING: "pending",
    RECEIVED: "received",
    CONFIRMED: "confirmed",
    LATE: "late",
    ESCALATED: "escalated",
};

const ESCALATION_TYPE = {
    MISSING_REPORT: "missing_report",
    BLOCKER: "blocker",
    LATE_RESPONSE: "late_response",
};

const ESCALATION_STATUS = {
    PENDING: "pending",
    ACKNOWLEDGED: "acknowledged",
    RESOLVED: "resolved",
    EXPIRED: "expired",
};

const ROUTINE_KEYS = {
    MORNING_DIGEST_ALL: "morning_digest_all",
    TECHNICIAN_EVENING_CHECK: "technician_evening_check",
    MISSING_REPORT_ESCALATION: "missing_report_escalation",
    BLOCK_INCIDENT_ALERT: "block_incident_alert",
    MANAGER_SUMMARY: "manager_summary",
    ENGINEER_RISK_DIGEST: "engineer_risk_digest",
    MANUAL_TEST_MESSAGE: "manual_test_message",
    DAILY_PERFORMANCE_REPORT: "daily_performance_report",
};

const AUTOMATION_CHANNELS = {
    TELEGRAM: "telegram",
    EMAIL: "email",
};

const AUTOMATION_PROVIDERS = {
    TELEGRAM_BOT: "telegram_bot",
    RESEND: "resend",
};

// Telegram session states (mirror)
const TELEGRAM_SESSION_STATE = {
    IDLE: "idle",
    AWAITING_IDENTITY_LINK: "awaiting_identity_link",
    AWAITING_DAILY_REPORT: "awaiting_daily_report",
    AWAITING_BLOCK_CAUSE: "awaiting_block_cause",
    AWAITING_REPORT_CONFIRMATION: "awaiting_report_confirmation",
    REPORT_RECEIVED: "report_received",
    ESCALATED: "escalated",
    BLOCKED_FLOW: "blocked_flow",
    // Task-linked report flow
    SELECTING_TASK: "selecting_task",
    AWAIT_REPORT_FOR_TASK: "await_report_for_task",
    CREATING_TASK: "creating_task",
    ASKING_MORE_TASKS: "asking_more_tasks",
    ASKING_OVERTIME: "asking_overtime",
    AWAIT_OVERTIME_HOURS: "await_overtime_hours",
    SELECTING_OVERTIME_TASK: "selecting_overtime_task",
};

const TELEGRAM_SESSION_EVENT = {
    LINK_REQUESTED: "LINK_REQUESTED",
    IDENTITY_CONFIRMED: "IDENTITY_CONFIRMED",
    IDENTITY_FAILED: "IDENTITY_FAILED",
    REPORT_REQUESTED: "REPORT_REQUESTED",
    REPORT_SUBMITTED: "REPORT_SUBMITTED",
    REPORT_CONFIRMED: "REPORT_CONFIRMED",
    REPORT_REJECTED: "REPORT_REJECTED",
    BLOCK_REPORTED: "BLOCK_REPORTED",
    BLOCK_CAUSE_RECEIVED: "BLOCK_CAUSE_RECEIVED",
    GRACE_PERIOD_EXPIRED: "GRACE_PERIOD_EXPIRED",
    RESET: "RESET",
    ADMIN_RESET: "ADMIN_RESET",
    ERROR: "ERROR",
    // Task-linked report flow
    TASK_LIST_SHOWN: "TASK_LIST_SHOWN",
    TASK_SELECTED: "TASK_SELECTED",
    CREATE_TASK_REQUESTED: "CREATE_TASK_REQUESTED",
    TASK_CREATED: "TASK_CREATED",
    TASK_REPORT_SAVED: "TASK_REPORT_SAVED",
    MORE_TASKS_YES: "MORE_TASKS_YES",
    MORE_TASKS_NO: "MORE_TASKS_NO",
    OVERTIME_YES: "OVERTIME_YES",
    OVERTIME_NO: "OVERTIME_NO",
    OVERTIME_HOURS_ENTERED: "OVERTIME_HOURS_ENTERED",
    OVERTIME_TASK_SELECTED: "OVERTIME_TASK_SELECTED",
};

const TELEGRAM_BOT_LOG_EVENT = {
    MESSAGE_SENT: "message_sent",
    MESSAGE_RECEIVED: "message_received",
    SESSION_CREATED: "session_created",
    SESSION_EXPIRED: "session_expired",
    STATE_TRANSITION: "state_transition",
    WEBHOOK_RECEIVED: "webhook_received",
    ERROR: "error",
    ESCALATION_TRIGGERED: "escalation_triggered",
    REPORT_PARSED: "report_parsed",
    IDENTITY_LINKED: "identity_linked",
};

// AI layer constants
const AI_FEATURE_TYPE = {
    REPORT_EXTRACTION: "report_extraction",
    AUDIO_TRANSCRIPTION: "audio_transcription",
    BRIEFING_GENERATION: "briefing_generation",
    INCIDENT_CLASSIFICATION: "incident_classification",
};

const AI_STATUS = {
    SUCCESS: "success",
    FAILURE: "failure",
    FALLBACK: "fallback",
};

const AI_SOURCE_TYPE = {
    TEXT: "text",
    AUDIO: "audio",
    SYSTEM_CONTEXT: "system_context",
};

const CONFIDENCE_ACTION = {
    ACCEPT: "accept",
    CONFIRM: "confirm",
    FALLBACK: "fallback",
};

module.exports = {
    RUN_STATUS,
    TRIGGER_TYPE,
    OPERATIONAL_ROLES,
    SCHEDULE_TYPE,
    DELIVERY_STATUS,
    INCIDENT_STATUS,
    INCIDENT_SEVERITY,
    REPORT_STATUS,
    ESCALATION_TYPE,
    ESCALATION_STATUS,
    ROUTINE_KEYS,
    AUTOMATION_CHANNELS,
    AUTOMATION_PROVIDERS,
    TELEGRAM_SESSION_STATE,
    TELEGRAM_SESSION_EVENT,
    TELEGRAM_BOT_LOG_EVENT,
    AI_FEATURE_TYPE,
    AI_STATUS,
    AI_SOURCE_TYPE,
    CONFIDENCE_ACTION,
};
