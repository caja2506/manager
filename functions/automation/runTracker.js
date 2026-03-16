/**
 * Run Tracker — Backend (CJS)
 * ============================
 * Run lifecycle management for automation execution records.
 * Uses Admin SDK (bypasses Firestore rules).
 */

const { FieldValue } = require("firebase-admin/firestore");
const paths = require("./firestorePaths");
const { RUN_STATUS, TRIGGER_TYPE, AUTOMATION_CHANNELS, AUTOMATION_PROVIDERS } = require("./constants");

/**
 * Create a new automation run document.
 * @returns {string} The created document ID
 */
async function createRun(adminDb, {
    routineKey,
    channel = AUTOMATION_CHANNELS.TELEGRAM,
    provider = AUTOMATION_PROVIDERS.TELEGRAM_BOT,
    triggerType = TRIGGER_TYPE.SCHEDULED,
    targetsCount = 0,
    dryRun = false,
    metadata = {},
}) {
    const now = new Date().toISOString();
    const ref = await adminDb.collection(paths.AUTOMATION_RUNS).add({
        routineKey,
        channel,
        provider,
        triggerType,
        startedAt: now,
        finishedAt: null,
        status: RUN_STATUS.RUNNING,
        targetsCount,
        sentCount: 0,
        deliveredCount: 0,
        respondedCount: 0,
        escalatedCount: 0,
        dryRun,
        errorSummary: null,
        metadata,
        createdAt: now,
        updatedAt: now,
    });
    return ref.id;
}

/**
 * Increment counters on an in-progress run.
 */
async function updateRunCounters(adminDb, runId, counters) {
    const ref = adminDb.collection(paths.AUTOMATION_RUNS).doc(runId);
    const update = { updatedAt: new Date().toISOString() };
    for (const [key, val] of Object.entries(counters)) {
        if (typeof val === "number" && val > 0) {
            update[key] = FieldValue.increment(val);
        }
    }
    await ref.update(update);
}

/**
 * Complete a run with final status.
 */
async function completeRun(adminDb, runId, status, { errorSummary = null, finalCounters = {} } = {}) {
    const ref = adminDb.collection(paths.AUTOMATION_RUNS).doc(runId);
    await ref.update({
        status,
        finishedAt: new Date().toISOString(),
        errorSummary,
        ...finalCounters,
        updatedAt: new Date().toISOString(),
    });
}

/**
 * Update the routine document with last run info.
 */
async function updateRoutineLastRun(adminDb, routineKey, status, error = null) {
    const ref = adminDb.collection(paths.AUTOMATION_ROUTINES).doc(routineKey);
    await ref.update({
        lastRunAt: new Date().toISOString(),
        lastStatus: status,
        lastError: error,
        updatedAt: new Date().toISOString(),
    });
}

module.exports = { createRun, updateRunCounters, completeRun, updateRoutineLastRun };
