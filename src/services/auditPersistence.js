/**
 * Audit Persistence Service
 * ==========================
 * 
 * Writes audit findings, scores, and events to Firestore.
 * Used by both the client (useAuditData) and Cloud Functions.
 */

import {
    collection, doc, setDoc, getDocs, query, where,
    orderBy, writeBatch, limit, serverTimestamp
} from 'firebase/firestore';
import { db } from '../firebase';
import { COLLECTIONS } from '../models/schemas';

// ============================================================
// PERSIST AUDIT RESULTS
// ============================================================

/**
 * Persist a full audit run to Firestore.
 * 
 * @param {Object} auditResult - From auditEngine.runFullAudit()
 * @param {string} userId - Current user ID (or 'system' for Cloud Functions)
 * @returns {Object} { findingsWritten, snapshotId }
 */
export async function persistAuditResults(auditResult, userId = 'system') {
    if (!auditResult?.findings?.length) return { findingsWritten: 0 };

    const batch = writeBatch(db);
    const now = new Date().toISOString();
    const runId = `audit-${Date.now()}`;

    // 1. Write new / updated findings
    let findingsWritten = 0;
    for (const finding of auditResult.newFindings || auditResult.findings) {
        const findingRef = doc(collection(db, COLLECTIONS.AUDIT_FINDINGS));
        batch.set(findingRef, {
            ...finding,
            auditRunId: runId,
            createdAt: now,
            status: finding.status || 'open',
        });
        findingsWritten++;

        // Limit batch size (Firestore max 500 writes per batch)
        if (findingsWritten >= 450) break;
    }

    // 2. Write audit event (summary of this run)
    const eventRef = doc(collection(db, COLLECTIONS.AUDIT_EVENTS));
    batch.set(eventRef, {
        eventType: 'audit_run',
        userId,
        timestamp: now,
        details: {
            runId,
            totalFindings: auditResult.summary?.totalFindings || 0,
            bySeverity: auditResult.summary?.bySeverity || {},
            scores: auditResult.scores || null,
            dataSnapshot: auditResult.dataSnapshot || null,
        },
    });

    // 3. Write analytics snapshot (compliance scores over time)
    if (auditResult.scores) {
        const snapshotRef = doc(collection(db, COLLECTIONS.ANALYTICS_SNAPSHOTS));
        batch.set(snapshotRef, {
            scope: 'compliance',
            entityId: 'department',
            snapshotDate: now.split('T')[0],
            metrics: {
                ...auditResult.scores,
                totalFindings: auditResult.summary?.totalFindings || 0,
                bySeverity: auditResult.summary?.bySeverity || {},
            },
            createdAt: now,
            createdBy: userId,
        });
    }

    await batch.commit();

    return { findingsWritten, runId };
}

// ============================================================
// READ HISTORICAL AUDIT DATA
// ============================================================

/**
 * Fetch recent audit findings from Firestore.
 */
export async function fetchRecentFindings(limitCount = 100) {
    const q = query(
        collection(db, COLLECTIONS.AUDIT_FINDINGS),
        where('status', '==', 'open'),
        orderBy('createdAt', 'desc'),
        limit(limitCount)
    );

    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

/**
 * Fetch compliance score history for trend analysis.
 */
export async function fetchComplianceHistory(days = 30) {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const q = query(
        collection(db, COLLECTIONS.ANALYTICS_SNAPSHOTS),
        where('scope', '==', 'compliance'),
        where('snapshotDate', '>=', since.toISOString().split('T')[0]),
        orderBy('snapshotDate', 'asc')
    );

    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

/**
 * Fetch recent audit events (run history).
 */
export async function fetchAuditHistory(limitCount = 20) {
    const q = query(
        collection(db, COLLECTIONS.AUDIT_EVENTS),
        where('eventType', '==', 'audit_run'),
        orderBy('timestamp', 'desc'),
        limit(limitCount)
    );

    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}
