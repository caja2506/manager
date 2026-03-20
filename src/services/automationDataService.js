/**
 * automationDataService.js
 * ========================
 * [Phase M.2] Firestore queries for AI automation components.
 * Extracted from AIExecutionLogCard and AutomationAISummaryCard.
 */

import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { db } from '../firebase';

/**
 * Load recent AI executions.
 * @param {number} [maxResults=20]
 * @returns {Promise<Array>}
 */
export async function loadRecentAIExecutions(maxResults = 20) {
    const q = query(
        collection(db, 'aiExecutions'),
        orderBy('createdAt', 'desc'),
        limit(maxResults)
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

/**
 * Load today's AI metrics.
 * @returns {Promise<object>} Aggregated metrics
 */
export async function loadTodayAIMetrics() {
    const today = new Date().toISOString().split('T')[0];
    const startOfDay = new Date(today + 'T00:00:00Z').toISOString();

    const q = query(
        collection(db, 'aiExecutions'),
        where('createdAt', '>=', startOfDay),
        orderBy('createdAt', 'desc'),
        limit(200)
    );

    const snap = await getDocs(q);
    const executions = snap.docs.map(d => d.data());

    return {
        total: executions.length,
        success: executions.filter(e => e.status === 'success').length,
        failure: executions.filter(e => e.status === 'failure').length,
        fallback: executions.filter(e => e.status === 'fallback').length,
        audioCount: executions.filter(e => e.sourceType === 'audio').length,
        textCount: executions.filter(e => e.sourceType === 'text').length,
        briefingCount: executions.filter(e => e.featureType === 'briefing_generation').length,
        extractionCount: executions.filter(e =>
            e.featureType === 'report_extraction' || e.featureType === 'audio_transcription'
        ).length,
        confirmationsRequested: executions.filter(e => e.confidenceAction === 'confirm').length,
        avgConfidence: executions.length > 0
            ? (executions.reduce((s, e) => s + (e.confidenceScore || 0), 0) / executions.length).toFixed(2)
            : 'N/A',
        avgLatency: executions.length > 0
            ? Math.round(executions.reduce((s, e) => s + (e.latencyMs || 0), 0) / executions.length)
            : 0,
    };
}
