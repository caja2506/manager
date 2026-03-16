import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useAppData } from '../contexts/AppDataContext';
import { useAuth } from '../contexts/AuthContext';
import { useRole } from '../contexts/RoleContext';
import {
    LayoutDashboard, AlertTriangle, Shield, CheckCircle, Clock, Zap, Target,
    Activity, Users, Flame, Info, AlertOctagon, CheckCheck
} from 'lucide-react';
import { format, isToday, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';
import { RISK_LEVEL_CONFIG, PROJECT_STATUS_CONFIG, TASK_STATUS_CONFIG } from '../models/schemas';
import { useAuditData } from '../hooks/useAuditData';
import ComplianceScoresPanel from '../components/audit/ComplianceScoresPanel';
import TaskDetailModal from '../components/tasks/TaskDetailModal';
import { resolveDelay } from '../services/delayService';

export default function Dashboard() {
    const {
        engProjects, engTasks, engSubtasks, teamMembers, timeLogs, delays, taskTypes
    } = useAppData();
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
            // Second click — actually resolve
            (async () => {
                setResolvingDelayId(alertItem.delayId);
                setConfirmingDelayId(null);
                try {
                    await resolveDelay(alertItem.delayId, alertItem.projectId, alertItem.taskId);
                } catch (err) {
                    console.error('Error resolving delay:', err);
                }
                setResolvingDelayId(null);
            })();
        } else {
            // First click — show confirmation
            setConfirmingDelayId(alertItem.delayId);
            // Auto-cancel after 3 seconds
            setTimeout(() => setConfirmingDelayId(prev => prev === alertItem.delayId ? null : prev), 3000);
        }
    }, [confirmingDelayId]);

    // ── Audit Data ──
    const { runClientAudit, scores, summary, isAuditing, auditResult } = useAuditData();

    // Auto-run audit on first load
    useEffect(() => {
        if (!auditResult && !isAuditing) {
            runClientAudit();
        }
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // ------------------------------------------------------------------------
    // AGGREGATED METRICS (KPIs)
    // ------------------------------------------------------------------------
    const kpis = useMemo(() => {
        const activeProjects = engProjects.filter(p => !['completed', 'on_hold', 'cancelled'].includes(p.status));
        const projectsAtRisk = engProjects.filter(p => p.riskLevel === 'high' || p.riskLevel === 'medium');

        const activeTasks = engTasks.filter(t => !['completed', 'cancelled'].includes(t.status));
        const blockedTasks = activeTasks.filter(t => t.status === 'blocked');

        let activeDelays = delays?.filter(d => !d.resolved).length || 0;

        // Sum today's overtime across all users
        const todayStr = format(new Date(), 'yyyy-MM-dd');
        const todayLogs = timeLogs?.filter(log => log.startTime && log.startTime.startsWith(todayStr)) || [];
        const todayOvertime = todayLogs.reduce((acc, log) => acc + (log.overtimeHours || 0), 0);

        return {
            totalActiveProjects: activeProjects.length,
            projectsAtRisk: projectsAtRisk.length,
            totalActiveTasks: activeTasks.length,
            blockedTasks: blockedTasks.length,
            activeDelays,
            todayOvertime: parseFloat(todayOvertime.toFixed(1))
        };
    }, [engProjects, engTasks, timeLogs, delays]);

    // ------------------------------------------------------------------------
    // TEAM WORKLOAD
    // ------------------------------------------------------------------------
    const workload = useMemo(() => {
        const engineers = teamMembers.filter(u => ['engineer', 'technician', 'team_lead', 'manager'].includes(u.teamRole) || !u.teamRole);
        return engineers.map(eng => {
            const assignedTasks = engTasks.filter(t => t.assignedTo === eng.uid && !['completed', 'cancelled'].includes(t.status));
            const inProgress = assignedTasks.filter(t => t.status === 'in_progress').length;
            const blocked = assignedTasks.filter(t => t.status === 'blocked').length;

            // "Overload" simplistic check: More than 5 active tasks is heavy, more than 8 is overload
            let loadLevel = 'normal'; // low, normal, heavy, overloaded
            if (assignedTasks.length > 8) loadLevel = 'overloaded';
            else if (assignedTasks.length > 5) loadLevel = 'heavy';
            else if (assignedTasks.length < 2) loadLevel = 'low';

            return {
                ...eng,
                totalAssigned: assignedTasks.length,
                inProgress,
                blocked,
                loadLevel
            };
        }).sort((a, b) => b.totalAssigned - a.totalAssigned);
    }, [engTasks, teamMembers]);

    // ------------------------------------------------------------------------
    // RECENT ACTIVITY / ALERTS
    // ------------------------------------------------------------------------
    const alerts = useMemo(() => {
        const _alerts = [];

        // 1. Blocked Tasks
        engTasks.filter(t => t.status === 'blocked').forEach(t => {
            const project = engProjects.find(p => p.id === t.projectId);
            _alerts.push({
                type: 'danger', icon: AlertOctagon, title: 'Tarea Bloqueada',
                desc: `La tarea "${t.title}" está bloqueada.`,
                meta: project ? project.name : '',
                time: t.updatedAt || t.createdAt,
                action: () => openTask(t)
            });
        });

        // 2. High Risk Projects
        engProjects.filter(p => p.riskLevel === 'high').forEach(p => {
            _alerts.push({
                type: 'warning', icon: Flame, title: 'Proyecto en Alto Riesgo',
                desc: `Factores críticos detectados.`,
                meta: p.name,
                time: p.riskUpdatedAt || p.updatedAt,
                action: () => navigate('/projects')
            });
        });

        // 3. Recent Delays reported
        if (delays) {
            delays.filter(d => !d.resolved).forEach(d => {
                const project = engProjects.find(p => p.id === d.projectId);
                const relatedTask = d.taskId ? engTasks.find(t => t.id === d.taskId) : null;
                _alerts.push({
                    type: 'warning', icon: AlertTriangle, title: 'Retraso Activo',
                    desc: d.causeName || 'Sin causa especificada',
                    meta: project ? project.name : '',
                    time: d.createdAt,
                    action: relatedTask ? () => openTask(relatedTask) : () => navigate('/projects'),
                    // Extra data for resolve action
                    isDelay: true,
                    delayId: d.id,
                    projectId: d.projectId,
                    taskId: d.taskId,
                    taskTitle: relatedTask?.title || '',
                });
            });
        }

        // Sort by time descending (newest first)
        return _alerts.sort((a, b) => new Date(b.time) - new Date(a.time)).slice(0, 8);
    }, [engTasks, engProjects, delays, navigate]); // eslint-disable-line react-hooks/exhaustive-deps

    // --- Render Helpers ---
    /** Simple name getter — shows displayName or email, no email-to-name conversion */
    const getUserName = (user) => user.displayName || user.email || '?';

    const getLoadColor = (level) => {
        switch (level) {
            case 'overloaded': return 'bg-rose-500';
            case 'heavy': return 'bg-amber-500';
            case 'low': return 'bg-emerald-400';
            default: return 'bg-indigo-500';
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            {/* Task Detail Popup */}
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
            {/* Header */}
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black text-white tracking-tight flex items-center gap-3">
                        Sala Obeya <span className="bg-indigo-500/20 text-indigo-400 text-xs px-2.5 py-1 rounded-lg uppercase tracking-widest leading-none mt-1 border border-indigo-500/30">En vivo</span>
                    </h1>
                    <p className="text-sm font-bold text-slate-400 mt-1">Tablero de Control y Salud de Ingeniería</p>
                </div>
                <div className="text-right flex items-center gap-2">
                    <Clock className="w-4 h-4 text-slate-500" />
                    <span className="text-sm font-bold text-slate-400 capitalize">{format(new Date(), "EEEE, d 'de' MMMM", { locale: es })}</span>
                </div>
            </div>

            {/* KPI ROW 1 */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-slate-900/70 backdrop-blur-sm p-5 rounded-2xl border border-slate-800 shadow-lg cursor-pointer hover:border-indigo-500/50 transition-colors" onClick={() => navigate('/projects')}>
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-black text-slate-400 uppercase tracking-wider">Proyectos Activos</span>
                        <div className="w-8 h-8 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400"><LayoutDashboard className="w-4 h-4" /></div>
                    </div>
                    <span className="text-4xl font-black text-white">{kpis.totalActiveProjects}</span>
                </div>

                <div className="bg-slate-900/70 backdrop-blur-sm p-5 rounded-2xl border border-slate-800 shadow-lg cursor-pointer hover:border-amber-500/50 transition-colors" onClick={() => navigate('/projects')}>
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-black text-amber-400 uppercase tracking-wider">Proy. en Riesgo</span>
                        <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400"><Flame className="w-4 h-4" /></div>
                    </div>
                    <span className="text-4xl font-black text-white">{kpis.projectsAtRisk}</span>
                </div>

                <div className="bg-slate-900/70 backdrop-blur-sm p-5 rounded-2xl border border-slate-800 shadow-lg cursor-pointer hover:border-rose-500/50 transition-colors" onClick={() => navigate('/tasks')}>
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-black text-rose-400 uppercase tracking-wider">Tareas Bloqueadas</span>
                        <div className="w-8 h-8 rounded-xl bg-rose-500/20 border border-rose-500/30 flex items-center justify-center text-rose-400"><AlertOctagon className="w-4 h-4" /></div>
                    </div>
                    <span className="text-4xl font-black text-white">{kpis.blockedTasks}</span>
                </div>

                <div className="bg-slate-900/70 backdrop-blur-sm p-5 rounded-2xl border border-slate-800 shadow-lg">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-black text-orange-400 uppercase tracking-wider">Horas Extra Hoy</span>
                        <div className="w-8 h-8 rounded-xl bg-orange-500/20 border border-orange-500/30 flex items-center justify-center text-orange-400"><Zap className="w-4 h-4" /></div>
                    </div>
                    <span className="text-4xl font-black text-white">{kpis.todayOvertime}</span>
                </div>
            </div>

            {/* COMPLIANCE SCORES */}
            <ComplianceScoresPanel
                scores={scores}
                summary={summary}
                isAuditing={isAuditing}
                onRunAudit={runClientAudit}
                compact={true}
            />

            {/* MAIN DASHBOARD SPLIT */}
            <div className="grid lg:grid-cols-3 gap-6">

                {/* LEFT COL: Projects Health & Workload */}
                <div className="lg:col-span-2 space-y-6">

                    {/* Project Health */}
                    <div className="bg-slate-900/70 backdrop-blur-sm rounded-2xl border border-slate-800 shadow-lg p-6">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="font-bold text-lg text-white flex items-center gap-2"><Activity className="w-5 h-5 text-indigo-400" /> Salud de Proyectos</h3>
                            <button onClick={() => navigate('/projects')} className="text-indigo-400 text-xs font-bold hover:underline">Ver todos</button>
                        </div>

                        <div className="space-y-4">
                            {engProjects.filter(p => !['completed', 'cancelled'].includes(p.status)).slice(0, 5).map(project => {
                                const rLvl = project.riskLevel || 'low';
                                const rCfg = RISK_LEVEL_CONFIG[rLvl] || RISK_LEVEL_CONFIG['low'];

                                // Recalculate quick progress
                                const projectTasks = engTasks.filter(t => t.projectId === project.id);
                                const completedTasks = projectTasks.filter(t => t.status === 'completed').length;
                                const totalTasks = projectTasks.length;
                                const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

                                return (
                                    <div key={project.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 bg-slate-800/60 border border-slate-700/50 rounded-xl gap-4">
                                        <div className="flex-1">
                                            <h4 className="font-black text-slate-200 leading-tight">{project.name}</h4>
                                            <div className="flex items-center gap-3 mt-1">
                                                <span className="text-[10px] font-bold text-slate-400">{completedTasks}/{totalTasks} Tareas</span>
                                                <div className="w-24 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                                                    <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${progress}%` }}></div>
                                                </div>
                                                <span className="text-[10px] font-bold text-slate-400">{progress}%</span>
                                            </div>
                                        </div>
                                        <div className="flex sm:flex-col gap-2 sm:gap-1 items-end shrink-0">
                                            <span
                                                className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full flex items-center gap-1 ${rLvl === 'high' ? 'text-red-400 bg-red-500/15 border border-red-500/30' :
                                                    rLvl === 'medium' ? 'text-amber-400 bg-amber-500/15 border border-amber-500/30' :
                                                        'text-emerald-400 bg-emerald-500/15 border border-emerald-500/30'
                                                    }`}
                                            >
                                                {rLvl === 'high' ? <Flame className="w-3 h-3" /> : rLvl === 'medium' ? <AlertTriangle className="w-3 h-3" /> : <CheckCircle className="w-3 h-3" />}
                                                {rCfg.label}
                                            </span>
                                        </div>
                                    </div>
                                );
                            })}
                            {engProjects.length === 0 && <p className="text-sm font-medium text-slate-500 py-4 text-center">No hay proyectos activos.</p>}
                        </div>
                    </div>

                    {/* Team Workload */}
                    <div className="bg-slate-900/70 backdrop-blur-sm rounded-2xl border border-slate-800 shadow-lg p-6">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="font-bold text-lg text-white flex items-center gap-2"><Users className="w-5 h-5 text-indigo-400" /> Carga del Equipo</h3>
                        </div>

                        <div className="grid gap-4">
                            {workload.map(user => {
                                const maxExpectedTasks = 10;
                                const barPct = Math.min((user.totalAssigned / maxExpectedTasks) * 100, 100);

                                return (
                                    <div key={user.uid} className="flex items-center gap-4 p-3 rounded-xl bg-slate-800/40 hover:bg-slate-800/70 transition-colors">
                                        <div className="w-52 shrink-0 flex items-center gap-3">
                                            <div className="w-9 h-9 rounded-full bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center font-bold text-sm text-indigo-400 shrink-0">
                                                {getUserName(user)[0].toUpperCase()}
                                            </div>
                                            <div className="min-w-0">
                                                <span className="text-sm font-bold text-slate-200 block truncate">{getUserName(user)}</span>
                                                <span className="text-[10px] font-bold text-slate-500 uppercase">{user.teamRole || 'Ingeniero'}</span>
                                            </div>
                                        </div>
                                        <div className="flex-1 relative">
                                            <div className="h-3 bg-slate-800 rounded-full w-full overflow-hidden">
                                                <div
                                                    className={`h-full transition-all duration-700 rounded-full ${getLoadColor(user.loadLevel)}`}
                                                    style={{ width: `${barPct}%` }}
                                                />
                                            </div>
                                        </div>
                                        <div className="w-28 shrink-0 text-right">
                                            <span className="text-xs font-black text-slate-300">
                                                {user.totalAssigned} asignadas
                                            </span>
                                            {(user.blocked > 0) && (
                                                <span className="block text-[10px] font-bold text-rose-400">{user.blocked} bloqueadas</span>
                                            )}
                                        </div>
                                    </div>
                                )
                            })}
                            {workload.length === 0 && <p className="text-sm font-medium text-slate-500 py-4 text-center">No hay ingenieros en el equipo.</p>}
                        </div>
                    </div>

                </div>

                {/* RIGHT COL: Alerts & Feed */}
                <div className="space-y-6">
                    <div className="bg-slate-900/70 backdrop-blur-sm rounded-2xl border border-slate-800 shadow-lg p-6 sticky top-6">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="font-bold text-lg text-white flex items-center gap-2"><AlertTriangle className="w-5 h-5 text-amber-400" /> Alertas Críticas</h3>
                        </div>

                        <div className="space-y-3">
                            {alerts.map((alert, i) => (
                                <div
                                    key={i}
                                    onClick={alert.action}
                                    className={`p-3 rounded-xl border-l-4 cursor-pointer transition-transform hover:translate-x-1 ${alert.type === 'danger' ? 'bg-rose-500/10 border-rose-500' :
                                        alert.type === 'warning' ? 'bg-amber-500/10 border-amber-500' :
                                            'bg-slate-800/50 border-slate-600'
                                        }`}
                                >
                                    <div className="flex items-start gap-3">
                                        <alert.icon className={`w-5 h-5 shrink-0 mt-0.5 ${alert.type === 'danger' ? 'text-rose-400' :
                                            alert.type === 'warning' ? 'text-amber-400' :
                                                'text-slate-400'
                                            }`} />
                                        <div className="flex-1 min-w-0">
                                            <p className={`text-sm font-black ${alert.type === 'danger' ? 'text-rose-300' :
                                                alert.type === 'warning' ? 'text-amber-300' :
                                                    'text-slate-300'
                                                }`}>
                                                {alert.title}
                                            </p>
                                            <p className={`text-xs mt-0.5 ${alert.type === 'danger' ? 'text-rose-400/80' :
                                                alert.type === 'warning' ? 'text-amber-400/80' :
                                                    'text-slate-500'
                                                }`}>
                                                {alert.desc}
                                            </p>
                                            {/* Show task name for delays */}
                                            {alert.taskTitle && (
                                                <p className="text-[10px] font-bold text-slate-400 mt-0.5">
                                                    Tarea: {alert.taskTitle}
                                                </p>
                                            )}
                                            <div className="flex items-center justify-between mt-2">
                                                <span className="text-[10px] font-bold text-slate-500 capitalize bg-slate-800/50 px-1.5 py-0.5 rounded">{alert.meta}</span>
                                                <span className="text-[9px] font-bold text-slate-500">
                                                    {alert.time ? format(new Date(alert.time), 'dd MMM HH:mm', { locale: es }) : ''}
                                                </span>
                                            </div>
                                            {/* Resolve button for delays */}
                                            {alert.isDelay && (
                                                <button
                                                    onClick={(e) => handleResolveClick(e, alert)}
                                                    disabled={resolvingDelayId === alert.delayId}
                                                    className={`mt-2 w-full py-1.5 rounded-lg font-bold text-[11px] flex items-center justify-center gap-1.5 transition-all active:scale-95 ${confirmingDelayId === alert.delayId
                                                        ? 'bg-red-600 hover:bg-red-500 text-white animate-pulse'
                                                        : resolvingDelayId === alert.delayId
                                                            ? 'bg-slate-700 text-slate-400'
                                                            : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                                                        }`}
                                                >
                                                    <CheckCheck className="w-3.5 h-3.5" />
                                                    {resolvingDelayId === alert.delayId
                                                        ? 'Resolviendo...'
                                                        : confirmingDelayId === alert.delayId
                                                            ? '¿Confirmar resolución? (clic otra vez)'
                                                            : 'Resolver Retraso'}
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
                                    <p className="text-xs text-slate-500 mt-1">No hay alertas críticas.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
}
