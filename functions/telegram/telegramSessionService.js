/**
 * Telegram Session Service — Backend (CJS)
 * ===========================================
 * Session CRUD and state machine operations for Firestore.
 */

const paths = require("../automation/firestorePaths");
const {
    TELEGRAM_SESSION_STATE,
    TELEGRAM_SESSION_EVENT,
    TELEGRAM_BOT_LOG_EVENT,
} = require("../automation/constants");

// ── State Machine (server-side mirror) ──
// Must stay in sync with src/automation/telegram/telegramStateMachine.js
const TRANSITIONS = {
    [TELEGRAM_SESSION_STATE.IDLE]: {
        [TELEGRAM_SESSION_EVENT.LINK_REQUESTED]: TELEGRAM_SESSION_STATE.AWAITING_IDENTITY_LINK,
        [TELEGRAM_SESSION_EVENT.REPORT_REQUESTED]: TELEGRAM_SESSION_STATE.AWAITING_DAILY_REPORT,
        [TELEGRAM_SESSION_EVENT.BLOCK_REPORTED]: TELEGRAM_SESSION_STATE.AWAITING_BLOCK_CAUSE,
        [TELEGRAM_SESSION_EVENT.TASK_LIST_SHOWN]: TELEGRAM_SESSION_STATE.SELECTING_TASK,
    },
    [TELEGRAM_SESSION_STATE.AWAITING_IDENTITY_LINK]: {
        [TELEGRAM_SESSION_EVENT.IDENTITY_CONFIRMED]: TELEGRAM_SESSION_STATE.IDLE,
        [TELEGRAM_SESSION_EVENT.IDENTITY_FAILED]: TELEGRAM_SESSION_STATE.IDLE,
    },
    [TELEGRAM_SESSION_STATE.AWAITING_DAILY_REPORT]: {
        [TELEGRAM_SESSION_EVENT.REPORT_SUBMITTED]: TELEGRAM_SESSION_STATE.AWAITING_REPORT_CONFIRMATION,
        [TELEGRAM_SESSION_EVENT.GRACE_PERIOD_EXPIRED]: TELEGRAM_SESSION_STATE.ESCALATED,
    },
    [TELEGRAM_SESSION_STATE.AWAITING_REPORT_CONFIRMATION]: {
        [TELEGRAM_SESSION_EVENT.REPORT_CONFIRMED]: TELEGRAM_SESSION_STATE.REPORT_RECEIVED,
        [TELEGRAM_SESSION_EVENT.REPORT_REJECTED]: TELEGRAM_SESSION_STATE.AWAITING_DAILY_REPORT,
    },
    [TELEGRAM_SESSION_STATE.AWAITING_BLOCK_CAUSE]: {
        [TELEGRAM_SESSION_EVENT.BLOCK_CAUSE_RECEIVED]: TELEGRAM_SESSION_STATE.IDLE,
    },
    [TELEGRAM_SESSION_STATE.REPORT_RECEIVED]: {
        [TELEGRAM_SESSION_EVENT.RESET]: TELEGRAM_SESSION_STATE.IDLE,
    },
    [TELEGRAM_SESSION_STATE.ESCALATED]: {
        [TELEGRAM_SESSION_EVENT.RESET]: TELEGRAM_SESSION_STATE.IDLE,
    },
    [TELEGRAM_SESSION_STATE.BLOCKED_FLOW]: {
        [TELEGRAM_SESSION_EVENT.ADMIN_RESET]: TELEGRAM_SESSION_STATE.IDLE,
    },
    // ── Task-linked report flow ──
    [TELEGRAM_SESSION_STATE.SELECTING_TASK]: {
        [TELEGRAM_SESSION_EVENT.TASK_SELECTED]: TELEGRAM_SESSION_STATE.AWAIT_REPORT_FOR_TASK,
        [TELEGRAM_SESSION_EVENT.CREATE_TASK_REQUESTED]: TELEGRAM_SESSION_STATE.CREATING_TASK,
        [TELEGRAM_SESSION_EVENT.RESET]: TELEGRAM_SESSION_STATE.IDLE,
    },
    [TELEGRAM_SESSION_STATE.CREATING_TASK]: {
        [TELEGRAM_SESSION_EVENT.TASK_CREATED]: TELEGRAM_SESSION_STATE.AWAIT_REPORT_FOR_TASK,
        [TELEGRAM_SESSION_EVENT.RESET]: TELEGRAM_SESSION_STATE.IDLE,
    },
    [TELEGRAM_SESSION_STATE.AWAIT_REPORT_FOR_TASK]: {
        [TELEGRAM_SESSION_EVENT.TASK_REPORT_SAVED]: TELEGRAM_SESSION_STATE.ASKING_MORE_TASKS,
        [TELEGRAM_SESSION_EVENT.RESET]: TELEGRAM_SESSION_STATE.IDLE,
    },
    [TELEGRAM_SESSION_STATE.ASKING_MORE_TASKS]: {
        [TELEGRAM_SESSION_EVENT.MORE_TASKS_YES]: TELEGRAM_SESSION_STATE.SELECTING_TASK,
        [TELEGRAM_SESSION_EVENT.MORE_TASKS_NO]: TELEGRAM_SESSION_STATE.ASKING_OVERTIME,
        [TELEGRAM_SESSION_EVENT.RESET]: TELEGRAM_SESSION_STATE.IDLE,
    },
    [TELEGRAM_SESSION_STATE.ASKING_OVERTIME]: {
        [TELEGRAM_SESSION_EVENT.OVERTIME_YES]: TELEGRAM_SESSION_STATE.AWAIT_OVERTIME_HOURS,
        [TELEGRAM_SESSION_EVENT.OVERTIME_NO]: TELEGRAM_SESSION_STATE.IDLE,
        [TELEGRAM_SESSION_EVENT.RESET]: TELEGRAM_SESSION_STATE.IDLE,
    },
    [TELEGRAM_SESSION_STATE.AWAIT_OVERTIME_HOURS]: {
        [TELEGRAM_SESSION_EVENT.OVERTIME_HOURS_ENTERED]: TELEGRAM_SESSION_STATE.SELECTING_OVERTIME_TASK,
        [TELEGRAM_SESSION_EVENT.RESET]: TELEGRAM_SESSION_STATE.IDLE,
    },
    [TELEGRAM_SESSION_STATE.SELECTING_OVERTIME_TASK]: {
        [TELEGRAM_SESSION_EVENT.OVERTIME_TASK_SELECTED]: TELEGRAM_SESSION_STATE.IDLE,
        [TELEGRAM_SESSION_EVENT.RESET]: TELEGRAM_SESSION_STATE.IDLE,
    },
};

