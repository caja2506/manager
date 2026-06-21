/**
 * Audit Persistence Service
 * ==========================
 * 
 * Writes audit findings, scores, and events to the database.
 * Dual-backend: Supabase or Firebase depending on config.
 */

import { supabase } from '../supabase';

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

    // 1. Write findings
    const findings = (auditResult.newFindings || auditResult.findings).slice(0, 450).map(f => ({
        ...f,
        audit_run_id: runId,
        created_at: now,
        status: f.status || 'open',
    }));
    try {
        if (findings.length > 0) {
            await supabase.from('audit_findings').insert(findings);
        }
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
    } catch (err) {
        console.warn('[auditPersistence] persistAuditResults Supabase error:', err.message);
    }

    return { findingsWritten: findings.length, runId };
}

// ============================================================
// READ HISTORICAL AUDIT DATA
// ============================================================

export async function fetchRecentFindings(limitCount = 100) {
    try {
        const { data, error } = await supabase.from('audit_findings').select('*').eq('status', 'open').order('created_at', { ascending: false }).limit(limitCount);
        if (error) { console.warn('[auditPersistence] fetchRecentFindings:', error.message); return []; }
        return data || [];
    } catch (err) {
        console.warn('[auditPersistence] fetchRecentFindings failed:', err.message);
        return [];
    }
}

export async function fetchComplianceHistory(days = 30) {
    const since = new Date();
    since.setDate(since.getDate() - days);
    const sinceStr = since.toISOString().split('T')[0];

    try {
        const { data, error } = await supabase.from('analytics_snapshots').select('*').eq('scope', 'compliance').gte('snapshot_date', sinceStr).order('snapshot_date', { ascending: true });
        if (error) { console.warn('[auditPersistence] fetchComplianceHistory:', error.message); return []; }
        return data || [];
    } catch (err) {
        console.warn('[auditPersistence] fetchComplianceHistory failed:', err.message);
        return [];
    }
}

export async function fetchAuditHistory(limitCount = 20) {
    try {
        const { data, error } = await supabase.from('audit_events').select('*').eq('event_type', 'audit_run').order('timestamp', { ascending: false }).limit(limitCount);
        if (error) {
            console.warn('[auditPersistence] fetchAuditHistory error:', error.message);
            return [];
        }
        return data || [];
    } catch (err) {
        console.warn('[auditPersistence] fetchAuditHistory failed:', err.message);
        return [];
    }
}
