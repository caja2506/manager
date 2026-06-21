/**
 * AI Trace Service — V5 Phase 6H
 * =================================
 * Records every AI monitoring intervention to AUDIT_TRAIL
 * with full traceability: signals, actions, approvals, results.
 *
 * @module services/analyticTraceService
 */

import { supabase } from '../supabase';

const mapTrace = (r) => ({
    id: r.id,
    eventType: r.event_type,
    entityType: r.entity_type,
    entityId: r.entity_id,
    actorType: r.actor_type,
    actorId: r.actor_id,
    changes: r.changes,
    metadata: r.metadata,
    timestamp: r.timestamp,
});

/**
 * Record an AI monitoring trace event.
 */
export async function recordAiTrace({
    correlationId,
    triggerSource,
    entityType,
    entityId,
    capability,
    signalsObserved = [],
    scoreAtMoment = null,
    riskLevel = 'ok',
    recommendationEmitted = null,
    actionExecuted = null,
    actionAuto = true,
    approvalRequired = false,
    approvedBy = null,
    channelUsed = 'in_app',
    result = 'completed',
    metadata = {},
}) {
    const trace = {
        correlationId,
        triggerSource,
        entityType,
        entityId,
        capability,
        signalsObserved,
        scoreAtMoment,
        riskLevel,
        recommendationEmitted,
        actionExecuted,
        actionAuto,
        approvalRequired,
        approvedBy,
        channelUsed,
        result,
        timestamp: new Date().toISOString(),
        metadata,
    };

    const { error } = await supabase.from('audit_trail').insert({
        event_type: 'ai_monitoring',
        entity_type: entityType,
        entity_id: entityId,
        actor_type: 'ai',
        actor_id: 'ai:monitoring-engine',
        timestamp: trace.timestamp,
        changes: null,
        metadata: trace,
    });

    if (error) {
        console.error('[analyticTraceService] Error recording trace:', error);
    }

    return trace;
}

/**
 * Record batch of traces from a monitoring cycle result.
 */
export async function recordMonitoringCycleTraces(monitoringResult) {
    const traces = [];
    const { correlationId, triggerSource, milestoneId, traceRecord, actions, risks, followUps } = monitoringResult;

    // Main cycle trace
    traces.push(await recordAiTrace({
        correlationId,
        triggerSource,
        entityType: 'milestone',
        entityId: milestoneId,
        capability: 'monitoring_cycle',
        signalsObserved: risks.map(r => r.signal),
        scoreAtMoment: traceRecord.milestoneScore,
        riskLevel: traceRecord.riskLevel,
        actionExecuted: `${actions.length} actions proposed`,
        metadata: { actionsCount: actions.length, followUpsCount: followUps.length },
    }));

    // Individual follow-up traces
    for (const fu of followUps) {
        traces.push(await recordAiTrace({
            correlationId,
            triggerSource,
            entityType: fu.entityType,
            entityId: fu.entityId,
            capability: fu.type,
            recommendationEmitted: fu.message,
            channelUsed: 'in_app',
            result: 'emitted',
        }));
    }

    return traces;
}

/**
 * Get AI monitoring traces for an entity.
 */
export async function getAiTraces(entityType, entityId, maxResults = 30) {
    const { data, error } = await supabase
        .from('audit_trail')
        .select('*')
        .eq('event_type', 'ai_monitoring')
        .eq('entity_type', entityType)
        .eq('entity_id', entityId)
        .order('timestamp', { ascending: false })
        .limit(maxResults);

    if (error) {
        console.error('[analyticTraceService] Error loading traces:', error);
        return [];
    }
    return (data || []).map(mapTrace);
}

