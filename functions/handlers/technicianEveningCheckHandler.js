/**
 * Evening Check Handler — Backend (CJS)
 * =======================================
 * Sends daily progress report requests to team leads, engineers, and technicians.
 * Creates pending reports and transitions each user's session to awaiting_daily_report.
 */

const { sendToTargets } = require("../telegram/telegramProvider");
const templates = require("../telegram/telegramTemplates");
const { transitionState } = require("../telegram/telegramSessionService");
const { REPORT_STATUS, TELEGRAM_SESSION_EVENT } = require("../automation/constants");
const { getSupabase } = require("../db/supabaseAdmin");

/**
 * Execute evening check routine for team leads, engineers, and technicians.
 */
async function execute(adminDb, token, targets, context) {
    const { dryRun, runId } = context;
    const now = new Date().toISOString();
    const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Costa_Rica" });
    const sb = getSupabase();

    // Pre-processing: create pending report records + transition sessions
    for (const target of targets) {
        if (dryRun) continue;

        try {
            // Create pending telegram_reports entry in Supabase
            const { error } = await sb.from("telegram_reports").insert({
                user_id: target.uid,
                date: today,
                input_type: "text",
                content: "",
                status: REPORT_STATUS.PENDING,
                parsed_data: {
                    requiresConfirmation: true,
                    runId,
                    onTime: null,
                },
                sent_at: now,
                created_at: now,
            });

            if (error) {
                console.warn(`[technicianCheck] Failed to create pending report in Supabase:`, error.message);
            }

            // Transition session to awaiting_daily_report
            await transitionState(null, target.chatId, TELEGRAM_SESSION_EVENT.REPORT_REQUESTED);
        } catch (err) {
            console.warn(`[technicianCheck] Pre-process error for ${target.uid}:`, err.message);
        }
    }

    // Send report request messages
    const messageBuilder = (target) => templates.reportRequest({ name: target.name });
    return sendToTargets(null, token, targets, messageBuilder, context);
}

module.exports = { execute };

