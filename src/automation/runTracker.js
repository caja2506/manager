/**
 * Automation Run Tracker
 * =======================
 * 
 * Service helpers for creating, updating, and completing automation
 * run documents in Firestore. Used by Cloud Functions in Phase 2.
 * 
 * These functions interact with Firestore directly and should only
 * be called from admin/backend contexts.
 * 
 * @module automation/runTracker
 */

import { doc, setDoc, updateDoc, collection, addDoc } from 'firebase/firestore';
import { db } from '../firebase.js';
import { AUTOMATION_RUNS } from './firestorePaths.js';
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

    const ref = await addDoc(collection(db, AUTOMATION_RUNS), runDoc);
    return ref.id;
}

/**
 * Update counters on an in-progress run.
 * 
 * @param {string} runId
 * @param {Object} counters - Partial update: { sentCount, deliveredCount, respondedCount, escalatedCount }
 */
export async function updateRunCounters(runId, counters) {
    const ref = doc(db, AUTOMATION_RUNS, runId);
    await updateDoc(ref, {
        ...counters,
        updatedAt: new Date().toISOString(),
    });
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
    const ref = doc(db, AUTOMATION_RUNS, runId);
    await updateDoc(ref, {
        status,
        finishedAt: new Date().toISOString(),
        errorSummary,
        ...finalCounters,
        updatedAt: new Date().toISOString(),
    });
}
