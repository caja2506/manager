/**
 * Automation Domain Exports — functions/exports/automation.js
 * [Phase M.5] Unified scheduler, manual routine execution, test messages.
 */
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");

function createAutomationExports(adminDb, secrets) {
    const { telegramBotToken, geminiApiKey } = secrets;

    const unifiedRoutineScheduler = onSchedule(
        { schedule: "*/15 * * * *", timeZone: "America/Mexico_City", timeoutSeconds: 180, secrets: [telegramBotToken, geminiApiKey] },
        async () => {
            console.log("[scheduler] Unified scheduler tick...");
            try {
                const { executeRoutine } = require("../automation/routineExecutor");
                const routinePaths = require("../automation/firestorePaths");
                const token = telegramBotToken.value();

                const routinesSnap = await adminDb.collection(routinePaths.AUTOMATION_ROUTINES).get();
                const now = new Date();
                const tz = "America/Mexico_City";
                const nowInTz = new Date(now.toLocaleString("en-US", { timeZone: tz }));
                const currentHour = nowInTz.getHours();
                const currentMinute = nowInTz.getMinutes();
                const currentDay = nowInTz.getDay();
                console.log(`[scheduler] Current time: ${currentHour}:${String(currentMinute).padStart(2, '0')} day=${currentDay}`);

                for (const doc of routinesSnap.docs) {
                    const routine = doc.data();
                    const key = routine.key || doc.id;
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
                        const result = await executeRoutine(adminDb, token, key, "scheduled", options);
                        console.log(`[scheduler] ${key} result:`, JSON.stringify(result));
                    } catch (routineErr) {
                        console.error(`[scheduler] ${key} failed:`, routineErr);
                    }
                }
                console.log("[scheduler] Tick complete.");
            } catch (err) {
                console.error("[scheduler] Fatal error:", err);
            }
        }
    );

    const { requireAdmin } = require("../middleware/authGuard");

    const executeRoutineManually = onCall(
        { secrets: [telegramBotToken], timeoutSeconds: 120 },
        async (request) => {
            await requireAdmin(adminDb, request);
            const { routineKey } = request.data;
            if (!routineKey) throw new HttpsError("invalid-argument", "routineKey is required.");
            try {
                const { executeRoutine } = require("../automation/routineExecutor");
                const token = telegramBotToken.value();
                const result = await executeRoutine(adminDb, token, routineKey, "manual", { forceDryRun: false });
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

    return { unifiedRoutineScheduler, executeRoutineManually, sendTestMessage };
}

module.exports = { createAutomationExports };
