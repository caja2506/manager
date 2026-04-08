/**
 * Timezone Configuration — Backend (CJS)
 * ========================================
 * SINGLE source of truth for timezone in Cloud Functions.
 *
 * Costa Rica (UTC-6, no DST) is the operational timezone.
 * Mexico_City was used in some legacy paths — both are UTC-6
 * but Costa_Rica avoids DST complications.
 */

const DEFAULT_TIMEZONE = "America/Costa_Rica";

/**
 * Get today's date string in the operational timezone.
 * @returns {string} "YYYY-MM-DD"
 */
function getTodayString(tz = DEFAULT_TIMEZONE) {
    return new Date().toLocaleDateString("en-CA", { timeZone: tz });
}

/**
 * Get a localized timestamp string.
 * @returns {string} e.g. "08/04/2026, 16:30:00"
 */
function getLocalTimestamp(tz = DEFAULT_TIMEZONE) {
    return new Date().toLocaleString("es-CR", { timeZone: tz });
}

module.exports = { DEFAULT_TIMEZONE, getTodayString, getLocalTimestamp };
