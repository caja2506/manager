/**
 * Peer Review Service — Supabase Version
 * ========================================
 * Client-side service for peer review operations.
 * Mutations use RPC calls to Supabase stored procedures.
 * Reads use direct table queries with real-time subscriptions.
 *
 * NOTE: The Cloud Functions (requestPeerReview, submitPeerReview, waivePeerReview)
 * still run on Firebase until Edge Functions are created.
 * Only the READ operations are migrated to Supabase.
 */

import { supabase } from '../supabase';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase';

// ── Cloud Function Callables (STILL FIREBASE — migrate in Phase 4) ──

const requestPeerReviewFn = httpsCallable(functions, 'requestPeerReview');
const submitPeerReviewFn = httpsCallable(functions, 'submitPeerReview');
const waivePeerReviewFn = httpsCallable(functions, 'waivePeerReview');
const generatePRChecklistFn = httpsCallable(functions, 'generatePRChecklist');
const saveTaskTypeChecklistFn = httpsCallable(functions, 'saveTaskTypeChecklist');

// ── Mutations (via Cloud Functions — temporary) ──

export async function requestPeerReview(taskId, reviewerId) {
    const result = await requestPeerReviewFn({ taskId, reviewerId });
    return result.data;
}

export async function submitPeerReview(reviewId, decision, checklistItems, summary) {
    const result = await submitPeerReviewFn({ reviewId, decision, checklistItems, summary });
    return result.data;
}

export async function waivePeerReview(taskId, reason) {
    const result = await waivePeerReviewFn({ taskId, reason });
    return result.data;
}

// ── Reads (Supabase) ──

export async function getChecklistForTaskType(taskTypeId) {
    if (!taskTypeId) return null;
    try {
        const { data, error } = await supabase
            .from('task_types')
            .select('name, peer_review_sections')
            .eq('id', taskTypeId)
            .single();
        if (error || !data) return null;
        const sections = data.peer_review_sections || [];
        const items = sections.flatMap((s, si) =>
            (s.items || []).map((item, ii) => ({
                id: item.id || `s${si}i${ii}`,
                label: item.label,
                required: !!item.required,
                section: s.name,
            }))
        );
        return { name: data.name, sections, items };
    } catch (err) {
        console.warn('[peerReviewService.sb] getChecklistForTaskType error:', err.message);
        return null;
    }
}

export async function getTemplateForTaskType(taskTypeId) {
    return getChecklistForTaskType(taskTypeId);
}

export function subscribeToPendingReviews(userId, callback) {
    // Initial fetch
    fetchPendingReviews(userId).then(callback);

    const channel = supabase
        .channel(`pending-reviews-${userId}`)
        .on('postgres_changes',
            { event: '*', schema: 'public', table: 'peer_reviews', filter: `reviewer_id=eq.${userId}` },
            () => { fetchPendingReviews(userId).then(callback); }
        )
        .subscribe();

    return () => { supabase.removeChannel(channel); };
}

async function fetchPendingReviews(userId) {
    const { data, error } = await supabase
        .from('peer_reviews')
        .select('*')
        .eq('reviewer_id', userId)
        .in('status', ['requested', 'in_review']);
    if (error) { console.warn('[peerReviewService.sb] fetchPending:', error.message); return []; }
    return (data || []).map(mapPeerReview);
}

export function subscribeToPeerReviews(taskId, callback) {
    // Initial fetch
    fetchTaskReviews(taskId).then(callback);

    const channel = supabase
        .channel(`task-reviews-${taskId}`)
        .on('postgres_changes',
            { event: '*', schema: 'public', table: 'peer_reviews', filter: `task_id=eq.${taskId}` },
            () => { fetchTaskReviews(taskId).then(callback); }
        )
        .subscribe();

    return () => { supabase.removeChannel(channel); };
}

async function fetchTaskReviews(taskId) {
    const { data, error } = await supabase
        .from('peer_reviews')
        .select('*')
        .eq('task_id', taskId)
        .order('created_at', { ascending: false });
    if (error) { console.warn('[peerReviewService.sb] fetchTaskReviews:', error.message); return []; }
    return (data || []).map(mapPeerReview);
}

// ── AI-Powered Checklist Generation ──

export async function generatePRChecklist(taskTypeName, context = '') {
    const result = await generatePRChecklistFn({ taskTypeName, context });
    return result.data;
}

export async function saveTaskTypeChecklist(taskTypeId, sections) {
    const { data, error } = await supabase
        .from('task_types')
        .update({ 
            peer_review_sections: sections || [],
            updated_at: new Date().toISOString()
        })
        .eq('id', taskTypeId)
        .select();
        
    if (error) throw new Error(`[peerReviewService.sb] saveChecklist: ${error.message}`);
    return data;
}

// ── TaskType → Peer Review Resolution ──

export async function resolvePeerReviewFromTaskType(taskTypeId) {
    if (!taskTypeId) return null;
    try {
        const { data, error } = await supabase
            .from('task_types')
            .select('peer_review_required, peer_review_sections')
            .eq('id', taskTypeId)
            .single();
        if (error || !data || !data.peer_review_required) return null;
        return {
            peerReviewRequired: true,
            peerReviewSections: data.peer_review_sections || [],
        };
    } catch (err) {
        console.warn('[peerReviewService.sb] resolve error:', err.message);
        return null;
    }
}

export async function updateTaskTypePeerReview(taskTypeId, { peerReviewRequired }) {
    const { error } = await supabase
        .from('task_types')
        .update({ peer_review_required: !!peerReviewRequired })
        .eq('id', taskTypeId);
    if (error) throw new Error(`[peerReviewService.sb] updateTaskTypePR: ${error.message}`);
}

// ── Peer Review Status Helpers ──

export const PR_STATUS_CONFIG = {
    not_required: { label: 'No requerido', color: 'slate', icon: null },
    requested: { label: 'Solicitado', color: 'amber', icon: '🟡' },
    in_review: { label: 'En revisión', color: 'blue', icon: '🔵' },
    approved: { label: 'Aprobado', color: 'emerald', icon: '🟢' },
    changes_requested: { label: 'Cambios solicitados', color: 'red', icon: '🔴' },
    waived: { label: 'Exonerado', color: 'gray', icon: '⚪' },
};

// ── Mapping helper ──

function mapPeerReview(r) {
    return {
        id: r.id,
        taskId: r.task_id,
        projectId: r.project_id,
        cycle: r.cycle,
        requestedBy: r.requested_by,
        reviewerId: r.reviewer_id,
        discipline: r.discipline,
        status: r.status,
        checklistItems: r.checklist_items,
        decision: r.decision,
        summary: r.summary,
        waivedBy: r.waived_by,
        waiveReason: r.waive_reason,
        requestedAt: r.requested_at,
        startedAt: r.started_at,
        completedAt: r.completed_at,
        createdAt: r.created_at,
    };
}
