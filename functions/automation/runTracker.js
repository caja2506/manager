/**
 * Run Tracker — Backend (CJS)
 * ============================
 * Run lifecycle management for automation execution records.
 * Uses Supabase tables: automation_runs, automation_routines.
 */

const { RUN_STATUS, TRIGGER_TYPE, AUTOMATION_CHANNELS, AUTOMATION_PROVIDERS } = require("./constants");
const { getSupabase } = require("../db/supabaseAdmin");

/**
 * Create a new automation run document.
 * @returns {Promise<string>} The created run UUID
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
    const sb = getSupabase();
    const now = new Date().toISOString();
    
    const details = {
        channel,
        provider,
        dryRun,
        targetsCount,
        sentCount: 0,
        deliveredCount: 0,
        respondedCount: 0,
        escalatedCount: 0,
        metadata
    };

    const { data, error } = await sb.from("automation_runs")
        .insert({
            routine_key: routineKey,
            status: RUN_STATUS.RUNNING,
            triggered_by: triggerType,
            started_at: now,
            details: details
        })
        .select()
        .single();

    if (error) {
        console.error("[runTracker] Error creating run:", error.message);
        throw error;
    }
    return data.id;
}

/**
 * Increment counters on an in-progress run.
 */
async function updateRunCounters(adminDb, runId, counters) {
    const sb = getSupabase();
    const { data: run, error: fetchError } = await sb.from("automation_runs")
        .select("details")
        .eq("id", runId)
        .single();

    if (fetchError || !run) {
        console.error("[runTracker] updateRunCounters: failed to fetch run", runId, fetchError?.message);
        return;
    }

    const details = run.details || {};
    for (const [key, val] of Object.entries(counters)) {
        if (typeof val === "number" && val > 0) {
            details[key] = (details[key] || 0) + val;
        }
    }

    const { error: updateError } = await sb.from("automation_runs")
        .update({ details })
        .eq("id", runId);

    if (updateError) {
        console.error("[runTracker] updateRunCounters: failed to update", runId, updateError.message);
    }
}

/**
 * Complete a run with final status.
 */
async function completeRun(adminDb, runId, status, { errorSummary = null, finalCounters = {} } = {}) {
    const sb = getSupabase();
    const finishedAt = new Date().toISOString();
    
    const { data: run, error: fetchError } = await sb.from("automation_runs")
        .select("started_at, details")
        .eq("id", runId)
        .single();

    let durationMs = 0;
    let details = {};

    if (!fetchError && run) {
        details = run.details || {};
        if (run.started_at) {
            durationMs = new Date(finishedAt) - new Date(run.started_at);
        }
    }

    for (const [key, val] of Object.entries(finalCounters)) {
        details[key] = val;
    }

    const { error: updateError } = await sb.from("automation_runs")
        .update({
            status,
            completed_at: finishedAt,
            error_message: errorSummary,
            duration_ms: durationMs,
            details
        })
        .eq("id", runId);

    if (updateError) {
        console.error("[runTracker] completeRun: failed to update", runId, updateError.message);
    }
}

/**
 * Update the routine document with last run info.
 */
async function updateRoutineLastRun(adminDb, routineKey, status, error = null) {
    const sb = getSupabase();
    const { error: updateError } = await sb.from("automation_routines")
        .update({
            last_run_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        })
        .eq("key", routineKey);

    if (updateError) {
        console.error("[runTracker] updateRoutineLastRun failed:", updateError.message);
    }
}

module.exports = { createRun, updateRunCounters, completeRun, updateRoutineLastRun };

