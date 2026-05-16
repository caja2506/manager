/**
 * ARIA Heartbeat Handler
 * =======================
 * Routine handler that runs the proactive engine every 15 minutes.
 * Plugged into the unifiedRoutineScheduler in automation.js.
 *
 * ⚠️  COSTO: Solo usa NVIDIA (gratis) opcionalmente para personalizar mensajes.
 *           NUNCA usa Gemini como fallback — riesgo de bucle de costo.
 *
 * Flow:
 * 1. Read agent config from Supabase (enabled, schedule, kill switch)
 * 2. Check if current time is within operating hours
 * 3. If enabled → run proactive engine (nudges)
 * 4. At specific hours → run scheduled review tasks
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
        // ── 1. Load config from Supabase ──
        const coreReader = require("../db/coreDataReader");
        const config = await coreReader.loadProactiveAgentConfig();

        // Check kill switch / enabled state
        if (!config || config.enabled === false) {
            console.log(`${tag} Agent is DISABLED in config. Skipping.`);
            return { success: true, sent: 0, skipped: 0, errors: 0, reason: "disabled" };
        }

        // ── 2. Check operating hours ──
        const now = new Date();
        const costaRicaTime = now.toLocaleString("en-US", { timeZone: "America/Costa_Rica" });
        const currentHour = new Date(costaRicaTime).getHours();
        const currentDay = new Date(costaRicaTime).getDay(); // 0=Sun, 6=Sat

        // Skip weekends
        if (currentDay === 0 || currentDay === 6) {
            console.log(`${tag} Weekend — skipping.`);
            return { success: true, sent: 0, skipped: 0, errors: 0, reason: "weekend" };
        }

        // Parse schedule (default 7:00 - 17:00)
        const startHour = parseInt((config.startTime || "07:00").split(":")[0], 10);
        const endHour = parseInt((config.endTime || "17:00").split(":")[0], 10);

        if (currentHour < startHour || currentHour >= endHour) {
            console.log(`${tag} Outside operating hours (${startHour}:00-${endHour}:00, current=${currentHour}:00). Skipping.`);
            return { success: true, sent: 0, skipped: 0, errors: 0, reason: "outside_hours" };
        }

        console.log(`${tag} Operating hours OK (${startHour}-${endHour}, now=${currentHour}). Running evaluation...`);

        // ── 3. Run proactive engine (nudges) ──
        const { evaluate } = require("../agent/proactiveEngine");
        const result = await evaluate({ telegramToken, nvidiaKey, adminDb });
        console.log(`${tag} Nudges — sent=${result.sent} skipped=${result.skipped} errors=${result.errors}`);

        // ── 4. Run scheduled review tasks ──
        let reviewResults = { reviews: [] };
        try {
            const { runScheduledReviews } = require("../agent/ariaReviewEngine");
            reviewResults = await runScheduledReviews({ currentHour });
            if (reviewResults.reviews.length > 0) {
                console.log(`${tag} Reviews — ${reviewResults.reviews.length} completed (${reviewResults.reviews.map(r => r.type).join(", ")})`);
            }
        } catch (reviewErr) {
            console.warn(`${tag} Review engine error (non-fatal):`, reviewErr.message);
        }

        return {
            success: true,
            ...result,
            reviews: reviewResults.reviews.length,
        };
    } catch (err) {
        console.error(`${tag} Fatal error:`, err.message);
        return { success: false, sent: 0, skipped: 0, errors: 1, error: err.message };
    }
}

module.exports = { ariaHeartbeatHandler };
