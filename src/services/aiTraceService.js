/**
 * AI Trace Service — V5 Phase 6H
 * =================================
 * Records every AI monitoring intervention to AUDIT_TRAIL
 * with full traceability: signals, actions, approvals, results.
 *
 * @module services/aiTraceService
 */

import { collection, addDoc, getDocs, query, where, orderBy, limit } from 'firebase/firestore';
import { db } from '../firebase';
import { COLLECTIONS } from '../models/schemas';

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

    await addDoc(collection(db, COLLECTIONS.AUDIT_TRAIL), {
        eventType: 'ai_monitoring',
        entityType,
        entityId,
        actorType: 'ai',
        actorId: 'ai:monitoring-engine',
        timestamp: trace.timestamp,
        changes: null,
        metadata: trace,
    });

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
    const q = query(
        collection(db, COLLECTIONS.AUDIT_TRAIL),
        where('eventType', '==', 'ai_monitoring'),
        where('entityType', '==', entityType),
        where('entityId', '==', entityId),
        orderBy('timestamp', 'desc'),
        limit(maxResults)
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}
