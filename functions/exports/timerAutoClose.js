/**
 * Timer Auto-Close — Scheduled Cloud Function
 * =============================================
 * Runs every weekday at 6:00 PM Costa Rica (UTC-6 = 00:00 UTC next day)
 * to auto-close any active timers that were left running.
 *
 * Also cleans up corrupt timers (null start_time).
 *
 * @module functions/exports/timerAutoClose
 */

const { onSchedule } = require("firebase-functions/v2/scheduler");
const { onCall } = require("firebase-functions/v2/https");
const { logger } = require("firebase-functions");

// Break bands (same as frontend breakTimeUtils.js defaults)
const BREAK_BANDS = [
    { start: 8, end: 8.5 },    // Desayuno: 30 min
    { start: 12, end: 13 },    // Almuerzo: 60 min
    { start: 15.5, end: 16 },  // Café: 30 min
];

const TZ = "America/Costa_Rica";

/**
 * Get decimal hour from a Date in Costa Rica timezone.
 */
function getLocalDecimalHour(d) {
    const parts = d.toLocaleString("en-US", {
        timeZone: TZ,
        hour: "numeric",
        minute: "numeric",
        hour12: false,
    }).split(":");
    return parseInt(parts[0]) + parseInt(parts[1]) / 60;
}

/**
 * Calculate break hours overlap between start and end times.
 */
function getBreakHoursInRange(startDt, endDt) {
    const startHour = getLocalDecimalHour(startDt);
    const endHour = getLocalDecimalHour(endDt);

    let breakHours = 0;
    for (const band of BREAK_BANDS) {
        const overlapStart = Math.max(startHour, band.start);
        const overlapEnd = Math.min(endHour, band.end);
        if (overlapEnd > overlapStart) {
            breakHours += overlapEnd - overlapStart;
        }
    }
    return parseFloat(breakHours.toFixed(2));
}

/**
 * Calculate effective hours = gross - breaks.
 */
function getEffectiveHours(startDt, endDt) {
    const grossHours = (endDt - startDt) / 3_600_000;
    const breakHours = getBreakHoursInRange(startDt, endDt);
    return parseFloat(Math.max(0, grossHours - breakHours).toFixed(4));
}

/**
 * Core auto-close logic — used by both scheduled and manual triggers.
 */
