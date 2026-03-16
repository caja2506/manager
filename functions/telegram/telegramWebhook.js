/**
 * Telegram Webhook — Backend (CJS)
 * ===================================
 * Handles incoming HTTP requests from Telegram webhook.
 * Supports text, audio, and inline button callback queries.
 */

const { routeInboundMessage, routeCallbackQuery } = require("./telegramRouter");
const { logBotEvent } = require("./telegramSessionService");
const { TELEGRAM_BOT_LOG_EVENT } = require("../automation/constants");

/**
 * Process an incoming Telegram webhook request.
 */
async function handleWebhook(adminDb, token, body) {
    if (!body) {
        return { processed: false, error: "Empty body" };
    }

    // ── Handle callback_query (inline button presses) ──
    if (body.callback_query) {
        const cbQuery = body.callback_query;
        const chatId = cbQuery.message?.chat?.id;
        const callbackData = cbQuery.data;
        const callbackQueryId = cbQuery.id;

        if (!chatId) {
            return { processed: false, error: "No chat ID in callback_query" };
        }

        await logBotEvent(adminDb, String(chatId), TELEGRAM_BOT_LOG_EVENT.WEBHOOK_RECEIVED, {
            type: "callback_query",
            callbackData,
            from: cbQuery.from?.username || cbQuery.from?.first_name,
        });

        try {
            await routeCallbackQuery(adminDb, token, chatId, callbackData, callbackQueryId, {
                apiKey: body._apiKey,
            });
            return { processed: true };
        } catch (err) {
            console.error("[webhook] Error processing callback_query:", err);
            await logBotEvent(adminDb, String(chatId), TELEGRAM_BOT_LOG_EVENT.ERROR, {
                error: err.message,
                callbackData,
            });
            return { processed: false, error: err.message };
        }
    }

    // ── Handle regular messages ──
    const message = body.message || body.edited_message;

    if (!message) {
        console.log("[webhook] Non-message update received, skipping");
        return { processed: false, error: "No message in update" };
    }

    const chatId = message.chat?.id;
    const text = message.text;
    const messageId = message.message_id;
    const hasVoice = !!message.voice;
    const hasAudio = !!message.audio;
    const isAudioMessage = hasVoice || hasAudio;

    if (!chatId) {
        return { processed: false, error: "No chat ID in message" };
    }

    await logBotEvent(adminDb, String(chatId), TELEGRAM_BOT_LOG_EVENT.WEBHOOK_RECEIVED, {
        messageId,
        hasText: !!text,
        hasVoice,
        hasAudio,
        chatType: message.chat?.type,
        from: message.from?.username || message.from?.first_name,
    });

    try {
        if (text) {
            await routeInboundMessage(adminDb, token, chatId, text, message, {
                apiKey: body._apiKey,
            });
            return { processed: true };
        }

        if (isAudioMessage) {
            await routeInboundMessage(adminDb, token, chatId, null, message, {
                inputType: "audio",
                apiKey: body._apiKey,
            });
            return { processed: true };
        }

        console.log("[webhook] Unsupported message type");
        return { processed: false, error: "Unsupported message type" };
    } catch (err) {
        console.error("[webhook] Error processing message:", err);
        await logBotEvent(adminDb, String(chatId), TELEGRAM_BOT_LOG_EVENT.ERROR, {
            error: err.message,
            messageId,
        });
        return { processed: false, error: err.message };
    }
}

module.exports = { handleWebhook };
