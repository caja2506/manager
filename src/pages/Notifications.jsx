import React, { useState, useEffect, useCallback, useMemo } from 'react';
import PageHeader from '../components/layout/PageHeader';
import { useAuth } from '../contexts/AuthContext';
import { useRole } from '../contexts/RoleContext';
import { useAuditData } from '../hooks/useAuditData';
import { useEngineeringData } from '../hooks/useEngineeringData';
import { useNotifications } from '../hooks/useNotifications';
import { FindingCardList } from '../components/audit/FindingCard';
import TaskDetailModal from '../components/tasks/TaskDetailModal';
import {
    Bell, Check, CheckCheck, AlertTriangle, Info, Briefcase,
    Clock, ChevronRight, Inbox, Shield, Filter, RefreshCw,
    AlertOctagon
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
    audit_warning: { icon: AlertTriangle, color: 'text-amber-400', bg: 'bg-amber-500/15', label: 'Auditoría' },
    audit_critical: { icon: AlertOctagon, color: 'text-rose-400', bg: 'bg-rose-500/15', label: 'Auditoría Crítica' },
    audit_info: { icon: Shield, color: 'text-blue-400', bg: 'bg-blue-500/15', label: 'Auditoría' },
};

const DEFAULT_TYPE = { icon: Bell, color: 'text-slate-400', bg: 'bg-slate-500/15', label: 'Notificación' };

// ============================================================
// SEVERITY FILTER OPTIONS
// ============================================================
const SEVERITY_OPTIONS = [
    { value: 'all', label: 'Todas' },
    { value: 'critical', label: 'Crítico' },
    { value: 'warning', label: 'Advertencia' },
    { value: 'info', label: 'Info' },
];

