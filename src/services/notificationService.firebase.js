/**
 * notificationService.js
 * =====================
 * [Phase M.2] Firestore operations for notifications.
 * Extracted from Notifications.jsx to remove direct Firestore access from pages.
 */

import {
    collection, query, where, onSnapshot,
    doc, updateDoc, writeBatch
} from 'firebase/firestore';
import { db } from '../firebase';
import { COLLECTIONS } from '../models/schemas';

/**
 * Subscribe to a user's notifications (real-time).
 * @param {string} userId
 * @param {function} onData - callback(items[])
 * @param {function} onError - callback(error)
 * @returns {function} unsubscribe
 */
export function subscribeToNotifications(userId, onData, onError) {
    // We removed orderBy/limit from the query to avoid Firebase compound index requirement.
    // Instead, we sort and limit the documents in-memory.
    const q = query(
        collection(db, COLLECTIONS.NOTIFICATIONS),
        where('userId', '==', userId)
    );
    return onSnapshot(q, (snap) => {
        let items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        // Descending sort
        items.sort((a, b) => {
            const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
            const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
            return dateB - dateA;
        });
        onData(items.slice(0, 100)); // Limit in memory
    }, onError);
}

/**
 * Mark a single notification as read.
 * @param {string} notifId
 */
export async function markNotificationRead(notifId) {
    await updateDoc(doc(db, COLLECTIONS.NOTIFICATIONS, notifId), { read: true });
}

/**
 * Mark multiple notifications as read (batch).
 * @param {Array<{id: string}>} notifications - items to mark
 */
export async function markAllNotificationsRead(notifications) {
    const unread = notifications.filter(n => !n.read);
    if (unread.length === 0) return;
    const batch = writeBatch(db);
    unread.forEach(n => {
        batch.update(doc(db, COLLECTIONS.NOTIFICATIONS, n.id), { read: true });
    });
    await batch.commit();
}
