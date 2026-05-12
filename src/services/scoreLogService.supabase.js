/**
 * Score Log Service — Supabase Version
 * ======================================
 * Daily IPS persistence in `daily_score_logs` table.
 */

import { supabase } from '../supabase';

const LEVEL_TO_CODE = { needs_attention: 1, regular: 2, good: 3, excellent: 4 };
const DIRECTION_CODE = { down: -1, stable: 0, up: 1 };

function buildDocId(userId, date) {
    const d = date instanceof Date ? date : new Date(date);
    return `${userId}_${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
}

function getISOWeek(date) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
}

function toDateKey(date) {
    const d = date instanceof Date ? date : new Date(date);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export async function saveScoreLog(scoreResult, userId, displayName, teamRole, rawMetrics = {}) {
    if (scoreResult.score === null || scoreResult.isManager || scoreResult.insufficientData) return null;

    const now = new Date();
    const docId = buildDocId(userId, now);

    // Dedup check
    const { data: existing } = await supabase.from('daily_score_logs').select('id').eq('id', docId).single();
    if (existing) return null;

    // Delta vs yesterday
    const yesterday = new Date(now); yesterday.setDate(yesterday.getDate() - 1);
    let delta = { score: 0, directionCode: DIRECTION_CODE.stable };
    const { data: prev } = await supabase.from('daily_score_logs')
        .select('score').eq('id', buildDocId(userId, yesterday)).single();
    if (prev) {
        const diff = parseFloat((scoreResult.score - prev.score).toFixed(1));
        delta = { score: diff, directionCode: diff > 0 ? 1 : diff < 0 ? -1 : 0 };
    }

    const row = {
        id: docId, user_id: userId, display_name: displayName, team_role: teamRole,
        date: toDateKey(now), date_key: toDateKey(now), week_number: getISOWeek(now),
        month: now.getFullYear() * 100 + (now.getMonth() + 1), year: now.getFullYear(),
        day_of_week: now.getDay() === 0 ? 7 : now.getDay(),
        score: scoreResult.score, level_code: LEVEL_TO_CODE[scoreResult.level] || 2,
        level_label: scoreResult.level || 'regular',
        dimensions: scoreResult.dimensions || {}, raw_metrics: rawMetrics, delta,
        version: 1, generated_by: 0,
    };

    const { error } = await supabase.from('daily_score_logs').insert(row);
    if (error) throw new Error(`[scoreLogService.sb] save: ${error.message}`);
    return docId;
}

export async function saveTeamScoreLogs(teamScores, rawMetricsMap = {}) {
    let saved = 0, skipped = 0;
    for (const p of teamScores) {
        try {
            const r = await saveScoreLog(p, p.userId, p.displayName, p.teamRole, rawMetricsMap[p.userId] || {});
            if (r) saved++; else skipped++;
        } catch (e) { console.error(`[scoreLogService.sb] ${p.userId}:`, e.message); skipped++; }
    }
    return { saved, skipped };
}

export async function getScoreLogs(userId, days = 14) {
    const since = new Date(); since.setDate(since.getDate() - days);
    const { data, error } = await supabase.from('daily_score_logs').select('*')
        .eq('user_id', userId).gte('date', toDateKey(since)).order('date', { ascending: true });
    if (error) { console.error('[scoreLogService.sb]', error.message); return []; }
    return data || [];
}

export async function getTeamLogsForDate(date) {
    const key = toDateKey(date);
    const { data, error } = await supabase.from('daily_score_logs').select('*')
        .eq('date_key', key).order('score', { ascending: false });
    if (error) { console.error('[scoreLogService.sb]', error.message); return []; }
    return data || [];
}

export async function getWeeklyAverages(userId, weeks = 4) {
    const logs = await getScoreLogs(userId, weeks * 7);
    const byWeek = {};
    for (const log of logs) {
        const wk = log.week_number;
        if (!byWeek[wk]) byWeek[wk] = { total: 0, count: 0 };
        byWeek[wk].total += log.score;
        byWeek[wk].count++;
    }
    return Object.entries(byWeek)
        .map(([wk, d]) => ({ weekNumber: parseInt(wk), avgScore: parseFloat((d.total / d.count).toFixed(1)), count: d.count }))
        .sort((a, b) => a.weekNumber - b.weekNumber);
}
