/**
 * Telegram Client — Backend (CJS)
 * =================================
 * Modular HTTP client for Telegram Bot API.
 * Handles sendMessage, error responses, and rate-limit awareness.
 */

const BASE_URL = "https://api.telegram.org/bot";

/**
 * Send a text message via Telegram Bot API.
 *
 * @param {string} token - Bot token
 * @param {string|number} chatId - Target chat ID
 * @param {string} text - Message text (supports Markdown V2 or HTML)
 * @param {Object} [options]
 * @param {string} [options.parseMode="HTML"] - "HTML" or "MarkdownV2"
 * @param {boolean} [options.disableNotification=false]
 * @returns {Promise<{ok: boolean, messageId?: number, error?: string}>}
 */
async function sendMessage(token, chatId, text, options = {}) {
    const { parseMode = "HTML", disableNotification = false } = options;
    // Trim token to remove any trailing whitespace/newlines from secrets
    const cleanToken = (token || "").trim();
    const url = `${BASE_URL}${cleanToken}/sendMessage`;

    try {
        const response = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                chat_id: chatId,
                text,
                parse_mode: parseMode,
                disable_notification: disableNotification,
            }),
        });

        const data = await response.json();

        if (!data.ok) {
            console.error(`[telegramClient] sendMessage failed: ${data.description}`, {
                chatId,
                errorCode: data.error_code,
            });
            return {
                ok: false,
                error: data.description || `HTTP ${data.error_code}`,
                errorCode: data.error_code,
            };
        }

        return {
            ok: true,
            messageId: data.result?.message_id,
        };
    } catch (err) {
        console.error("[telegramClient] Network error:", err.message);
        return { ok: false, error: `Network error: ${err.message}` };
    }
}

/**
 * Send a message with an inline keyboard.
 */
async function sendMessageWithKeyboard(token, chatId, text, inlineKeyboard, options = {}) {
    const { parseMode = "HTML" } = options;
    const cleanToken = (token || "").trim();
    const url = `${BASE_URL}${cleanToken}/sendMessage`;

    try {
        const response = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                chat_id: chatId,
                text,
                parse_mode: parseMode,
                reply_markup: { inline_keyboard: inlineKeyboard },
            }),
        });
        const data = await response.json();
        if (!data.ok) {
            console.error(`[telegramClient] sendMessageWithKeyboard failed:`, data.description);
            return { ok: false, error: data.description };
        }
        return { ok: true, messageId: data.result?.message_id };
    } catch (err) {
        console.error("[telegramClient] sendMessageWithKeyboard error:", err.message);
        return { ok: false, error: err.message };
    }
}

/**
 * Answer a callback query (acknowledge inline button press).
 */
async function answerCallbackQuery(token, callbackQueryId, text = "") {
    const cleanToken = (token || "").trim();
    const url = `${BASE_URL}${cleanToken}/answerCallbackQuery`;

    try {
        const response = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                callback_query_id: callbackQueryId,
                text: text || undefined,
            }),
        });
        return response.json();
    } catch (err) {
        console.error("[telegramClient] answerCallbackQuery error:", err.message);
        return { ok: false };
    }
}

/**
 * Set webhook URL for the bot (one-time setup helper).
 */
async function setWebhook(token, webhookUrl) {
    const url = `${BASE_URL}${token}/setWebhook`;
    const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: webhookUrl }),
    });
    return response.json();
}

/**
 * Get current webhook info (diagnostic).
 */
async function getWebhookInfo(token) {
    const url = `${BASE_URL}${token}/getWebhookInfo`;
    const response = await fetch(url);
    return response.json();
}

/**
 * Persistent reply keyboard for main menu.
 */
const WEBAPP_URL = "https://bom-ame-cr.web.app/tg-report";

const MAIN_MENU_KEYBOARD = {
    keyboard: [
        [{ text: "⚡ Quick Report" }, { text: "📝 Reportar" }],
        [{ text: "📊 Status" }, { text: "❓ Ayuda" }],
    ],
    resize_keyboard: true,
    one_time_keyboard: false,
};

/**
 * Send a message with a persistent reply keyboard (main menu).
 */
async function sendMessageWithReplyKeyboard(token, chatId, text, options = {}) {
    const { parseMode = "HTML" } = options;
    const cleanToken = (token || "").trim();
    const url = `${BASE_URL}${cleanToken}/sendMessage`;

    try {
        const response = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                chat_id: chatId,
                text,
                parse_mode: parseMode,
                reply_markup: MAIN_MENU_KEYBOARD,
            }),
        });
        const data = await response.json();
        if (!data.ok) {
            console.error(`[telegramClient] sendMessageWithReplyKeyboard failed:`, data.description);
            return { ok: false, error: data.description };
        }
        return { ok: true, messageId: data.result?.message_id };
    } catch (err) {
        console.error("[telegramClient] sendMessageWithReplyKeyboard error:", err.message);
        return { ok: false, error: err.message };
    }
}

module.exports = {
    sendMessage, sendMessageWithKeyboard, sendMessageWithReplyKeyboard,
    answerCallbackQuery, setWebhook, getWebhookInfo, MAIN_MENU_KEYBOARD,
};
