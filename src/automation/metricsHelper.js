/**
 * Automation Metrics Helper
 * ==========================
 * 
 * Helpers for reading and incrementing daily automation metrics.
 * Designed around atomic Supabase updates.
 * 
 * @module automation/metricsHelper
 */

import { supabase } from '../supabase.js';
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
    const { data, error } = await supabase
        .from('automation_metrics_daily')
        .select('id')
        .eq('id', docId)
        .maybeSingle();

    if (error) {
        console.error('[metricsHelper] Error checking metrics document:', error);
        return;
    }

    if (!data) {
        const { error: insErr } = await supabase
            .from('automation_metrics_daily')
            .insert({
                id: docId,
                date,
                details: {
                    channel,
                    provider,
                    messagesSent: 0,
                    messagesDelivered: 0,
                    responsesReceived: 0,
                    responsesOnTime: 0,
                    responsesLate: 0,
                    escalationsTriggered: 0,
                    incidentsOpened: 0,
                    audioReportsCount: 0,
                    textReportsCount: 0,
                    failedDeliveries: 0,
                    activeRoutines: 0,
                }
            });

        if (insErr) {
            console.error('[metricsHelper] Error creating metrics document:', insErr);
        }
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
    
    // Get existing details
    const { data, error } = await supabase
        .from('automation_metrics_daily')
        .select('details')
        .eq('id', docId)
        .maybeSingle();

    if (error) {
        console.error('[metricsHelper] Error loading metrics for increment:', error);
        return;
    }

    const details = data?.details || {};
    for (const [field, amount] of Object.entries(increments)) {
        if (typeof amount === 'number' && amount !== 0) {
            details[field] = (Number(details[field]) || 0) + amount;
        }
    }

    const { error: upsErr } = await supabase
        .from('automation_metrics_daily')
        .upsert({
            id: docId,
            date,
            details
        });

    if (upsErr) {
        console.error('[metricsHelper] Error incrementing metrics:', upsErr);
    }
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
    const { data, error } = await supabase
        .from('automation_metrics_daily')
        .select('*')
        .eq('id', docId)
        .maybeSingle();

    if (error || !data) return null;
    
    // Map details back to top-level fields for compatibility
    return {
        id: data.id,
        date: data.date,
        ...(data.details || {})
    };
}

