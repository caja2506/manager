/**
 * Manual Test Message Handler — Backend (CJS)
 * ==============================================
 * Sends a test message to a specific user.
 * Used for verifying Telegram connectivity from the UI.
 */

const { sendToTargets } = require("../telegram/telegramProvider");
const templates = require("../telegram/telegramTemplates");

/**
 * Execute manual test message.
 */
async function execute(adminDb, token, targets, context) {
    const { options = {} } = context;
    const timestamp = new Date().toLocaleString("es-CR", { timeZone: "America/Costa_Rica" });

    const messageBuilder = (target) => {
        if (options.message) {
            return `🧪 <b>Mensaje de prueba</b>\n\n${options.message}`;
        }
        return templates.testMessage({ name: target.name, timestamp });
    };

    return sendToTargets(adminDb, token, targets, messageBuilder, context);
}

module.exports = { execute };
