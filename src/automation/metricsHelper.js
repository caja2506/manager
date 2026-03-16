/**
 * Automation Metrics Helper
 * ==========================
 * 
 * Helpers for reading and incrementing daily automation metrics.
 * Designed around atomic Firestore updates using setDoc with merge.
 * 
 * @module automation/metricsHelper
 */

import { doc, getDoc, setDoc, increment } from 'firebase/firestore';
import { db } from '../firebase.js';
import { AUTOMATION_METRICS_DAILY } from './firestorePaths.js';
import { createAutomationMetricsDailyDocument } from './schemas.js';
import { AUTOMATION_CHANNELS, AUTOMATION_PROVIDERS } from './constants.js';

/**
 * Generate a document ID for daily metrics.
 * Format: YYYY-MM-DD_channel
 * 
 * @param {string} date - YYYY-MM-DD
 * @param {string} channel
 * @returns {string}
 */
export function getMetricsDocId(date, channel = AUTOMATION_CHANNELS.TELEGRAM) {
    return `${date}_${channel}`;
}

/**
 * Ensure a daily metrics document exists for the given date/channel.
 * Uses setDoc with merge to avoid overwriting.
 * 
 * @param {string} date - YYYY-MM-DD
 * @param {string} [channel]
 * @param {string} [provider]
 */
export async function ensureMetricsDoc(
    date,
    channel = AUTOMATION_CHANNELS.TELEGRAM,
    provider = AUTOMATION_PROVIDERS.TELEGRAM_BOT
) {
    const docId = getMetricsDocId(date, channel);
    const ref = doc(db, AUTOMATION_METRICS_DAILY, docId);
    const snap = await getDoc(ref);

    if (!snap.exists()) {
        const metricsDoc = createAutomationMetricsDailyDocument({
            date,
            channel,
            provider,
        });
        await setDoc(ref, metricsDoc);
    }
}

/**
 * Increment one or more metric counters atomically.
 * 
 * @param {string} date - YYYY-MM-DD
 * @param {string} channel
 * @param {Object} increments - { messagesSent: 1, responsesReceived: 2, ... }
 */
export async function incrementMetrics(date, channel, increments) {
    const docId = getMetricsDocId(date, channel);
    const ref = doc(db, AUTOMATION_METRICS_DAILY, docId);

    // Build increment update
    const update = { updatedAt: new Date().toISOString() };
    for (const [field, amount] of Object.entries(increments)) {
        if (typeof amount === 'number' && amount !== 0) {
            update[field] = increment(amount);
        }
    }

    await setDoc(ref, update, { merge: true });
}

/**
 * Get daily metrics for a specific date and channel.
 * 
 * @param {string} date - YYYY-MM-DD
 * @param {string} [channel]
 * @returns {Promise<Object|null>}
 */
export async function getDailyMetrics(date, channel = AUTOMATION_CHANNELS.TELEGRAM) {
    const docId = getMetricsDocId(date, channel);
    const ref = doc(db, AUTOMATION_METRICS_DAILY, docId);
    const snap = await getDoc(ref);
    return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}
