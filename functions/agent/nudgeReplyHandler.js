/**
 * ARIA Nudge Reply Handler
 * =========================
 * When a user replies to a nudge message in Telegram, this handler:
 * 1. Looks up the nudge record by telegram_message_id + chat_id
 * 2. Finds the associated task (target_id)
 * 3. Inserts the reply text as a task_comment
 * 4. Confirms to the user via Telegram
 *
 * ⚠️ This is a READ+WRITE operation but it's safe:
 *    - Only ADDS a comment (no state mutation)
 *    - Uses the user's own ID (no impersonation)
 *    - Fully auditable via task_comments table
 */

/**
 * Check if an inbound Telegram message is a reply to an ARIA nudge.
 * If so, save it as a task comment.
 *
 * @param {Object} params
 * @param {string} params.chatId
 * @param {string} params.userId
 * @param {string} params.userName
 * @param {string} params.replyText - User's reply text
 * @param {number} params.replyToMessageId - The message_id being replied to
 * @returns {Promise<{handled: boolean, taskId?: string, error?: string}>}
 */
async function handleNudgeReply({ chatId, userId, userName, replyText, replyToMessageId }) {
    const tag = "[nudgeReplyHandler]";

    if (!replyToMessageId || !replyText) {
        return { handled: false };
    }

    try {
        const { getSupabase } = require("../db/supabaseAdmin");
        const sb = getSupabase();

        // 1. Look up: was this reply directed at a nudge message?
        const { data: nudges, error: nudgeErr } = await sb
            .from("agent_nudges")
            .select("target_id, rule_key, user_id")
            .eq("chat_id", String(chatId))
            .eq("telegram_message_id", replyToMessageId)
            .limit(1);

        if (nudgeErr || !nudges || nudges.length === 0) {
            // Not a reply to a nudge — let normal flow handle it
            return { handled: false };
        }

        const nudge = nudges[0];
        const taskId = nudge.target_id;

        if (!taskId) {
            console.log(`${tag} Nudge found but no target_id (global rule: ${nudge.rule_key})`);
            return { handled: false };
        }

        // 2. Load the task to get its title for the confirmation message
        const coreReader = require("../db/coreDataReader");
        const task = await coreReader.loadTask(taskId);
        const taskTitle = task?.title || taskId;

        // 3. Insert as task_comment
        const { error: insertErr } = await sb.from("task_comments").insert({
            task_id: taskId,
            user_id: userId,
            user_name: userName || "Usuario",
            text: `[vía ARIA Telegram] ${replyText}`,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        });

        if (insertErr) {
            console.error(`${tag} Failed to insert comment:`, insertErr.message);
            return { handled: true, taskId, error: insertErr.message };
        }

        console.log(`${tag} ✅ Comment saved for task ${taskId} from user ${userId}`);
        return {
            handled: true,
            taskId,
            taskTitle,
        };
    } catch (err) {
        console.error(`${tag} Error:`, err.message);
        return { handled: false, error: err.message };
    }
}

module.exports = { handleNudgeReply };
