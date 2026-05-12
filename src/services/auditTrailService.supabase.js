/**
 * auditTrailService.supabase.js
 * ================================
 * Supabase implementation: Append-only audit trail.
 */

import { supabase } from '../supabase';
import {
    AUDIT_TRAIL_EVENT_TYPE,
    AUDIT_TRAIL_ACTOR_TYPE,
    createAuditTrailDocument,
} from '../models/schemas';

/**
 * Record a generic audit trail event.
 */
export async function recordEvent({
    eventType,
    entityType,
    entityId,
    actorType = AUDIT_TRAIL_ACTOR_TYPE.USER,
    actorId,
    changes = null,
    correlationId = null,
    description = '',
}) {
    const event = createAuditTrailDocument({
        eventType, entityType, entityId, actorType, actorId, changes,
        metadata: { correlationId, description },
    });

    const { error } = await supabase.from('audit_trail').insert({
        event_type: event.eventType,
        entity_type: event.entityType,
        entity_id: event.entityId,
        actor_type: event.actorType,
        actor_id: event.actorId,
        changes: event.changes,
        metadata: event.metadata,
        description: description,
        timestamp: event.timestamp,
    });

    if (error) console.error('[auditTrail] recordEvent error:', error.message);
}

/**
 * Record a traffic light override event.
 */
export async function recordOverride({ entityType, entityId, field, oldValue, newValue, reason, userId, expiresAt = null }) {
    await recordEvent({
        eventType: AUDIT_TRAIL_EVENT_TYPE.OVERRIDE,
        entityType, entityId,
        actorType: AUDIT_TRAIL_ACTOR_TYPE.USER,
        actorId: userId,
        changes: { [field]: { from: oldValue, to: newValue } },
        description: `Override: ${reason}${expiresAt ? ` (expires ${expiresAt})` : ''}`,
    });
}

/**
 * Record an AI action event.
 */
export async function recordAiAction({ capability, entityType, entityId, model = 'gemini-2.5-flash', result = null, governanceRef = null }) {
    await recordEvent({
        eventType: AUDIT_TRAIL_EVENT_TYPE.AI_ACTION,
        entityType, entityId,
        actorType: AUDIT_TRAIL_ACTOR_TYPE.AI,
        actorId: `ai:${model}`,
        changes: null,
        correlationId: governanceRef,
        description: `AI ${capability}: ${result || 'completed'}`,
    });
}

/**
 * Record an entity change event.
 */
export async function recordEntityChange({ entityType, entityId, changes, userId, description = '' }) {
    await recordEvent({
        eventType: AUDIT_TRAIL_EVENT_TYPE.ENTITY_CHANGE,
        entityType, entityId,
        actorType: AUDIT_TRAIL_ACTOR_TYPE.USER,
        actorId: userId,
        changes,
        description,
    });
}

/**
 * Get recent audit trail for an entity.
 */
export async function getAuditTrailForEntity(entityType, entityId, maxResults = 50) {
    const { data, error } = await supabase
        .from('audit_trail')
        .select('*')
        .eq('entity_type', entityType)
        .eq('entity_id', entityId)
        .order('timestamp', { ascending: false })
        .limit(maxResults);

    if (error) { console.error('[auditTrail] getAuditTrailForEntity:', error.message); return []; }
    return (data || []).map(row => ({
        id: row.id,
        eventType: row.event_type,
        entityType: row.entity_type,
        entityId: row.entity_id,
        actorType: row.actor_type,
        actorId: row.actor_id,
        changes: row.changes,
        metadata: row.metadata,
        description: row.description,
        timestamp: row.timestamp,
    }));
}
