/**
 * Telegram Provider Constants
 * ============================
 * 
 * Enums specific to the Telegram channel adapter.
 * Generic automation constants live in ../constants.js
 * 
 * @module automation/telegram/telegramConstants
 */

// ============================================================
// SESSION STATES — Bot Conversation State Machine
// ============================================================

/**
 * States for the Telegram bot conversational flow.
 * Each user/chat maintains one active session state.
 */
export const TELEGRAM_SESSION_STATE = {
    /** No active conversation flow. Default state. */
    IDLE: 'idle',

    /** Waiting for user to confirm their identity link (chatId ↔ userId) */
    AWAITING_IDENTITY_LINK: 'awaiting_identity_link',

    /** Waiting for user to submit their daily progress report */
    AWAITING_DAILY_REPORT: 'awaiting_daily_report',

    /** Waiting for user to specify the cause of a reported blocker */
    AWAITING_BLOCK_CAUSE: 'awaiting_block_cause',

    /** Waiting for user to confirm parsed report data */
    AWAITING_REPORT_CONFIRMATION: 'awaiting_report_confirmation',

    /** Report has been successfully received and stored */
    REPORT_RECEIVED: 'report_received',

    /** User did not respond in time — escalation triggered */
    ESCALATED: 'escalated',

    /** Error state — requires admin intervention to reset */
    BLOCKED_FLOW: 'blocked_flow',
};

// ============================================================
// SESSION EVENTS — Transitions triggers
// ============================================================

/**
 * Events that trigger state transitions in the bot state machine.
 */
export const TELEGRAM_SESSION_EVENT = {
    LINK_REQUESTED: 'LINK_REQUESTED',
    IDENTITY_CONFIRMED: 'IDENTITY_CONFIRMED',
    IDENTITY_FAILED: 'IDENTITY_FAILED',
    REPORT_REQUESTED: 'REPORT_REQUESTED',
    REPORT_SUBMITTED: 'REPORT_SUBMITTED',
    REPORT_CONFIRMED: 'REPORT_CONFIRMED',
    REPORT_REJECTED: 'REPORT_REJECTED',
    BLOCK_REPORTED: 'BLOCK_REPORTED',
    BLOCK_CAUSE_RECEIVED: 'BLOCK_CAUSE_RECEIVED',
    GRACE_PERIOD_EXPIRED: 'GRACE_PERIOD_EXPIRED',
    RESET: 'RESET',
    ADMIN_RESET: 'ADMIN_RESET',
    ERROR: 'ERROR',
};

// ============================================================
// MESSAGE TYPES
// ============================================================

/** Types of messages the bot sends/receives */
export const TELEGRAM_MESSAGE_TYPE = {
    BRIEFING: 'briefing',
    REPORT_REQUEST: 'report_request',
    ESCALATION_NOTICE: 'escalation_notice',
    BLOCK_ALERT: 'block_alert',
    CONFIRMATION_PROMPT: 'confirmation_prompt',
    SYSTEM_MESSAGE: 'system_message',
    USER_RESPONSE: 'user_response',
    AUDIO_MESSAGE: 'audio_message',
};

// ============================================================
// BOT LOG EVENT TYPES
// ============================================================

/** Types of events logged by the bot for traceability */
export const TELEGRAM_BOT_LOG_EVENT = {
    MESSAGE_SENT: 'message_sent',
    MESSAGE_RECEIVED: 'message_received',
    SESSION_CREATED: 'session_created',
    SESSION_EXPIRED: 'session_expired',
    STATE_TRANSITION: 'state_transition',
    WEBHOOK_RECEIVED: 'webhook_received',
    ERROR: 'error',
    ESCALATION_TRIGGERED: 'escalation_triggered',
    REPORT_PARSED: 'report_parsed',
    IDENTITY_LINKED: 'identity_linked',
};

// ============================================================
// LOG SEVERITY
// ============================================================

export const TELEGRAM_LOG_SEVERITY = {
    DEBUG: 'debug',
    INFO: 'info',
    WARN: 'warn',
    ERROR: 'error',
};

// ============================================================
// REPORT INPUT TYPES
// ============================================================

export const TELEGRAM_INPUT_TYPE = {
    TEXT: 'text',
    AUDIO: 'audio',
    MANUAL: 'manual',
};

// ============================================================
// SESSION TIMEOUT (milliseconds)
// ============================================================

/** Default session timeout: 2 hours */
export const SESSION_TIMEOUT_MS = 2 * 60 * 60 * 1000;

/** Grace period before escalation: 30 minutes (default, configurable) */
export const DEFAULT_GRACE_PERIOD_MS = 30 * 60 * 1000;
