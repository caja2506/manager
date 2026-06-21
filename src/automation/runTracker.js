/**
 * Automation Run Tracker
 * =======================
 * 
 * Service helpers for creating, updating, and completing automation
 * run documents in Supabase. Used by Cloud Functions.
 * 
 * @module automation/runTracker
 */

import { supabase } from '../supabase.js';
import { createAutomationRunDocument } from './schemas.js';
import { RUN_STATUS } from './constants.js';

/**
 * Start a new automation run and persist it.
 * 
 * @param {Object} params
 * @param {string} params.routineKey - The routine being executed
 * @param {string} params.channel - Channel constant
 * @param {string} params.provider - Provider constant
 * @param {string} params.triggerType - What triggered this run
 * @param {number} params.targetsCount - Number of target users
 * @param {boolean} [params.dryRun=false]
 * @param {Object} [params.metadata={}]
 * @returns {Promise<string>} The ID of the created run document
 */
export async function startRun({
    routineKey,
    channel,
    provider,
    triggerType,
    targetsCount,
    dryRun = false,
    metadata = {},
}) {
    const runDoc = createAutomationRunDocument({
        routineKey,
        channel,
        provider,
        triggerType,
        targetsCount,
        dryRun,
        metadata,
        status: RUN_STATUS.RUNNING,
        startedAt: new Date().toISOString(),
    });

    const { data, error } = await supabase
        .from('automation_runs')
        .insert({
            routine_key: routineKey,
            status: RUN_STATUS.RUNNING,
            triggered_by: triggerType,
            started_at: runDoc.startedAt,
            details: runDoc,
        })
        .select('id')
        .single();

    if (error) {
        console.error('[runTracker] Error starting run:', error);
        throw error;
    }
    return data.id;
}

/**
 * Update counters on an in-progress run.
 * 
 * @param {string} runId
 * @param {Object} counters - Partial update: { sentCount, deliveredCount, respondedCount, escalatedCount }
 */
export async function updateRunCounters(runId, counters) {
    const { data: existing } = await supabase
        .from('automation_runs')
        .select('details')
        .eq('id', runId)
        .maybeSingle();

    const details = { ...(existing?.details || {}), ...counters, updatedAt: new Date().toISOString() };

    const { error } = await supabase
        .from('automation_runs')
        .update({ details })
        .eq('id', runId);

    if (error) {
        console.error('[runTracker] Error updating run counters:', error);
    }
}

/**
 * Complete a run with final status.
 * 
 * @param {string} runId
 * @param {string} status - RUN_STATUS value
 * @param {string|null} [errorSummary=null]
 * @param {Object} [finalCounters={}]
 */
export async function completeRun(runId, status, errorSummary = null, finalCounters = {}) {
    const { data: existing } = await supabase
        .from('automation_runs')
        .select('*')
        .eq('id', runId)
        .maybeSingle();

    const now = new Date().toISOString();
    const details = { 
        ...(existing?.details || {}), 
        status, 
        finishedAt: now, 
        errorSummary, 
        ...finalCounters, 
        updatedAt: now 
    };

    let duration_ms = 0;
    if (existing?.started_at) {
        duration_ms = Math.max(0, new Date(now) - new Date(existing.started_at));
    }

    const { error } = await supabase
        .from('automation_runs')
        .update({
            status,
            completed_at: now,
            duration_ms,
            error_message: errorSummary,
            details
        })
        .eq('id', runId);

    if (error) {
        console.error('[runTracker] Error completing run:', error);
    }
}

