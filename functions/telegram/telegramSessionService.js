/**
 * Telegram Session Service — Backend (CJS)
 * ===========================================
 * Session CRUD and state machine operations for Supabase.
 */

const { getSupabase } = require("../db/supabaseAdmin");
const {
    TELEGRAM_SESSION_STATE,
    TELEGRAM_SESSION_EVENT,
    TELEGRAM_BOT_LOG_EVENT,
} = require("../automation/constants");
const { updateUser, loadAllUsers } = require("../db/coreDataReader");

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
        [TELEGRAM_SESSION_EVENT.SUBTASKS_SHOWN]: TELEGRAM_SESSION_STATE.SELECTING_SUBTASKS,
        [TELEGRAM_SESSION_EVENT.CREATE_TASK_REQUESTED]: TELEGRAM_SESSION_STATE.CREATING_TASK,
        [TELEGRAM_SESSION_EVENT.RESET]: TELEGRAM_SESSION_STATE.IDLE,
    },
    [TELEGRAM_SESSION_STATE.SELECTING_SUBTASKS]: {
        [TELEGRAM_SESSION_EVENT.SUBTASK_TOGGLED]: TELEGRAM_SESSION_STATE.SELECTING_SUBTASKS,
        [TELEGRAM_SESSION_EVENT.SUBTASKS_CONFIRMED]: TELEGRAM_SESSION_STATE.AWAIT_REPORT_FOR_TASK,
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
    const sb = getSupabase();

    const { data: sessionData, error } = await sb.from("telegram_sessions")
        .select("*")
        .eq("chat_id", chatIdStr)
        .maybeSingle();

    if (error) {
        console.warn("[telegramSessionService] getOrCreateSession error:", error.message);
    }

    if (sessionData) {
        return {
            id: sessionData.chat_id,
            chatId: sessionData.chat_id,
            userId: sessionData.user_id,
            currentState: sessionData.current_state,
            previousState: sessionData.previous_state,
            stateChangedAt: sessionData.state_changed_at,
            stateExpiresAt: sessionData.state_expires_at,
            linkedAt: sessionData.linked_at,
            lastActivityAt: sessionData.last_activity_at,
            metadata: sessionData.metadata || {},
            createdAt: sessionData.created_at,
            updatedAt: sessionData.updated_at,
        };
    }

    // Create new session
    const now = new Date().toISOString();
    const session = {
        chat_id: chatIdStr,
        user_id: null,
        current_state: TELEGRAM_SESSION_STATE.IDLE,
        previous_state: null,
        state_changed_at: now,
        state_expires_at: null,
        linked_at: null,
        last_activity_at: now,
        metadata: {},
        created_at: now,
        updated_at: now,
    };

    const { error: insertError } = await sb.from("telegram_sessions").insert(session);
    if (insertError) {
        console.error("[telegramSessionService] Error inserting session:", insertError.message);
    }

    await logBotEvent(null, chatIdStr, TELEGRAM_BOT_LOG_EVENT.SESSION_CREATED, {});

    return {
        id: chatIdStr,
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
}

/**
 * Transition session state using the state machine.
 */
async function transitionState(adminDb, chatId, event, extras = {}) {
    const session = await getOrCreateSession(null, chatId);
    const currentState = session.currentState;

    // Global ERROR transition
    if (event === TELEGRAM_SESSION_EVENT.ERROR) {
        const newState = TELEGRAM_SESSION_STATE.BLOCKED_FLOW;
        await updateSessionState(null, session.id, currentState, newState, extras);
        await logBotEvent(null, String(chatId), TELEGRAM_BOT_LOG_EVENT.STATE_TRANSITION, {
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
    await updateSessionState(null, session.id, currentState, newState, extras);
    await logBotEvent(null, String(chatId), TELEGRAM_BOT_LOG_EVENT.STATE_TRANSITION, {
        from: currentState, to: newState, event,
    });

    return { valid: true, state: newState, session: { ...session, currentState: newState } };
}

/**
 * Internal: Update session document.
 */
async function updateSessionState(adminDb, sessionId, previousState, newState, extras = {}) {
    const now = new Date().toISOString();
    const sb = getSupabase();

    const updates = {
        current_state: newState,
        previous_state: previousState,
        state_changed_at: now,
        last_activity_at: now,
        updated_at: now,
    };

    if (extras.userId !== undefined) updates.user_id = extras.userId;
    if (extras.stateExpiresAt !== undefined) updates.state_expires_at = extras.stateExpiresAt;
    if (extras.linkedAt !== undefined) updates.linked_at = extras.linkedAt;
    if (extras.metadata !== undefined) updates.metadata = extras.metadata;

    const { error } = await sb.from("telegram_sessions")
        .update(updates)
        .eq("chat_id", String(sessionId));

    if (error) {
        console.error("[telegramSessionService] updateSessionState error:", error.message);
    }
}

/**
 * Reset session to IDLE.
 */
async function resetSession(adminDb, chatId) {
    return transitionState(null, chatId, TELEGRAM_SESSION_EVENT.RESET);
}

/**
 * Link a chatId to a userId.
 */
async function linkIdentity(adminDb, chatId, userId) {
    const session = await getOrCreateSession(null, chatId);
    const now = new Date().toISOString();
    const sb = getSupabase();

    const { error } = await sb.from("telegram_sessions")
        .update({
            user_id: userId,
            linked_at: now,
            updated_at: now,
        })
        .eq("chat_id", String(chatId));

    if (error) {
        console.error("[telegramSessionService] linkIdentity error:", error.message);
    }

    // Also update user's Telegram link in Supabase
    await updateUser(userId, {
        telegramChatId: String(chatId),
        isAutomationParticipant: true,
    });

    await logBotEvent(null, String(chatId), TELEGRAM_BOT_LOG_EVENT.IDENTITY_LINKED, { userId });
}

/**
 * Find user ID from chatId.
 */
async function findUserByChatId(adminDb, chatId) {
    const chatIdStr = String(chatId);
    const sb = getSupabase();

    const { data: session, error } = await sb.from("telegram_sessions")
        .select("user_id")
        .eq("chat_id", chatIdStr)
        .maybeSingle();

    if (!error && session && session.user_id) {
        return session.user_id;
    }

    // Fallback: search users in Supabase by telegramChatId
    const allUsers = await loadAllUsers();
    const matchedUser = allUsers.find(u => String(u.telegramChatId) === chatIdStr);
    if (matchedUser) {
        return matchedUser.id;
    }

    return null;
}

/**
 * Log a bot event for traceability.
 */
async function logBotEvent(adminDb, chatId, eventType, details = {}) {
    const cleanDetails = JSON.parse(JSON.stringify(details));
    const sb = getSupabase();
    const { error } = await sb.from("telegram_bot_logs").insert({
        chat_id: String(chatId),
        event_type: eventType,
        details: cleanDetails,
        direction: "internal",
        severity: "info",
        created_at: new Date().toISOString(),
    });

    if (error) {
        console.error("[telegramSessionService] logBotEvent error:", error.message);
    }
}

module.exports = {
    getOrCreateSession,
    transitionState,
    resetSession,
    linkIdentity,
    findUserByChatId,
    logBotEvent,
};

