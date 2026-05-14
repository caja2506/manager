/**
 * ARIA Heartbeat Handler
 * =======================
 * Routine handler that runs the proactive engine every 15 minutes.
 * Plugged into the unifiedRoutineScheduler in automation.js.
 *
 * ⚠️  COSTO: Solo usa NVIDIA (gratis) opcionalmente para personalizar mensajes.
 *           NUNCA usa Gemini como fallback — riesgo de bucle de costo.
 */

/**
 * @param {Object} context
 * @param {string} context.telegramToken
 * @param {string|null} [context.nvidiaKey]
 * @param {Object|null} [context.adminDb] - Firestore admin for Telegram session lookup
 * @returns {Promise<{success: boolean, sent: number, skipped: number, errors: number}>}
 */
async function ariaHeartbeatHandler({ telegramToken, nvidiaKey, adminDb }) {
    const tag = "[ariaHeartbeatHandler]";
    console.log(`${tag} Starting ARIA proactive heartbeat...`);

    try {
        const { evaluate } = require("../agent/proactiveEngine");
        const result = await evaluate({ telegramToken, nvidiaKey, adminDb });
        console.log(`${tag} Complete — sent=${result.sent} skipped=${result.skipped} errors=${result.errors}`);
        return { success: true, ...result };
    } catch (err) {
        console.error(`${tag} Fatal error:`, err.message);
        return { success: false, sent: 0, skipped: 0, errors: 1, error: err.message };
    }
}

module.exports = { ariaHeartbeatHandler };
