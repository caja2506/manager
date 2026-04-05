/**
 * Break time bands — shared definition.
 * Each band has a start/end in decimal hours (e.g. 12.5 = 12:30).
 */
const BREAK_BANDS = [
    { id: 'desayuno', start: 8,    end: 8.5  },   // 30 min
    { id: 'almuerzo', start: 12,   end: 13   },   // 60 min
    { id: 'cafe',     start: 15.5, end: 16   },   // 30 min
];

/**
 * Calculate the overlap (in hours) between a time range and all break bands.
 * @param {Date|string} startDt - start of the block
 * @param {Date|string} endDt   - end of the block
 * @returns {number} total break hours that fall within the given range
 */
export function getBreakHoursInRange(startDt, endDt) {
    const start = startDt instanceof Date ? startDt : new Date(startDt);
    const end   = endDt   instanceof Date ? endDt   : new Date(endDt);

    const startHour = start.getHours() + start.getMinutes() / 60;
    const endHour   = end.getHours()   + end.getMinutes()   / 60;

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
 * Calculate effective working hours = gross hours − break overlap.
 * @param {Date|string} startDt
 * @param {Date|string} endDt
 * @returns {number} net working hours
 */
export function getEffectiveHours(startDt, endDt) {
    const start = startDt instanceof Date ? startDt : new Date(startDt);
    const end   = endDt   instanceof Date ? endDt   : new Date(endDt);
    const grossHours = (end - start) / 3_600_000;
    const breakHours = getBreakHoursInRange(start, end);
    return parseFloat(Math.max(0, grossHours - breakHours).toFixed(2));
}
