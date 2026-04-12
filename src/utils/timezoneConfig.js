/**
 * Timezone Configuration — Frontend
 * ====================================
 * Single source of truth for the operational timezone.
 * Mirrors functions/utils/timezoneConfig.js for consistency.
 * 
 * The system operates in America/Costa_Rica (UTC-6, no DST).
 * This avoids daylight saving time issues entirely.
 */

export const DEFAULT_TIMEZONE = 'America/Costa_Rica';

/**
 * Get today's date as YYYY-MM-DD string in the operational timezone.
 * @param {string} [tz=DEFAULT_TIMEZONE]
 * @returns {string} e.g. "2026-04-11"
 */
export function getTodayString(tz = DEFAULT_TIMEZONE) {
    return new Date().toLocaleDateString('en-CA', { timeZone: tz });
}

/**
 * Format a Date or ISO string for display in the operational timezone.
 * @param {Date|string} date
 * @param {Object} [options] - Intl.DateTimeFormat options
 * @returns {string}
 */
export function formatInTimezone(date, options = {}) {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleString('es-CR', {
        timeZone: DEFAULT_TIMEZONE,
        ...options,
    });
}
