/**
 * Evening Check Handler — Backend (CJS)
 * =======================================
 * Sends daily progress report requests to team leads, engineers, and technicians.
 * Creates pending reports and transitions each user's session to awaiting_daily_report.
 */

const { sendToTargets } = require("../telegram/telegramProvider");
const templates = require("../telegram/telegramTemplates");
const { transitionState } = require("../telegram/telegramSessionService");
const paths = require("../automation/firestorePaths");
const {
    REPORT_STATUS,
    TELEGRAM_SESSION_EVENT,
} = require("../automation/constants");

/**
 * Execute evening check routine for team leads, engineers, and technicians.
 */
async function execute(adminDb, token, targets, context) {
    const { dryRun, runId } = context;
    const now = new Date().toISOString();
    const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Mexico_City" });

    // Pre-processing: create pending report records + transition sessions
    for (const target of targets) {
        if (dryRun) continue;

        try {
            // Create pending telegramReports entry
            await adminDb.collection(paths.TELEGRAM_REPORTS).add({
                userId: target.uid,
                chatId: target.chatId,
                date: today,
                inputType: "text",
                rawText: null,
                parsedData: null,
                progressPercent: null,
                hoursWorked: null,
                blocker: null,
                status: REPORT_STATUS.PENDING,
                requiresConfirmation: true,
                runId,
                onTime: null,
                createdAt: now,
                updatedAt: now,
            });

            // Transition session to awaiting_daily_report
            await transitionState(adminDb, target.chatId, TELEGRAM_SESSION_EVENT.REPORT_REQUESTED);
        } catch (err) {
            console.warn(`[technicianCheck] Pre-process error for ${target.uid}:`, err.message);
        }
    }

    // Send report request messages
    const messageBuilder = (target) => templates.reportRequest({ name: target.name });
    return sendToTargets(adminDb, token, targets, messageBuilder, context);
}

module.exports = { execute };