async function autoCloseTimers(supabase) {
    const now = new Date();
    const results = { stopped: 0, deleted: 0, errors: [], recalculated: [] };

    // 1. Delete corrupt timers (start_time IS NULL)
    const { data: corrupt, error: corruptErr } = await supabase
        .from("time_logs")
        .select("id")
        .is("start_time", null)
        .is("end_time", null);

    if (corruptErr) {
        results.errors.push(`Corrupt query failed: ${corruptErr.message}`);
    } else if (corrupt?.length) {
        for (const row of corrupt) {
            const { error } = await supabase.from("time_logs").delete().eq("id", row.id);
            if (error) {
                results.errors.push(`Delete corrupt ${row.id}: ${error.message}`);
            } else {
                results.deleted++;
            }
        }
    }

    // 2. Stop all active timers (end_time IS NULL, start_time NOT NULL)
    const { data: active, error: activeErr } = await supabase
        .from("time_logs")
        .select("id, user_id, task_id, project_id, start_time, notes, display_name, task_title")
        .is("end_time", null)
        .not("start_time", "is", null);

    if (activeErr) {
        results.errors.push(`Active query failed: ${activeErr.message}`);
        return results;
    }

    if (!active?.length) {
        logger.info("[timerAutoClose] No active timers to close.");
        return results;
    }

    const affectedTaskIds = new Set();

    for (const log of active) {
        try {
            const startTime = new Date(log.start_time);
            const totalHoursGross = parseFloat(((now - startTime) / 3_600_000).toFixed(6));
            let totalHours = getEffectiveHours(startTime, now);
            if (totalHours < 0.016666) totalHours = 0.016666;

            const breakHoursDeducted = parseFloat((totalHoursGross - totalHours).toFixed(4));

            const { error: updateErr } = await supabase
                .from("time_logs")
                .update({
                    end_time: now.toISOString(),
                    total_hours: totalHours,
                    total_hours_gross: totalHoursGross,
                    break_hours_deducted: breakHoursDeducted,
                    auto_stopped: true,
                    notes: (log.notes || "") + " [Auto-cerrado: cierre automático 6PM]",
                })
                .eq("id", log.id);

            if (updateErr) {
                results.errors.push(`Stop ${log.id} (${log.display_name}): ${updateErr.message}`);
            } else {
                results.stopped++;
                logger.info(`[timerAutoClose] Stopped timer for ${log.display_name || log.user_id}: ${log.task_title || "no task"} (${totalHours.toFixed(1)}h effective)`);
                if (log.task_id) affectedTaskIds.add(log.task_id);
            }
        } catch (err) {
            results.errors.push(`Stop ${log.id}: ${err.message}`);
        }
    }

    // 3. Recalculate actual_hours for affected tasks
    for (const taskId of affectedTaskIds) {
        try {
            const { data: logs, error: logsErr } = await supabase
                .from("time_logs")
                .select("total_hours, end_time")
                .eq("task_id", taskId);

            if (logsErr) throw logsErr;

            let totalHours = 0;
            (logs || []).forEach(row => {
                if (row.total_hours && row.end_time) {
                    totalHours += row.total_hours;
                }
            });

            await supabase
                .from("tasks")
                .update({ actual_hours: parseFloat(totalHours.toFixed(4)) })
                .eq("id", taskId);

            results.recalculated.push(taskId);
        } catch (err) {
            results.errors.push(`Recalc ${taskId}: ${err.message}`);
        }
    }

    return results;
}

/**
 * Create exports for timer auto-close functions.
 */
function createTimerAutoCloseExports(adminDb, secrets) {
    const SECRETS = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"];

    // ── Scheduled: runs every weekday at 6 PM Costa Rica (00:00 UTC next day) ──
    const scheduledTimerAutoClose = onSchedule(
        {
            schedule: "0 0 * * 1-5",  // UTC midnight = 6 PM Costa Rica (Mon-Fri)
            timeZone: "UTC",
            region: "us-central1",
            secrets: SECRETS,
            memory: "256MiB",
            timeoutSeconds: 120,
        },
        async () => {
            const { createClient } = require("@supabase/supabase-js");
            const supabase = createClient(
                process.env.SUPABASE_URL,
                process.env.SUPABASE_SERVICE_ROLE_KEY,
                { auth: { persistSession: false, autoRefreshToken: false } }
            );

            logger.info("[timerAutoClose] ⏰ Scheduled run starting...");
            const results = await autoCloseTimers(supabase);
            logger.info("[timerAutoClose] ✅ Complete:", JSON.stringify(results));
        }
    );

    // ── Manual: callable function for on-demand execution ──
    const manualTimerAutoClose = onCall(
        {
            region: "us-central1",
            secrets: SECRETS,
            memory: "256MiB",
            timeoutSeconds: 120,
        },
        async (request) => {
            const { createClient } = require("@supabase/supabase-js");
            const supabase = createClient(
                process.env.SUPABASE_URL,
                process.env.SUPABASE_SERVICE_ROLE_KEY,
                { auth: { persistSession: false, autoRefreshToken: false } }
            );

            logger.info("[timerAutoClose] 🔧 Manual run triggered by:", request.auth?.uid || "unknown");
            const results = await autoCloseTimers(supabase);
            logger.info("[timerAutoClose] ✅ Complete:", JSON.stringify(results));
            return results;
        }
    );

    return { scheduledTimerAutoClose, manualTimerAutoClose };
}

module.exports = { createTimerAutoCloseExports };
