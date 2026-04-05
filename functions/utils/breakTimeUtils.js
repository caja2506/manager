/**
 * Break Time Utils — Backend (CJS)
 * =================================
 * Shared break band definitions and effective-hours calculator.
 * Mirror of src/utils/breakTimeUtils.js for Cloud Functions.
 */

const BREAK_BANDS = [
    { id: "desayuno", start: 8,    end: 8.5  },   // 30 min
    { id: "almuerzo", start: 12,   end: 13   },   // 60 min
    { id: "cafe",     start: 15.5, end: 16   },   // 30 min
];

const TZ = "America/Costa_Rica";

/**
 * Get the hour (decimal) of a Date in Costa Rica timezone.
 * @param {Date} d
 * @returns {number} e.g. 8.5 for 8:30 AM
 */
function getLocalDecimalHour(d) {
    const parts = d.toLocaleString("en-US", {
        timeZone: TZ,
        hour: "numeric", minute: "numeric", hour12: false,
    }).split(":");
    return parseInt(parts[0]) + parseInt(parts[1]) / 60;
}

/**
 * Calculate break hours that overlap with a time range.
 * Uses Costa Rica timezone for hour comparison.
 */
function getBreakHoursInRange(startDt, endDt) {
    const start = startDt instanceof Date ? startDt : new Date(startDt);
    const end   = endDt   instanceof Date ? endDt   : new Date(endDt);

    const startHour = getLocalDecimalHour(start);
    const endHour   = getLocalDecimalHour(end);

    let breakHours = 0;
    for (const band of BREAK_BANDS) {
        const overlapStart = Math.max(startHour, band.start);
        const overlapEnd   = Math.min(endHour,   band.end);
        if (overlapEnd > overlapStart) {
            breakHours += overlapEnd - overlapStart;
        }
    }
    return parseFloat(breakHours.toFixed(2));
}

/**
 * Calculate effective working hours = gross − break overlap.
 * @param {Date|string} startDt
 * @param {Date|string} endDt
 * @returns {number} net working hours
 */
function getEffectiveHours(startDt, endDt) {
    const start = startDt instanceof Date ? startDt : new Date(startDt);
    const end   = endDt   instanceof Date ? endDt   : new Date(endDt);
    const grossHours = (end - start) / 3_600_000;
    const breakHours = getBreakHoursInRange(start, end);
    return parseFloat(Math.max(0, grossHours - breakHours).toFixed(2));
}

module.exports = { BREAK_BANDS, getBreakHoursInRange, getEffectiveHours };
