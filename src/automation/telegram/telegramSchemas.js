/**
 * Telegram Provider Schemas
 * ==========================
 * 
 * Factory functions for Telegram-specific Firestore documents.
 * Generic automation schemas live in ../schemas.js
 * 
 * @module automation/telegram/telegramSchemas
 */

import {
    TELEGRAM_SESSION_STATE,
    TELEGRAM_INPUT_TYPE,
    TELEGRAM_LOG_SEVERITY,
    SESSION_TIMEOUT_MS,
} from './telegramConstants.js';
import {
    DELIVERY_STATUS,
    REPORT_STATUS,
    ESCALATION_STATUS,
} from '../constants.js';

// ============================================================
// TELEGRAM SESSIONS
// ============================================================

/**
 * Conversational session for a Telegram user/chat.
 * Stored in: telegramSessions/{chatId}
 * 
 * Each user has at most one active session.
 * Sessions expire after SESSION_TIMEOUT_MS of inactivity.
 * 
 * @param {Object} [overrides]
 * @returns {Object} session document
 */
export function createTelegramSessionDocument(overrides = {}) {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + SESSION_TIMEOUT_MS);

    return {
        userId: null,                          // App user UID (null until linked)
        chatId: null,                          // Telegram chat ID
        currentState: TELEGRAM_SESSION_STATE.IDLE,
        pendingAction: null,                   // Describes what the bot expects next
        pendingTaskId: null,                   // Task context for current flow
        pendingIncidentId: null,               // Incident context for current flow
        lastInboundAt: null,                   // Last message FROM user
        lastOutboundAt: null,                  // Last message TO user
        lastMessageText: null,                 // Last message content (summary)
        stateExpiresAt: expiresAt.toISOString(),
        metadata: {},
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
        ...overrides,
    };
}

// ============================================================
// TELEGRAM REPORTS
// ============================================================

/**
 * Daily progress report submitted via Telegram.
 * Stored in: telegramReports/{auto-id}
 * 
 * Created when a technician submits a progress report.
 * Parsed by the system (text or audio → structured data).
 * 
 * @param {Object} [overrides]
 * @returns {Object} report document
 */
export function createTelegramReportDocument(overrides = {}) {
    return {
        userId: null,
        taskId: null,                          // Optional task reference
        reportDate: '',                        // YYYY-MM-DD
        inputType: TELEGRAM_INPUT_TYPE.TEXT,
        rawText: '',                           // Original user text or transcription
        parsedProgressPercent: null,           // 0–100, extracted by AI
        parsedHoursWorked: null,               // Extracted hours
        parsedBlockers: [],                    // Array of blocker strings
        relatedIncidentId: null,               // Created if blocker detected
        status: REPORT_STATUS.PENDING,
        confidenceScore: null,                 // AI confidence in parsing (0–1)
        requiresConfirmation: true,            // Should user confirm parsed data?
        escalationTriggered: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        ...overrides,
    };
}

// ============================================================
// TELEGRAM ESCALATIONS
// ============================================================

/**
 * Escalation record for missed reports or blockers.
 * Stored in: telegramEscalations/{auto-id}
 * 
 * @param {Object} [overrides]
 * @returns {Object} escalation document
 */
export function createTelegramEscalationDocument(overrides = {}) {
    return {
        userId: null,                          // Who triggered the escalation
        relatedReportId: null,                 // Reference to telegramReports
        relatedIncidentId: null,               // Reference to operationIncidents
        escalationType: '',                    // ESCALATION_TYPE value
        fromRole: '',                          // Operational role of the source user
        toUserId: null,                        // Escalation target user UID
        toRole: '',                            // Operational role of the target
        status: ESCALATION_STATUS.PENDING,
        triggeredAt: new Date().toISOString(),
        resolvedAt: null,
        resolutionNotes: '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        ...overrides,
    };
}

// ============================================================
// TELEGRAM DELIVERIES
// ============================================================

/**
 * Individual message delivery record for traceability.
 * Stored in: telegramDeliveries/{auto-id}
 * 
 * @param {Object} [overrides]
 * @returns {Object} delivery document
 */
export function createTelegramDeliveryDocument(overrides = {}) {
    return {
        routineKey: null,                      // Which routine triggered this delivery
        runId: null,                           // Reference to automationRuns
        userId: null,                          // Target app user
        chatId: null,                          // Telegram chat ID
        direction: 'outbound',                 // 'outbound' | 'inbound'
        messageType: '',                       // TELEGRAM_MESSAGE_TYPE value
        deliveryStatus: DELIVERY_STATUS.PENDING,
        sentAt: null,
        deliveredAt: null,
        respondedAt: null,
        telegramMessageId: null,               // Telegram-assigned message ID
        summary: '',                           // Short description of message content
        requiresFollowup: false,
        metadata: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        ...overrides,
    };
}

// ============================================================
// TELEGRAM BOT LOGS
// ============================================================

/**
 * Operational log entry for the Telegram bot.
 * Append-only — never updated or deleted.
 * Stored in: telegramBotLogs/{auto-id}
 * 
 * @param {Object} [overrides]
 * @returns {Object} log document
 */
export function createTelegramBotLogDocument(overrides = {}) {
    return {
        direction: 'internal',                 // 'inbound' | 'outbound' | 'internal'
        eventType: '',                         // TELEGRAM_BOT_LOG_EVENT value
        userId: null,
        chatId: null,
        messageSummary: '',
        payloadSnippet: null,                  // Truncated payload for debugging
        relatedSessionId: null,
        relatedReportId: null,
        relatedRunId: null,
        severity: TELEGRAM_LOG_SEVERITY.INFO,
        createdAt: new Date().toISOString(),
        ...overrides,
    };
}
