/**
 * Audit Persistence Service
 * ==========================
 * 
 * Writes audit findings, scores, and events to the database.
 * Dual-backend: Supabase or Firebase depending on config.
 */

import { USE_SUPABASE } from '../services/_backend';
import { supabase } from '../supabase';
import { COLLECTIONS } from '../models/schemas';

// ============================================================
// PERSIST AUDIT RESULTS
// ============================================================

/**
 * Persist a full audit run.
 */
export async function persistAuditResults(auditResult, userId = 'system') {
    if (!auditResult?.findings?.length) return { findingsWritten: 0 };

    const now = new Date().toISOString();
    const runId = `audit-${Date.now()}`;

    if (USE_SUPABASE) {
        // 1. Write findings
        const findings = (auditResult.newFindings || auditResult.findings).slice(0, 450).map(f => ({
            ...f,
            audit_run_id: runId,
            created_at: now,
            status: f.status || 'open',
        }));
        if (findings.length > 0) {
            await supabase.from('audit_findings').insert(findings);
        }

        // 2. Write audit event
        await supabase.from('audit_events').insert({
            event_type: 'audit_run',
            entity_type: 'system',
            entity_id: 'department',
            user_id: userId,
            timestamp: now,
            source: 'client_audit',
            correlation_id: runId,
            details: {
                totalFindings: auditResult.summary?.totalFindings || 0,
                bySeverity: auditResult.summary?.bySeverity || {},
                scores: auditResult.scores || null,
                dataSnapshot: auditResult.dataSnapshot || null,
            },
        });

        // 3. Write analytics snapshot
        if (auditResult.scores) {
            await supabase.from('analytics_snapshots').insert({
                scope: 'compliance',
                entity_id: 'department',
                snapshot_date: now.split('T')[0],
                metrics: {
                    ...auditResult.scores,
                    totalFindings: auditResult.summary?.totalFindings || 0,
                    bySeverity: auditResult.summary?.bySeverity || {},
                },
                created_at: now,
                created_by: userId,
            });
        }

        return { findingsWritten: findings.length, runId };
    }

    // Firebase fallback
    const { collection, doc, writeBatch } = await import('firebase/firestore');
    const { db } = await import('../firebase');

    const batch = writeBatch(db);
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
        if (findingsWritten >= 450) break;
    }

    const eventRef = doc(collection(db, COLLECTIONS.AUDIT_EVENTS));
    batch.set(eventRef, {
        eventType: 'audit_run', entityType: 'system', entityId: 'department',
        userId, timestamp: now, source: 'client_audit', correlationId: runId,
        details: {
            totalFindings: auditResult.summary?.totalFindings || 0,
            bySeverity: auditResult.summary?.bySeverity || {},
            scores: auditResult.scores || null,
            dataSnapshot: auditResult.dataSnapshot || null,
        },
    });

    if (auditResult.scores) {
        const snapshotRef = doc(collection(db, COLLECTIONS.ANALYTICS_SNAPSHOTS));
        batch.set(snapshotRef, {
            scope: 'compliance', entityId: 'department',
            snapshotDate: now.split('T')[0],
            metrics: { ...auditResult.scores, totalFindings: auditResult.summary?.totalFindings || 0, bySeverity: auditResult.summary?.bySeverity || {} },
            createdAt: now, createdBy: userId,
        });
    }

    await batch.commit();
    return { findingsWritten, runId };
}

// ============================================================
// READ HISTORICAL AUDIT DATA
// ============================================================

export async function fetchRecentFindings(limitCount = 100) {
    if (USE_SUPABASE) {
        const { data } = await supabase.from('audit_findings').select('*').eq('status', 'open').order('created_at', { ascending: false }).limit(limitCount);
        return data || [];
    }
    const { collection, getDocs, query, where, orderBy, limit } = await import('firebase/firestore');
    const { db } = await import('../firebase');
    const q = query(collection(db, COLLECTIONS.AUDIT_FINDINGS), where('status', '==', 'open'), orderBy('createdAt', 'desc'), limit(limitCount));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function fetchComplianceHistory(days = 30) {
    const since = new Date();
    since.setDate(since.getDate() - days);
    const sinceStr = since.toISOString().split('T')[0];

    if (USE_SUPABASE) {
        const { data } = await supabase.from('analytics_snapshots').select('*').eq('scope', 'compliance').gte('snapshot_date', sinceStr).order('snapshot_date', { ascending: true });
        return data || [];
    }
    const { collection, getDocs, query, where, orderBy } = await import('firebase/firestore');
    const { db } = await import('../firebase');
    const q = query(collection(db, COLLECTIONS.ANALYTICS_SNAPSHOTS), where('scope', '==', 'compliance'), where('snapshotDate', '>=', sinceStr), orderBy('snapshotDate', 'asc'));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function fetchAuditHistory(limitCount = 20) {
    if (USE_SUPABASE) {
        const { data } = await supabase.from('audit_events').select('*').eq('event_type', 'audit_run').order('timestamp', { ascending: false }).limit(limitCount);
        return data || [];
    }
    const { collection, getDocs, query, where, orderBy, limit } = await import('firebase/firestore');
    const { db } = await import('../firebase');
    const q = query(collection(db, COLLECTIONS.AUDIT_EVENTS), where('eventType', '==', 'audit_run'), orderBy('timestamp', 'desc'), limit(limitCount));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}
