/**
 * Telegram Delivery Tracker — Backend (CJS)
 * ============================================
 * Tracks every outbound/inbound message for traceability in Supabase.
 */

const { getSupabase } = require("../db/supabaseAdmin");
const { DELIVERY_STATUS } = require("../automation/constants");

/**
 * Create a delivery record.
 * @returns {string} delivery document ID (UUID)
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
    const sb = getSupabase();

    const { data, error } = await sb.from("telegram_deliveries").insert({
        chat_id: String(chatId),
        user_id: userId,
        routine_key: routineKey,
        run_id: runId,
        direction,
        message_text: messageText,
        delivery_status: DELIVERY_STATUS.PENDING,
        telegram_message_id: telegramMessageId ? Number(telegramMessageId) : null,
        dry_run: dryRun,
        sent_at: now,
        created_at: now,
        updated_at: now,
    }).select("id").single();

    if (error) {
        console.error("[telegramDeliveryTracker] createDelivery error:", error.message);
        throw error;
    }

    return data.id;
}

/**
 * Mark delivery as delivered (Telegram API returned 200).
 */
async function markDelivered(adminDb, deliveryId, telegramMessageId = null) {
    const now = new Date().toISOString();
    const sb = getSupabase();

    const updates = {
        delivery_status: DELIVERY_STATUS.DELIVERED,
        delivered_at: now,
        updated_at: now,
    };
    if (telegramMessageId) updates.telegram_message_id = Number(telegramMessageId);

    const { error } = await sb.from("telegram_deliveries")
        .update(updates)
        .eq("id", deliveryId);

    if (error) {
        console.error("[telegramDeliveryTracker] markDelivered error:", error.message);
    }
}

/**
 * Mark delivery as failed.
 */
async function markFailed(adminDb, deliveryId, error) {
    const sb = getSupabase();

    const { error: err } = await sb.from("telegram_deliveries")
        .update({
            delivery_status: DELIVERY_STATUS.FAILED,
            failed_at: new Date().toISOString(),
            error_message: error || "Unknown error",
            updated_at: new Date().toISOString(),
        })
        .eq("id", deliveryId);

    if (err) {
        console.error("[telegramDeliveryTracker] markFailed error:", err.message);
    }
}

/**
 * Mark a delivery as responded (user replied in context).
 * Links response to the most recent outbound delivery for this chatId + routineKey.
 */
async function markResponded(adminDb, chatId, routineKey) {
    const sb = getSupabase();

    // Find the most recent outbound delivery that is delivered for this chatId and routineKey
    const { data, error } = await sb.from("telegram_deliveries")
        .select("id")
        .eq("chat_id", String(chatId))
        .eq("routine_key", routineKey)
        .eq("direction", "outbound")
        .eq("delivery_status", DELIVERY_STATUS.DELIVERED)
        .order("sent_at", { ascending: false })
        .limit(1)
        .maybeSingle();

    if (error || !data) return null;

    const { error: updateErr } = await sb.from("telegram_deliveries")
        .update({
            delivery_status: DELIVERY_STATUS.RESPONDED,
            responded_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        })
        .eq("id", data.id);

    if (updateErr) {
        console.error("[telegramDeliveryTracker] markResponded error:", updateErr.message);
    }

    return data.id;
}

module.exports = { createDelivery, markDelivered, markFailed, markResponded };

