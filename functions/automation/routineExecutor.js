/**
 * Routine Executor — Backend (CJS)
 * ==================================
 * Core execution engine for automation routines.
 * Orchestrates the full lifecycle: guard → run → resolve → handler → complete.
 *
 * The executor NEVER calls Telegram directly — it delegates to handlers
 * which in turn use the provider adapter.
 */

const { shouldRoutineRun } = require("./scheduleGuards");
const { createRun, completeRun, updateRoutineLastRun } = require("./runTracker");
const { resolveTargetsByRole } = require("./targetResolver");
const { incrementTodayMetrics } = require("./metricsUpdater");
const { RUN_STATUS, TRIGGER_TYPE, AUTOMATION_CHANNELS } = require("./constants");

// Handler registry — maps routine key to handler module
const HANDLER_REGISTRY = {
    morning_digest_all: () => require("../handlers/morningDigestHandler"),
    technician_evening_check: () => require("../handlers/technicianEveningCheckHandler"),
    missing_report_escalation: () => require("../handlers/missingReportEscalationHandler"),
    manual_test_message: () => require("../handlers/manualTestMessageHandler"),
    engineer_risk_digest: () => require("../handlers/genericDigestHandler").engineerRiskDigest,
    block_incident_alert: () => require("../handlers/genericDigestHandler").blockIncidentAlert,
    close_day_report: () => require("../handlers/closeDayReportHandler"),
    open_day: () => require("../handlers/openDayHandler"),
    daily_performance_report: () => require("../handlers/dailyPerformanceReportHandler"),
    planner_timer_sync: () => require("../handlers/plannerTimerSyncHandler"),
};

/**
 * Execute a routine by key.
 *
 * @param {FirebaseFirestore.Firestore} adminDb
 * @param {string} token - Telegram bot token
 * @param {string} routineKey - Routine to execute
 * @param {string} triggerType - TRIGGER_TYPE value
 * @param {Object} [options] - { targetUserId, message, forceDryRun }
 * @returns {Promise<{success: boolean, runId: string, status: string, error?: string}>}
 */
