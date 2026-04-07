import { useState, useEffect, useCallback } from 'react';
import { subscribeToNotifications, markNotificationRead, markAllNotificationsRead } from '../services/notificationService';
import { useAuth } from '../contexts/AuthContext';

export function useNotifications() {
    const { user } = useAuth();
    const [notifications, setNotifications] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!user?.uid) {
            setNotifications([]);
            setLoading(false);
            return;
        }

        const unsub = subscribeToNotifications(
            user.uid,
            (items) => { setNotifications(items); setLoading(false); },
            (err) => { console.error('[useNotifications] Subscription failed:', err); setLoading(false); }
        );

        return unsub;
    }, [user?.uid]);

    const unreadCount = notifications.filter(n => !n.read).length;

    const markAsRead = useCallback(async (notifId) => {
        try { await markNotificationRead(notifId); }
        catch (err) { console.error('Error marking notification as read:', err); }
    }, []);

    const markAllRead = useCallback(async () => {
        try { await markAllNotificationsRead(notifications); }
        catch (err) { console.error('Error marking all as read:', err); }
    }, [notifications]);

    return {
        notifications,
        loading,
        unreadCount,
        markAsRead,
        markAllRead
    };
}
