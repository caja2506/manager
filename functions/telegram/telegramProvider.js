/**
 * Telegram Provider — Backend (CJS)
 * ====================================
 * Channel adapter bridging generic runtime → Telegram Bot API.
 * This is the ONLY module that touches telegramClient for outbound messages.
 */

const { sendMessage } = require("./telegramClient");
const { createDelivery, markDelivered, markFailed } = require("./telegramDeliveryTracker");
const { incrementTodayMetrics } = require("../automation/metricsUpdater");
const { AUTOMATION_CHANNELS } = require("../automation/constants");

/**
 * Send messages to multiple targets.
 *
 * @param {FirebaseFirestore.Firestore} adminDb
 * @param {string} token - Bot token
 * @param {Array} targets - Resolved targets [{uid, chatId, name, ...}]
 * @param {Function} messageBuilder - (target) => string (builds message text per target)
 * @param {Object} context - { runId, routineKey, dryRun, debug }
 * @returns {Promise<{sentCount: number, failedCount: number, errors: string[]}>}
 */
async function sendToTargets(adminDb, token, targets, messageBuilder, context) {
    const { runId, routineKey, dryRun = false } = context;
    let sentCount = 0;
    let failedCount = 0;
    const errors = [];

    for (const target of targets) {
        const text = await messageBuilder(target);
        if (!text) {
            console.warn(`[telegramProvider] Empty message for ${target.uid}, skipping`);
            continue;
        }

        // Create delivery record (always, even dryRun)
        const deliveryId = await createDelivery(adminDb, {
            chatId: target.chatId,
            userId: target.uid,
            routineKey,
            runId,
            direction: "outbound",
            messageText: text.substring(0, 500), // Truncate for storage
            dryRun,
        });

        if (dryRun) {
            console.log(`[telegramProvider] DRY-RUN: Would send to ${target.name} (${target.chatId})`);
            sentCount++;
            await markDelivered(adminDb, deliveryId);
            continue;
        }

        // Actually send
        const result = await sendMessage(token, target.chatId, text);

        if (result.ok) {
            sentCount++;
            await markDelivered(adminDb, deliveryId, result.messageId);
        } else {
            failedCount++;
            errors.push(`${target.name}: ${result.error}`);
            await markFailed(adminDb, deliveryId, result.error);
        }
    }

    // Update daily metrics for this batch
    try {
        await incrementTodayMetrics(adminDb, AUTOMATION_CHANNELS.TELEGRAM, {
            messagesSent: sentCount,
            failedDeliveries: failedCount,
        });
    } catch (err) {
        console.warn("[telegramProvider] Metrics update error:", err.message);
    }

    return { sentCount, failedCount, errors };
}

/**
 * Send a single message to a specific user (for manual sends, responses, etc.)
 */
async function sendToUser(adminDb, token, userId, chatId, text, context = {}) {
    const { runId = null, routineKey = "direct", dryRun = false } = context;

    const deliveryId = await createDelivery(adminDb, {
        chatId,
        userId,
        routineKey,
        runId,
        direction: "outbound",
        messageText: text.substring(0, 500),
        dryRun,
    });

    if (dryRun) {
        console.log(`[telegramProvider] DRY-RUN: Would send to user ${userId}`);
        await markDelivered(adminDb, deliveryId);
        return { ok: true, deliveryId, dryRun: true };
    }

    const result = await sendMessage(token, chatId, text);

    if (result.ok) {
        await markDelivered(adminDb, deliveryId, result.messageId);
    } else {
        await markFailed(adminDb, deliveryId, result.error);
    }

    return { ok: result.ok, deliveryId, error: result.error };
}

/**
 * Send to alert group chat.
 */
async function sendToGroup(adminDb, token, groupChatId, text, context = {}) {
    if (!groupChatId) return { ok: false, error: "No groupChatId configured" };

    if (context.dryRun) {
        console.log(`[telegramProvider] DRY-RUN: Would send to group ${groupChatId}`);
        return { ok: true, dryRun: true };
    }

    const result = await sendMessage(token, groupChatId, text);
    return result;
}

module.exports = { sendToTargets, sendToUser, sendToGroup };
