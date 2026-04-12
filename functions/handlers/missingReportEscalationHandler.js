/**
 * Missing Report Escalation Handler — Backend (CJS)
 * =====================================================
 * Detects technicians who haven't responded after grace period.
 * Sends escalation to technician + notifies supervisor.
 */

const { sendToUser } = require("../telegram/telegramProvider");
const templates = require("../telegram/telegramTemplates");
const { transitionState, logBotEvent } = require("../telegram/telegramSessionService");
const { resolveSupervisor, resolveTargetById } = require("../automation/targetResolver");
const { incrementTodayMetrics } = require("../automation/metricsUpdater");
const paths = require("../automation/firestorePaths");
const {
    REPORT_STATUS,
    ESCALATION_TYPE,
    ESCALATION_STATUS,
    TELEGRAM_SESSION_EVENT,
    TELEGRAM_BOT_LOG_EVENT,
    AUTOMATION_CHANNELS,
} = require("../automation/constants");

/**
 * Execute missing report escalation.
 * Unlike other handlers, this doesn't use sendToTargets because
 * targets are determined by checking pending reports.
 */
async function execute(adminDb, token, targets, context) {
    const { dryRun, runId } = context;
    const now = new Date();
    const today = now.toLocaleDateString("en-CA", { timeZone: "America/Costa_Rica" });

    // Find pending reports for today
    const pendingSnap = await adminDb.collection(paths.TELEGRAM_REPORTS)
        .where("date", "==", today)
        .where("status", "==", REPORT_STATUS.PENDING)
        .get();

    if (pendingSnap.empty) {
        console.log("[escalation] No pending reports found");
        return { sentCount: 0, failedCount: 0, errors: [], escalatedCount: 0 };
    }

    // Load telegramOps for grace period
    const tgConfigSnap = await adminDb.collection(paths.SETTINGS).doc("telegramOps").get();
    const gracePeriodMs = (tgConfigSnap.exists ? tgConfigSnap.data().gracePeriodMinutes : 30) * 60 * 1000;

    let sentCount = 0;
    let failedCount = 0;
    let escalatedCount = 0;
    const errors = [];

    for (const doc of pendingSnap.docs) {
        const report = doc.data();
        const createdAt = new Date(report.createdAt);
        const elapsed = now.getTime() - createdAt.getTime();

        // Only escalate if grace period exceeded
        if (elapsed < gracePeriodMs) continue;

        const minutesLate = Math.round(elapsed / 60000);

        try {
            // Resolve technician target
            const target = await resolveTargetById(adminDb, report.userId);
            if (!target) {
                console.warn(`[escalation] Cannot resolve user ${report.userId}`);
                continue;
            }

            if (!dryRun) {
                // ── 1. Send escalation to technician ──
                const techResult = await sendToUser(
                    adminDb, token, target.uid, target.chatId,
                    templates.escalationToTechnician({ name: target.name, minutesLate }),
                    { runId, routineKey: "missing_report_escalation", dryRun }
                );

                if (techResult.ok) sentCount++;
                else {
                    failedCount++;
                    errors.push(`Tech ${target.name}: ${techResult.error}`);
                }

                // ── 2. Notify supervisor ──
                const supervisor = await resolveSupervisor(adminDb, target.uid);
                if (supervisor) {
                    const supResult = await sendToUser(
                        adminDb, token, supervisor.uid, supervisor.chatId,
                        templates.escalationToSupervisor({
                            technicianName: target.name,
                            supervisorName: supervisor.name,
                            minutesLate,
                        }),
                        { runId, routineKey: "missing_report_escalation", dryRun }
                    );

                    if (supResult.ok) sentCount++;
                    else errors.push(`Sup ${supervisor.name}: ${supResult.error}`);
                }

                // ── 3. Create escalation record ──
                await adminDb.collection(paths.TELEGRAM_ESCALATIONS).add({
                    type: ESCALATION_TYPE.MISSING_REPORT,
                    userId: target.uid,
                    chatId: target.chatId,
                    supervisorId: supervisor?.uid || null,
                    reportId: doc.id,
                    status: ESCALATION_STATUS.PENDING,
                    minutesLate,
                    message: `Reporte pendiente - ${minutesLate} min tarde`,
                    resolvedAt: null,
                    createdAt: now.toISOString(),
                    updatedAt: now.toISOString(),
                });

                // ── 4. Update report status ──
                await doc.ref.update({
                    status: REPORT_STATUS.ESCALATED,
                    updatedAt: now.toISOString(),
                });

                // ── 5. Transition state ──
                await transitionState(adminDb, target.chatId, TELEGRAM_SESSION_EVENT.GRACE_PERIOD_EXPIRED);

                // ── 6. Log ──
                await logBotEvent(adminDb, target.chatId, TELEGRAM_BOT_LOG_EVENT.ESCALATION_TRIGGERED, {
                    userId: target.uid, minutesLate, reportId: doc.id,
                });

                escalatedCount++;
            } else {
                console.log(`[escalation] DRY-RUN: Would escalate ${target.name} (${minutesLate} min late)`);
                sentCount++;
                escalatedCount++;
            }
        } catch (err) {
            console.error(`[escalation] Error for report ${doc.id}:`, err);
            errors.push(err.message);
            failedCount++;
        }
    }

    // Update metrics
    try {
        await incrementTodayMetrics(adminDb, AUTOMATION_CHANNELS.TELEGRAM, {
            escalationsTriggered: escalatedCount,
        });
    } catch (e) {
        console.warn("[escalation] Metrics error:", e.message);
    }

    return { sentCount, failedCount, errors, escalatedCount };
}

module.exports = { execute };
