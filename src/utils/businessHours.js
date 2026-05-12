/**
 * Business Hours Calculator (Frontend — ESM)
 * ===========================================
 * Calculates WORKING hours between two ISO timestamps,
 * excluding nights, weekends (Sat/Sun), and break bands.
 *
 * @param {string} startISO  - ISO timestamp (block start)
 * @param {string} endISO    - ISO timestamp (block end / now)
 * @param {object} schedule  - { openTime: "08:00", closeTime: "18:00", breakBands: [{ start, end }] }
 * @returns {number} Effective business hours (rounded to 4 decimals)
 */
export function calculateBusinessHours(startISO, endISO, schedule = {}) {
    const openTime = schedule.openTime || "08:00";
    const closeTime = schedule.closeTime || "18:00";
    const breaks = (schedule.breakBands || []).map(b => ({
        start: timeToMin(b.start),
        end: timeToMin(b.end),
    }));

    const TZ_OFFSET = -6; // Costa Rica UTC-6 (no DST)

    const startUtc = new Date(startISO).getTime();
    const endUtc = new Date(endISO).getTime();
    if (endUtc <= startUtc) return 0;

    const openMin = timeToMin(openTime);
    const closeMin = timeToMin(closeTime);

    // Cap at 90 days to avoid infinite loops on bad data
    const MAX_MS = 90 * 24 * 3600000;
    const effectiveEnd = Math.min(endUtc, startUtc + MAX_MS);

    let totalMinutes = 0;

    // Convert UTC ms to local date components (Costa Rica)
    function utcToLocal(ms) {
        const d = new Date(ms + TZ_OFFSET * 3600000);
        return {
            year: d.getUTCFullYear(),
            month: d.getUTCMonth(),
            date: d.getUTCDate(),
            day: d.getUTCDay(), // 0=Sun
            minuteOfDay: d.getUTCHours() * 60 + d.getUTCMinutes(),
        };
    }

    // Get UTC ms for start of a local day
    function localDayStartUtc(year, month, date) {
        return Date.UTC(year, month, date) - TZ_OFFSET * 3600000;
    }

    function workMinutesForDay(dayOfWeek, sliceStartMin, sliceEndMin) {
        if (dayOfWeek === 0 || dayOfWeek === 6) return 0; // Weekend

        const effStart = Math.max(sliceStartMin, openMin);
        const effEnd = Math.min(sliceEndMin, closeMin);
        if (effEnd <= effStart) return 0;

        let breakMins = 0;
        for (const b of breaks) {
            const bStart = Math.max(b.start, effStart);
            const bEnd = Math.min(b.end, effEnd);
            if (bEnd > bStart) breakMins += bEnd - bStart;
        }

        return Math.max(0, (effEnd - effStart) - breakMins);
    }

    const localStart = utcToLocal(startUtc);
    const localEnd = utcToLocal(effectiveEnd);

    // Same calendar day?
    if (localStart.year === localEnd.year && localStart.month === localEnd.month && localStart.date === localEnd.date) {
        totalMinutes = workMinutesForDay(localStart.day, localStart.minuteOfDay, localEnd.minuteOfDay);
    } else {
        // First partial day
        totalMinutes += workMinutesForDay(localStart.day, localStart.minuteOfDay, 24 * 60);

        // Full days in between
        let cursor = localDayStartUtc(localStart.year, localStart.month, localStart.date) + 24 * 3600000;
        const lastDayStart = localDayStartUtc(localEnd.year, localEnd.month, localEnd.date);

        while (cursor < lastDayStart) {
            const loc = utcToLocal(cursor);
            totalMinutes += workMinutesForDay(loc.day, 0, 24 * 60);
            cursor += 24 * 3600000;
        }

        // Last partial day
        totalMinutes += workMinutesForDay(localEnd.day, 0, localEnd.minuteOfDay);
    }

    return parseFloat((totalMinutes / 60).toFixed(4));
}

function timeToMin(hhmm) {
    const [h, m] = (hhmm || "00:00").split(":").map(Number);
    return h * 60 + (m || 0);
}
