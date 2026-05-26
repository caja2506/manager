/**
 * ARIA Agent — Nudge Tracker (Anti-Spam)
 * =========================================
 * Tracks which nudges have been sent and when, to prevent ARIA
 * from being annoying. Uses the `agent_nudges` Supabase table.
 *
 * Design: check before sending, record after sending.
 */

/**
 * Check if a nudge has already been sent within the cooldown window.
 *
 * @param {string} userId
 * @param {string} ruleKey - e.g. 'overdue_reminder', 'no_report_nudge'
 * @param {string|null} targetId - specific task/project ID (null for global rules)
 * @param {number} cooldownHours - minimum hours between sends for this rule
 * @returns {Promise<boolean>} true if the nudge was already sent (should skip)
 */
async function wasSentRecently(userId, ruleKey, targetId, cooldownHours) {
    const { getSupabase } = require("../db/supabaseAdmin");
    const sb = getSupabase();

    const cutoff = new Date(Date.now() - cooldownHours * 3600 * 1000).toISOString();

    let query = sb
        .from("agent_nudges")
        .select("sent_at")
        .eq("user_id", userId)
        .eq("rule_key", ruleKey)
        .gte("sent_at", cutoff);

    if (targetId) {
        query = query.eq("target_id", targetId);
    } else {
        query = query.is("target_id", null);
    }

    const { data, error } = await query.limit(1);
    if (error) {
        console.warn(`[nudgeTracker] wasSentRecently error (${ruleKey}):`, error.message);
        return false; // On error, allow sending (fail open)
    }

    return data && data.length > 0;
}

/**
 * Record that a nudge was sent.
 *
 * @param {string} userId
 * @param {string} ruleKey
 * @param {string|null} targetId
 * @param {string} messagePreview - First 120 chars of the message
 * @param {Object} [extra] - { chatId, telegramMessageId }
 * @returns {Promise<void>}
 */
async function recordNudge(userId, ruleKey, targetId, messagePreview, extra = {}) {
    const { getSupabase } = require("../db/supabaseAdmin");
    const sb = getSupabase();

    const { error } = await sb.from("agent_nudges").insert({
        user_id: userId,
        rule_key: ruleKey,
        target_id: targetId || null,
        sent_at: new Date().toISOString(),
        message_preview: (messagePreview || "").substring(0, 120),
        chat_id: extra.chatId || null,
        telegram_message_id: extra.telegramMessageId || null,
    });

    if (error) {
        console.warn(`[nudgeTracker] First insert failed (error: ${error.message}), trying simplified fallback insert...`);
        const { error: err2 } = await sb.from("agent_nudges").insert({
            user_id: userId,
            rule_key: ruleKey,
            target_id: targetId || null,
            sent_at: new Date().toISOString(),
            message_preview: (messagePreview || "").substring(0, 120),
        });
        if (err2) {
            console.error(`[nudgeTracker] recordNudge fallback error:`, err2.message);
        } else {
            console.log(`[nudgeTracker] recordNudge fallback insert succeeded for user ${userId}`);
        }
    }
}

/**
 * Get stats for a user: how many nudges sent in the last 24h.
 * Used to enforce a daily cap per user.
 *
 * @param {string} userId
 * @returns {Promise<number>}
 */
async function getDailyNudgeCount(userId) {
    const { getSupabase } = require("../db/supabaseAdmin");
    const sb = getSupabase();

    const cutoff = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    const { count, error } = await sb
        .from("agent_nudges")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .gte("sent_at", cutoff);

    if (error) {
        console.warn("[nudgeTracker] getDailyNudgeCount error:", error.message);
        return 0;
    }
    return count || 0;
}

module.exports = {
    wasSentRecently,
    recordNudge,
    getDailyNudgeCount,
};
