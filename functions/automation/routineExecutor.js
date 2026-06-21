/**
 * Routine Executor — Backend (CJS)
 * ==================================
 * Core execution engine for automation routines in Supabase.
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
const { getSupabase } = require("../db/supabaseAdmin");
const { loadSetting } = require("../db/coreDataReader");

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
    scheduled_timer_events: () => require("../handlers/scheduledTimerEventHandler"),
};

/**
 * Execute a routine by key.
 *
 * @param {any} _adminDb - Deprecated
 * @param {string} token - Telegram bot token
 * @param {string} routineKey - Routine to execute
 * @param {string} triggerType - TRIGGER_TYPE value
 * @param {Object} [options] - { targetUserId, message, forceDryRun }
 * @returns {Promise<{success: boolean, runId: string, status: string, error?: string}>}
 */
async function executeRoutine(_adminDb, token, routineKey, triggerType, options = {}) {
    const tag = `[routineExecutor:${routineKey}]`;
    const sb = getSupabase();

    // ── 1. Guard: should this routine run? ──
    const guard = await shouldRoutineRun(null, routineKey);
    if (!guard.shouldRun && triggerType !== TRIGGER_TYPE.MANUAL && triggerType !== TRIGGER_TYPE.DAY_SCHEDULE) {
        console.log(`${tag} Skipped: ${guard.reason}`);
        return { success: false, runId: null, status: "skipped", error: guard.reason };
    }

    // For manual triggers, we still need routine config even if disabled
    let routine = guard.routine;
    let effectiveDryRun = guard.effectiveDryRun ?? false;
    let effectiveDebug = guard.effectiveDebug ?? false;

    if (!routine && (triggerType === TRIGGER_TYPE.MANUAL || triggerType === TRIGGER_TYPE.DAY_SCHEDULE)) {
        const { data: routineData } = await sb.from("automation_routines")
            .select("*")
            .eq("key", routineKey)
            .maybeSingle();

        if (!routineData) {
            // Auto-seed the routine doc for DAY_SCHEDULE triggers
            if (triggerType === TRIGGER_TYPE.DAY_SCHEDULE) {
                console.log(`${tag} Auto-seeding routine doc: ${routineKey}`);
                const seed = {
                    key: routineKey,
                    name: routineKey,
                    description: `Auto-created by scheduler`,
                    enabled: true,
                    schedule_type: "interval",
                    channel: "none",
                    target_role: "all",
                    dry_run: false,
                    debug_mode: false,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                };
                await sb.from("automation_routines").insert(seed);
                routine = {
                    key: routineKey,
                    name: routineKey,
                    description: `Auto-created by scheduler`,
                    enabled: true,
                    scheduleType: "interval",
                    channel: "none",
                    targetRole: "all",
                    dryRun: false,
                    debugMode: false,
                };
            } else {
                return { success: false, runId: null, status: "error", error: `Routine "${routineKey}" not found` };
            }
        } else {
            routine = {
                key: routineData.key,
                name: routineData.name,
                description: routineData.description,
                enabled: routineData.enabled,
                dryRun: routineData.dry_run,
                debugMode: routineData.debug_mode,
                scheduleType: routineData.schedule_type,
                channel: routineData.channel,
                targetRole: routineData.target_role,
                allowedRoles: routineData.allowed_roles || [],
            };
        }
        const coreConfig = await loadSetting("automationCore") || {};
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
        const target = await resolveTargetById(null, options.targetUserId);
        if (target) targets = [target];
    } else if (routine.allowedRoles && routine.allowedRoles.length > 0) {
        targets = await resolveTargetsByRole(null, routine.allowedRoles);
    }

    // Routines that resolve their own targets internally (not via targetResolver)
    const SELF_TARGETING_ROUTINES = new Set(["daily_performance_report", "planner_timer_sync"]);

    if (targets.length === 0 && !SELF_TARGETING_ROUTINES.has(routineKey)) {
        console.log(`${tag} No targets resolved`);
        return { success: false, runId: null, status: "no_targets", error: "No targets resolved" };
    }

    // ── 3. Create run ──
    const runId = await createRun(null, {
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
            triggerType,
        };

        result = await handler.execute(null, token, targets, context);

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
    await completeRun(null, runId, finalStatus, {
        errorSummary: result.errors.length > 0 ? result.errors.join("; ") : null,
        finalCounters: {
            sentCount: result.sentCount || 0,
            deliveredCount: result.sentCount || 0, // Approximation: sent ≈ delivered for Telegram
            escalatedCount: result.escalatedCount || 0,
        },
    });

    // ── 7. Update routine metadata ──
    await updateRoutineLastRun(null, routineKey, finalStatus,
        result.errors.length > 0 ? result.errors[0] : null
    );

    // ── 8. Update daily metrics ──
    try {
        await incrementTodayMetrics(null, AUTOMATION_CHANNELS.TELEGRAM, {
            messagesSent: result.sentCount || 0,
            failedDeliveries: result.failedCount || 0,
            activeRoutines: 0,
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

