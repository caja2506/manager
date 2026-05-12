/**
 * Audit Trail Service — V5 Phase 2G
 * ====================================
 * Append-only audit trail for all auditable platform events.
 * All writes go to COLLECTIONS.AUDIT_TRAIL (immutable by Firestore rules).
 *
 * @module services/auditTrailService
 */

import { collection, addDoc, getDocs, query, where, orderBy, limit } from 'firebase/firestore';
import { db } from '../firebase';
import {
    COLLECTIONS,
    AUDIT_TRAIL_EVENT_TYPE,
    AUDIT_TRAIL_ACTOR_TYPE,
    createAuditTrailDocument,
} from '../models/schemas';

/**
 * Record a generic audit trail event.
 *
 * @param {Object} params
 * @param {string} params.eventType - AUDIT_TRAIL_EVENT_TYPE value
 * @param {string} params.entityType - 'task', 'milestone', 'project', 'user', etc.
 * @param {string} params.entityId - Document ID of the entity
 * @param {string} params.actorType - AUDIT_TRAIL_ACTOR_TYPE value
 * @param {string} params.actorId - UID, 'system', or 'ai:{model}'
 * @param {Object} [params.changes] - { field: { from, to } }
 * @param {string} [params.correlationId] - Links related events together
 * @param {string} [params.description] - Human-readable description
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
        eventType,
        entityType,
        entityId,
        actorType,
        actorId,
        changes,
        metadata: {
            correlationId,
            description,
        },
    });

    await addDoc(collection(db, COLLECTIONS.AUDIT_TRAIL), event);
}

/**
 * Record a traffic light override event (specialized).
 */
export async function recordOverride({
    entityType,
    entityId,
    field,
    oldValue,
    newValue,
    reason,
    userId,
    expiresAt = null,
}) {
    await recordEvent({
        eventType: AUDIT_TRAIL_EVENT_TYPE.OVERRIDE,
        entityType,
        entityId,
        actorType: AUDIT_TRAIL_ACTOR_TYPE.USER,
        actorId: userId,
        changes: {
            [field]: { from: oldValue, to: newValue },
        },
        description: `Override: ${reason}${expiresAt ? ` (expires ${expiresAt})` : ''}`,
    });
}

/**
 * Record an AI action event (specialized).
 */
export async function recordAiAction({
    capability,
    entityType,
    entityId,
    model = 'gemini-2.5-flash',
    result = null,
    governanceRef = null,
}) {
    await recordEvent({
        eventType: AUDIT_TRAIL_EVENT_TYPE.AI_ACTION,
        entityType,
        entityId,
        actorType: AUDIT_TRAIL_ACTOR_TYPE.AI,
        actorId: `ai:${model}`,
        changes: null,
        correlationId: governanceRef,
        description: `AI ${capability}: ${result || 'completed'}`,
    });
}

/**
 * Record an entity change event (specialized).
 */
export async function recordEntityChange({
    entityType,
    entityId,
    changes,
    userId,
    description = '',
}) {
    await recordEvent({
        eventType: AUDIT_TRAIL_EVENT_TYPE.ENTITY_CHANGE,
        entityType,
        entityId,
        actorType: AUDIT_TRAIL_ACTOR_TYPE.USER,
        actorId: userId,
        changes,
        description,
    });
}

/**
 * Get recent audit trail for an entity.
 * @param {string} entityType
 * @param {string} entityId
 * @param {number} [maxResults=50]
 */
export async function getAuditTrailForEntity(entityType, entityId, maxResults = 50) {
    const q = query(
        collection(db, COLLECTIONS.AUDIT_TRAIL),
        where('entityType', '==', entityType),
        where('entityId', '==', entityId),
        orderBy('timestamp', 'desc'),
        limit(maxResults)
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}
