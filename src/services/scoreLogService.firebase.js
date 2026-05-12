/**
 * Score Log Service — Daily IPS Persistence
 * ==========================================
 *
 * Persists daily IPS snapshots with strongly-typed Firestore-native fields.
 *
 * RULES:
 *   1. One log per person per day — dedup by userId + dateKey
 *   2. Idempotent — if today's log exists, skip (first calc wins)
 *   3. Delta auto-calculated vs previous day
 *   4. All queryable fields are numbers or Timestamps (no text)
 *   5. Validation before every write
 */

import {
    collection, doc, getDocs, getDoc, setDoc, query,
    where, orderBy, serverTimestamp, Timestamp,
} from 'firebase/firestore';
import { db } from '../firebase';
import { COLLECTIONS } from '../models/schemas';

const COLL = COLLECTIONS.DAILY_SCORE_LOGS;

// ============================================================
// LEVEL CODE MAP
// ============================================================

const LEVEL_TO_CODE = { needs_attention: 1, regular: 2, good: 3, excellent: 4 };
const DIRECTION_CODE = { down: -1, stable: 0, up: 1 };

// ============================================================
// HELPERS
// ============================================================

/**
 * Generate a deterministic document ID for dedup: userId_YYYYMMDD
 */
function buildDocId(userId, date) {
    const d = date instanceof Date ? date : new Date(date);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${userId}_${yyyy}${mm}${dd}`;
}

/**
 * Get ISO week number
 */
function getISOWeek(date) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
}

/**
 * Build a date key string YYYY-MM-DD (for display only, NOT stored in Firestore)
 */
function toDateKey(date) {
    const d = date instanceof Date ? date : new Date(date);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Validate document before write.
 * Throws if invalid.
 */
function validateScoreLog(doc) {
    if (typeof doc.score !== 'number' || doc.score < 0 || doc.score > 100) {
        throw new Error(`[scoreLogService] Invalid score: ${doc.score}`);
    }
    if (typeof doc.weekNumber !== 'number') {
        throw new Error('[scoreLogService] weekNumber must be number');
    }
    if (typeof doc.month !== 'number' || doc.month < 202601) {
        throw new Error(`[scoreLogService] Invalid month: ${doc.month}`);
    }
    if (![1, 2, 3, 4].includes(doc.levelCode)) {
        throw new Error(`[scoreLogService] Invalid levelCode: ${doc.levelCode}`);
    }
    if (!['engineer', 'team_lead', 'technician', 'manager'].includes(doc.teamRole)) {
        throw new Error(`[scoreLogService] Invalid teamRole: ${doc.teamRole}`);
    }
}

// ============================================================
// PUBLIC API
// ============================================================

/**
 * Save a daily score log for one user.
 * Idempotent: if today's log exists, returns null (skip).
 *
 * @param {Object} scoreResult - Output from calculateIndividualScore()
 * @param {string} userId
 * @param {string} displayName
 * @param {string} teamRole
 * @param {Object} [rawMetrics={}] - Output from buildRawMetrics()
 * @returns {Promise<string|null>} Document ID if saved, null if already exists
 */
export async function saveScoreLog(scoreResult, userId, displayName, teamRole, rawMetrics = {}) {
    if (scoreResult.score === null || scoreResult.isManager || scoreResult.insufficientData) {
        return null; // Don't persist non-scoreable entries
    }

    const now = new Date();
    const docId = buildDocId(userId, now);

    // ── Check if already exists (dedup) ──
    const docRef = doc(db, COLL, docId);
    const existing = await getDoc(docRef);
    if (existing.exists()) {
        return null; // Already saved today
    }

    // ── Build dimension maps (all numeric) ──
    const dimensions = {};
    for (const [key, dim] of Object.entries(scoreResult.dimensions || {})) {
        dimensions[key] = {
            score: dim.score,
            weight: dim.weight,
            raw: dim.raw || {},
        };
    }

    // ── Calculate delta vs yesterday ──
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayDocId = buildDocId(userId, yesterday);
    let delta = { score: 0, directionCode: DIRECTION_CODE.stable };

    try {
        const yesterdayDoc = await getDoc(doc(db, COLL, yesterdayDocId));
        if (yesterdayDoc.exists()) {
            const prevScore = yesterdayDoc.data().score;
            const diff = parseFloat((scoreResult.score - prevScore).toFixed(1));
            delta = {
                score: diff,
                directionCode: diff > 0 ? DIRECTION_CODE.up : diff < 0 ? DIRECTION_CODE.down : DIRECTION_CODE.stable,
            };
        }
    } catch (e) {
        console.warn('[scoreLogService] Could not fetch yesterday delta:', e.message);
    }

    // ── Build document (all native types) ──
    const logDoc = {
        // Identity
        userId,
        displayName,
        teamRole,

        // Temporal (native types)
        date: Timestamp.fromDate(new Date(now.getFullYear(), now.getMonth(), now.getDate())),
        dateKey: toDateKey(now), // for display only
        weekNumber: getISOWeek(now),
        month: now.getFullYear() * 100 + (now.getMonth() + 1), // YYYYMM as number
        year: now.getFullYear(),
        dayOfWeek: now.getDay() === 0 ? 7 : now.getDay(), // 1=Mon...7=Sun

        // Score (numeric)
        score: scoreResult.score,
        levelCode: LEVEL_TO_CODE[scoreResult.level] || 2,
        levelLabel: scoreResult.level || 'regular',

        // Dimensions
        dimensions,

        // Raw metrics snapshot
        rawMetrics,

        // Delta
        delta,

        // Metadata
        createdAt: serverTimestamp(),
        version: 1,
        generatedBy: 0, // 0=client
    };

    // ── Validate ──
    validateScoreLog(logDoc);

    // ── Write ──
    await setDoc(docRef, logDoc);
    return docId;
}

/**
 * Save daily logs for the entire team (batch).
 * Calls saveScoreLog for each member that has a valid score.
 *
 * @param {Array} teamScores - Output from calculateTeamScores()
 * @param {Object} rawMetricsMap - { userId: rawMetrics }
 * @returns {Promise<{ saved: number, skipped: number }>}
 */
export async function saveTeamScoreLogs(teamScores, rawMetricsMap = {}) {
    let saved = 0;
    let skipped = 0;

    for (const person of teamScores) {
        try {
            const result = await saveScoreLog(
                person,
                person.userId,
                person.displayName,
                person.teamRole,
                rawMetricsMap[person.userId] || {},
            );
            if (result) saved++;
            else skipped++;
        } catch (e) {
            console.error(`[scoreLogService] Error saving log for ${person.userId}:`, e.message);
            skipped++;
        }
    }
    return { saved, skipped };
}

/**
 * Get score logs for one user, last N days.
 * Returns array sorted by date ASC (oldest first) for sparklines.
 *
 * @param {string} userId
 * @param {number} [days=14] - How many days back
 * @returns {Promise<Array>}
 */
export async function getScoreLogs(userId, days = 14) {
    const since = new Date();
    since.setDate(since.getDate() - days);
    since.setHours(0, 0, 0, 0);

    const q = query(
        collection(db, COLL),
        where('userId', '==', userId),
        where('date', '>=', Timestamp.fromDate(since)),
        orderBy('date', 'asc'),
    );

    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

/**
 * Get all team logs for a specific date.
 *
 * @param {Date} date
 * @returns {Promise<Array>}
 */
export async function getTeamLogsForDate(date) {
    const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);

    const q = query(
        collection(db, COLL),
        where('date', '>=', Timestamp.fromDate(dayStart)),
        where('date', '<', Timestamp.fromDate(dayEnd)),
        orderBy('date', 'asc'),
    );

    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

/**
 * Get weekly averages for a user.
 *
 * @param {string} userId
 * @param {number} [weeks=4]
 * @returns {Promise<Array<{weekNumber: number, avgScore: number, count: number}>>}
 */
export async function getWeeklyAverages(userId, weeks = 4) {
    const since = new Date();
    since.setDate(since.getDate() - (weeks * 7));
    since.setHours(0, 0, 0, 0);

    const logs = await getScoreLogs(userId, weeks * 7);

    // Group by weekNumber
    const byWeek = {};
    for (const log of logs) {
        const wk = log.weekNumber;
        if (!byWeek[wk]) byWeek[wk] = { total: 0, count: 0 };
        byWeek[wk].total += log.score;
        byWeek[wk].count++;
    }

    return Object.entries(byWeek)
        .map(([wk, data]) => ({
            weekNumber: parseInt(wk),
            avgScore: parseFloat((data.total / data.count).toFixed(1)),
            count: data.count,
        }))
        .sort((a, b) => a.weekNumber - b.weekNumber);
}
