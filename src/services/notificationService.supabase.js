/**
 * Notification Service — Supabase Version
 * =========================================
 * Real-time subscriptions and mutations for notifications table.
 */

import { supabase } from '../supabase';

/**
 * Subscribe to a user's notifications (real-time).
 */
export function subscribeToNotifications(userId, onData, onError) {
    if (!userId) return () => {};

    // Initial fetch
    fetchNotifications(userId).then(onData).catch(err => {
        console.warn('[notificationService.sb] Initial fetch failed:', err.message);
        onData([]); // Return empty array instead of crashing
    });

    // Realtime — wrap in try/catch to prevent ErrorBoundary crash
    let channel;
    try {
        channel = supabase.channel(`notifications-${userId}`);
        channel.on('postgres_changes',
            { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
            () => { fetchNotifications(userId).then(onData).catch(err => console.warn('[notificationService.sb] Realtime refetch failed:', err.message)); }
        );
        channel.subscribe((status) => {
            if (status === 'CHANNEL_ERROR') {
                console.warn('[notificationService.sb] Channel error for notifications');
            }
        });
    } catch (err) {
        console.warn('[notificationService.sb] Realtime subscription failed:', err.message);
    }

    return () => { if (channel) supabase.removeChannel(channel); };
}

/**
 * Fetch notifications for a user (one-time).
 */
async function fetchNotifications(userId) {
    const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(100);
    if (error) throw error;
    // Map to camelCase for backward compat
    return (data || []).map(n => ({
        id: n.id,
        userId: n.user_id,
        type: n.type,
        title: n.title,
        message: n.message,
        read: n.read,
        link: n.link,
        taskId: n.task_id,
        projectId: n.project_id,
        triggeredBy: n.triggered_by,
        createdAt: n.created_at,
    }));
}

/**
 * Mark a single notification as read.
 */
export async function markNotificationRead(notifId) {
    const { error } = await supabase
        .from('notifications').update({ read: true }).eq('id', notifId);
    if (error) throw new Error(`[notificationService.sb] markRead: ${error.message}`);
}

/**
 * Mark multiple notifications as read (batch).
 */
export async function markAllNotificationsRead(notifications) {
    const unread = notifications.filter(n => !n.read);
    if (unread.length === 0) return;
    const ids = unread.map(n => n.id);
    const { error } = await supabase
        .from('notifications').update({ read: true }).in('id', ids);
    if (error) throw new Error(`[notificationService.sb] markAllRead: ${error.message}`);
}
