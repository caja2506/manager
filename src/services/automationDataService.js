/**
 * automationDataService.js
 * ========================
 * [Phase M.2] Supabase queries for AI automation components.
 * Extracted from AIExecutionLogCard and AutomationAISummaryCard.
 */

import { supabase } from '../supabase';

const mapExecution = (r) => ({
    id: r.id,
    featureType: r.feature_type,
    sourceType: r.source_type,
    status: r.status,
    latencyMs: r.latency_ms,
    confidenceScore: Number(r.confidence_score || 0),
    confidenceAction: r.confidence_action,
    inputTokens: r.input_tokens,
    outputTokens: r.output_tokens,
    createdBy: r.created_by,
    createdAt: r.created_at,
});

/**
 * Load recent AI executions.
 * @param {number} [maxResults=20]
 * @returns {Promise<Array>}
 */
export async function loadRecentAIExecutions(maxResults = 20) {
    const { data, error } = await supabase
        .from('ai_executions')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(maxResults);

    if (error) {
        console.error('[automationDataService] error loading executions:', error);
        return [];
    }
    return (data || []).map(mapExecution);
}

/**
 * Load today's AI metrics.
 * @returns {Promise<object>} Aggregated metrics
 */
export async function loadTodayAIMetrics() {
    const today = new Date().toISOString().split('T')[0];
    const startOfDay = new Date(today + 'T00:00:00Z').toISOString();

    const { data, error } = await supabase
        .from('ai_executions')
        .select('*')
        .gte('created_at', startOfDay)
        .order('created_at', { ascending: false })
        .limit(200);

    if (error) {
        console.error('[automationDataService] error loading today metrics:', error);
        return {
            total: 0, success: 0, failure: 0, fallback: 0,
            audioCount: 0, textCount: 0, briefingCount: 0, extractionCount: 0,
            confirmationsRequested: 0, avgConfidence: 'N/A', avgLatency: 0
        };
    }

    const executions = (data || []).map(mapExecution);

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

