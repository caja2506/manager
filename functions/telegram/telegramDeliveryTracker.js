/**
 * Telegram Delivery Tracker — Backend (CJS)
 * ============================================
 * Tracks every outbound/inbound message for traceability.
 */

const paths = require("../automation/firestorePaths");
const { DELIVERY_STATUS } = require("../automation/constants");

/**
 * Create a delivery record.
 * @returns {string} delivery document ID
 */
async function createDelivery(adminDb, {
    chatId,
    userId = null,
    routineKey = null,
    runId = null,
    direction = "outbound",
    messageText = "",
    dryRun = false,
    telegramMessageId = null,
}) {
    const now = new Date().toISOString();
    const ref = await adminDb.collection(paths.TELEGRAM_DELIVERIES).add({
        chatId: String(chatId),
        userId,
        routineKey,
        runId,
        direction,
        messageText,
        deliveryStatus: DELIVERY_STATUS.PENDING,
        telegramMessageId,
        dryRun,
        sentAt: now,
        deliveredAt: null,
        respondedAt: null,
        failedAt: null,
        errorMessage: null,
        createdAt: now,
        updatedAt: now,
    });
    return ref.id;
}

/**
 * Mark delivery as delivered (Telegram API returned 200).
 */
async function markDelivered(adminDb, deliveryId, telegramMessageId = null) {
    const now = new Date().toISOString();
    const update = {
        deliveryStatus: DELIVERY_STATUS.DELIVERED,
        deliveredAt: now,
        updatedAt: now,
    };
    if (telegramMessageId) update.telegramMessageId = telegramMessageId;
    await adminDb.collection(paths.TELEGRAM_DELIVERIES).doc(deliveryId).update(update);
}

/**
 * Mark delivery as failed.
 */
async function markFailed(adminDb, deliveryId, error) {
    await adminDb.collection(paths.TELEGRAM_DELIVERIES).doc(deliveryId).update({
        deliveryStatus: DELIVERY_STATUS.FAILED,
        failedAt: new Date().toISOString(),
        errorMessage: error || "Unknown error",
        updatedAt: new Date().toISOString(),
    });
}

/**
 * Mark a delivery as responded (user replied in context).
 * Links response to the most recent outbound delivery for this chatId + routineKey.
 */
async function markResponded(adminDb, chatId, routineKey) {
    const snap = await adminDb.collection(paths.TELEGRAM_DELIVERIES)
        .where("chatId", "==", String(chatId))
        .where("routineKey", "==", routineKey)
        .where("direction", "==", "outbound")
        .where("deliveryStatus", "==", DELIVERY_STATUS.DELIVERED)
        .orderBy("sentAt", "desc")
        .limit(1)
        .get();

    if (snap.empty) return null;

    const docRef = snap.docs[0].ref;
    await docRef.update({
        deliveryStatus: DELIVERY_STATUS.RESPONDED,
        respondedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    });
    return docRef.id;
}

module.exports = { createDelivery, markDelivered, markFailed, markResponded };
