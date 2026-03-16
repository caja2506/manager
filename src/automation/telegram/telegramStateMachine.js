/**
 * Telegram Bot State Machine
 * ===========================
 * 
 * Declarative, pure-function state machine for the Telegram bot
 * conversational flow. No side effects — safe for testing.
 * 
 * The state machine manages per-user conversation context:
 * - Identity linking (chatId ↔ app userId)
 * - Daily report submission + confirmation
 * - Blocker reporting
 * - Escalation handling
 * - Error recovery
 * 
 * Usage:
 *   import { getNextState, isValidTransition } from './telegramStateMachine.js';
 *   const result = getNextState('idle', 'REPORT_REQUESTED');
 *   // → { state: 'awaiting_daily_report', valid: true }
 * 
 * @module automation/telegram/telegramStateMachine
 */

import {
    TELEGRAM_SESSION_STATE as STATE,
    TELEGRAM_SESSION_EVENT as EVENT,
    SESSION_TIMEOUT_MS,
} from './telegramConstants.js';

// ============================================================
// STATE METADATA
// ============================================================

/**
 * Metadata for each state: description, timeout behavior, required session fields.
 */
export const STATE_METADATA = {
    [STATE.IDLE]: {
        description: 'Sin flujo conversacional activo. Estado por defecto.',
        hasTimeout: false,
        requiredFields: [],
    },
    [STATE.AWAITING_IDENTITY_LINK]: {
        description: 'Esperando que el usuario confirme su vinculación chatId ↔ userId.',
        hasTimeout: true,
        timeoutMs: 10 * 60 * 1000, // 10 minutes
        requiredFields: ['chatId'],
    },
    [STATE.AWAITING_DAILY_REPORT]: {
        description: 'Esperando que el usuario envíe su reporte de avance diario.',
        hasTimeout: true,
        timeoutMs: SESSION_TIMEOUT_MS,
        requiredFields: ['userId', 'chatId'],
    },
    [STATE.AWAITING_BLOCK_CAUSE]: {
        description: 'Esperando que el usuario especifique la causa del bloqueo reportado.',
        hasTimeout: true,
        timeoutMs: 15 * 60 * 1000, // 15 minutes
        requiredFields: ['userId', 'chatId'],
    },
    [STATE.AWAITING_REPORT_CONFIRMATION]: {
        description: 'Esperando que el usuario confirme los datos parseados de su reporte.',
        hasTimeout: true,
        timeoutMs: 10 * 60 * 1000, // 10 minutes
        requiredFields: ['userId', 'chatId'],
    },
    [STATE.REPORT_RECEIVED]: {
        description: 'Reporte recibido y confirmado exitosamente.',
        hasTimeout: false,
        requiredFields: ['userId'],
    },
    [STATE.ESCALATED]: {
        description: 'Se activó una escalación por falta de respuesta o bloqueo.',
        hasTimeout: false,
        requiredFields: ['userId'],
    },
    [STATE.BLOCKED_FLOW]: {
        description: 'Error en el flujo. Requiere intervención administrativa para resetear.',
        hasTimeout: false,
        requiredFields: [],
    },
};

// ============================================================
// TRANSITION TABLE
// ============================================================

/**
 * State transition table.
 * Format: { [currentState]: { [event]: nextState } }
 * 
 * Special rule: ERROR event from ANY state → BLOCKED_FLOW
 */