/**
 * Get or create a Telegram session for a chatId.
 */
async function getOrCreateSession(adminDb, chatId) {
    const chatIdStr = String(chatId);
    const snap = await adminDb.collection(paths.TELEGRAM_SESSIONS)
        .where("chatId", "==", chatIdStr)
        .limit(1)
        .get();

    if (!snap.empty) {
        return { id: snap.docs[0].id, ...snap.docs[0].data() };
    }

    // Create new session
    const now = new Date().toISOString();
    const session = {
        chatId: chatIdStr,
        userId: null,
        currentState: TELEGRAM_SESSION_STATE.IDLE,
        previousState: null,
        stateChangedAt: now,
        stateExpiresAt: null,
        linkedAt: null,
        lastActivityAt: now,
        metadata: {},
        createdAt: now,
        updatedAt: now,
    };

    const ref = await adminDb.collection(paths.TELEGRAM_SESSIONS).add(session);
    await logBotEvent(adminDb, chatIdStr, TELEGRAM_BOT_LOG_EVENT.SESSION_CREATED, {});

    return { id: ref.id, ...session };
}

/**
 * Transition session state using the state machine.
 */
async function transitionState(adminDb, chatId, event, extras = {}) {
    const session = await getOrCreateSession(adminDb, chatId);
    const currentState = session.currentState;

    // Global ERROR transition
    if (event === TELEGRAM_SESSION_EVENT.ERROR) {
        const newState = TELEGRAM_SESSION_STATE.BLOCKED_FLOW;
        await updateSessionState(adminDb, session.id, currentState, newState, extras);
        await logBotEvent(adminDb, String(chatId), TELEGRAM_BOT_LOG_EVENT.STATE_TRANSITION, {
            from: currentState, to: newState, event,
        });
        return { valid: true, state: newState, session };
    }

    // Check transition table
    const stateTransitions = TRANSITIONS[currentState];
    if (!stateTransitions || !stateTransitions[event]) {
        console.warn(`[sessionService] Invalid transition: ${currentState} + ${event}`);
        return { valid: false, state: currentState, error: `No transition for ${currentState}+${event}`, session };
    }

    const newState = stateTransitions[event];
    await updateSessionState(adminDb, session.id, currentState, newState, extras);
    await logBotEvent(adminDb, String(chatId), TELEGRAM_BOT_LOG_EVENT.STATE_TRANSITION, {
        from: currentState, to: newState, event,
    });

    return { valid: true, state: newState, session: { ...session, currentState: newState } };
}

