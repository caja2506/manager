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
import { calculateTeamScores } from '../core/analytics/performanceScore';
import { getActiveAssignments } from '../services/resourceAssignmentService';

// ============================================================
// ANIMATED COUNT UP HOOK
// ============================================================

function useCountUp(end, duration = 1200) {
    const [val, setVal] = useState(0);
    useEffect(() => {
        const numEnd = typeof end === 'number' ? end : parseFloat(end) || 0;
        if (numEnd === 0) return;
        const isDecimal = !Number.isInteger(numEnd);
        let cancelled = false;
        let startTs = null;
        const step = (ts) => {
            if (cancelled) return;
            if (!startTs) startTs = ts;
            const p = Math.min((ts - startTs) / duration, 1);
            const eased = 1 - Math.pow(1 - p, 3);
            const current = eased * numEnd;
            setVal(isDecimal ? parseFloat(current.toFixed(1)) : Math.round(current));
            if (p < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
        return () => { cancelled = true; };
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
// TASK PIPELINE — Card-based (Overview style)
// ============================================================

function TaskPipeline({ tasks, onTaskClick }) {
    const [expandedStatus, setExpandedStatus] = useState(null);

    const pipeline = useMemo(() => {
        const statuses = [
            { key: 'backlog', label: 'Backlog', subtitle: 'Pendientes', icon: Inbox, color: 'slate', desc: 'Tareas registradas pendientes de planificación y asignación.' },
            { key: 'planned', label: 'Planificado', subtitle: 'Listo para iniciar', icon: ListTodo, color: 'blue', desc: 'Tareas asignadas y planificadas, listas para comenzar trabajo.' },
            { key: 'in_progress', label: 'En Progreso', subtitle: 'Trabajo activo', icon: Play, color: 'indigo', desc: 'Tareas con trabajo activo y timer de horas en tiempo real.' },
            { key: 'in_review', label: 'En Revisión', subtitle: 'Validación', icon: Eye, color: 'amber', desc: 'Tareas completadas esperando validación del responsable.' },
            { key: 'completed', label: 'Completado', subtitle: 'Finalizado', icon: CheckCircle, color: 'emerald', desc: 'Tareas terminadas y registradas en métricas.' },
        ];

        return statuses.map(s => ({
            ...s,
            count: tasks.filter(t => t.status === s.key).length,
            tasks: tasks.filter(t => t.status === s.key),
        }));
    }, [tasks]);

    const cardColors = {
        slate: { bg: 'bg-slate-500/8', border: 'border-slate-700/50', activeBorder: 'border-slate-500/60', text: 'text-slate-400', iconBg: 'bg-slate-500/15', iconBorder: 'border-slate-500/30', dot: 'bg-slate-500' },
        blue: { bg: 'bg-blue-500/8', border: 'border-slate-700/50', activeBorder: 'border-blue-500/60', text: 'text-blue-400', iconBg: 'bg-blue-500/15', iconBorder: 'border-blue-500/30', dot: 'bg-blue-500' },
        indigo: { bg: 'bg-indigo-500/8', border: 'border-slate-700/50', activeBorder: 'border-indigo-500/60', text: 'text-indigo-400', iconBg: 'bg-indigo-500/15', iconBorder: 'border-indigo-500/30', dot: 'bg-indigo-500' },
        amber: { bg: 'bg-amber-500/8', border: 'border-slate-700/50', activeBorder: 'border-amber-500/60', text: 'text-amber-400', iconBg: 'bg-amber-500/15', iconBorder: 'border-amber-500/30', dot: 'bg-amber-500' },
        emerald: { bg: 'bg-emerald-500/8', border: 'border-slate-700/50', activeBorder: 'border-emerald-500/60', text: 'text-emerald-400', iconBg: 'bg-emerald-500/15', iconBorder: 'border-emerald-500/30', dot: 'bg-emerald-500' },
    };

    return (
        <div className="bg-slate-900/70 backdrop-blur-sm rounded-2xl border border-slate-800 shadow-lg p-6">
            <div className="flex items-center justify-between mb-5">
                <h3 className="font-bold text-lg text-white flex items-center gap-2">
                    <Target className="w-5 h-5 text-indigo-400" /> Pipeline de Tareas
                </h3>
                <span className="text-xs font-bold text-slate-500">{tasks.length} total</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                {pipeline.map(stage => {
                    const cc = cardColors[stage.color];
                    const isExpanded = expandedStatus === stage.key;
                    const StageIcon = stage.icon;

                    return (
                        <div
                            key={stage.key}
                            className={`rounded-2xl border p-4 transition-all duration-300 cursor-pointer ${
                                isExpanded
                                    ? `${cc.activeBorder} ${cc.bg} shadow-lg`
                                    : `${cc.border} bg-slate-900/40 hover:bg-slate-800/40 hover:${cc.activeBorder}`
                            }`}
                            onClick={() => setExpandedStatus(isExpanded ? null : stage.key)}
                        >
                            {/* Icon */}
                            <div className={`w-10 h-10 rounded-xl ${cc.iconBg} border ${cc.iconBorder} flex items-center justify-center mb-3`}>
                                <StageIcon className={`w-5 h-5 ${cc.text}`} />
                            </div>

                            {/* Title + Count */}
                            <h4 className="text-sm font-black text-slate-200">{stage.label}</h4>
                            <p className={`text-[10px] font-black uppercase tracking-wider ${cc.text} mb-2`}>{stage.count} tareas</p>

                            {/* Description */}
                            <p className="text-[11px] text-slate-500 leading-relaxed line-clamp-2 mb-3">{stage.desc}</p>

                            {/* Expand toggle */}
                            <button className={`text-[11px] font-bold ${cc.text} flex items-center gap-1 hover:underline`}>
                                {isExpanded ? 'Menos detalles' : 'Ver detalles'}
                                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                            </button>

                            {/* Expanded task list */}
                            {isExpanded && (
                                <div className="mt-3 pt-3 border-t border-slate-700/50 space-y-1.5 animate-in slide-in-from-top-1 duration-200">
                                    {stage.tasks.slice(0, 6).map(task => (
                                        <button
                                            key={task.id}
                                            onClick={(e) => { e.stopPropagation(); onTaskClick(task); }}
                                            className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-800/60 transition-colors text-left"
                                        >
                                            <div className={`w-1.5 h-1.5 rounded-full ${cc.dot} shrink-0`} />
                                            <p className="text-[11px] font-bold text-slate-300 truncate flex-1">{task.title}</p>
                                        </button>
                                    ))}
                                    {stage.tasks.length > 6 && (
                                        <p className="text-[10px] text-slate-600 text-center">+ {stage.tasks.length - 6} más</p>
                                    )}
                                    {stage.tasks.length === 0 && (
                                        <p className="text-[10px] text-slate-600 text-center py-1">Sin tareas</p>
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

// ============================================================
// TEAM WORKLOAD PANEL — Module card grid style
// ============================================================

function TeamWorkloadPanel({ workload, timeLogs, engTasks, engProjects, onTaskClick, scoreMap, navigate }) {
    const [expandedUser, setExpandedUser] = useState(null);
    const now = new Date();
    const weekStart = startOfWeek(now, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
    const todayStr = format(now, 'yyyy-MM-dd');

    const getUserStats = useCallback((uid) => {
        const userTodayLogs = timeLogs.filter(l => l.userId === uid && l.startTime?.startsWith(todayStr) && l.endTime);
        const hoursToday = userTodayLogs.reduce((sum, l) => sum + (l.totalHours || 0), 0);
        const userWeekLogs = timeLogs.filter(l => {
            if (l.userId !== uid || !l.startTime || !l.endTime) return false;
            return isWithinInterval(new Date(l.startTime), { start: weekStart, end: weekEnd });
        });
        const hoursWeek = userWeekLogs.reduce((sum, l) => sum + (l.totalHours || 0), 0);
        const overtimeWeek = userWeekLogs.reduce((sum, l) => sum + (l.overtimeHours || 0), 0);
        const activeTimer = timeLogs.find(l => l.userId === uid && !l.endTime);
        const userTasks = engTasks.filter(t => t.assignedTo === uid && !['completed', 'cancelled'].includes(t.status));
        const inProgress = userTasks.filter(t => t.status === 'in_progress');
        const blocked = userTasks.filter(t => t.status === 'blocked');
        return { hoursToday, hoursWeek, overtimeWeek, activeTimer, userTasks, inProgress, blocked };
    }, [timeLogs, engTasks, todayStr, weekStart, weekEnd]);

    const roleLabels = { manager: 'Manager', team_lead: 'Team Lead', engineer: 'Ingeniero', technician: 'Técnico' };
    const roleColors = {
        manager: { text: 'text-violet-400', iconBg: 'bg-violet-500/15', iconBorder: 'border-violet-500/30', activeBorder: 'border-violet-500/50', bg: 'bg-violet-500/5' },
        team_lead: { text: 'text-amber-400', iconBg: 'bg-amber-500/15', iconBorder: 'border-amber-500/30', activeBorder: 'border-amber-500/50', bg: 'bg-amber-500/5' },
        engineer: { text: 'text-indigo-400', iconBg: 'bg-indigo-500/15', iconBorder: 'border-indigo-500/30', activeBorder: 'border-indigo-500/50', bg: 'bg-indigo-500/5' },
        technician: { text: 'text-emerald-400', iconBg: 'bg-emerald-500/15', iconBorder: 'border-emerald-500/30', activeBorder: 'border-emerald-500/50', bg: 'bg-emerald-500/5' },
    };

    return (
        <div className="bg-slate-900/70 backdrop-blur-sm rounded-2xl border border-slate-800 shadow-lg p-6">
            <div className="flex items-center justify-between mb-5">
                <h3 className="font-bold text-lg text-white flex items-center gap-2">
                    <Users className="w-5 h-5 text-indigo-400" /> Equipo
                </h3>
                <div className="flex items-center gap-3">
                    <button onClick={() => navigate('/team-scores')} className="text-[10px] font-bold text-indigo-400 hover:text-indigo-300 transition-colors flex items-center gap-1">
                        <Target className="w-3 h-3" /> Scorecard
                    </button>
                    <span className="text-xs font-bold text-slate-500">{workload.length} miembros</span>
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {workload.map(user => {
                    const stats = getUserStats(user.uid);
                    const isExpanded = expandedUser === user.uid;
                    const name = user.displayName || user.email || '?';
                    const role = user.teamRole || 'engineer';
                    const rc = roleColors[role] || roleColors.engineer;

                    // Build description
                    const descParts = [];
                    if (stats.hoursToday > 0) descParts.push(`${stats.hoursToday.toFixed(1)}h hoy`);
                    if (stats.hoursWeek > 0) descParts.push(`${stats.hoursWeek.toFixed(1)}h semana`);
                    if (stats.overtimeWeek > 0) descParts.push(`${stats.overtimeWeek.toFixed(1)}h overtime`);
                    if (stats.inProgress.length > 0) descParts.push(`${stats.inProgress.length} en progreso`);
                    if (stats.blocked.length > 0) descParts.push(`${stats.blocked.length} bloqueadas`);
                    const desc = descParts.length > 0 ? descParts.join(', ') : 'Sin actividad registrada';

                    return (
                        <div
                            key={user.uid}
                            className={`rounded-2xl border p-5 transition-all duration-300 cursor-pointer ${
                                isExpanded
                                    ? `${rc.activeBorder} ${rc.bg} shadow-lg`
                                    : 'border-slate-800 bg-slate-900/40 hover:bg-slate-800/40 hover:border-slate-700'
                            }`}
                            onClick={() => setExpandedUser(isExpanded ? null : user.uid)}
                        >
                            {/* Avatar Icon */}
                            <div className={`w-11 h-11 rounded-xl ${rc.iconBg} border ${rc.iconBorder} flex items-center justify-center mb-3 relative`}>
                                <span className={`text-base font-black ${rc.text}`}>{name[0].toUpperCase()}</span>
                                {stats.activeTimer && (
                                    <div className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-500 rounded-full border-2 border-slate-900 animate-pulse" />
                                )}
                            </div>

                            {/* Name */}
                            <h4 className="text-sm font-black text-slate-200 truncate">{name}</h4>
                            <p className={`text-[10px] font-black uppercase tracking-wider ${rc.text} mb-2`}>{roleLabels[role] || 'Ingeniero'}</p>

                            {/* IPS Badge */}
                            {scoreMap?.[user.uid] && (() => {
                                const ips = scoreMap[user.uid];
                                const badgeColor = ips.score >= 90 ? '#10b981' : ips.score >= 75 ? '#6366f1' : ips.score >= 60 ? '#f59e0b' : '#ef4444';
                                return (
                                    <div className="flex items-center gap-1.5 mb-2">
                                        <div className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-black text-white"
                                            style={{ background: `${badgeColor}30`, border: `1.5px solid ${badgeColor}`, color: badgeColor }}>
                                            {Math.round(ips.score)}
                                        </div>
                                        <span className="text-[9px] font-bold" style={{ color: badgeColor }}>IPS</span>
                                    </div>
                                );
                            })()}

                            {/* Description */}
                            <p className="text-[11px] text-slate-500 leading-relaxed line-clamp-2 mb-3">{desc}</p>

                            {/* Expand toggle */}
                            <button className={`text-[11px] font-bold ${rc.text} flex items-center gap-1 hover:underline`}>
                                {isExpanded ? 'Menos detalles' : 'Ver detalles'}
                                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                            </button>

                            {/* Expanded Details */}
                            {isExpanded && (
                                <div className="mt-4 pt-3 border-t border-slate-700/50 space-y-2 animate-in slide-in-from-top-1 duration-200" onClick={e => e.stopPropagation()}>
                                    {/* Quick stat badges */}
                                    <div className="flex flex-wrap gap-1.5 mb-2">
                                        {stats.activeTimer && (
                                            <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">🟢 Timer activo</span>
                                        )}
                                        {stats.overtimeWeek > 0 && (
                                            <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-orange-500/15 text-orange-400 border border-orange-500/25">⚡ {stats.overtimeWeek.toFixed(1)}h extra</span>
                                        )}
                                    </div>

                                    {/* Task list */}
                                    {stats.userTasks.length > 0 ? stats.userTasks.map(task => {
                                        const project = engProjects.find(p => p.id === task.projectId);
                                        const statusCfg = TASK_STATUS_CONFIG[task.status] || {};
                                        return (
                                            <button
                                                key={task.id}
                                                onClick={() => onTaskClick(task)}
                                                className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-800/60 transition-colors text-left"
                                            >
                                                <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                                                    task.status === 'blocked' ? 'bg-rose-500' :
                                                    task.status === 'in_progress' ? 'bg-indigo-500' :
                                                    task.status === 'in_review' ? 'bg-amber-500' :
                                                    'bg-slate-500'
                                                }`} />
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-[11px] font-bold text-slate-300 truncate">{task.title}</p>
                                                    <p className="text-[9px] text-slate-600">{project?.name || ''} · {statusCfg.label || task.status}</p>
                                                </div>
                                            </button>
                                        );
                                    }) : (
                                        <p className="text-[10px] text-slate-600 text-center py-1">Sin tareas activas</p>
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}
                {workload.length === 0 && (
                    <div className="col-span-full text-center py-6">
                        <Users className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                        <p className="text-sm font-medium text-slate-500">No hay ingenieros en el equipo.</p>
                    </div>
                )}
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

    // ── IPS Scores (for badge in team cards) ──
    const [ipsAssignments, setIpsAssignments] = useState([]);
    useEffect(() => {
        getActiveAssignments().then(setIpsAssignments).catch(() => {});
    }, []);
    const ipsScoreMap = useMemo(() => {
        if (!isReady || teamMembers.length === 0) return {};
        const scores = calculateTeamScores(teamMembers, {
            tasks: engTasks, timeLogs, delays, teamMembers,
            assignments: ipsAssignments, plannerSlots: [], auditScores: null,
        });
        const map = {};
        scores.forEach(s => { if (s.score !== null) map[s.userId] = s; });
        return map;
    }, [isReady, teamMembers, engTasks, timeLogs, delays, ipsAssignments]);

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

    // ── Scroll Reveal refs (same tech as Overview) ──
    const useScrollReveal = (opts = {}) => {
        const ref = useRef(null);
        const [isVisible, setIsVisible] = useState(false);
        useEffect(() => {
            const el = ref.current;
            if (!el) return;
            const obs = new IntersectionObserver(
                ([entry]) => { if (entry.isIntersecting) { setIsVisible(true); obs.unobserve(el); } },
                { threshold: 0.12, rootMargin: '0px 0px -40px 0px', ...opts }
            );
            obs.observe(el);
            return () => obs.disconnect();
        }, []); // eslint-disable-line react-hooks/exhaustive-deps
        return [ref, isVisible];
    };

    const [headerRef, headerVis] = useScrollReveal();
    const [kpiRef, kpiVis] = useScrollReveal();
    const [compRef, compVis] = useScrollReveal();
    const [pipeRef, pipeVis] = useScrollReveal();
    const [teamRef, teamVis] = useScrollReveal();
    const [alertRef, alertVis] = useScrollReveal();

    return (
        <div className="relative min-h-screen pb-20">
            {/* ═══════════ ANIMATED BACKGROUND ═══════════ */}
            <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-indigo-600/5 blur-3xl" />
                <div className="absolute top-1/4 right-1/4 w-[300px] h-[300px] rounded-full bg-violet-600/5 blur-3xl animate-pulse" style={{ animationDuration: '4s' }} />
                <div className="absolute bottom-1/3 left-1/4 w-[200px] h-[200px] rounded-full bg-emerald-600/5 blur-3xl animate-pulse" style={{ animationDuration: '6s' }} />
                <div className="absolute top-2/3 right-1/3 w-[250px] h-[250px] rounded-full bg-amber-600/4 blur-3xl animate-pulse" style={{ animationDuration: '8s' }} />
            </div>

            {/* CSS Animations */}
            <style>{`
                @keyframes orbit-float {
                    0%, 100% { transform: translate(-50%, -50%) translateY(0px); }
                    50% { transform: translate(-50%, -50%) translateY(-12px); }
                }
            `}</style>

            <div className="relative z-10 space-y-8">

                <TaskDetailModal
                    isOpen={isModalOpen} onClose={closeModal} task={selectedTask}
                    projects={engProjects} teamMembers={teamMembers}
                    subtasks={selectedTask ? engSubtasks.filter(s => s.taskId === selectedTask.id) : []}
                    taskTypes={taskTypes} userId={user?.uid} canEdit={canEdit} canDelete={canDelete}
                />

                <PageHeader title="" showBack={true} />

                {/* ═══════════ HEADER ═══════════ */}
                <section ref={headerRef} className="relative overflow-hidden">
                    {/* Floating icons */}
                    <div className="absolute inset-0 pointer-events-none">
                        {[LayoutDashboard, Target, Clock, Shield, Activity].map((FloatIcon, i) => (
                            <div
                                key={i}
                                className={`absolute transition-all duration-1000 ${headerVis ? 'opacity-60' : 'opacity-0'}`}
                                style={{
                                    top: `${20 + 60 * Math.sin((i / 5) * 2 * Math.PI)}%`,
                                    left: `${50 + 42 * Math.cos((i / 5) * 2 * Math.PI)}%`,
                                    transform: 'translate(-50%, -50%)',
                                    transitionDelay: `${i * 150}ms`,
                                    animation: headerVis ? `orbit-float 8s ease-in-out infinite ${i * 1.3}s` : 'none',
                                }}
                            >
                                <div className="w-10 h-10 md:w-12 md:h-12 rounded-2xl bg-slate-800/60 backdrop-blur-sm border border-slate-700/40 flex items-center justify-center shadow-lg shadow-black/20">
                                    <FloatIcon className="w-4 h-4 md:w-5 md:h-5 text-indigo-400/50" />
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className={`relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 transition-all duration-700 ${headerVis ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
                        <div>
                            <h1 className="text-3xl md:text-4xl font-black tracking-tight flex items-center gap-3">
                                <span className="bg-linear-to-r from-indigo-400 via-violet-400 to-purple-400 bg-clip-text text-transparent">Sala Obeya</span>
                                <span className="bg-indigo-500/20 text-indigo-400 text-xs px-2.5 py-1 rounded-lg uppercase tracking-widest leading-none border border-indigo-500/30 animate-pulse" style={{ animationDuration: '3s' }}>En vivo</span>
                            </h1>
                            <p className="text-sm font-bold text-slate-400 mt-1">Tablero de Control y Salud de Ingeniería</p>
                        </div>
                        <div className={`flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800/50 border border-slate-700/50 transition-all duration-700 delay-200 ${headerVis ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
                            <Clock className="w-4 h-4 text-indigo-400" />
                            <span className="text-sm font-bold text-slate-300 capitalize">{format(now, "EEEE, d 'de' MMMM", { locale: es })}</span>
                        </div>
                    </div>
                </section>

                {/* ═══════════ KPI ROW — EXPANDABLE ═══════════ */}
                <section ref={kpiRef}>
                    <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                        {[
                            <KpiCard key="proj" label="Proyectos Activos" value={kpis.activeProjects.length} icon={LayoutDashboard} color="indigo">
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
                            </KpiCard>,
                            <KpiCard key="risk" label="Proy. en Riesgo" value={kpis.projectsAtRisk.length} icon={Flame} color="amber">
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
                            </KpiCard>,
                            <KpiCard key="blocked" label="Bloqueadas" value={kpis.blockedTasks.length} icon={AlertOctagon} color="rose">
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
                            </KpiCard>,
                            <KpiCard key="ot" label="Overtime Semana" value={kpis.weekOvertime} suffix="h" icon={Zap} color="orange">
                                {(() => {
                                    const ws = startOfWeek(new Date(), { weekStartsOn: 1 });
                                    const we = endOfWeek(new Date(), { weekStartsOn: 1 });
                                    const weekLogs = timeLogs?.filter(l => {
                                        if (!l.startTime || !l.overtimeHours || l.overtimeHours <= 0) return false;
                                        const d = new Date(l.startTime);
                                        return isWithinInterval(d, { start: ws, end: we });
                                    }) || [];
                                    const byUser = {};
                                    weekLogs.forEach(l => {
                                        if (!byUser[l.userId]) byUser[l.userId] = { total: 0 };
                                        byUser[l.userId].total += l.overtimeHours;
                                    });
                                    const entries = Object.entries(byUser).sort((a, b) => b[1].total - a[1].total);
                                    if (entries.length === 0) return <p className="text-xs text-slate-600 text-center py-2">Sin overtime esta semana</p>;
                                    return entries.map(([uid, data]) => {
                                        const member = teamMembers.find(u => u.uid === uid);
                                        return (
                                            <div key={uid} className="flex items-center gap-3 p-2 rounded-xl bg-orange-500/5">
                                                <Zap className="w-4 h-4 text-orange-400 shrink-0" />
                                                <div className="flex-1 min-w-0"><p className="text-sm font-bold text-slate-200 truncate">{member?.displayName || uid}</p></div>
                                                <span className="text-sm font-black text-orange-400">{data.total.toFixed(1)}h</span>
                                            </div>
                                        );
                                    });
                                })()}
                            </KpiCard>,
                            <KpiCard key="delays" label="Retrasos Activos" value={kpis.activeDelays.length} icon={AlertTriangle} color="violet">
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
                            </KpiCard>,
                        ].map((card, i) => (
                            <div
                                key={i}
                                className={`transition-all duration-500 ${kpiVis ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
                                style={{ transitionDelay: kpiVis ? `${i * 80}ms` : '0ms' }}
                            >
                                {card}
                            </div>
                        ))}
                    </div>
                </section>

                {/* ═══════════ COMPLIANCE SCORES ═══════════ */}
                <section ref={compRef} className={`transition-all duration-700 ${compVis ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
                    <ComplianceScoresPanel
                        scores={scores} summary={summary}
                        isAuditing={isAuditing} onRunAudit={runClientAudit}
                    />
                </section>

                {/* ═══════════ PIPELINE ═══════════ */}
                <section ref={pipeRef} className={`transition-all duration-700 ${pipeVis ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
                    <TaskPipeline tasks={enrichedTasks} onTaskClick={openTask} />
                </section>

                {/* ═══════════ TEAM WORKLOAD ═══════════ */}
                <section ref={teamRef} className={`transition-all duration-700 ${teamVis ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
                    <TeamWorkloadPanel
                        workload={workload} timeLogs={timeLogs}
                        engTasks={engTasks} engProjects={engProjects}
                        onTaskClick={openTask}
                        scoreMap={ipsScoreMap}
                        navigate={navigate}
                    />
                </section>

                {/* ═══════════ ALERTS ═══════════ */}
                <section ref={alertRef} className={`transition-all duration-700 ${alertVis ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
                    <div className="bg-slate-900/70 backdrop-blur-sm rounded-2xl border border-slate-800 shadow-lg p-6">
                        <div className="flex items-center justify-between mb-5">
                            <h3 className="font-bold text-lg text-white flex items-center gap-2"><AlertTriangle className="w-5 h-5 text-amber-400" /> Alertas</h3>
                            <span className="text-xs font-bold text-slate-500">{alerts.length}</span>
                        </div>

                        <div className="space-y-2">
                            {alerts.map((alert, i) => (
                                <div
                                    key={i}
                                    onClick={alert.action}
                                    className={`p-3 rounded-xl border-l-4 cursor-pointer transition-all duration-500 hover:translate-x-1 ${
                                        alert.type === 'danger' ? 'bg-rose-500/10 border-rose-500' :
                                        'bg-amber-500/10 border-amber-500'
                                    } ${alertVis ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-4'}`}
                                    style={{ transitionDelay: alertVis ? `${i * 60}ms` : '0ms' }}
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
                </section>

            </div>
        </div>
    );
}