async function executeRoutine(adminDb, token, routineKey, triggerType, options = {}) {
    const tag = `[routineExecutor:${routineKey}]`;

    // ── 1. Guard: should this routine run? ──
    const guard = await shouldRoutineRun(adminDb, routineKey);
    if (!guard.shouldRun && triggerType !== TRIGGER_TYPE.MANUAL && triggerType !== TRIGGER_TYPE.DAY_SCHEDULE) {
        console.log(`${tag} Skipped: ${guard.reason}`);
        return { success: false, runId: null, status: "skipped", error: guard.reason };
    }

    // For manual triggers, we still need routine config even if disabled
    let routine = guard.routine;
    let effectiveDryRun = guard.effectiveDryRun ?? false;
    let effectiveDebug = guard.effectiveDebug ?? false;

    if (!routine && (triggerType === TRIGGER_TYPE.MANUAL || triggerType === TRIGGER_TYPE.DAY_SCHEDULE)) {
        const paths = require("./firestorePaths");
        const snap = await adminDb.collection(paths.AUTOMATION_ROUTINES).doc(routineKey).get();
        if (!snap.exists) {
            // Auto-seed the routine doc for DAY_SCHEDULE triggers
            if (triggerType === TRIGGER_TYPE.DAY_SCHEDULE) {
                console.log(`${tag} Auto-seeding routine doc: ${routineKey}`);
                await adminDb.collection(paths.AUTOMATION_ROUTINES).doc(routineKey).set({
                    key: routineKey,
                    name: routineKey,
                    description: `Auto-created by scheduler`,
                    enabled: true,
                    scheduleType: "interval",
                    channel: "none",
                    targetRole: "all",
                    dryRun: false,
                    debugMode: false,
                    createdAt: new Date().toISOString(),
                });
                // Re-read after creation
                const newSnap = await adminDb.collection(paths.AUTOMATION_ROUTINES).doc(routineKey).get();
                routine = { ...newSnap.data(), key: routineKey };
            } else {
                return { success: false, runId: null, status: "error", error: `Routine "${routineKey}" not found` };
            }
        } else {
            routine = { ...snap.data(), key: routineKey };
        }
        const coreSnap = await adminDb.collection(paths.SETTINGS).doc(paths.SETTINGS_DOCS.AUTOMATION_CORE).get();
        const coreConfig = coreSnap.exists ? coreSnap.data() : {};
        effectiveDryRun = routine.dryRun || coreConfig.dryRun || false;
        effectiveDebug = routine.debugMode || coreConfig.debugMode || false;
    }

    if (options.forceDryRun !== undefined) {
        effectiveDryRun = options.forceDryRun;
    }

    // ── 2. Resolve targets ──
    let targets = [];
    if (options.targetUserId) {
        // Single target (manual test)
        const { resolveTargetById } = require("./targetResolver");
        const target = await resolveTargetById(adminDb, options.targetUserId);
        if (target) targets = [target];
    } else if (routine.allowedRoles && routine.allowedRoles.length > 0) {
        targets = await resolveTargetsByRole(adminDb, routine.allowedRoles);
    }

    // Email-based routines (like daily_performance_report) get recipients
    // from settings/emailReportConfig instead of the target resolver.
    const EMAIL_ROUTINES = new Set(["daily_performance_report"]);

    if (targets.length === 0 && !EMAIL_ROUTINES.has(routineKey)) {
        console.log(`${tag} No targets resolved`);
        return { success: false, runId: null, status: "no_targets", error: "No targets resolved" };
    }


    // ── 3. Create run ──
    const runId = await createRun(adminDb, {
        routineKey,
        triggerType,
        targetsCount: targets.length,
        dryRun: effectiveDryRun,
        metadata: { triggerOptions: options },
    });

    console.log(`${tag} Run ${runId} started | targets=${targets.length} dryRun=${effectiveDryRun}`);

    // ── 4. Execute handler ──
    let result = { sentCount: 0, failedCount: 0, errors: [] };
    try {
        const handlerFactory = HANDLER_REGISTRY[routineKey];
        if (!handlerFactory) {
            throw new Error(`No handler registered for routine: ${routineKey}`);
        }
        const handler = handlerFactory();

        const context = {
            runId,
            routineKey,
            routine,
            dryRun: effectiveDryRun,
            debug: effectiveDebug,
            options,
        };

        result = await handler.execute(adminDb, token, targets, context);

    } catch (err) {
        console.error(`${tag} Handler error:`, err);
        result.errors.push(err.message);
    }

    // ── 5. Determine final status ──
    let finalStatus;
    if (result.errors.length > 0 && result.sentCount === 0) {
        finalStatus = RUN_STATUS.FAILED;
    } else if (result.errors.length > 0) {
        finalStatus = RUN_STATUS.PARTIAL;
    } else {
        finalStatus = RUN_STATUS.SUCCESS;
    }

    // ── 6. Complete run ──
    await completeRun(adminDb, runId, finalStatus, {
        errorSummary: result.errors.length > 0 ? result.errors.join("; ") : null,
        finalCounters: {
            sentCount: result.sentCount || 0,
            deliveredCount: result.sentCount || 0, // Approximation: sent ≈ delivered for Telegram
            escalatedCount: result.escalatedCount || 0,
        },
    });

    // ── 7. Update routine metadata ──
    await updateRoutineLastRun(adminDb, routineKey, finalStatus,
        result.errors.length > 0 ? result.errors[0] : null
    );

    // ── 8. Update daily metrics ──
    try {
        await incrementTodayMetrics(adminDb, AUTOMATION_CHANNELS.TELEGRAM, {
            messagesSent: result.sentCount || 0,
            failedDeliveries: result.failedCount || 0,
            activeRoutines: 0, // Will be computed separately if needed
        });
    } catch (metricsErr) {
        console.warn(`${tag} Metrics update failed:`, metricsErr.message);
    }

    console.log(`${tag} Run ${runId} completed: ${finalStatus} | sent=${result.sentCount} failed=${result.failedCount}`);

    return {
        success: finalStatus !== RUN_STATUS.FAILED,
        runId,
        status: finalStatus,
        sentCount: result.sentCount,
        error: result.errors.length > 0 ? result.errors.join("; ") : undefined,
    };
}

module.exports = { executeRoutine, HANDLER_REGISTRY };
