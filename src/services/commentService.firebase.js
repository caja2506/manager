/**
 * Comment Service
 * ================
 * CRUD for task comments stored in sub-collection: tasks/{taskId}/comments/{commentId}
 *
 * Schema per comment:
 *   - text: string
 *   - userId: string
 *   - userName: string
 *   - createdAt: ISO string
 *   - updatedAt: ISO string (if edited)
 *   - edited: boolean
 */

import { db } from '../firebase';
import {
    collection, doc, setDoc, getDocs, updateDoc, deleteDoc,
    query, orderBy, onSnapshot, limit
} from 'firebase/firestore';

/**
 * Subscribe to comments for a task (real-time).
 * @param {string} taskId
 * @param {function} onData — callback(comments[])
 * @returns {function} unsubscribe
 */
export function subscribeToComments(taskId, onData) {
    if (!taskId) return () => {};

    const colRef = collection(db, 'tasks', taskId, 'comments');
    const q = query(colRef, orderBy('createdAt', 'asc'), limit(500));

    return onSnapshot(q, (snap) => {
        const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        onData(items);
    }, (err) => {
        console.warn('[commentService] Subscription error:', err.message);
        onData([]);
    });
}

/**
 * Add a comment to a task.
 * @param {string} taskId
 * @param {string} text
 * @param {string} userId
 * @param {string} userName
 * @returns {string} comment ID
 */
export async function addComment(taskId, text, userId, userName) {
    if (!taskId || !text?.trim()) return null;

    const colRef = collection(db, 'tasks', taskId, 'comments');
    const ref = doc(colRef);
    const now = new Date().toISOString();

    await setDoc(ref, {
        text: text.trim(),
        userId,
        userName: userName || null,
        createdAt: now,
        updatedAt: null,
        edited: false,
        taskId, // denormalized for collectionGroup queries
    });

    return ref.id;
}

/**
 * Update the text of an existing comment.
 * @param {string} taskId
 * @param {string} commentId
 * @param {string} newText
 */
export async function updateComment(taskId, commentId, newText) {
    const ref = doc(db, 'tasks', taskId, 'comments', commentId);
    await updateDoc(ref, {
        text: newText.trim(),
        updatedAt: new Date().toISOString(),
        edited: true,
    });
}

/**
 * Delete a comment.
 * @param {string} taskId
 * @param {string} commentId
 */
export async function deleteComment(taskId, commentId) {
    const ref = doc(db, 'tasks', taskId, 'comments', commentId);
    await deleteDoc(ref);
}

/**
 * Fetch all comments for a task (one-time, not real-time).
 * @param {string} taskId
 * @returns {Array}
 */
export async function fetchComments(taskId) {
    if (!taskId) return [];
    const colRef = collection(db, 'tasks', taskId, 'comments');
    const q = query(colRef, orderBy('createdAt', 'asc'));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

/**
 * Fetch all comments from yesterday across all tasks (collectionGroup).
 * @param {string} yesterdayStr — YYYY-MM-DD
 * @returns {Array} [{ id, taskId, text, userName, createdAt }]
 */
export async function fetchYesterdayComments(yesterdayStr) {
    const { collectionGroup: cg, where } = await import('firebase/firestore');
    const start = `${yesterdayStr}T00:00:00`;
    const end = `${yesterdayStr}T23:59:59`;
    const q = query(
        cg(db, 'comments'),
        where('createdAt', '>=', start),
        where('createdAt', '<=', end)
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, taskId: d.data().taskId, ...d.data() }));
}
