/**
 * Automation Domain Exports — functions/exports/automation.js
 * [Phase M.5] Unified scheduler, manual routine execution, test messages.
 */
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");

function createAutomationExports(adminDb, secrets) {
    const { telegramBotToken, geminiApiKey, resendApiKey } = secrets;

    const unifiedRoutineScheduler = onSchedule(
        { schedule: "*/15 * * * *", timeZone: "America/Mexico_City", timeoutSeconds: 180, secrets: [telegramBotToken, geminiApiKey, resendApiKey] },
        async () => {
            console.log("[scheduler] Unified scheduler tick...");
            try {
                const { executeRoutine } = require("../automation/routineExecutor");
                const routinePaths = require("../automation/firestorePaths");
                const { TRIGGER_TYPE } = require("../automation/constants");
                const token = telegramBotToken.value();

                const routinesSnap = await adminDb.collection(routinePaths.AUTOMATION_ROUTINES).get();
                const now = new Date();
                const tz = "America/Mexico_City";
                const nowInTz = new Date(now.toLocaleString("en-US", { timeZone: tz }));
                const currentHour = nowInTz.getHours();
                const currentMinute = nowInTz.getMinutes();
                const currentDay = nowInTz.getDay();
                console.log(`[scheduler] Current time: ${currentHour}:${String(currentMinute).padStart(2, '0')} day=${currentDay}`);

                // ── Cron-based routines (skip day-schedule managed ones) ──
                const DAY_SCHEDULE_ROUTINES = new Set(["close_day_report", "open_day"]);

                for (const doc of routinesSnap.docs) {
                    const routine = doc.data();
                    const key = routine.key || doc.id;

                    // Skip routines managed by daySchedule settings
                    if (DAY_SCHEDULE_ROUTINES.has(key)) continue;

                    if (routine.scheduleType !== "daily") continue;
                    if (!routine.enabled) continue;
                    if (!routine.scheduleConfig?.cron) continue;

                    const cronParts = routine.scheduleConfig.cron.split(" ");
                    const cronMinute = parseInt(cronParts[0]);
                    const cronHour = parseInt(cronParts[1]);
                    const cronDays = cronParts[4] || "1-5";

                    const activeDays = new Set();
                    cronDays.split(",").forEach(segment => {
                        if (segment.includes("-")) {
                            const [start, end] = segment.split("-").map(Number);
                            for (let i = start; i <= end; i++) activeDays.add(i);
                        } else {
                            activeDays.add(parseInt(segment));
                        }
                    });
                    if (!activeDays.has(currentDay)) continue;

                    const cronTotalMinutes = cronHour * 60 + cronMinute;
                    const currentTotalMinutes = currentHour * 60 + currentMinute;
                    const diff = currentTotalMinutes - cronTotalMinutes;
                    if (diff < 0 || diff >= 15) continue;

                    console.log(`[scheduler] Routine "${key}" matches schedule (${cronHour}:${String(cronMinute).padStart(2, '0')}). Executing...`);
                    try {
                        const options = {};
                        if (key === "morning_digest_all") options.apiKey = geminiApiKey.value();
                        if (key === "daily_performance_report") options.resendApiKey = resendApiKey.value();
                        const result = await executeRoutine(adminDb, token, key, "scheduled", options);
                        console.log(`[scheduler] ${key} result:`, JSON.stringify(result));
                    } catch (routineErr) {
                        console.error(`[scheduler] ${key} failed:`, routineErr);
                    }
                }

                // ── Day Schedule: close_day_report + open_day ──
                try {
                    const dayScheduleSnap = await adminDb
                        .collection(routinePaths.SETTINGS)
                        .doc(routinePaths.SETTINGS_DOCS.DAY_SCHEDULE)
                        .get();

                    if (dayScheduleSnap.exists) {
                        const ds = dayScheduleSnap.data();
                        if (ds.enabled) {
                            const dsTz = ds.timezone || "America/Costa_Rica";
                            const nowDs = new Date(now.toLocaleString("en-US", { timeZone: dsTz }));
                            const dsHour = nowDs.getHours();
                            const dsMin = nowDs.getMinutes();
                            const dsDay = nowDs.getDay();
                            const dsTotalMin = dsHour * 60 + dsMin;

                            console.log(`[scheduler] daySchedule check: ${dsHour}:${String(dsMin).padStart(2, '0')} day=${dsDay} tz=${dsTz}`);

                            if (dsDay >= 1 && dsDay <= 5) {
                                if (ds.closeTime) {
                                    const [cH, cM] = ds.closeTime.split(":").map(Number);
                                    const closeTotal = cH * 60 + cM;
                                    const closeDiff = dsTotalMin - closeTotal;
                                    if (closeDiff >= 0 && closeDiff < 15) {
                                        console.log(`[scheduler] ⏹ close_day_report triggered by daySchedule (${ds.closeTime} ${dsTz})`);
                                        try {
                                            const result = await executeRoutine(adminDb, token, "close_day_report", TRIGGER_TYPE.DAY_SCHEDULE, {});
                                            console.log(`[scheduler] close_day_report result:`, JSON.stringify(result));
                                        } catch (e) {
                                            console.error(`[scheduler] close_day_report failed:`, e);
                                        }
                                    }
                                }

                                if (ds.openTime) {
                                    const [oH, oM] = ds.openTime.split(":").map(Number);
                                    const openTotal = oH * 60 + oM;
                                    const openDiff = dsTotalMin - openTotal;
                                    if (openDiff >= 0 && openDiff < 15) {
                                        console.log(`[scheduler] ▶ open_day triggered by daySchedule (${ds.openTime} ${dsTz})`);
                                        try {
                                            const result = await executeRoutine(adminDb, token, "open_day", TRIGGER_TYPE.DAY_SCHEDULE, {});
                                            console.log(`[scheduler] open_day result:`, JSON.stringify(result));
                                        } catch (e) {
                                            console.error(`[scheduler] open_day failed:`, e);
                                        }
                                    }
                                }
                            } else {
                                console.log(`[scheduler] daySchedule: weekend (day=${dsDay}), skipping close/open`);
                            }
                        } else {
                            console.log("[scheduler] daySchedule is disabled");
                        }
                    } else {
                        console.log("[scheduler] No settings/daySchedule document found");
                    }
                } catch (dsErr) {
                    console.error("[scheduler] daySchedule processing error:", dsErr);
                }

                console.log("[scheduler] Tick complete.");
            } catch (err) {
                console.error("[scheduler] Fatal error:", err);
            }
        }
    );

    const { requireAdmin } = require("../middleware/authGuard");

    const executeRoutineManually = onCall(
        { secrets: [telegramBotToken, resendApiKey], timeoutSeconds: 120 },
        async (request) => {
            await requireAdmin(adminDb, request);
            const { routineKey } = request.data;
            if (!routineKey) throw new HttpsError("invalid-argument", "routineKey is required.");
            try {
                const { executeRoutine } = require("../automation/routineExecutor");
                const token = telegramBotToken.value();
                const options = { forceDryRun: false };
                if (routineKey === "daily_performance_report") {
                    options.resendApiKey = resendApiKey.value();
                }
                const result = await executeRoutine(adminDb, token, routineKey, "manual", options);
                return result;
            } catch (err) {
                throw new HttpsError("internal", `Routine execution failed: ${err.message}`);
            }
        }
    );

    const sendTestMessage = onCall(
        { secrets: [telegramBotToken], timeoutSeconds: 30 },
        async (request) => {
            if (!request.auth) throw new HttpsError("unauthenticated", "User must be authenticated.");
            const roleDoc = await adminDb.collection("users_roles").doc(request.auth.uid).get();
            if (!roleDoc.exists || roleDoc.data().role !== "admin") throw new HttpsError("permission-denied", "Admin access required.");
            const { userId, message } = request.data;
            if (!userId) throw new HttpsError("invalid-argument", "userId is required.");
            try {
                const { executeRoutine } = require("../automation/routineExecutor");
                const token = telegramBotToken.value();
                const result = await executeRoutine(adminDb, token, "manual_test_message", "manual", { targetUserId: userId, message, forceDryRun: false });
                return result;
            } catch (err) {
                throw new HttpsError("internal", `Test message failed: ${err.message}`);
            }
        }
    );

    // Manual performance report execution (callable from UI)
    const executePerformanceReport = onCall(
        { secrets: [telegramBotToken, resendApiKey], timeoutSeconds: 120 },
        async (request) => {
            await requireAdmin(adminDb, request);
            try {
                const { executeRoutine } = require("../automation/routineExecutor");
                const token = telegramBotToken.value();
                const reportDate = request.data?.reportDate || null;
                const result = await executeRoutine(adminDb, token, "daily_performance_report", "manual", {
                    forceDryRun: false,
                    resendApiKey: resendApiKey.value(),
                    reportDate,
                });
                return result;
            } catch (err) {
                throw new HttpsError("internal", `Performance report failed: ${err.message}`);
            }
        }
    );

    return { unifiedRoutineScheduler, executeRoutineManually, sendTestMessage, executePerformanceReport };
}

module.exports = { createAutomationExports };
