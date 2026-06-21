/**
 * Metrics Updater — Backend (CJS)
 * =================================
 * Atomic daily metrics management using Supabase automation_metrics_daily table.
 */

const { AUTOMATION_CHANNELS, AUTOMATION_PROVIDERS } = require("./constants");
const { getSupabase } = require("../db/supabaseAdmin");

/**
 * Get today's date string in YYYY-MM-DD format (Costa Rica timezone).
 */
function getTodayDate() {
    return new Date().toLocaleDateString("en-CA", { timeZone: "America/Costa_Rica" });
}

/**
 * Increment one or more daily metrics atomically.
 * Creates the document if it doesn't exist.
 *
 * @param {any} adminDb - Deprecated, kept for signature compatibility
 * @param {string} date - YYYY-MM-DD
 * @param {string} channel
 * @param {Object} increments - { totalExecutions: 1, successfulExecutions: 2, ... }
 */
async function incrementMetrics(adminDb, date, channel, increments) {
    const sb = getSupabase();
    const docId = date; // Deterministic YYYY-MM-DD

    // 1. Fetch existing record
    const { data: existing, error: fetchError } = await sb.from("automation_metrics_daily")
        .select("*")
        .eq("id", docId)
        .maybeSingle();

    if (fetchError) {
        console.warn("[metricsUpdater] Error fetching existing metrics:", fetchError.message);
    }

    // 2. Prepare accumulated values
    let totalExec = existing?.total_executions || 0;
    let successExec = existing?.successful_executions || 0;
    let failedExec = existing?.failed_executions || 0;
    let details = existing?.details || {};

    // Map increments
    for (const [key, amount] of Object.entries(increments)) {
        if (typeof amount !== "number") continue;

        if (key === "totalExecutions" || key === "total_executions") {
            totalExec += amount;
        } else if (key === "successfulExecutions" || key === "successful_executions") {
            successExec += amount;
        } else if (key === "failedExecutions" || key === "failed_executions") {
            failedExec += amount;
        } else {
            // Keep flexible metric inside details JSONB
            details[key] = (details[key] || 0) + amount;
        }
    }

    // Add channel/provider metadata inside details
    details.channel = channel;
    details.provider = AUTOMATION_PROVIDERS.TELEGRAM_BOT;

    // 3. Upsert into Supabase
    const payload = {
        id: docId,
        date,
        total_executions: totalExec,
        successful_executions: successExec,
        failed_executions: failedExec,
        details
    };

    const { error: upsertError } = await sb.from("automation_metrics_daily")
        .upsert(payload, { onConflict: "date" });

    if (upsertError) {
        console.error("[metricsUpdater] Error upserting metrics to Supabase:", upsertError.message);
    }
}

/**
 * Shorthand: increment today's metrics.
 */
async function incrementTodayMetrics(adminDb, channel, increments) {
    return incrementMetrics(adminDb, getTodayDate(), channel, increments);
}

module.exports = { incrementMetrics, incrementTodayMetrics, getTodayDate };

