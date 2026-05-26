/**
 * ARIA Agent — Confirmation Flow (Phase 5)
 * ==========================================
 * Manages the pending write action state for ARIA.
 *
 * When ARIA detects a write intent, it stores the pending action
 * in the Telegram session (Firestore). When the user responds
 * "Sí" or "No", the action is executed or cancelled.
 *
 * The pending action has a 5-minute timeout — if the user doesn't
 * respond, the action is automatically cancelled on next interaction.
 */

const PENDING_ACTION_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Save a pending write action to the user's Telegram session.
 *
 * @param {FirebaseFirestore.Firestore} adminDb
 * @param {string} chatId
 * @param {Object} action - The pending action
 * @param {string} action.toolName - e.g., "createTask", "addTaskComment"
 * @param {Object} action.params - Parameters for the write tool
 * @param {string} action.confirmMessage - The message shown to the user
 * @returns {Promise<void>}
 */
async function setPendingAction(adminDb, chatId, action) {
    const paths = require("../automation/firestorePaths");
    const chatIdStr = String(chatId);

    const snap = await adminDb.collection(paths.TELEGRAM_SESSIONS)
        .where("chatId", "==", chatIdStr)
        .limit(1)
        .get();

    if (snap.empty) {
        console.warn("[confirmationFlow] No session found for chatId:", chatIdStr);
        return;
    }

    const sessionRef = snap.docs[0].ref;
    await sessionRef.update({
        "metadata.pendingAriaAction": {
            toolName: action.toolName,
            params: action.params,
            confirmMessage: action.confirmMessage,
            createdAt: new Date().toISOString(),
        },
        updatedAt: new Date().toISOString(),
    });

    console.log(`[confirmationFlow] Pending action set: ${action.toolName} for chat ${chatIdStr}`);
}

/**
 * Get the pending write action for a chat, if any.
 * Returns null if no action is pending or if it has expired.
 *
 * @param {FirebaseFirestore.Firestore} adminDb
 * @param {string} chatId
 * @returns {Promise<Object|null>} The pending action or null
 */
async function getPendingAction(adminDb, chatId) {
    const paths = require("../automation/firestorePaths");
    const chatIdStr = String(chatId);

    const snap = await adminDb.collection(paths.TELEGRAM_SESSIONS)
        .where("chatId", "==", chatIdStr)
        .limit(1)
        .get();

    if (snap.empty) return null;

    const session = snap.docs[0].data();
    const pending = session?.metadata?.pendingAriaAction;

    if (!pending || !pending.toolName) return null;

    // Check timeout
    const createdAt = new Date(pending.createdAt).getTime();
    if (Date.now() - createdAt > PENDING_ACTION_TIMEOUT_MS) {
        // Expired — auto-clear
        console.log(`[confirmationFlow] Pending action expired for chat ${chatIdStr}`);
        await clearPendingAction(adminDb, chatId);
        return null;
    }

    return pending;
}

/**
 * Clear the pending write action after execution or cancellation.
 *
 * @param {FirebaseFirestore.Firestore} adminDb
 * @param {string} chatId
 * @returns {Promise<void>}
 */
async function clearPendingAction(adminDb, chatId) {
    const paths = require("../automation/firestorePaths");
    const { FieldValue } = require("firebase-admin/firestore");
    const chatIdStr = String(chatId);

    const snap = await adminDb.collection(paths.TELEGRAM_SESSIONS)
        .where("chatId", "==", chatIdStr)
        .limit(1)
        .get();

    if (snap.empty) return;

    await snap.docs[0].ref.update({
        "metadata.pendingAriaAction": FieldValue.delete(),
        updatedAt: new Date().toISOString(),
    });

    console.log(`[confirmationFlow] Pending action cleared for chat ${chatIdStr}`);
}

/**
 * Check if a user's text message is a confirmation response (Sí/No).
 *
 * @param {string} text
 * @returns {'yes' | 'no' | null}
 */
function parseConfirmationResponse(text) {
    if (!text) return null;
    const lower = text.toLowerCase().trim();

    const yesValues = ["sí", "si", "yes", "ok", "confirmo", "dale", "hazlo", "va", "correcto", "afirmativo"];
    const noValues = ["no", "nope", "negativo", "cancelar", "cancel", "olvídalo", "olvidalo", "déjalo", "dejalo"];

    if (yesValues.includes(lower)) return "yes";
    if (noValues.includes(lower)) return "no";
    return null;
}

module.exports = {
    setPendingAction,
    getPendingAction,
    clearPendingAction,
    parseConfirmationResponse,
    PENDING_ACTION_TIMEOUT_MS,
};