export default function Notifications() {
    const { user } = useAuth();
    const { canEdit, canDelete } = useRole();
    const { engTasks = [], engProjects = [], engSubtasks = [], taskTypes = [], teamMembers = [] } = useEngineeringData();

    // ── Notifications Hook ──
    const { notifications, loading, unreadCount, markAsRead, markAllRead: handleMarkAllRead } = useNotifications();

    // ── Audit Alerts (live) ──
    const {
        runClientAudit,
        auditResult,
        isAuditing,
        isReady,
    } = useAuditData();

    // ── UI State ──
    const [activeTab, setActiveTab] = useState('alerts'); // 'alerts' | 'notifications'
    const [severityFilter, setSeverityFilter] = useState('all');
    const [notifFilter, setNotifFilter] = useState('all'); // 'all' | 'unread'

    // ── Task Modal ──
    const [selectedTask, setSelectedTask] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const closeModal = () => { setIsModalOpen(false); setSelectedTask(null); };

    const handleOpenTask = useCallback((taskId) => {
        const task = engTasks.find(t => t.id === taskId);
        if (task) {
            setSelectedTask(task);
            setIsModalOpen(true);
        }
    }, [engTasks]);


    // ── Auto-run audit when data is ready ──
    useEffect(() => {
        if (isReady && !auditResult && !isAuditing) {
            runClientAudit();
        }
    }, [isReady, auditResult, isAuditing, runClientAudit]);

    // ── Derived: filtered audit findings ──
    const filteredFindings = useMemo(() => {
        if (!auditResult?.findings) return [];
        let findings = [...auditResult.findings];

        if (severityFilter !== 'all') {
            findings = findings.filter(f => f.severity === severityFilter);
        }

        // Sort: critical first
        const order = { critical: 0, warning: 1, info: 2 };
        findings.sort((a, b) => (order[a.severity] || 2) - (order[b.severity] || 2));

        return findings;
    }, [auditResult, severityFilter]);

    // ── Derived: counts ──
    const alertCounts = useMemo(() => {
        if (!auditResult?.findings) return { total: 0, critical: 0, warning: 0, info: 0 };
        const findings = auditResult.findings;
        return {
            total: findings.length,
            critical: findings.filter(f => f.severity === 'critical').length,
            warning: findings.filter(f => f.severity === 'warning').length,
            info: findings.filter(f => f.severity === 'info').length,
        };
    }, [auditResult]);

    // ── Filtered notifications ──
    const filteredNotifications = notifFilter === 'unread'
        ? notifications.filter(n => !n.read)
        : notifications;

    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            <PageHeader title="" showBack={true} />

            {/* ── Header ── */}
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg shadow-amber-500/30 relative">
                            <Bell className="w-5 h-5 text-white" />
                            {(alertCounts.critical + alertCounts.warning + unreadCount) > 0 && (
                                <span className="absolute -top-1 -right-1 w-5 h-5 bg-rose-500 text-white text-[10px] font-black rounded-full flex items-center justify-center shadow-lg">
                                    {alertCounts.critical + alertCounts.warning + unreadCount > 9 ? '9+' : alertCounts.critical + alertCounts.warning + unreadCount}
                                </span>
                            )}
                        </div>
                        Notificaciones
                    </h1>
                    <p className="text-sm text-slate-400 mt-1">
                        {alertCounts.total > 0 ? `${alertCounts.total} alertas de auditoría` : 'Sin alertas'}
                        {' · '}
                        {unreadCount > 0 ? `${unreadCount} sin leer` : `${notifications.length} notificaciones`}
                    </p>
                </div>

                {/* Refresh audit */}
                <button
                    onClick={runClientAudit}
                    disabled={isAuditing}
                    className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-600/50 text-white text-sm font-bold rounded-xl transition-colors shadow-lg shadow-indigo-900/30"
                >
                    <RefreshCw className={`w-4 h-4 ${isAuditing ? 'animate-spin' : ''}`} />
                    {isAuditing ? 'Evaluando...' : 'Re-evaluar'}
                </button>
            </div>

            {/* ── Tabs ── */}
            <div className="flex items-center gap-1 bg-slate-800/50 p-1 rounded-xl w-fit">
                <button
                    onClick={() => setActiveTab('alerts')}
                    className={`flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-lg transition-all ${
                        activeTab === 'alerts'
                            ? 'bg-slate-700 text-white shadow-md'
                            : 'text-slate-400 hover:text-white'
                    }`}
                >
                    <Shield className="w-4 h-4" />
                    Alertas
                    {alertCounts.total > 0 && (
                        <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full ${
                            alertCounts.critical > 0 ? 'bg-rose-500/20 text-rose-400' : 'bg-amber-500/20 text-amber-400'
                        }`}>
                            {alertCounts.total}
                        </span>
                    )}
                </button>
                <button
                    onClick={() => setActiveTab('notifications')}
                    className={`flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-lg transition-all ${
                        activeTab === 'notifications'
                            ? 'bg-slate-700 text-white shadow-md'
                            : 'text-slate-400 hover:text-white'
                    }`}
                >
                    <Bell className="w-4 h-4" />
                    Notificaciones
                    {unreadCount > 0 && (
                        <span className="text-[10px] font-black px-1.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-400">
                            {unreadCount}
                        </span>
                    )}
                </button>
            </div>

            {/* ══════════════════════════════════════ */}
            {/* TAB: ALERTAS DE AUDITORÍA              */}
            {/* ══════════════════════════════════════ */}
            {activeTab === 'alerts' && (
                <div className="space-y-4">
                    {/* Severity filter */}
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Filter className="w-4 h-4 text-slate-500" />
                            <div className="flex bg-slate-800/50 p-0.5 rounded-lg">
                                {SEVERITY_OPTIONS.map(opt => (
                                    <button
                                        key={opt.value}
                                        onClick={() => setSeverityFilter(opt.value)}
                                        className={`px-3 py-1.5 text-xs font-bold rounded-md transition-colors ${
                                            severityFilter === opt.value
                                                ? 'bg-slate-700 text-white'
                                                : 'text-slate-400 hover:text-white'
                                        }`}
                                    >
                                        {opt.label}
                                        {opt.value !== 'all' && alertCounts[opt.value] > 0 && (
                                            <span className="ml-1 text-[9px] opacity-70">({alertCounts[opt.value]})</span>
                                        )}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <span className="text-xs font-bold text-slate-500">
                            {filteredFindings.length} hallazgo{filteredFindings.length !== 1 ? 's' : ''}
                        </span>
                    </div>

                    {/* Audit loading state */}
                    {isAuditing && (
                        <div className="text-center py-12">
                            <RefreshCw className="w-8 h-8 text-indigo-400 animate-spin mx-auto mb-3" />
                            <p className="text-sm font-bold text-slate-400">Evaluando 18 reglas de auditoría...</p>
                        </div>
                    )}

                    {/* Findings list - reusing FindingCard from audit */}
                    {!isAuditing && (
                        <FindingCardList
                            findings={filteredFindings}
                            emptyMessage="Sin hallazgos de auditoría — todo en orden ✅"
                            maxItems={100}
                            onOpenTask={handleOpenTask}
                        />
                    )}

                    {/* Info footer */}
                    {auditResult && !isAuditing && (
                        <div className="bg-slate-900/50 rounded-xl border border-slate-800 p-3 text-center">
                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                                🔍 {auditResult.dataSnapshot?.totalTasks || 0} Tareas · {auditResult.dataSnapshot?.totalProjects || 0} Proyectos · {auditResult.dataSnapshot?.totalUsers || 0} Usuarios evaluados
                                {' · '}
                                🕐 {new Date(auditResult.auditedAt).toLocaleString('es-MX')}
                            </p>
                        </div>
                    )}
                </div>
            )}

            {/* ══════════════════════════════════════ */}
            {/* TAB: NOTIFICACIONES DE FIRESTORE       */}
            {/* ══════════════════════════════════════ */}
            {activeTab === 'notifications' && (
                <div className="space-y-4">
                    {/* Notification filter + actions */}
                    <div className="flex items-center justify-between">
                        <div className="flex bg-slate-800/50 p-0.5 rounded-lg">
                            <button
                                onClick={() => setNotifFilter('all')}
                                className={`px-3 py-1.5 text-xs font-bold rounded-md transition-colors ${
                                    notifFilter === 'all' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'
                                }`}
                            >
                                Todas
                            </button>
                            <button
                                onClick={() => setNotifFilter('unread')}
                                className={`px-3 py-1.5 text-xs font-bold rounded-md transition-colors ${
                                    notifFilter === 'unread' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'
                                }`}
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

                    {/* Notification list */}
                    {loading ? (
                        <div className="text-center py-16 text-slate-400 font-bold text-sm">Cargando notificaciones...</div>
                    ) : filteredNotifications.length === 0 ? (
                        <div className="text-center py-16 text-slate-500">
                            <Inbox className="w-12 h-12 mx-auto mb-3 opacity-40" />
                            <p className="font-bold">{notifFilter === 'unread' ? 'No hay notificaciones sin leer' : 'No hay notificaciones'}</p>
                            <p className="text-sm mt-1">Las notificaciones del sistema aparecerán aquí cuando se generen.</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {filteredNotifications.map(notif => (
                                <NotificationItem
                                    key={notif.id}
                                    notification={notif}
                                    onMarkRead={markAsRead}
                                    onOpenTask={handleOpenTask}
                                    engTasks={engTasks}
                                    teamMembers={teamMembers}
                                />
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* ── Task Detail Modal ── */}
            <TaskDetailModal
                isOpen={isModalOpen}
                onClose={closeModal}
                task={selectedTask}
                projects={engProjects}
                teamMembers={teamMembers}
                subtasks={selectedTask ? engSubtasks.filter(s => s.taskId === selectedTask.id) : []}
                taskTypes={taskTypes}
                userId={user?.uid}
                canEdit={canEdit}
                canDelete={canDelete}
            />
        </div>
    );
}

// ============================================================
// NOTIFICATION ITEM (Firestore)
// ============================================================

function NotificationItem({ notification, onMarkRead, onOpenTask, engTasks = [], teamMembers = [] }) {
    const config = TYPE_CONFIG[notification.type] || DEFAULT_TYPE;
    const Icon = config.icon;

    const timeAgo = notification.createdAt
        ? formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true, locale: es })
        : '';

    const handleClick = () => {
        // If notification has a taskId reference, open the task modal
        if (notification.taskId && onOpenTask) {
            onOpenTask(notification.taskId);
        }
        // Mark as read on click
        if (!notification.read) {
            onMarkRead(notification.id);
        }
    };

    return (
        <div
            onClick={handleClick}
            className={`flex items-start gap-3 p-4 rounded-xl border transition-all cursor-pointer ${notification.read
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
                {notification.taskId && (() => {
                    const nTask = engTasks.find(t => t.id === notification.taskId);
                    if (!nTask) return null;
                    const asignador = teamMembers.find(m => m.uid === nTask.assignedBy)?.displayName || 'Desconocido';
                    const asignado = teamMembers.find(m => m.uid === nTask.assignedTo)?.displayName || 'Sin asignar';
                    return (
                        <div className="mt-1.5 text-[11px] text-slate-400 bg-slate-800/50 rounded px-2 py-1 inline-flex gap-3 border border-slate-700/50">
                            <div><span className="font-semibold text-slate-300">De:</span> {asignador}</div>
                            <div><span className="font-semibold text-slate-300">Para:</span> {asignado}</div>
                        </div>
                    );
                })()}
                {/* Show entityId if present */}
                {notification.entityId && (
                    <code className="text-[9px] font-mono text-indigo-400/60 bg-indigo-500/10 px-1.5 py-0.5 rounded mt-1 inline-block select-all">
                        {notification.entityId}
                    </code>
                )}
                <p className="text-[10px] text-slate-500 mt-1">{timeAgo}</p>
            </div>

            {/* Mark read button */}
            {!notification.read && (
                <button
                    onClick={(e) => { e.stopPropagation(); onMarkRead(notification.id); }}
                    className="p-1.5 text-slate-500 hover:text-indigo-400 hover:bg-indigo-500/10 rounded-lg transition-colors flex-shrink-0"
                    title="Marcar como leído"
                >
                    <Check className="w-4 h-4" />
                </button>
            )}
        </div>
    );
}
