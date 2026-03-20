import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
    subscribeToNotifications,
    markNotificationRead,
    markAllNotificationsRead,
} from '../services/notificationService';
import {
    Bell, Check, CheckCheck, AlertTriangle, Info, Briefcase,
    Clock, ChevronRight, Inbox, Filter
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

// Notification type config
const TYPE_CONFIG = {
    task_assigned: { icon: Briefcase, color: 'text-indigo-400', bg: 'bg-indigo-500/15', label: 'Tarea asignada' },
    status_change: { icon: ChevronRight, color: 'text-cyan-400', bg: 'bg-cyan-500/15', label: 'Cambio de estado' },
    task_blocked: { icon: AlertTriangle, color: 'text-rose-400', bg: 'bg-rose-500/15', label: 'Tarea bloqueada' },
    risk_alert: { icon: AlertTriangle, color: 'text-amber-400', bg: 'bg-amber-500/15', label: 'Alerta de riesgo' },
    reminder: { icon: Clock, color: 'text-violet-400', bg: 'bg-violet-500/15', label: 'Recordatorio' },
    system: { icon: Info, color: 'text-slate-400', bg: 'bg-slate-500/15', label: 'Sistema' },
};

const DEFAULT_TYPE = { icon: Bell, color: 'text-slate-400', bg: 'bg-slate-500/15', label: 'Notificación' };

export default function Notifications() {
    const { user } = useAuth();
    const [notifications, setNotifications] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('all'); // 'all' | 'unread'

    // Real-time subscription to user's notifications
    useEffect(() => {
        if (!user?.uid) return;

        const unsub = subscribeToNotifications(
            user.uid,
            (items) => { setNotifications(items); setLoading(false); },
            (err) => { console.error('[Notifications] Subscription failed:', err); setLoading(false); }
        );

        return unsub;
    }, [user?.uid]);

    // Mark single as read
    const markAsRead = useCallback(async (notifId) => {
        try {
            await markNotificationRead(notifId);
        } catch (err) {
            console.error('Error marking notification as read:', err);
        }
    }, []);

    // Mark all as read
    const handleMarkAllRead = useCallback(async () => {
        try {
            await markAllNotificationsRead(notifications);
        } catch (err) {
            console.error('Error marking all as read:', err);
        }
    }, [notifications]);

    const filtered = filter === 'unread'
        ? notifications.filter(n => !n.read)
        : notifications;

    const unreadCount = notifications.filter(n => !n.read).length;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg shadow-amber-500/30 relative">
                            <Bell className="w-5 h-5 text-white" />
                            {unreadCount > 0 && (
                                <span className="absolute -top-1 -right-1 w-5 h-5 bg-rose-500 text-white text-[10px] font-black rounded-full flex items-center justify-center shadow-lg">
                                    {unreadCount > 9 ? '9+' : unreadCount}
                                </span>
                            )}
                        </div>
                        Notificaciones
                    </h1>
                    <p className="text-sm text-slate-400 mt-1">
                        {unreadCount > 0 ? `${unreadCount} sin leer` : 'Todo al día'} · {notifications.length} total
                    </p>
                </div>

                <div className="flex items-center gap-2">
                    {/* Filter toggle */}
                    <div className="flex bg-slate-800 rounded-lg p-0.5">
                        <button
                            onClick={() => setFilter('all')}
                            className={`px-3 py-1.5 text-xs font-bold rounded-md transition-colors ${filter === 'all' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'}`}
                        >
                            Todas
                        </button>
                        <button
                            onClick={() => setFilter('unread')}
                            className={`px-3 py-1.5 text-xs font-bold rounded-md transition-colors ${filter === 'unread' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'}`}
                        >
                            Sin leer {unreadCount > 0 && `(${unreadCount})`}
                        </button>
                    </div>

                    {unreadCount > 0 && (
                        <button
                            onClick={handleMarkAllRead}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-500/15 text-indigo-400 text-xs font-bold rounded-lg hover:bg-indigo-500/25 transition-colors"
                        >
                            <CheckCheck className="w-3.5 h-3.5" />
                            Marcar todas
                        </button>
                    )}
                </div>
            </div>

            {/* Notification list */}
            {loading ? (
                <div className="text-center py-16 text-slate-400 font-bold text-sm">Cargando notificaciones...</div>
            ) : filtered.length === 0 ? (
                <div className="text-center py-16 text-slate-500">
                    <Inbox className="w-12 h-12 mx-auto mb-3 opacity-40" />
                    <p className="font-bold">{filter === 'unread' ? 'No hay notificaciones sin leer' : 'No hay notificaciones'}</p>
                    <p className="text-sm mt-1">Las notificaciones del sistema aparecerán aquí.</p>
                </div>
            ) : (
                <div className="space-y-2">
                    {filtered.map(notif => (
                        <NotificationItem
                            key={notif.id}
                            notification={notif}
                            onMarkRead={markAsRead}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

function NotificationItem({ notification, onMarkRead }) {
    const config = TYPE_CONFIG[notification.type] || DEFAULT_TYPE;
    const Icon = config.icon;

    const timeAgo = notification.createdAt
        ? formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true, locale: es })
        : '';

    return (
        <div
            className={`flex items-start gap-3 p-4 rounded-xl border transition-all ${notification.read
                    ? 'bg-slate-800/30 border-slate-800/50 opacity-70'
                    : 'bg-slate-800/70 border-slate-700/50 hover:border-slate-600/50'
                }`}
        >
            {/* Type icon */}
            <div className={`w-9 h-9 rounded-lg ${config.bg} flex items-center justify-center flex-shrink-0 mt-0.5`}>
                <Icon className={`w-4 h-4 ${config.color}`} />
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${config.bg} ${config.color}`}>
                        {config.label}
                    </span>
                    {!notification.read && (
                        <span className="w-2 h-2 bg-indigo-500 rounded-full flex-shrink-0" />
                    )}
                </div>
                <p className={`text-sm font-bold ${notification.read ? 'text-slate-400' : 'text-white'}`}>
                    {notification.title}
                </p>
                {notification.message && (
                    <p className="text-xs text-slate-400 mt-0.5 line-clamp-2">{notification.message}</p>
                )}
                <p className="text-[10px] text-slate-500 mt-1">{timeAgo}</p>
            </div>

            {/* Mark read button */}
            {!notification.read && (
                <button
                    onClick={() => onMarkRead(notification.id)}
                    className="p-1.5 text-slate-500 hover:text-indigo-400 hover:bg-indigo-500/10 rounded-lg transition-colors flex-shrink-0"
                    title="Marcar como leído"
                >
                    <Check className="w-4 h-4" />
                </button>
            )}
        </div>
    );
}