/**
 * Internal: Update session document.
 */
async function updateSessionState(adminDb, sessionId, previousState, newState, extras = {}) {
    const now = new Date().toISOString();
    await adminDb.collection(paths.TELEGRAM_SESSIONS).doc(sessionId).update({
        currentState: newState,
        previousState,
        stateChangedAt: now,
        lastActivityAt: now,
        updatedAt: now,
        ...extras,
    });
}

/**
 * Reset session to IDLE.
 */
async function resetSession(adminDb, chatId) {
    return transitionState(adminDb, chatId, TELEGRAM_SESSION_EVENT.RESET);
}

/**
 * Link a chatId to a userId.
 */
async function linkIdentity(adminDb, chatId, userId) {
    const session = await getOrCreateSession(adminDb, chatId);
    const now = new Date().toISOString();

    await adminDb.collection(paths.TELEGRAM_SESSIONS).doc(session.id).update({
        userId,
        linkedAt: now,
        updatedAt: now,
    });

    // Also update user's providerLinks
    await adminDb.collection(paths.USERS).doc(userId).update({
        "providerLinks.telegram": {
            chatId: String(chatId),
            linkedAt: now,
        },
        isAutomationParticipant: true,
        updatedAt: now,
    });

    await logBotEvent(adminDb, String(chatId), TELEGRAM_BOT_LOG_EVENT.IDENTITY_LINKED, { userId });
}

/**
 * Find user ID from chatId.
 */
async function findUserByChatId(adminDb, chatId) {
    const chatIdStr = String(chatId);

    // Check sessions first (single-field query, no composite index needed)
    const snap = await adminDb.collection(paths.TELEGRAM_SESSIONS)
        .where("chatId", "==", chatIdStr)
        .limit(1)
        .get();

    if (!snap.empty) {
        const userId = snap.docs[0].data().userId;
        if (userId) return userId;
    }

    // Fallback: search users collection
    const userSnap = await adminDb.collection(paths.USERS)
        .where("providerLinks.telegram.chatId", "==", chatIdStr)
        .limit(1)
        .get();

    if (!userSnap.empty) {
        return userSnap.docs[0].id;
    }

    return null;
}

/**
 * Log a bot event for traceability.
 */
async function logBotEvent(adminDb, chatId, eventType, details = {}) {
    // Sanitize: remove undefined values (Firestore rejects them)
    const cleanDetails = JSON.parse(JSON.stringify(details));
    await adminDb.collection(paths.TELEGRAM_BOT_LOGS).add({
        chatId: String(chatId),
        eventType,
        details: cleanDetails,
        direction: "internal",
        severity: "info",
        createdAt: new Date().toISOString(),
    });
}

module.exports = {
    getOrCreateSession,
    transitionState,
    resetSession,
    linkIdentity,
    findUserByChatId,
    logBotEvent,
};
