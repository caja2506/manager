/**
 * Timer Auto-Close — Scheduled Cloud Function
 * =============================================
 * Runs every weekday at 6:00 PM Costa Rica (UTC-6 = 00:00 UTC next day)
 * to auto-close any active timers that were left running.
 *
 * Reads configuration dynamically from Supabase: settings.key = 'daySchedule'
 * Fields: enabled, closeTime, openTime, timezone, breakBands[]
 *
 * Also cleans up corrupt timers (null start_time).
 *
 * @module functions/exports/timerAutoClose
 */

const { onSchedule } = require("firebase-functions/v2/scheduler");
const { onCall } = require("firebase-functions/v2/https");
const { logger } = require("firebase-functions");

// Fallback defaults (used if settings not found in DB)
const DEFAULT_BREAK_BANDS = [
    { start: 8, end: 8.5 },    // Desayuno: 30 min
    { start: 12, end: 13 },    // Almuerzo: 60 min
    { start: 15.5, end: 16 },  // Café: 30 min
];

const DEFAULT_TZ = "America/Costa_Rica";

/**
 * Parse "HH:mm" string to decimal hours (e.g., "08:30" → 8.5)
 */
function timeStringToDecimal(timeStr) {
    if (!timeStr || typeof timeStr !== "string") return null;
    const [h, m] = timeStr.split(":").map(Number);
    return h + (m || 0) / 60;
}

/**
 * Convert DB break bands [{start:"08:00", end:"08:30"}] to decimal [{start:8, end:8.5}]
 */
function parseBreakBands(dbBands) {
    if (!Array.isArray(dbBands) || !dbBands.length) return DEFAULT_BREAK_BANDS;
    return dbBands.map(b => ({
        start: timeStringToDecimal(b.start),
        end: timeStringToDecimal(b.end),
    })).filter(b => b.start !== null && b.end !== null && b.end > b.start);
}

/**
 * Load day schedule settings from Supabase.
 */
async function loadSettings(supabase) {
    try {
        const { data, error } = await supabase
            .from("settings")
            .select("value")
            .eq("key", "daySchedule")
            .single();

        if (error || !data?.value) {
            logger.warn("[timerAutoClose] No settings found in DB, using defaults.", error?.message);
            return { enabled: true, breakBands: DEFAULT_BREAK_BANDS, timezone: DEFAULT_TZ };
        }

        const v = data.value;
        return {
            enabled: v.enabled !== false,
            closeTime: v.closeTime || "18:00",
            openTime: v.openTime || "08:00",
            timezone: v.timezone || DEFAULT_TZ,
            breakBands: parseBreakBands(v.breakBands),
        };
    } catch (err) {
        logger.error("[timerAutoClose] Failed to load settings:", err.message);
        return { enabled: true, breakBands: DEFAULT_BREAK_BANDS, timezone: DEFAULT_TZ };
    }
}

/**
 * Get decimal hour from a Date in a specific timezone.
 */
function getLocalDecimalHour(d, tz) {
    const parts = d.toLocaleString("en-US", {
        timeZone: tz || DEFAULT_TZ,
        hour: "numeric",
        minute: "numeric",
        hour12: false,
    }).split(":");
    return parseInt(parts[0]) + parseInt(parts[1]) / 60;
}

/**
 * Calculate break hours overlap between start and end times.
 */
function getBreakHoursInRange(startDt, endDt, breakBands, tz) {
    const startHour = getLocalDecimalHour(startDt, tz);
    const endHour = getLocalDecimalHour(endDt, tz);

    let breakHours = 0;
    for (const band of breakBands) {
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
function getEffectiveHours(startDt, endDt, breakBands, tz) {
    const grossHours = (endDt - startDt) / 3_600_000;
    const breakHours = getBreakHoursInRange(startDt, endDt, breakBands, tz);
    return parseFloat(Math.max(0, grossHours - breakHours).toFixed(4));
}

/**
 * Core auto-close logic — used by both scheduled and manual triggers.
 */
async function autoCloseTimers(supabase) {
    const now = new Date();
    const results = { stopped: 0, deleted: 0, errors: [], recalculated: [], settingsUsed: {} };

    // 0. Load dynamic settings from Supabase
    const settings = await loadSettings(supabase);
    results.settingsUsed = { enabled: settings.enabled, closeTime: settings.closeTime, breakBands: settings.breakBands?.length };
    logger.info("[timerAutoClose] Settings loaded:", JSON.stringify(results.settingsUsed));

    // Check if automation is enabled
    if (!settings.enabled) {
        logger.info("[timerAutoClose] Automation is DISABLED. Skipping.");
        results.skipped = "Automation disabled";
        return results;
    }

    const { breakBands, timezone: tz } = settings;

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
            let totalHours = getEffectiveHours(startTime, now, breakBands, tz);
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
                    notes: (log.notes || "") + ` [Auto-cerrado: cierre automático ${settings.closeTime || '6PM'}]`,
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

    // ── Scheduled: runs every hour, checks if current time matches closeTime from settings ──
    const scheduledTimerAutoClose = onSchedule(
        {
            schedule: "0 * * * *",  // Every hour, on the hour
            timeZone: "America/Costa_Rica",
            region: "us-central1",
            secrets: SECRETS,
            memory: "256MiB",
            timeoutSeconds: 120,
        },
        async () => {
            const { createClient } = require("@supabase/supabase-js");
            const WebSocket = require("ws");
            const supabase = createClient(
                process.env.SUPABASE_URL,
                process.env.SUPABASE_SERVICE_ROLE_KEY,
                {
                    auth: { persistSession: false, autoRefreshToken: false },
                    realtime: { transport: WebSocket },
                    global: { headers: { 'X-Client-Info': 'timer-auto-close' } },
                }
            );

            // Load settings to check if NOW is the right close hour
            const settings = await loadSettings(supabase);
            const closeHour = timeStringToDecimal(settings.closeTime || "18:00"); // e.g., 18
            const now = new Date();
            const currentHour = getLocalDecimalHour(now, settings.timezone || "America/Costa_Rica");
            const currentWholeHour = Math.floor(currentHour);

            logger.info(`[timerAutoClose] ⏰ Hourly check: current=${currentWholeHour}:00, closeTime=${settings.closeTime} (${closeHour})`);

            // Only execute if current hour matches the close hour
            if (currentWholeHour !== Math.floor(closeHour)) {
                logger.info(`[timerAutoClose] Not close time yet (${currentWholeHour} != ${Math.floor(closeHour)}). Skipping.`);
                return;
            }

            logger.info("[timerAutoClose] ⏰ It's close time! Running auto-close...");
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
            const WebSocket = require("ws");
            const supabase = createClient(
                process.env.SUPABASE_URL,
                process.env.SUPABASE_SERVICE_ROLE_KEY,
                {
                    auth: { persistSession: false, autoRefreshToken: false },
                    realtime: { transport: WebSocket },
                    global: { headers: { 'X-Client-Info': 'timer-auto-close-manual' } },
                }
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
