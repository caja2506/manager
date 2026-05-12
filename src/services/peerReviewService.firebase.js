/**
 * Peer Review Service — src/services/peerReviewService.js
 * ========================================================
 * Client-side service for peer review operations.
 * Calls Cloud Functions for mutations (enforced server-side).
 * Uses Firestore subscriptions for real-time reads.
 */

import { httpsCallable } from 'firebase/functions';
import {
    collection, query, where, orderBy, onSnapshot, doc, getDoc, getDocs, updateDoc,
} from 'firebase/firestore';
import { functions, db } from '../firebase';

// ── Cloud Function Callables ──

const requestPeerReviewFn = httpsCallable(functions, 'requestPeerReview');
const submitPeerReviewFn = httpsCallable(functions, 'submitPeerReview');
const waivePeerReviewFn = httpsCallable(functions, 'waivePeerReview');
const generatePRChecklistFn = httpsCallable(functions, 'generatePRChecklist');
const saveTaskTypeChecklistFn = httpsCallable(functions, 'saveTaskTypeChecklist');

// ── Mutations (via Cloud Functions) ──

/**
 * Request a peer review for a task.
 * Moves the task to `validation` status and creates a peerReview doc.
 */
export async function requestPeerReview(taskId, reviewerId) {
    const result = await requestPeerReviewFn({ taskId, reviewerId });
    return result.data;
}

/**
 * Submit a peer review decision.
 * @param {string} reviewId
 * @param {'approved'|'changes_requested'} decision
 * @param {Array} checklistItems — items with `{ id, checked }` status
 * @param {string} summary — reviewer notes
 */
export async function submitPeerReview(reviewId, decision, checklistItems, summary) {
    const result = await submitPeerReviewFn({ reviewId, decision, checklistItems, summary });
    return result.data;
}

/**
 * Waive peer review for a task (privileged only).
 */
export async function waivePeerReview(taskId, reason) {
    const result = await waivePeerReviewFn({ taskId, reason });
    return result.data;
}

// ── Reads ──

/**
 * Get the checklist sections for a task type (reads from taskType doc).
 * Returns { sections: [...] } with items grouped by section.
 */
export async function getChecklistForTaskType(taskTypeId) {
    if (!taskTypeId) return null;
    try {
        const ttDoc = await getDoc(doc(db, 'taskTypes', taskTypeId));
        if (!ttDoc.exists()) return null;
        const data = ttDoc.data();
        const sections = data.peerReviewSections || [];
        // Build flat items array for backward compatibility
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
        console.warn('[peerReviewService] getChecklistForTaskType error:', err.message);
        return null;
    }
}

/**
 * @deprecated Use getChecklistForTaskType instead
 */
export async function getTemplateForTaskType(taskTypeId) {
    return getChecklistForTaskType(taskTypeId);
}

/**
 * Get pending reviews assigned to a specific user.
 */
export function subscribeToPendingReviews(userId, callback) {
    const q = query(
        collection(db, 'peerReviews'),
        where('reviewerId', '==', userId),
        where('status', 'in', ['requested', 'in_review'])
    );
    return onSnapshot(q, (snapshot) => {
        const reviews = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        callback(reviews);
    });
}

/**
 * Subscribe to all peer reviews for a specific task.
 */
export function subscribeToPeerReviews(taskId, callback) {
    const q = query(
        collection(db, 'peerReviews'),
        where('taskId', '==', taskId),
        orderBy('createdAt', 'desc')
    );
    return onSnapshot(q, (snapshot) => {
        const reviews = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        callback(reviews);
    });
}

// ── AI-Powered Checklist Generation ──

/**
 * Generate peer review checklist items organized by sections using AI.
 * @param {string} taskTypeName - e.g. 'Programación', 'Diseño', 'Pruebas'
 * @param {string} [context] - additional context for the AI
 * @returns {Promise<{sections: Array}>}
 */
export async function generatePRChecklist(taskTypeName, context = '') {
    const result = await generatePRChecklistFn({ taskTypeName, context });
    return result.data;
}

/**
 * Save checklist sections directly to a taskType document.
 * @param {string} taskTypeId
 * @param {Array} sections - [{name, items:[{label,required}]}]
 */
export async function saveTaskTypeChecklist(taskTypeId, sections) {
    const result = await saveTaskTypeChecklistFn({ taskTypeId, sections });
    return result.data;
}

// ── TaskType → Peer Review Resolution ──

/**
 * Reads the taskType document to determine if peer review is required.
 */
export async function resolvePeerReviewFromTaskType(taskTypeId) {
    if (!taskTypeId) return null;
    try {
        const ttDoc = await getDoc(doc(db, 'taskTypes', taskTypeId));
        if (!ttDoc.exists()) return null;
        const data = ttDoc.data();
        if (!data.peerReviewRequired) return null;
        return {
            peerReviewRequired: true,
            peerReviewSections: data.peerReviewSections || [],
        };
    } catch (err) {
        console.warn('[peerReviewService] resolvePeerReviewFromTaskType error:', err.message);
        return null;
    }
}

/**
 * Update peer review config fields on a taskType document.
 */
export async function updateTaskTypePeerReview(taskTypeId, { peerReviewRequired }) {
    await updateDoc(doc(db, 'taskTypes', taskTypeId), {
        peerReviewRequired: !!peerReviewRequired,
        updatedAt: new Date().toISOString(),
    });
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
