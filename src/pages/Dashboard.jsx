import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useEngineeringData } from '../hooks/useEngineeringData';
import { useAuth } from '../contexts/AuthContext';
import { useRole } from '../contexts/RoleContext';
import {
    LayoutDashboard, AlertTriangle, Shield, CheckCircle, Clock, Zap, Target,
    Activity, Users, Flame, AlertOctagon, CheckCheck, ChevronDown, ChevronRight,
    Play, Eye, Inbox, ListTodo, Briefcase, ArrowRight, Timer, X
} from 'lucide-react';
import { format, startOfWeek, endOfWeek, isWithinInterval } from 'date-fns';
import { es } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';
import { RISK_LEVEL_CONFIG, TASK_STATUS_CONFIG } from '../models/schemas';
import { useAuditData } from '../hooks/useAuditData';
import ComplianceScoresPanel from '../components/audit/ComplianceScoresPanel';
import TaskDetailModal from '../components/tasks/TaskDetailModal';
import PageHeader from '../components/layout/PageHeader';
import { resolveDelay } from '../services/delayService';

// ============================================================
// ANIMATED COUNT UP HOOK
// ============================================================

function useCountUp(end, duration = 1200) {
    const [val, setVal] = useState(0);
    const prevEnd = useRef(0);
    useEffect(() => {
        if (end === prevEnd.current) return;
        prevEnd.current = end;
        const numEnd = typeof end === 'number' ? end : parseFloat(end) || 0;
        if (numEnd === 0) { requestAnimationFrame(() => setVal(0)); return; }
        const isDecimal = !Number.isInteger(numEnd);
        let start = null;
        const step = (ts) => {
            if (!start) start = ts;
            const p = Math.min((ts - start) / duration, 1);
            // easeOutCubic
            const eased = 1 - Math.pow(1 - p, 3);
            const current = eased * numEnd;
            setVal(isDecimal ? parseFloat(current.toFixed(1)) : Math.round(current));
            if (p < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
    }, [end, duration]);
    return val;
}

// ============================================================
// EXPANDABLE KPI CARD
// ============================================================

function KpiCard({ label, value, suffix, icon: KpiIcon, color, children, badge, onClick }) {
    const [expanded, setExpanded] = useState(false);
    const hasChildren = !!children;
    // Animate numeric values
    const numericValue = typeof value === 'number' ? value : parseFloat(value) || 0;
    const animatedValue = useCountUp(numericValue);

    const colorMap = {
        indigo: { bg: 'bg-indigo-600/15', border: 'border-indigo-500/30', text: 'text-indigo-400', iconBg: 'bg-indigo-600/20', hoverBorder: 'hover:border-indigo-500/50' },
        amber: { bg: 'bg-amber-600/15', border: 'border-amber-500/30', text: 'text-amber-400', iconBg: 'bg-amber-600/20', hoverBorder: 'hover:border-amber-500/50' },
        rose: { bg: 'bg-rose-600/15', border: 'border-rose-500/30', text: 'text-rose-400', iconBg: 'bg-rose-600/20', hoverBorder: 'hover:border-rose-500/50' },
        orange: { bg: 'bg-orange-600/15', border: 'border-orange-500/30', text: 'text-orange-400', iconBg: 'bg-orange-600/20', hoverBorder: 'hover:border-orange-500/50' },
        emerald: { bg: 'bg-emerald-600/15', border: 'border-emerald-500/30', text: 'text-emerald-400', iconBg: 'bg-emerald-600/20', hoverBorder: 'hover:border-emerald-500/50' },
        violet: { bg: 'bg-violet-600/15', border: 'border-violet-500/30', text: 'text-violet-400', iconBg: 'bg-violet-600/20', hoverBorder: 'hover:border-violet-500/50' },
    };
    const c = colorMap[color] || colorMap.indigo;

    return (
        <div className={`bg-slate-900/70 backdrop-blur-sm rounded-2xl border border-slate-800 shadow-lg transition-all ${hasChildren ? `cursor-pointer ${c.hoverBorder}` : ''} ${expanded ? c.border : ''}`}>
            <div
                className="p-5"
                onClick={() => {
                    if (hasChildren) setExpanded(!expanded);
                    else if (onClick) onClick();
                }}
            >
                <div className="flex items-center justify-between mb-2">
                    <span className={`text-xs font-black uppercase tracking-wider ${c.text}`}>{label}</span>
                    <div className="flex items-center gap-2">
                        {badge && <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${badge.className}`}>{badge.text}</span>}
                        <div className={`w-8 h-8 rounded-xl ${c.iconBg} border ${c.border} flex items-center justify-center ${c.text}`}>
                            <KpiIcon className="w-4 h-4" />
                        </div>
                    </div>
                </div>
                <div className="flex items-end justify-between">
                    <span className="text-4xl font-black text-white">{typeof value === 'number' ? animatedValue : value}{suffix || ''}</span>
                    {hasChildren && (
                        <ChevronDown className={`w-5 h-5 text-slate-500 transition-transform duration-300 ${expanded ? 'rotate-180' : ''}`} />
                    )}
                </div>
            </div>

            {/* Expandable Drill-Down */}
            {hasChildren && expanded && (
                <div className="border-t border-slate-800 p-4 animate-in slide-in-from-top-2 duration-200">
                    {children}
                </div>
            )}
        </div>
    );
}

// ============================================================
// TASK PIPELINE
// ============================================================

function TaskPipeline({ tasks, onTaskClick }) {
    const [expandedStatus, setExpandedStatus] = useState(null);

    const pipeline = useMemo(() => {
        const statuses = [
            { key: 'backlog', label: 'Backlog', icon: Inbox, color: 'slate' },
            { key: 'planned', label: 'Planificado', icon: ListTodo, color: 'blue' },
            { key: 'in_progress', label: 'En Progreso', icon: Play, color: 'indigo' },
            { key: 'in_review', label: 'En Revisión', icon: Eye, color: 'amber' },
            { key: 'completed', label: 'Completado', icon: CheckCircle, color: 'emerald' },
        ];

        const total = tasks.length || 1;
        return statuses.map(s => ({
            ...s,
            count: tasks.filter(t => t.status === s.key).length,
            tasks: tasks.filter(t => t.status === s.key),
            pct: Math.round((tasks.filter(t => t.status === s.key).length / total) * 100),
        }));
    }, [tasks]);

    const statusColors = {
        slate: { bar: 'bg-slate-500', text: 'text-slate-400', bg: 'bg-slate-500/10' },
        blue: { bar: 'bg-blue-500', text: 'text-blue-400', bg: 'bg-blue-500/10' },
        indigo: { bar: 'bg-indigo-500', text: 'text-indigo-400', bg: 'bg-indigo-500/10' },
        amber: { bar: 'bg-amber-500', text: 'text-amber-400', bg: 'bg-amber-500/10' },
        emerald: { bar: 'bg-emerald-500', text: 'text-emerald-400', bg: 'bg-emerald-500/10' },
    };

    return (
        <div className="bg-slate-900/70 backdrop-blur-sm rounded-2xl border border-slate-800 shadow-lg p-6">
            <div className="flex items-center justify-between mb-5">
                <h3 className="font-bold text-lg text-white flex items-center gap-2">
                    <Target className="w-5 h-5 text-indigo-400" /> Pipeline de Tareas
                </h3>
                <span className="text-xs font-bold text-slate-500">{tasks.length} total</span>
            </div>

            <div className="space-y-3">
                {pipeline.map(stage => {
                    const sc = statusColors[stage.color];
                    const isExpanded = expandedStatus === stage.key;
                    const Icon = stage.icon;
                    return (
                        <div key={stage.key}>
                            <button
                                onClick={() => setExpandedStatus(isExpanded ? null : stage.key)}
                                className="w-full group"
                            >
                                <div className="flex items-center gap-3 mb-1">
                                    <Icon className={`w-4 h-4 ${sc.text} shrink-0`} />
                                    <span className={`text-xs font-black ${sc.text} uppercase tracking-wider w-28 text-left`}>{stage.label}</span>
                                    <div className="flex-1 h-5 bg-slate-800 rounded-full overflow-hidden relative">
                                        <div
                                            className={`h-full ${sc.bar} rounded-full transition-all duration-700 flex items-center justify-end pr-2`}
                                            style={{ width: `${Math.max(stage.pct, stage.count > 0 ? 8 : 0)}%` }}
                                        >
                                            {stage.count > 2 && <span className="text-[10px] font-black text-white">{stage.count}</span>}
                                        </div>
                                    </div>
                                    <span className="text-sm font-black text-slate-300 w-8 text-right">{stage.count}</span>
                                    <ChevronRight className={`w-4 h-4 text-slate-600 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                                </div>
                            </button>

                            {/* Drill-down: task list */}
                            {isExpanded && stage.tasks.length > 0 && (
                                <div className="ml-7 mt-2 mb-3 space-y-1.5 animate-in slide-in-from-top-1 duration-200">
                                    {stage.tasks.slice(0, 10).map(task => (
                                        <button
                                            key={task.id}
                                            onClick={() => onTaskClick(task)}
                                            className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl ${sc.bg} hover:bg-slate-800/60 transition-colors text-left`}
                                        >
                                            <div className={`w-2 h-2 rounded-full ${sc.bar} shrink-0`} />
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-bold text-slate-200 truncate">{task.title}</p>
                                                <p className="text-[10px] text-slate-500">{task.projectName || 'Sin proyecto'}</p>
                                            </div>
                                            {task.priority && (
                                                <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded ${
                                                    task.priority === 'critical' ? 'bg-rose-500/20 text-rose-400' :
                                                    task.priority === 'high' ? 'bg-amber-500/20 text-amber-400' :
                                                    'bg-slate-700 text-slate-400'
                                                }`}>{task.priority}</span>
                                            )}
                                        </button>
                                    ))}
                                    {stage.tasks.length > 10 && (
                                        <p className="text-[10px] text-slate-500 text-center py-1">+ {stage.tasks.length - 10} más</p>
                                    )}
                                </div>
                            )}
                            {isExpanded && stage.tasks.length === 0 && (
                                <p className="ml-7 text-xs text-slate-600 py-2">Sin tareas en este estado.</p>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

// ============================================================
// TEAM WORKLOAD PANEL (REDESIGNED)
// ============================================================

function TeamWorkloadPanel({ workload, timeLogs, engTasks, engProjects, onTaskClick }) {
    const [expandedUser, setExpandedUser] = useState(null);
    const now = new Date();
    const weekStart = startOfWeek(now, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
    const todayStr = format(now, 'yyyy-MM-dd');

    const getUserStats = useCallback((uid) => {
        // Today's logs
        const userTodayLogs = timeLogs.filter(l => l.userId === uid && l.startTime?.startsWith(todayStr) && l.endTime);
        const hoursToday = userTodayLogs.reduce((sum, l) => sum + (l.totalHours || 0), 0);
        const overtimeToday = userTodayLogs.reduce((sum, l) => sum + (l.overtimeHours || 0), 0);

        // Week's logs
        const userWeekLogs = timeLogs.filter(l => {
            if (l.userId !== uid || !l.startTime || !l.endTime) return false;
            const d = new Date(l.startTime);
            return isWithinInterval(d, { start: weekStart, end: weekEnd });
        });
        const hoursWeek = userWeekLogs.reduce((sum, l) => sum + (l.totalHours || 0), 0);
        const overtimeWeek = userWeekLogs.reduce((sum, l) => sum + (l.overtimeHours || 0), 0);

        // Active timer
        const activeTimer = timeLogs.find(l => l.userId === uid && !l.endTime);

        // Tasks breakdown
        const userTasks = engTasks.filter(t => t.assignedTo === uid && !['completed', 'cancelled'].includes(t.status));
        const inProgress = userTasks.filter(t => t.status === 'in_progress');
        const blocked = userTasks.filter(t => t.status === 'blocked');
        const inReview = userTasks.filter(t => t.status === 'in_review');

        return { hoursToday, overtimeToday, hoursWeek, overtimeWeek, activeTimer, userTasks, inProgress, blocked, inReview };
    }, [timeLogs, engTasks, todayStr, weekStart, weekEnd]);

    const roleLabels = { manager: 'Manager', team_lead: 'Team Lead', engineer: 'Ingeniero', technician: 'Técnico' };

    return (
        <div className="bg-slate-900/70 backdrop-blur-sm rounded-2xl border border-slate-800 shadow-lg p-6">
            <div className="flex items-center justify-between mb-5">
                <h3 className="font-bold text-lg text-white flex items-center gap-2">
                    <Users className="w-5 h-5 text-indigo-400" /> Equipo
                </h3>
                <span className="text-xs font-bold text-slate-500">{workload.length} miembros</span>
            </div>

            <div className="space-y-2">
                {workload.map(user => {
                    const stats = getUserStats(user.uid);
                    const isExpanded = expandedUser === user.uid;
                    const name = user.displayName || user.email || '?';

                    return (
                        <div key={user.uid} className={`rounded-xl border transition-all ${isExpanded ? 'border-indigo-500/30 bg-slate-800/50' : 'border-transparent bg-slate-800/30 hover:bg-slate-800/50'}`}>
                            {/* Compact Row */}
                            <button
                                onClick={() => setExpandedUser(isExpanded ? null : user.uid)}
                                className="w-full flex items-center gap-3 p-3 text-left"
                            >
                                {/* Avatar */}
                                <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm shrink-0 ${
                                    stats.activeTimer ? 'bg-emerald-600/30 border border-emerald-500/50 text-emerald-400' : 'bg-indigo-600/20 border border-indigo-500/30 text-indigo-400'
                                }`}>
                                    {stats.activeTimer && <div className="absolute w-2.5 h-2.5 bg-emerald-500 rounded-full -top-0.5 -right-0.5 animate-pulse" />}
                                    {name[0].toUpperCase()}
                                </div>

                                {/* Name + Role */}
                                <div className="min-w-0 shrink">
                                    <span className="text-sm font-bold text-slate-200 block truncate">{name}</span>
                                    <span className="text-[10px] font-bold text-slate-500 uppercase">{roleLabels[user.teamRole] || 'Ingeniero'}</span>
                                </div>

                                {/* Quick Stats Badges */}
                                <div className="flex items-center gap-1.5 flex-wrap ml-auto">
                                    {stats.inProgress.length > 0 && (
                                        <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-400 border border-indigo-500/25">
                                            ▶ {stats.inProgress.length}
                                        </span>
                                    )}
                                    {stats.blocked.length > 0 && (
                                        <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-400 border border-rose-500/25">
                                            ⛔ {stats.blocked.length}
                                        </span>
                                    )}
                                    {stats.hoursToday > 0 && (
                                        <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-400 border border-blue-500/25">
                                            ⏱ {stats.hoursToday.toFixed(1)}h
                                        </span>
                                    )}
                                    {stats.overtimeWeek > 0 && (
                                        <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-orange-500/15 text-orange-400 border border-orange-500/25">
                                            ⚡ {stats.overtimeWeek.toFixed(1)}h extra
                                        </span>
                                    )}
                                    {stats.activeTimer && (
                                        <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 animate-pulse">
                                            🟢 Activo
                                        </span>
                                    )}
                                    <span className="text-xs font-bold text-slate-500">{user.totalAssigned}</span>
                                    <ChevronDown className={`w-4 h-4 text-slate-600 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                                </div>
                            </button>

                            {/* Expanded Detail */}
                            {isExpanded && (
                                <div className="px-3 pb-3 animate-in slide-in-from-top-1 duration-200">
                                    {/* Week summary */}
                                    <div className="flex gap-3 mb-3 flex-wrap">
                                        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900/70 border border-slate-700">
                                            <Clock className="w-3.5 h-3.5 text-blue-400" />
                                            <span className="text-xs font-bold text-slate-300">{stats.hoursWeek.toFixed(1)}h esta semana</span>
                                        </div>
                                        {stats.overtimeWeek > 0 && (
                                            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-orange-500/10 border border-orange-500/20">
                                                <Zap className="w-3.5 h-3.5 text-orange-400" />
                                                <span className="text-xs font-bold text-orange-300">{stats.overtimeWeek.toFixed(1)}h overtime</span>
                                            </div>
                                        )}
                                        {stats.activeTimer && (
                                            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                                                <Timer className="w-3.5 h-3.5 text-emerald-400" />
                                                <span className="text-xs font-bold text-emerald-300">Timer activo: {engTasks.find(t => t.id === stats.activeTimer.taskId)?.title || 'Tarea'}</span>
                                            </div>
                                        )}
                                    </div>

                                    {/* Task list */}
                                    {stats.userTasks.length > 0 ? (
                                        <div className="space-y-1">
                                            {stats.userTasks.map(task => {
                                                const project = engProjects.find(p => p.id === task.projectId);
                                                const statusCfg = TASK_STATUS_CONFIG[task.status] || {};
                                                return (
                                                    <button
                                                        key={task.id}
                                                        onClick={() => onTaskClick(task)}
                                                        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-900/50 hover:bg-slate-800 transition-colors text-left"
                                                    >
                                                        <div className={`w-2 h-2 rounded-full shrink-0 ${
                                                            task.status === 'blocked' ? 'bg-rose-500' :
                                                            task.status === 'in_progress' ? 'bg-indigo-500' :
                                                            task.status === 'in_review' ? 'bg-amber-500' :
                                                            'bg-slate-500'
                                                        }`} />
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-xs font-bold text-slate-200 truncate">{task.title}</p>
                                                            <p className="text-[10px] text-slate-500">{project?.name || 'Sin proyecto'} · {statusCfg.label || task.status}</p>
                                                        </div>
                                                        <ArrowRight className="w-3.5 h-3.5 text-slate-600 shrink-0" />
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    ) : (
                                        <p className="text-xs text-slate-600 py-2 text-center">Sin tareas asignadas activas</p>
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}
                {workload.length === 0 && <p className="text-sm font-medium text-slate-500 py-4 text-center">No hay ingenieros en el equipo.</p>}
            </div>
        </div>
    );
}

// ============================================================
// MAIN DASHBOARD
// ============================================================

export default function Dashboard() {
    const {
        engProjects, engTasks, engSubtasks, teamMembers, timeLogs, delays, taskTypes, isReady
    } = useEngineeringData();
    const { user } = useAuth();
    const { canEdit, canDelete } = useRole();
    const navigate = useNavigate();

    // ── Task Detail Modal state ──
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedTask, setSelectedTask] = useState(null);
    const openTask = (task) => { setSelectedTask(task); setIsModalOpen(true); };
    const closeModal = () => { setIsModalOpen(false); setSelectedTask(null); };

    // ── Delay resolution state ──
    const [resolvingDelayId, setResolvingDelayId] = useState(null);
    const [confirmingDelayId, setConfirmingDelayId] = useState(null);

    const handleResolveClick = useCallback((e, alertItem) => {
        e.stopPropagation();
        e.preventDefault();
        if (confirmingDelayId === alertItem.delayId) {
            (async () => {
                setResolvingDelayId(alertItem.delayId);
                setConfirmingDelayId(null);
                try { await resolveDelay(alertItem.delayId, alertItem.projectId, alertItem.taskId); }
                catch (err) { console.error('Error resolving delay:', err); }
                setResolvingDelayId(null);
            })();
        } else {
            setConfirmingDelayId(alertItem.delayId);
            setTimeout(() => setConfirmingDelayId(prev => prev === alertItem.delayId ? null : prev), 3000);
        }
    }, [confirmingDelayId]);

    // ── Audit Data ──
    const { runClientAudit, scores, summary, isAuditing, auditResult } = useAuditData();

    useEffect(() => {
        if (isReady && !auditResult && !isAuditing) { runClientAudit(); }
    }, [isReady]); // eslint-disable-line react-hooks/exhaustive-deps

    // ── Date helpers ──
    const now = new Date();

    // ── KPIs ──
    const kpis = useMemo(() => {
        const activeProjects = engProjects.filter(p => !['completed', 'on_hold', 'cancelled'].includes(p.status));
        const projectsAtRisk = engProjects.filter(p => p.riskLevel === 'high' || p.riskLevel === 'medium');
        const activeTasks = engTasks.filter(t => !['completed', 'cancelled'].includes(t.status));
        const blockedTasks = activeTasks.filter(t => t.status === 'blocked');
        const activeDelays = delays?.filter(d => !d.resolved) || [];

        // Weekly overtime
        const ws = startOfWeek(new Date(), { weekStartsOn: 1 });
        const we = endOfWeek(new Date(), { weekStartsOn: 1 });
        const weekLogs = timeLogs?.filter(l => {
            if (!l.startTime) return false;
            const d = new Date(l.startTime);
            return isWithinInterval(d, { start: ws, end: we });
        }) || [];
        const weekOvertime = weekLogs.reduce((acc, l) => acc + (l.overtimeHours || 0), 0);

        return {
            activeProjects,
            projectsAtRisk,
            activeTasks,
            blockedTasks,
            activeDelays,
            weekOvertime: parseFloat(weekOvertime.toFixed(1)),
        };
    }, [engProjects, engTasks, timeLogs, delays]);

    // ── Enrich tasks with project names ──
    const enrichedTasks = useMemo(() => {
        return engTasks.map(t => ({
            ...t,
            projectName: engProjects.find(p => p.id === t.projectId)?.name || '',
        }));
    }, [engTasks, engProjects]);

    // ── Team workload ──
    const workload = useMemo(() => {
        const engineers = teamMembers.filter(u => ['engineer', 'technician', 'team_lead', 'manager'].includes(u.teamRole) || !u.teamRole);
        return engineers.map(eng => {
            const assignedTasks = engTasks.filter(t => t.assignedTo === eng.uid && !['completed', 'cancelled'].includes(t.status));
            return { ...eng, totalAssigned: assignedTasks.length };
        }).sort((a, b) => b.totalAssigned - a.totalAssigned);
    }, [engTasks, teamMembers]);

    // ── Alerts ──
    const alerts = useMemo(() => {
        const _alerts = [];

        engTasks.filter(t => t.status === 'blocked').forEach(t => {
            const project = engProjects.find(p => p.id === t.projectId);
            const assignee = teamMembers.find(u => u.uid === t.assignedTo);
            _alerts.push({
                type: 'danger', icon: AlertOctagon, title: 'Tarea Bloqueada',
                desc: t.title,
                meta: project?.name || '', assigneeName: assignee?.displayName || '',
                time: t.updatedAt || t.createdAt,
                action: () => openTask(t),
            });
        });

        engProjects.filter(p => p.riskLevel === 'high').forEach(p => {
            _alerts.push({
                type: 'warning', icon: Flame, title: 'Proyecto en Alto Riesgo',
                desc: p.name,
                meta: `${engTasks.filter(t => t.projectId === p.id && t.status === 'blocked').length} bloqueadas`,
                time: p.riskUpdatedAt || p.updatedAt,
                action: () => navigate(`/projects/${p.id}`),
            });
        });

        if (delays) {
            delays.filter(d => !d.resolved).forEach(d => {
                const project = engProjects.find(p => p.id === d.projectId);
                const relatedTask = d.taskId ? engTasks.find(t => t.id === d.taskId) : null;
                _alerts.push({
                    type: 'warning', icon: AlertTriangle, title: 'Retraso Activo',
                    desc: d.causeName || 'Sin causa especificada',
                    meta: project?.name || '',
                    time: d.createdAt,
                    action: relatedTask ? () => openTask(relatedTask) : () => navigate('/projects'),
                    isDelay: true, delayId: d.id, projectId: d.projectId, taskId: d.taskId,
                    taskTitle: relatedTask?.title || '',
                });
            });
        }

        return _alerts.sort((a, b) => new Date(b.time) - new Date(a.time)).slice(0, 12);
    }, [engTasks, engProjects, delays, teamMembers, navigate]);

    return (
        <div className="relative min-h-screen">
            {/* ═══════════ ANIMATED BACKGROUND ═══════════ */}
            <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
                <div className="absolute top-1/4 left-1/3 w-[500px] h-[500px] rounded-full bg-indigo-600/5 blur-3xl animate-pulse" style={{ animationDuration: '6s' }} />
                <div className="absolute top-2/3 right-1/4 w-[400px] h-[400px] rounded-full bg-violet-600/5 blur-3xl animate-pulse" style={{ animationDuration: '8s' }} />
                <div className="absolute bottom-1/4 left-1/6 w-[300px] h-[300px] rounded-full bg-emerald-600/4 blur-3xl animate-pulse" style={{ animationDuration: '10s' }} />
            </div>

            {/* Inline keyframes for stagger animation */}
            <style>{`
                @keyframes obeya-fade-up {
                    from { opacity: 0; transform: translateY(24px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                .obeya-stagger > * {
                    opacity: 0;
                    animation: obeya-fade-up 0.6s ease-out forwards;
                }
                .obeya-stagger > *:nth-child(1) { animation-delay: 0.05s; }
                .obeya-stagger > *:nth-child(2) { animation-delay: 0.12s; }
                .obeya-stagger > *:nth-child(3) { animation-delay: 0.2s; }
                .obeya-stagger > *:nth-child(4) { animation-delay: 0.28s; }
                .obeya-stagger > *:nth-child(5) { animation-delay: 0.36s; }
                .obeya-stagger > *:nth-child(6) { animation-delay: 0.44s; }
                .obeya-stagger > *:nth-child(7) { animation-delay: 0.52s; }
                .obeya-stagger > *:nth-child(8) { animation-delay: 0.6s; }
            `}</style>

            <div className="relative z-10 space-y-6 obeya-stagger">
                <TaskDetailModal
                    isOpen={isModalOpen} onClose={closeModal} task={selectedTask}
                    projects={engProjects} teamMembers={teamMembers}
                    subtasks={selectedTask ? engSubtasks.filter(s => s.taskId === selectedTask.id) : []}
                    taskTypes={taskTypes} userId={user?.uid} canEdit={canEdit} canDelete={canDelete}
                />

                <PageHeader title="" showBack={true} />

                {/* Header */}
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-3xl md:text-4xl font-black tracking-tight flex items-center gap-3">
                            <span className="bg-gradient-to-r from-indigo-400 via-violet-400 to-purple-400 bg-clip-text text-transparent">Sala Obeya</span>
                            <span className="bg-indigo-500/20 text-indigo-400 text-xs px-2.5 py-1 rounded-lg uppercase tracking-widest leading-none border border-indigo-500/30 animate-pulse" style={{ animationDuration: '3s' }}>En vivo</span>
                        </h1>
                        <p className="text-sm font-bold text-slate-400 mt-1">Tablero de Control y Salud de Ingeniería</p>
                    </div>
                    <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800/50 border border-slate-700/50">
                        <Clock className="w-4 h-4 text-indigo-400" />
                        <span className="text-sm font-bold text-slate-300 capitalize">{format(now, "EEEE, d 'de' MMMM", { locale: es })}</span>
                    </div>
                </div>

            {/* ═══════════ KPI ROW — EXPANDABLE ═══════════ */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                {/* Proyectos Activos */}
                <KpiCard label="Proyectos Activos" value={kpis.activeProjects.length} icon={LayoutDashboard} color="indigo">
                    {kpis.activeProjects.map(p => {
                        const pTasks = engTasks.filter(t => t.projectId === p.id);
                        const done = pTasks.filter(t => t.status === 'completed').length;
                        const progress = pTasks.length > 0 ? Math.round((done / pTasks.length) * 100) : 0;
                        const rCfg = RISK_LEVEL_CONFIG[p.riskLevel || 'low'] || {};
                        return (
                            <button key={p.id} onClick={() => navigate(`/projects/${p.id}`)} className="w-full flex items-center gap-3 p-2 rounded-xl hover:bg-slate-800/60 transition-colors text-left">
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-bold text-slate-200 truncate">{p.name}</p>
                                    <div className="flex items-center gap-2 mt-1">
                                        <div className="w-16 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                                            <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${progress}%` }} />
                                        </div>
                                        <span className="text-[10px] font-bold text-slate-400">{progress}% · {done}/{pTasks.length}</span>
                                    </div>
                                </div>
                                <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded ${
                                    p.riskLevel === 'high' ? 'bg-rose-500/20 text-rose-400' :
                                    p.riskLevel === 'medium' ? 'bg-amber-500/20 text-amber-400' :
                                    'bg-emerald-500/20 text-emerald-400'
                                }`}>{rCfg.label || 'Bajo'}</span>
                            </button>
                        );
                    })}
                    {kpis.activeProjects.length === 0 && <p className="text-xs text-slate-600 text-center py-2">Sin proyectos activos</p>}
                </KpiCard>

                {/* Proy. en Riesgo */}
                <KpiCard label="Proy. en Riesgo" value={kpis.projectsAtRisk.length} icon={Flame} color="amber">
                    {kpis.projectsAtRisk.map(p => {
                        const blocked = engTasks.filter(t => t.projectId === p.id && t.status === 'blocked').length;
                        const activeD = delays?.filter(d => d.projectId === p.id && !d.resolved).length || 0;
                        return (
                            <button key={p.id} onClick={() => navigate(`/projects/${p.id}`)} className="w-full flex items-center gap-3 p-2 rounded-xl hover:bg-slate-800/60 transition-colors text-left">
                                <Flame className={`w-4 h-4 shrink-0 ${p.riskLevel === 'high' ? 'text-rose-400' : 'text-amber-400'}`} />
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-bold text-slate-200 truncate">{p.name}</p>
                                    <p className="text-[10px] text-slate-500">
                                        {p.riskLevel === 'high' ? 'Alto riesgo' : 'Riesgo medio'}
                                        {blocked > 0 && ` · ${blocked} bloqueadas`}
                                        {activeD > 0 && ` · ${activeD} retrasos`}
                                    </p>
                                </div>
                            </button>
                        );
                    })}
                    {kpis.projectsAtRisk.length === 0 && <p className="text-xs text-emerald-500 text-center py-2 flex items-center justify-center gap-1"><CheckCircle className="w-3.5 h-3.5" /> Sin proyectos en riesgo</p>}
                </KpiCard>

                {/* Tareas Bloqueadas */}
                <KpiCard label="Bloqueadas" value={kpis.blockedTasks.length} icon={AlertOctagon} color="rose">
                    {kpis.blockedTasks.map(t => {
                        const project = engProjects.find(p => p.id === t.projectId);
                        const assignee = teamMembers.find(u => u.uid === t.assignedTo);
                        return (
                            <button key={t.id} onClick={() => openTask(t)} className="w-full flex items-center gap-3 p-2 rounded-xl hover:bg-slate-800/60 transition-colors text-left">
                                <AlertOctagon className="w-4 h-4 text-rose-400 shrink-0" />
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-bold text-slate-200 truncate">{t.title}</p>
                                    <p className="text-[10px] text-slate-500">{project?.name || ''} · {assignee?.displayName || 'Sin asignar'}</p>
                                </div>
                            </button>
                        );
                    })}
                    {kpis.blockedTasks.length === 0 && <p className="text-xs text-emerald-500 text-center py-2 flex items-center justify-center gap-1"><CheckCircle className="w-3.5 h-3.5" /> Sin bloqueos</p>}
                </KpiCard>

                {/* Overtime Semanal */}
                <KpiCard label="Overtime Semana" value={kpis.weekOvertime} suffix="h" icon={Zap} color="orange">
                    {(() => {
                        const ws = startOfWeek(new Date(), { weekStartsOn: 1 });
                        const we = endOfWeek(new Date(), { weekStartsOn: 1 });
                        const weekLogs = timeLogs?.filter(l => {
                            if (!l.startTime || !l.overtimeHours || l.overtimeHours <= 0) return false;
                            const d = new Date(l.startTime);
                            return isWithinInterval(d, { start: ws, end: we });
                        }) || [];
                        // Group by user
                        const byUser = {};
                        weekLogs.forEach(l => {
                            if (!byUser[l.userId]) byUser[l.userId] = { total: 0, logs: [] };
                            byUser[l.userId].total += l.overtimeHours;
                            byUser[l.userId].logs.push(l);
                        });
                        const entries = Object.entries(byUser).sort((a, b) => b[1].total - a[1].total);

                        if (entries.length === 0) return <p className="text-xs text-slate-600 text-center py-2">Sin overtime esta semana</p>;

                        return entries.map(([uid, data]) => {
                            const member = teamMembers.find(u => u.uid === uid);
                            return (
                                <div key={uid} className="flex items-center gap-3 p-2 rounded-xl bg-orange-500/5">
                                    <Zap className="w-4 h-4 text-orange-400 shrink-0" />
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-bold text-slate-200 truncate">{member?.displayName || uid}</p>
                                    </div>
                                    <span className="text-sm font-black text-orange-400">{data.total.toFixed(1)}h</span>
                                </div>
                            );
                        });
                    })()}
                </KpiCard>

                {/* Retrasos Activos */}
                <KpiCard label="Retrasos Activos" value={kpis.activeDelays.length} icon={AlertTriangle} color="violet">
                    {kpis.activeDelays.map(d => {
                        const project = engProjects.find(p => p.id === d.projectId);
                        const task = d.taskId ? engTasks.find(t => t.id === d.taskId) : null;
                        return (
                            <div key={d.id} className="flex items-center gap-3 p-2 rounded-xl hover:bg-slate-800/60 transition-colors">
                                <AlertTriangle className="w-4 h-4 text-violet-400 shrink-0" />
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-bold text-slate-200 truncate">{d.causeName || 'Sin causa'}</p>
                                    <p className="text-[10px] text-slate-500">{project?.name || ''}{task ? ` · ${task.title}` : ''}</p>
                                </div>
                                <button
                                    onClick={(e) => handleResolveClick(e, { delayId: d.id, projectId: d.projectId, taskId: d.taskId })}
                                    disabled={resolvingDelayId === d.id}
                                    className={`text-[10px] font-black px-2 py-1 rounded-lg transition-all ${
                                        confirmingDelayId === d.id ? 'bg-red-600 text-white animate-pulse' :
                                        resolvingDelayId === d.id ? 'bg-slate-700 text-slate-400' :
                                        'bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/30'
                                    }`}
                                >
                                    <CheckCheck className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        );
                    })}
                    {kpis.activeDelays.length === 0 && <p className="text-xs text-emerald-500 text-center py-2 flex items-center justify-center gap-1"><CheckCircle className="w-3.5 h-3.5" /> Sin retrasos</p>}
                </KpiCard>
            </div>

            {/* ═══════════ COMPLIANCE SCORES ═══════════ */}
            <ComplianceScoresPanel
                scores={scores} summary={summary}
                isAuditing={isAuditing} onRunAudit={runClientAudit}
            />

            {/* ═══════════ MAIN SPLIT ═══════════ */}
            <div className="grid lg:grid-cols-3 gap-6">

                {/* LEFT: Pipeline + Workload */}
                <div className="lg:col-span-2 space-y-6">
                    <TaskPipeline tasks={enrichedTasks} onTaskClick={openTask} />
                    <TeamWorkloadPanel
                        workload={workload} timeLogs={timeLogs}
                        engTasks={engTasks} engProjects={engProjects}
                        onTaskClick={openTask}
                    />
                </div>

                {/* RIGHT: Alerts */}
                <div className="space-y-6">
                    <div className="bg-slate-900/70 backdrop-blur-sm rounded-2xl border border-slate-800 shadow-lg p-6 sticky top-6">
                        <div className="flex items-center justify-between mb-5">
                            <h3 className="font-bold text-lg text-white flex items-center gap-2"><AlertTriangle className="w-5 h-5 text-amber-400" /> Alertas</h3>
                            <span className="text-xs font-bold text-slate-500">{alerts.length}</span>
                        </div>

                        <div className="space-y-2">
                            {alerts.map((alert, i) => (
                                <div
                                    key={i}
                                    onClick={alert.action}
                                    className={`p-3 rounded-xl border-l-4 cursor-pointer transition-transform hover:translate-x-1 ${
                                        alert.type === 'danger' ? 'bg-rose-500/10 border-rose-500' :
                                        'bg-amber-500/10 border-amber-500'
                                    }`}
                                >
                                    <div className="flex items-start gap-2">
                                        <alert.icon className={`w-4 h-4 shrink-0 mt-0.5 ${alert.type === 'danger' ? 'text-rose-400' : 'text-amber-400'}`} />
                                        <div className="flex-1 min-w-0">
                                            <p className={`text-xs font-black ${alert.type === 'danger' ? 'text-rose-300' : 'text-amber-300'}`}>{alert.title}</p>
                                            <p className="text-xs text-slate-400 truncate mt-0.5">{alert.desc}</p>
                                            <div className="flex items-center justify-between mt-1.5">
                                                <span className="text-[10px] font-bold text-slate-500">{alert.meta}{alert.assigneeName ? ` · ${alert.assigneeName}` : ''}</span>
                                                <span className="text-[9px] font-bold text-slate-600">{alert.time ? format(new Date(alert.time), 'dd MMM HH:mm', { locale: es }) : ''}</span>
                                            </div>
                                            {alert.isDelay && (
                                                <button
                                                    onClick={(e) => handleResolveClick(e, alert)}
                                                    disabled={resolvingDelayId === alert.delayId}
                                                    className={`mt-2 w-full py-1.5 rounded-lg font-bold text-[11px] flex items-center justify-center gap-1.5 transition-all active:scale-95 ${
                                                        confirmingDelayId === alert.delayId ? 'bg-red-600 hover:bg-red-500 text-white animate-pulse' :
                                                        resolvingDelayId === alert.delayId ? 'bg-slate-700 text-slate-400' :
                                                        'bg-emerald-600 hover:bg-emerald-500 text-white'
                                                    }`}
                                                >
                                                    <CheckCheck className="w-3.5 h-3.5" />
                                                    {resolvingDelayId === alert.delayId ? 'Resolviendo...' :
                                                     confirmingDelayId === alert.delayId ? '¿Confirmar?' : 'Resolver'}
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                            {alerts.length === 0 && (
                                <div className="text-center p-8 border border-dashed border-slate-700 rounded-xl">
                                    <Shield className="w-8 h-8 text-emerald-500 mx-auto mb-2 opacity-50" />
                                    <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Todo en orden</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
            </div>
        </div>
    );
}