const TRANSITIONS = {
    [STATE.IDLE]: {
        [EVENT.LINK_REQUESTED]: STATE.AWAITING_IDENTITY_LINK,
        [EVENT.REPORT_REQUESTED]: STATE.AWAITING_DAILY_REPORT,
        [EVENT.BLOCK_REPORTED]: STATE.AWAITING_BLOCK_CAUSE,
    },

    [STATE.AWAITING_IDENTITY_LINK]: {
        [EVENT.IDENTITY_CONFIRMED]: STATE.IDLE,
        [EVENT.IDENTITY_FAILED]: STATE.IDLE,
    },

    [STATE.AWAITING_DAILY_REPORT]: {
        [EVENT.REPORT_SUBMITTED]: STATE.AWAITING_REPORT_CONFIRMATION,
        [EVENT.GRACE_PERIOD_EXPIRED]: STATE.ESCALATED,
    },

    [STATE.AWAITING_REPORT_CONFIRMATION]: {
        [EVENT.REPORT_CONFIRMED]: STATE.REPORT_RECEIVED,
        [EVENT.REPORT_REJECTED]: STATE.AWAITING_DAILY_REPORT,
    },

    [STATE.AWAITING_BLOCK_CAUSE]: {
        [EVENT.BLOCK_CAUSE_RECEIVED]: STATE.IDLE,
    },

    [STATE.REPORT_RECEIVED]: {
        [EVENT.RESET]: STATE.IDLE,
    },

    [STATE.ESCALATED]: {
        [EVENT.RESET]: STATE.IDLE,
    },

    [STATE.BLOCKED_FLOW]: {
        [EVENT.ADMIN_RESET]: STATE.IDLE,
    },
};

// ============================================================
// PUBLIC API
// ============================================================

/**
 * Compute the next state given a current state and an event.
 * 
 * @param {string} currentState - Current TELEGRAM_SESSION_STATE
 * @param {string} event - TELEGRAM_SESSION_EVENT
 * @returns {{ valid: boolean, state: string, error?: string }}
 */
export function getNextState(currentState, event) {
    // Global ERROR transition: any state → blocked_flow
    if (event === EVENT.ERROR) {
        return { valid: true, state: STATE.BLOCKED_FLOW };
    }

    const stateTransitions = TRANSITIONS[currentState];
    if (!stateTransitions) {
        return {
            valid: false,
            state: currentState,
            error: `Unknown state: ${currentState}`,
        };
    }

    const nextState = stateTransitions[event];
    if (!nextState) {
        return {
            valid: false,
            state: currentState,
            error: `No transition from "${currentState}" on event "${event}"`,
        };
    }

    return { valid: true, state: nextState };
}

/**
 * Check if a direct state transition is valid.
 * 
 * @param {string} fromState
 * @param {string} toState
 * @returns {boolean}
 */
export function isValidTransition(fromState, toState) {
    // ERROR → blocked_flow is always valid
    if (toState === STATE.BLOCKED_FLOW) return true;

    const stateTransitions = TRANSITIONS[fromState];
    if (!stateTransitions) return false;

    return Object.values(stateTransitions).includes(toState);
}

/**
 * Get all events that can be processed from a given state.
 * 
 * @param {string} currentState
 * @returns {string[]} Array of valid event names
 */
export function getAvailableEvents(currentState) {
    const events = [];

    // ERROR is always available
    events.push(EVENT.ERROR);

    const stateTransitions = TRANSITIONS[currentState];
    if (stateTransitions) {
        events.push(...Object.keys(stateTransitions));
    }

    return events;
}

/**
 * Get all possible next states from a given state.
 * 
 * @param {string} currentState
 * @returns {string[]}
 */
export function getPossibleNextStates(currentState) {
    const states = new Set();

    // ERROR always leads to blocked_flow
    states.add(STATE.BLOCKED_FLOW);

    const stateTransitions = TRANSITIONS[currentState];
    if (stateTransitions) {
        Object.values(stateTransitions).forEach(s => states.add(s));
    }

    return [...states];
}

/**
 * Check if a session has expired based on its state and timestamp.
 * 
 * @param {Object} session - Session document
 * @returns {boolean}
 */
export function isSessionExpired(session) {
    if (!session.stateExpiresAt) return false;
    const meta = STATE_METADATA[session.currentState];
    if (!meta || !meta.hasTimeout) return false;
    return new Date() > new Date(session.stateExpiresAt);
}

/**
 * Get the timeout for a given state in milliseconds.
 * Returns null if the state has no timeout.
 * 
 * @param {string} state
 * @returns {number|null}
 */
export function getStateTimeout(state) {
    const meta = STATE_METADATA[state];
    return meta?.timeoutMs ?? null;
}

/**
 * Get all defined states.
 * @returns {string[]}
 */
export function getAllStates() {
    return Object.values(STATE);
}

/**
 * Get all defined events.
 * @returns {string[]}
 */
export function getAllEvents() {
    return Object.values(EVENT);
}
