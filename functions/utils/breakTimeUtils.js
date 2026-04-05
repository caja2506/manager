/**
 * Break Time Utils — Backend (CJS)
 * =================================
 * V3: Reads break bands from Firestore settings/daySchedule.
 * Falls back to hardcoded defaults if Firestore doc doesn't exist.
 *
 * Usage:
 *   const { getEffectiveHours, loadBreakBands } = require("./breakTimeUtils");
 *   await loadBreakBands(adminDb); // call once at start
 *   const net = getEffectiveHours(start, end);
 */

const DEFAULTS = [
    { id: "desayuno", start: 8,    end: 8.5  },   // 30 min
    { id: "almuerzo", start: 12,   end: 13   },   // 60 min
    { id: "cafe",     start: 15.5, end: 16   },   // 30 min
];

const TZ = "America/Costa_Rica";

let _bands = DEFAULTS;

/**
 * Load break bands from Firestore once (call at the start of a function).
 * @param {FirebaseFirestore.Firestore} adminDb
 */
async function loadBreakBands(adminDb) {
    try {
        const snap = await adminDb.doc("settings/daySchedule").get();
        if (snap.exists) {
            const data = snap.data();
            if (data.breakBands?.length) {
                _bands = data.breakBands.map(b => ({
                    id: b.id,
                    start: timeStringToDecimal(b.start),
                    end: timeStringToDecimal(b.end),
                }));
            }
        }
    } catch (err) {
        console.warn("Could not load break bands from Firestore, using defaults:", err.message);
    }
}

function timeStringToDecimal(timeStr) {
    if (typeof timeStr === "number") return timeStr;
    const [h, m] = timeStr.split(":").map(Number);
    return h + (m || 0) / 60;
}

function getLocalDecimalHour(d) {
    const parts = d.toLocaleString("en-US", {
        timeZone: TZ,
        hour: "numeric", minute: "numeric", hour12: false,
    }).split(":");
    return parseInt(parts[0]) + parseInt(parts[1]) / 60;
}

function getBreakHoursInRange(startDt, endDt) {
    const start = startDt instanceof Date ? startDt : new Date(startDt);
    const end   = endDt   instanceof Date ? endDt   : new Date(endDt);

    const startHour = getLocalDecimalHour(start);
    const endHour   = getLocalDecimalHour(end);

    let breakHours = 0;
    for (const band of _bands) {
        const overlapStart = Math.max(startHour, band.start);
        const overlapEnd   = Math.min(endHour,   band.end);
        if (overlapEnd > overlapStart) {
            breakHours += overlapEnd - overlapStart;
        }
    }
    return parseFloat(breakHours.toFixed(2));
}

function getEffectiveHours(startDt, endDt) {
    const start = startDt instanceof Date ? startDt : new Date(startDt);
    const end   = endDt   instanceof Date ? endDt   : new Date(endDt);
    const grossHours = (end - start) / 3_600_000;
    const breakHours = getBreakHoursInRange(start, end);
    return parseFloat(Math.max(0, grossHours - breakHours).toFixed(2));
}

module.exports = { BREAK_BANDS: DEFAULTS, loadBreakBands, getBreakHoursInRange, getEffectiveHours };
