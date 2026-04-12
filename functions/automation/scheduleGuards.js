/**
 * Schedule Guards — Backend (CJS)
 * =================================
 * Validates whether a routine should actually execute.
 * Decouples Cloud Scheduler cron from business logic.
 */

const paths = require("./firestorePaths");

/**
 * Check if a routine should run right now.
 *
 * Checks:
 * 1. automationCore is enabled
 * 2. Routine exists and is enabled
 * 3. Current day is an active weekday (per telegramOps config)
 * 4. Returns config context for the executor
 *
 * @param {FirebaseFirestore.Firestore} adminDb
 * @param {string} routineKey
 * @returns {Promise<{shouldRun: boolean, reason: string, routine?: Object, coreConfig?: Object, tgConfig?: Object}>}
 */
async function shouldRoutineRun(adminDb, routineKey) {
    // 1. Load core config
    const coreSnap = await adminDb
        .collection(paths.SETTINGS)
        .doc(paths.SETTINGS_DOCS.AUTOMATION_CORE)
        .get();

    if (!coreSnap.exists) {
        return { shouldRun: false, reason: "automationCore config not found" };
    }
    const coreConfig = coreSnap.data();

    if (!coreConfig.enabled) {
        return { shouldRun: false, reason: "automationCore is disabled" };
    }

    // 2. Load routine
    const routineSnap = await adminDb
        .collection(paths.AUTOMATION_ROUTINES)
        .doc(routineKey)
        .get();

    if (!routineSnap.exists) {
        return { shouldRun: false, reason: `Routine "${routineKey}" not found` };
    }
    const routine = routineSnap.data();

    if (!routine.enabled) {
        return { shouldRun: false, reason: `Routine "${routineKey}" is disabled` };
    }

    // 3. Load telegramOps for weekday rules
    const tgSnap = await adminDb
        .collection(paths.SETTINGS)
        .doc(paths.SETTINGS_DOCS.TELEGRAM_OPS)
        .get();
    const tgConfig = tgSnap.exists ? tgSnap.data() : {};

    // Check weekday (Mexico City timezone)
    const activeDays = tgConfig.weekdayRules?.activeDays || [1, 2, 3, 4, 5];
    const tz = tgConfig.timezone || coreConfig.defaultTimezone || "America/Costa_Rica";
    const nowInTz = new Date().toLocaleDateString("en-US", { timeZone: tz, weekday: "long" });
    const dayMap = { Sunday: 0, Monday: 1, Tuesday: 2, Wednesday: 3, Thursday: 4, Friday: 5, Saturday: 6 };
    const currentDay = dayMap[nowInTz];

    if (!activeDays.includes(currentDay)) {
        return { shouldRun: false, reason: `Today (${nowInTz}) is not an active day` };
    }

    // 4. Determine effective dryRun: routine-level overrides core
    const effectiveDryRun = routine.dryRun || coreConfig.dryRun || false;
    const effectiveDebug = routine.debugMode || coreConfig.debugMode || false;

    return {
        shouldRun: true,
        reason: "All checks passed",
        routine: { ...routine, key: routineKey },
        coreConfig,
        tgConfig,
        effectiveDryRun,
        effectiveDebug,
    };
}

module.exports = { shouldRoutineRun };
