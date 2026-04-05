/**
 * Break Time Utils — Frontend (ESM)
 * ==================================
 * Shared break band definitions and effective-hours calculator.
 * Used by Planner, Timer, and Reports to deduct break time from hours.
 *
 * V3: Reads break bands from Firestore (settings/daySchedule.breakBands)
 * and caches them. Falls back to defaults if Firestore is unavailable.
 */

import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';

const DEFAULTS_BREAKS = [
    { id: 'desayuno', start: 8,    end: 8.5  },   // 30 min
    { id: 'almuerzo', start: 12,   end: 13   },   // 60 min
    { id: 'cafe',     start: 15.5, end: 16   },   // 30 min
];

const TZ = 'America/Costa_Rica';

// ── Live cache from Firestore ──
let _cachedBands = DEFAULTS_BREAKS;
let _subscribed = false;

/**
 * Subscribe to Firestore settings/daySchedule once.
 * All subsequent calls to getBreakBands() use the cached value.
 */
function ensureSubscription() {
    if (_subscribed) return;
    _subscribed = true;
    try {
        onSnapshot(doc(db, 'settings', 'daySchedule'), snap => {
            if (snap.exists()) {
                const data = snap.data();
                if (data.breakBands?.length) {
                    _cachedBands = data.breakBands.map(b => ({
                        id: b.id,
                        start: timeStringToDecimal(b.start),
                        end: timeStringToDecimal(b.end),
                    }));
                }
            }
        });
    } catch {
        // Firestore not available, keep defaults
    }
}

/**
 * Convert "HH:MM" → decimal hour (e.g. "08:30" → 8.5)
 */
function timeStringToDecimal(timeStr) {
    if (typeof timeStr === 'number') return timeStr;
    const [h, m] = timeStr.split(':').map(Number);
    return h + (m || 0) / 60;
}

/**
 * Get current break bands (live from Firestore or defaults).
 */
export function getBreakBands() {
    ensureSubscription();
    return _cachedBands;
}

/** @deprecated Use getBreakBands() instead */
export const BREAK_BANDS = DEFAULTS_BREAKS;

/**
 * Get the hour (decimal) of a Date in Costa Rica timezone.
 * @param {Date} d
 * @returns {number} e.g. 8.5 for 8:30 AM
 */
function getLocalDecimalHour(d) {
    const parts = d.toLocaleString('en-US', {
        timeZone: TZ,
        hour: 'numeric', minute: 'numeric', hour12: false,
    }).split(':');
    return parseInt(parts[0]) + parseInt(parts[1]) / 60;
}

/**
 * Calculate the overlap (in hours) between a time range and all break bands.
 * @param {Date|string} startDt - start of the block
 * @param {Date|string} endDt   - end of the block
 * @returns {number} total break hours that fall within the given range
 */
export function getBreakHoursInRange(startDt, endDt) {
    const start = startDt instanceof Date ? startDt : new Date(startDt);
    const end   = endDt   instanceof Date ? endDt   : new Date(endDt);

    const startHour = getLocalDecimalHour(start);
    const endHour   = getLocalDecimalHour(end);

    const bands = getBreakBands();
    let breakHours = 0;
    for (const band of bands) {
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
