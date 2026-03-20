import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Activity, AlertTriangle, AlertOctagon, ArrowRight, BarChart3,
    BrainCircuit, CalendarDays, CheckCircle, Clock, Eye, Flame, FolderGit2,
    GanttChartSquare, LayoutDashboard, ListTodo, Radar, Shield,
    Sparkles, Target, TrendingUp, User, Users, Zap,
    FileText, ArrowDown, Timer, XCircle, ChevronRight, CheckCircle2,
    Play, Pause, Milestone, Calendar, History, Flag, Hourglass,
    Bell, Inbox, Trophy, Rocket, ExternalLink
} from 'lucide-react';
import { useDailyBriefingData } from '../hooks/useDailyBriefingData';
import { useEngineeringData } from '../hooks/useEngineeringData';
import { useAuth } from '../contexts/AuthContext';
import { useRole } from '../contexts/RoleContext';
import TaskDetailModal from '../components/tasks/TaskDetailModal';
import { isBefore, parseISO, startOfDay } from 'date-fns';
import PageHeader from '../components/layout/PageHeader';

// ─── Hook: Intersection Observer para animaciones por scroll ───
function useScrollReveal(options = {}) {
    const ref = useRef(null);
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        const el = ref.current;
        if (!el) return;

        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    setIsVisible(true);
                    observer.unobserve(el);
                }
            },
            { threshold: 0.15, rootMargin: '0px 0px -50px 0px', ...options }
        );

        observer.observe(el);
        return () => observer.disconnect();
    }, []);

    return [ref, isVisible];
}

// ─── Color Map ───
const colorMap = {
    indigo: { bg: 'bg-indigo-500/15', border: 'border-indigo-500/30', text: 'text-indigo-400', glow: 'shadow-indigo-500/20', solid: 'bg-indigo-600', gradient: 'from-indigo-600 to-indigo-400' },
    violet: { bg: 'bg-violet-500/15', border: 'border-violet-500/30', text: 'text-violet-400', glow: 'shadow-violet-500/20', solid: 'bg-violet-600', gradient: 'from-violet-600 to-violet-400' },
    emerald: { bg: 'bg-emerald-500/15', border: 'border-emerald-500/30', text: 'text-emerald-400', glow: 'shadow-emerald-500/20', solid: 'bg-emerald-600', gradient: 'from-emerald-600 to-emerald-400' },
    amber: { bg: 'bg-amber-500/15', border: 'border-amber-500/30', text: 'text-amber-400', glow: 'shadow-amber-500/20', solid: 'bg-amber-600', gradient: 'from-amber-600 to-amber-400' },
    blue: { bg: 'bg-blue-500/15', border: 'border-blue-500/30', text: 'text-blue-400', glow: 'shadow-blue-500/20', solid: 'bg-blue-600', gradient: 'from-blue-600 to-blue-400' },
    cyan: { bg: 'bg-cyan-500/15', border: 'border-cyan-500/30', text: 'text-cyan-400', glow: 'shadow-cyan-500/20', solid: 'bg-cyan-600', gradient: 'from-cyan-600 to-cyan-400' },
    rose: { bg: 'bg-rose-500/15', border: 'border-rose-500/30', text: 'text-rose-400', glow: 'shadow-rose-500/20', solid: 'bg-rose-600', gradient: 'from-rose-600 to-rose-400' },
    orange: { bg: 'bg-orange-500/15', border: 'border-orange-500/30', text: 'text-orange-400', glow: 'shadow-orange-500/20', solid: 'bg-orange-600', gradient: 'from-orange-600 to-orange-400' },
    purple: { bg: 'bg-purple-500/15', border: 'border-purple-500/30', text: 'text-purple-400', glow: 'shadow-purple-500/20', solid: 'bg-purple-600', gradient: 'from-purple-600 to-purple-400' },
    teal: { bg: 'bg-teal-500/15', border: 'border-teal-500/30', text: 'text-teal-400', glow: 'shadow-teal-500/20', solid: 'bg-teal-600', gradient: 'from-teal-600 to-teal-400' },
    sky: { bg: 'bg-sky-500/15', border: 'border-sky-500/30', text: 'text-sky-400', glow: 'shadow-sky-500/20', solid: 'bg-sky-600', gradient: 'from-sky-600 to-sky-400' },
    slate: { bg: 'bg-slate-500/15', border: 'border-slate-500/30', text: 'text-slate-400', glow: 'shadow-slate-500/20', solid: 'bg-slate-600', gradient: 'from-slate-600 to-slate-400' },
};

// ─── Quick Action icon lookup ───
const ACTION_ICONS = {
    mywork: User, tasks: ListTodo, planner: CalendarDays, projects: FolderGit2,
    team: Users, control: Radar, audit: Shield, analytics: BarChart3,
    logs: Clock, report: FileText,
};

// ─── Role display labels ───
const ROLE_LABELS = {
    manager: 'Manager', team_lead: 'Team Lead', engineer: 'Ingeniero',
    technician: 'Técnico', admin: 'Admin', editor: 'Editor', viewer: 'Viewer',
};

// ═══════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ═══════════════════════════════════════════════════════════════

export default function DailyBriefing() {
    const navigate = useNavigate();
    const {
        greeting, isReady, isLeader, kpis,
        myFocus, projectHealth, criticalAlerts,
        teamOverview, discipline, topRisks, dailyScrum, quickActions,
        timeSnapshot, activeDelaysDetail, weekPlannerSnapshot, upcomingMilestones, recentActivity,
        executiveSummary, priorityOne, productivityStreak, notifications,
    } = useDailyBriefingData();

    // ── Engineering data for TaskDetailModal ──
    const { engProjects, engTasks, engSubtasks, taskTypes, teamMembers } = useEngineeringData();
    const { user } = useAuth();
    const { canEdit, canDelete } = useRole();

    // ── Task Detail Modal state ──
    const [selectedTask, setSelectedTask] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);

    const openTask = useCallback((taskOrId) => {
        const task = typeof taskOrId === 'string' ? engTasks.find(t => t.id === taskOrId) : taskOrId;
        if (task) {
            setSelectedTask(task);
            setIsModalOpen(true);
        }
    }, [engTasks]);

    const closeModal = useCallback(() => {
        setIsModalOpen(false);
        setSelectedTask(null);
    }, []);

    // Scroll reveal refs
    const [heroRef, heroVisible] = useScrollReveal();
    const [kpiRef, kpiVisible] = useScrollReveal();
    const [focusRef, focusVisible] = useScrollReveal();
    const [projRef, projVisible] = useScrollReveal();
    const [alertRef, alertVisible] = useScrollReveal();
    const [teamRef, teamVisible] = useScrollReveal();
    const [scrumRef, scrumVisible] = useScrollReveal();
    const [timeRef, timeVisible] = useScrollReveal();
    const [delayRef, delayVisible] = useScrollReveal();
    const [planRef, planVisible] = useScrollReveal();
    const [msRef, msVisible] = useScrollReveal();
    const [feedRef, feedVisible] = useScrollReveal();
    const [notifRef, notifVisible] = useScrollReveal();
    const [discRef, discVisible] = useScrollReveal();
    const [riskRef, riskVisible] = useScrollReveal();
    const [actRef, actVisible] = useScrollReveal();

    // ── Helpers ──
    const getLoadColor = (level) => {
        switch (level) {
            case 'overloaded': return 'bg-rose-500';
            case 'heavy': return 'bg-amber-500';
            case 'low': return 'bg-emerald-400';
            default: return 'bg-indigo-500';
        }
    };

    const getLoadLabel = (level) => {
        switch (level) {
            case 'overloaded': return 'Sobrecargado';
            case 'heavy': return 'Carga alta';
            case 'low': return 'Baja carga';
            default: return 'Normal';
        }
    };

    const riskColorMap = {
        high: { badge: 'text-red-400 bg-red-500/15 border-red-500/30', bar: 'bg-red-500' },
        medium: { badge: 'text-amber-400 bg-amber-500/15 border-amber-500/30', bar: 'bg-amber-500' },
        low: { badge: 'text-emerald-400 bg-emerald-500/15 border-emerald-500/30', bar: 'bg-emerald-500' },
    };

    // ── KPI click destinations ──
    const kpiClickTargets = {
        'Mis Tareas Activas': '/my-work',
        'Vencidas': '/my-work',
        'Bloqueadas': '/tasks',
        'Horas Hoy': '/work-logs',
        'Proyectos Activos': '/projects',
        'Proyectos en Riesgo': '/projects',
        'Tareas Bloqueadas (Global)': '/tasks',
        'Overtime Global Hoy': '/work-logs',
    };

    return (
        <div className="min-h-screen pb-20">

            {/* ═══ TASK DETAIL MODAL ═══ */}
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

            {/* ═══════════════════════════════════════════════════
                SECTION 1: HERO — Greeting + Day Summary
            ═══════════════════════════════════════════════════ */}
            <section ref={heroRef} className="relative min-h-[40vh] flex flex-col items-center justify-center overflow-hidden">
                {/* Decorative background */}
                <div className="absolute inset-0 overflow-hidden">
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-indigo-600/5 blur-3xl" />
                    <div className="absolute top-1/4 right-1/4 w-[250px] h-[250px] rounded-full bg-violet-600/5 blur-3xl animate-pulse" style={{ animationDuration: '4s' }} />
                    <div className="absolute bottom-1/3 left-1/4 w-[200px] h-[200px] rounded-full bg-emerald-600/5 blur-3xl animate-pulse" style={{ animationDuration: '6s' }} />
                </div>

                {/* Orbiting status indicators */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    {[Activity, Target, Clock, Shield, TrendingUp, Sparkles].map((Icon, i) => (
                        <div
                            key={i}
                            className={`absolute transition-all duration-1000 ${heroVisible ? 'opacity-100' : 'opacity-0'}`}
                            style={{
                                top: `${50 + 32 * Math.sin((i / 6) * 2 * Math.PI)}%`,
                                left: `${50 + 32 * Math.cos((i / 6) * 2 * Math.PI)}%`,
                                transform: 'translate(-50%, -50%)',
                                transitionDelay: `${i * 150}ms`,
                                animation: heroVisible ? `orbit-float 8s ease-in-out infinite ${i * 1.3}s` : 'none',
                            }}
                        >
                            <div className="w-11 h-11 md:w-12 md:h-12 rounded-2xl bg-slate-800/80 backdrop-blur-sm border border-slate-700/50 flex items-center justify-center shadow-lg shadow-black/20">
                                <Icon className="w-5 h-5 text-indigo-400/70" />
                            </div>
                        </div>
                    ))}
                </div>

                {/* Back button overlay — top left, always visible */}
                <div className="absolute top-4 left-4 z-20">
                    <PageHeader title="" showBack={true} backTo="/" className="!gap-0" />
                </div>

                {/* Central content */}
                <div className={`relative z-10 text-center max-w-3xl mx-auto px-6 transition-all duration-1000 ${heroVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-sm font-bold mb-4">
                        <Activity className="w-4 h-4" />
                        Daily Briefing
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    </div>
                    <h1 className="text-3xl md:text-5xl font-black text-white tracking-tight leading-tight mb-3">
                        {greeting.text},
                        <span className="block bg-gradient-to-r from-indigo-400 via-violet-400 to-purple-400 bg-clip-text text-transparent">
                            {greeting.userName}
                        </span>
                    </h1>
                    <p className="text-base md:text-lg text-slate-400 font-medium mb-3 capitalize">
                        {greeting.dateLabel}
                    </p>
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800/60 border border-slate-700/50 text-slate-400 text-sm font-bold">
                        <div className={`w-2 h-2 rounded-full ${isLeader ? 'bg-amber-400' : 'bg-indigo-400'}`} />
                        {ROLE_LABELS[greeting.teamRole] || greeting.teamRole}
                    </div>

                    {/* ── Executive Summary ── */}
                    {executiveSummary && (
                        <p className={`mt-5 text-sm md:text-base text-slate-300 font-medium leading-relaxed max-w-2xl mx-auto px-4 py-3 rounded-xl bg-slate-800/40 border border-slate-700/30 backdrop-blur-sm transition-all duration-1000 delay-500 ${heroVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
                            {executiveSummary}
                        </p>
                    )}

                    {/* ── Productivity Streak ── */}
                    {productivityStreak && (
                        <div className={`mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-full border text-sm font-black transition-all duration-1000 delay-700 ${
                            productivityStreak.status === 'fire' ? 'bg-orange-500/15 border-orange-500/30 text-orange-400' :
                            productivityStreak.status === 'strong' ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400' :
                            productivityStreak.status === 'growing' ? 'bg-violet-500/15 border-violet-500/30 text-violet-400' :
                            productivityStreak.status === 'started' ? 'bg-cyan-500/15 border-cyan-500/30 text-cyan-400' :
                            'bg-slate-800/60 border-slate-700/30 text-slate-500'
                        } ${heroVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
                            {productivityStreak.status === 'fire' && <Flame className="w-4 h-4" />}
                            {productivityStreak.status === 'strong' && <Trophy className="w-4 h-4" />}
                            {productivityStreak.status === 'growing' && <Sparkles className="w-4 h-4" />}
                            {productivityStreak.status === 'started' && <Zap className="w-4 h-4" />}
                            {productivityStreak.status === 'cold' && <Clock className="w-4 h-4" />}
                            {productivityStreak.label}
                            {productivityStreak.days >= 5 && (
                                <span className="text-xs font-black bg-white/10 px-2 py-0.5 rounded-full">{productivityStreak.days}🔥</span>
                            )}
                        </div>
                    )}
                </div>

                {/* ── Priority #1 Card (outside centered div, but self-centered) ── */}
                {priorityOne && (
                    <div className={`relative z-10 w-full max-w-lg px-4 mt-5 transition-all duration-1000 delay-900 ${heroVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
                        style={{ margin: '1.25rem auto 0' }}>
                        <div
                            onClick={() => openTask(priorityOne.id)}
                            className="group relative p-4 rounded-2xl bg-gradient-to-r from-indigo-900/50 to-violet-900/50 border border-indigo-500/30 cursor-pointer hover:border-indigo-400/50 transition-all duration-300 hover:shadow-[0_0_30px_rgba(99,102,241,0.15)] backdrop-blur-md"
                        >
                            <div className="absolute -top-2.5 left-4 px-2.5 py-0.5 rounded-full bg-indigo-600 text-[10px] font-black text-white uppercase tracking-wider flex items-center gap-1">
                                <Rocket className="w-3 h-3" /> Prioridad #1
                            </div>
                            <div className="flex items-center gap-3 mt-1">
                                <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center shrink-0">
                                    <Target className="w-5 h-5 text-indigo-400" />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <p className="text-sm font-black text-white truncate group-hover:text-indigo-200 transition-colors">{priorityOne.title}</p>
                                    <div className="flex items-center gap-2 mt-0.5">
                                        <span className="text-[10px] font-bold text-slate-400">{priorityOne.projectName}</span>
                                        {priorityOne.dueDate && (() => {
                                            const dueDate = typeof priorityOne.dueDate === 'string' ? parseISO(priorityOne.dueDate) : new Date();
                                            const isOverdue = isBefore(dueDate, startOfDay(new Date()));
                                            const daysUntil = Math.round((dueDate - new Date()) / (1000 * 60 * 60 * 24));
                                            const label = isOverdue ? `${Math.abs(daysUntil)}d vencida` : daysUntil === 0 ? 'Hoy' : `${daysUntil}d restantes`;
                                            return (
                                                <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full border ${
                                                    isOverdue ? 'text-rose-400 bg-rose-500/15 border-rose-500/30' : 'text-slate-400 bg-slate-800 border-slate-700'
                                                }`}>{label}</span>
                                            );
                                        })()}
                                        <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded-full border ${
                                            priorityOne.status === 'in_progress' ? 'text-blue-400 bg-blue-500/15 border-blue-500/30' :
                                            priorityOne.status === 'blocked' ? 'text-rose-400 bg-rose-500/15 border-rose-500/30' :
                                            'text-slate-400 bg-slate-800 border-slate-700'
                                        }`}>{priorityOne.status?.replace('_', ' ')}</span>
                                    </div>
                                </div>
                                <ChevronRight className="w-5 h-5 text-indigo-400 opacity-0 group-hover:opacity-100 transition-all group-hover:translate-x-1" />
                            </div>
                        </div>
                    </div>
                )}

                {/* Scroll indicator */}
                <div className={`absolute ${priorityOne ? 'bottom-2' : 'bottom-6'} left-1/2 -translate-x-1/2 transition-all duration-1000 delay-700 ${heroVisible ? 'opacity-100' : 'opacity-0'}`}>
                    <div className="flex flex-col items-center gap-2 text-slate-500">
                        <span className="text-xs font-bold uppercase tracking-widest">Tu día</span>
                        <ArrowDown className="w-4 h-4 animate-bounce" />
                    </div>
                </div>
            </section>


            {/* ═══════════════════════════════════════════════════
                SECTION 2: KPI STRIP — ALL CLICKABLE
            ═══════════════════════════════════════════════════ */}
            <section ref={kpiRef} className="py-10 px-6">
                <div className="max-w-6xl mx-auto">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {[
                            { label: 'Mis Tareas Activas', value: kpis.myActiveTasks, icon: ListTodo, color: 'indigo' },
                            { label: 'Vencidas', value: kpis.myOverdue, icon: AlertTriangle, color: kpis.myOverdue > 0 ? 'rose' : 'emerald' },
                            { label: 'Bloqueadas', value: kpis.myBlocked, icon: AlertOctagon, color: kpis.myBlocked > 0 ? 'amber' : 'emerald' },
                            { label: 'Horas Hoy', value: kpis.todayHours, icon: Clock, color: 'blue' },
                        ].map((kpi, i) => {
                            const c = colorMap[kpi.color];
                            const Icon = kpi.icon;
                            const target = kpiClickTargets[kpi.label];
                            return (
                                <div
                                    key={i}
                                    onClick={() => target && navigate(target)}
                                    className={`p-5 rounded-2xl bg-slate-900/60 backdrop-blur-sm border border-slate-800 shadow-lg transition-all duration-500
                                        cursor-pointer hover:border-slate-700 hover:shadow-xl hover:scale-[1.02] active:scale-[0.98]
                                        ${kpiVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}
                                    `}
                                    style={{ transitionDelay: kpiVisible ? `${i * 80}ms` : '0ms' }}
                                >
                                    <div className="flex items-center justify-between mb-3">
                                        <span className={`text-[10px] font-black uppercase tracking-wider ${c.text}`}>{kpi.label}</span>
                                        <div className={`w-8 h-8 rounded-xl ${c.bg} border ${c.border} flex items-center justify-center`}>
                                            <Icon className={`w-4 h-4 ${c.text}`} />
                                        </div>
                                    </div>
                                    <div className="flex items-end justify-between">
                                        <span className="text-3xl md:text-4xl font-black text-white">{kpi.value}</span>
                                        <ArrowRight className={`w-4 h-4 ${c.text} opacity-50`} />
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Leader-only global KPIs — also clickable */}
                    {isLeader && (
                        <div className={`grid grid-cols-2 md:grid-cols-4 gap-4 mt-4 transition-all duration-500 delay-300 ${kpiVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
                            {[
                                { label: 'Proyectos Activos', value: kpis.totalActiveProjects, icon: FolderGit2, color: 'violet' },
                                { label: 'Proyectos en Riesgo', value: kpis.projectsAtRisk, icon: Flame, color: kpis.projectsAtRisk > 0 ? 'amber' : 'emerald' },
                                { label: 'Tareas Bloqueadas (Global)', value: kpis.blockedTasks, icon: XCircle, color: kpis.blockedTasks > 0 ? 'rose' : 'emerald' },
                                { label: 'Overtime Global Hoy', value: kpis.todayOvertime, icon: Zap, color: kpis.todayOvertime > 0 ? 'orange' : 'emerald' },
                            ].map((kpi, i) => {
                                const c = colorMap[kpi.color];
                                const Icon = kpi.icon;
                                const target = kpiClickTargets[kpi.label];
                                return (
                                    <div
                                        key={i}
                                        onClick={() => target && navigate(target)}
                                        className="p-4 rounded-2xl bg-slate-900/40 backdrop-blur-sm border border-slate-800/60 shadow-md cursor-pointer hover:border-slate-700 hover:scale-[1.02] active:scale-[0.98] transition-all"
                                    >
                                        <div className="flex items-center justify-between mb-2">
                                            <span className={`text-[10px] font-black uppercase tracking-wider ${c.text}`}>{kpi.label}</span>
                                            <div className={`w-7 h-7 rounded-lg ${c.bg} border ${c.border} flex items-center justify-center`}>
                                                <Icon className={`w-3.5 h-3.5 ${c.text}`} />
                                            </div>
                                        </div>
                                        <div className="flex items-end justify-between">
                                            <span className="text-2xl font-black text-white">{kpi.value}</span>
                                            <ArrowRight className={`w-3.5 h-3.5 ${c.text} opacity-40`} />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </section>


            {/* ═══════════════════════════════════════════════════
                SECTION 3: MI FOCO DEL DÍA — tasks open modal
            ═══════════════════════════════════════════════════ */}
            <section ref={focusRef} className="py-12 px-6">
                <div className="max-w-6xl mx-auto">
                    <div className={`text-center mb-10 transition-all duration-700 ${focusVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
                        <span className="text-xs font-black uppercase tracking-[0.2em] text-violet-400 block mb-3">Mi Foco</span>
                        <h2 className="text-3xl md:text-4xl font-black text-white mb-3">¿Qué Atacar Hoy?</h2>
                        <p className="text-slate-400 text-lg max-w-2xl mx-auto">Tu situación personal: tareas vencidas, bloqueadas, urgentes y próximas a vencer</p>
                    </div>

                    <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5">
                        {[
                            { title: 'En Progreso', tasks: myFocus.inProgress, color: 'indigo', icon: Activity, emptyMsg: 'Sin tareas activas' },
                            { title: 'Vencidas', tasks: myFocus.overdue, color: 'rose', icon: AlertTriangle, emptyMsg: 'Sin tareas vencidas 🎉' },
                            { title: 'Bloqueadas', tasks: myFocus.blocked, color: 'amber', icon: AlertOctagon, emptyMsg: 'Sin bloqueos' },
                            { title: 'Próximas (3 días)', tasks: myFocus.upcoming, color: 'blue', icon: Timer, emptyMsg: 'Nada urgente próximo' },
                        ].map((block, i) => {
                            const c = colorMap[block.color];
                            const Icon = block.icon;
                            return (
                                <div
                                    key={i}
                                    className={`group p-6 rounded-2xl bg-slate-900/60 border border-slate-800 backdrop-blur-sm transition-all duration-500 hover:border-slate-700 hover:shadow-lg
                                        ${focusVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}
                                    `}
                                    style={{ transitionDelay: focusVisible ? `${i * 100}ms` : '0ms' }}
                                >
                                    <div className="flex items-center gap-3 mb-4">
                                        <div className={`w-10 h-10 rounded-xl ${c.bg} border ${c.border} flex items-center justify-center transition-transform duration-300 group-hover:scale-110`}>
                                            <Icon className={`w-5 h-5 ${c.text}`} />
                                        </div>
                                        <div>
                                            <h3 className="font-black text-white text-base">{block.title}</h3>
                                            <span className={`text-2xl font-black ${c.text}`}>{block.tasks.length}</span>
                                        </div>
                                    </div>

                                    {block.tasks.length > 0 ? (
                                        <div className="space-y-2">
                                            {block.tasks.slice(0, 3).map(task => (
                                                <div
                                                    key={task.id}
                                                    onClick={() => openTask(task)}
                                                    className="flex items-start gap-2 p-2.5 rounded-xl bg-slate-800/50 border border-slate-700/30 hover:border-slate-600 cursor-pointer transition-all group/task"
                                                >
                                                    <div className={`w-1.5 h-1.5 rounded-full mt-2 shrink-0 ${c.text.replace('text-', 'bg-')}`} />
                                                    <div className="min-w-0 flex-1">
                                                        <p className="text-sm font-bold text-slate-200 truncate">{task.title}</p>
                                                        <p className="text-[10px] text-slate-500 font-bold truncate">{task.projectName}</p>
                                                    </div>
                                                    <ChevronRight className="w-3.5 h-3.5 text-slate-600 opacity-0 group-hover/task:opacity-100 mt-1 transition-opacity" />
                                                </div>
                                            ))}
                                            {block.tasks.length > 3 && (
                                                <button onClick={() => navigate('/my-work')} className={`text-xs font-bold ${c.text} hover:underline mt-1`}>
                                                    +{block.tasks.length - 3} más →
                                                </button>
                                            )}
                                        </div>
                                    ) : (
                                        <p className="text-sm text-slate-500 font-medium py-3 text-center">{block.emptyMsg}</p>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </section>


            {/* ═══════════════════════════════════════════════════
                SECTION 3B: TIME TRACKING SNAPSHOT
            ═══════════════════════════════════════════════════ */}
            <section ref={timeRef} className="py-12 px-6">
                <div className="max-w-6xl mx-auto">
                    <div className={`text-center mb-10 transition-all duration-700 ${timeVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
                        <span className="text-xs font-black uppercase tracking-[0.2em] text-blue-400 block mb-3">Control de Tiempo</span>
                        <h2 className="text-3xl md:text-4xl font-black text-white mb-3">⏱️ Mis Horas</h2>
                        <p className="text-slate-400 text-lg max-w-2xl mx-auto">Registro de tiempo: hoy y esta semana con desglose por proyecto</p>
                    </div>

                    <div className={`grid md:grid-cols-3 gap-5 mb-6 transition-all duration-700 delay-100 ${timeVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
                        {/* Today hours */}
                        <div onClick={() => navigate('/work-logs')} className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 cursor-pointer hover:border-slate-700 transition-all hover:shadow-lg">
                            <div className="flex items-center gap-3 mb-3">
                                <div className="w-10 h-10 rounded-xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center">
                                    <Clock className="w-5 h-5 text-blue-400" />
                                </div>
                                <div>
                                    <span className="text-[10px] font-black uppercase tracking-wider text-blue-400">Hoy</span>
                                    <p className="text-2xl font-black text-white">{timeSnapshot.todayHours}h</p>
                                </div>
                            </div>
                            {timeSnapshot.activeTimer && (
                                <div className="flex items-center gap-2 text-xs font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-1.5">
                                    <Play className="w-3 h-3 animate-pulse" /> Timer activo
                                </div>
                            )}
                            <span className="text-[10px] text-slate-500">{timeSnapshot.totalLogsToday} registros</span>
                        </div>

                        {/* Week hours with progress bar */}
                        <div onClick={() => navigate('/work-logs')} className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 cursor-pointer hover:border-slate-700 transition-all hover:shadow-lg">
                            <div className="flex items-center gap-3 mb-3">
                                <div className="w-10 h-10 rounded-xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center">
                                    <Calendar className="w-5 h-5 text-indigo-400" />
                                </div>
                                <div>
                                    <span className="text-[10px] font-black uppercase tracking-wider text-indigo-400">Esta Semana</span>
                                    <p className="text-2xl font-black text-white">{timeSnapshot.weekHours}h <span className="text-sm text-slate-500">/ 40h</span></p>
                                </div>
                            </div>
                            <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                                <div className="h-full bg-indigo-500 rounded-full transition-all duration-700" style={{ width: `${timeSnapshot.weekProgress}%` }} />
                            </div>
                            <span className="text-[10px] text-slate-500 mt-1 block">{timeSnapshot.weekProgress}% de objetivo semanal</span>
                        </div>

                        {/* Week mini chart */}
                        <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800">
                            <span className="text-[10px] font-black uppercase tracking-wider text-cyan-400 block mb-3">Horas por Día</span>
                            <div className="flex items-end gap-1.5 h-20">
                                {timeSnapshot.weekDays.map((day, i) => {
                                    const maxH = Math.max(...timeSnapshot.weekDays.map(d => d.hours), 1);
                                    const pct = (day.hours / maxH) * 100;
                                    return (
                                        <div key={i} className="flex-1 flex flex-col items-center gap-1">
                                            <span className="text-[9px] font-black text-slate-400">{day.hours > 0 ? day.hours : ''}</span>
                                            <div className="w-full rounded-t-md transition-all duration-700" style={{ height: `${Math.max(pct, 4)}%`, background: day.isToday ? '#818cf8' : 'rgba(100,116,139,0.3)' }} />
                                            <span className={`text-[9px] font-bold ${day.isToday ? 'text-indigo-400' : 'text-slate-500'}`}>{day.dayLabel}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    {/* Per-project hours today */}
                    {timeSnapshot.projectHoursToday.length > 0 && (
                        <div className={`grid grid-cols-2 md:grid-cols-4 gap-3 transition-all duration-700 delay-300 ${timeVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
                            {timeSnapshot.projectHoursToday.map((ph, i) => (
                                <div key={i} className="p-3 rounded-xl bg-slate-900/40 border border-slate-800/60 flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-blue-400 shrink-0" />
                                    <span className="text-xs font-bold text-slate-300 truncate flex-1">{ph.name}</span>
                                    <span className="text-sm font-black text-blue-400">{parseFloat(ph.hours.toFixed(1))}h</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </section>


            {/* ═══════════════════════════════════════════════════
                SECTION 3C: WEEKLY PLANNER SNAPSHOT
            ═══════════════════════════════════════════════════ */}
            <section ref={planRef} className="py-12 px-6">
                <div className="max-w-6xl mx-auto">
                    <div className={`text-center mb-10 transition-all duration-700 ${planVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
                        <span className="text-xs font-black uppercase tracking-[0.2em] text-teal-400 block mb-3">Planner</span>
                        <h2 className="text-3xl md:text-4xl font-black text-white mb-3">📅 Mi Semana</h2>
                        <p className="text-slate-400 text-lg max-w-2xl mx-auto">Plan del día y progreso semanal del planner</p>
                    </div>

                    {/* Week progress strip */}
                    <div className={`mb-6 transition-all duration-700 delay-100 ${planVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-bold text-slate-300">Progreso semanal</span>
                            <span className="text-sm font-black text-teal-400">{weekPlannerSnapshot.completedThisWeek}/{weekPlannerSnapshot.totalThisWeek} items ({weekPlannerSnapshot.weekProgress}%)</span>
                        </div>
                        <div className="h-2.5 bg-slate-800 rounded-full overflow-hidden">
                            <div className="h-full bg-gradient-to-r from-teal-500 to-emerald-400 rounded-full transition-all duration-700" style={{ width: `${weekPlannerSnapshot.weekProgress}%` }} />
                        </div>
                    </div>

                    {/* Day bubbles */}
                    <div className={`grid grid-cols-7 gap-2 mb-6 transition-all duration-700 delay-200 ${planVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
                        {weekPlannerSnapshot.daySummary.map((day, i) => (
                            <div key={i} className={`p-3 rounded-xl text-center border transition-all ${
                                day.isToday ? 'bg-teal-500/15 border-teal-500/30' : 'bg-slate-900/40 border-slate-800/60'
                            }`}>
                                <span className={`text-[10px] font-black uppercase block mb-1 ${day.isToday ? 'text-teal-400' : 'text-slate-500'}`}>{day.dayLabel}</span>
                                <span className={`text-lg font-black ${day.isToday ? 'text-white' : 'text-slate-400'}`}>{day.total}</span>
                                {day.done > 0 && (
                                    <span className="text-[9px] font-bold text-emerald-400 block">✓{day.done}</span>
                                )}
                            </div>
                        ))}
                    </div>

                    {/* Today's items */}
                    {weekPlannerSnapshot.todayItems.length > 0 ? (
                        <div className="space-y-2">
                            <h3 className={`text-sm font-black text-slate-300 mb-3 transition-all duration-700 delay-300 ${planVisible ? 'opacity-100' : 'opacity-0'}`}>Items de hoy:</h3>
                            {weekPlannerSnapshot.todayItems.map((item, i) => (
                                <div
                                    key={item.id || i}
                                    onClick={() => item.taskId ? openTask(item.taskId) : navigate('/planner')}
                                    className={`flex items-center gap-3 p-3 rounded-xl bg-slate-900/50 border border-slate-800/60 cursor-pointer hover:border-slate-700 transition-all duration-500
                                        ${planVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}
                                    `}
                                    style={{ transitionDelay: planVisible ? `${400 + i * 60}ms` : '0ms' }}
                                >
                                    <div className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 ${item.completed ? 'bg-emerald-600 text-white' : 'bg-slate-700 text-slate-500'}`}>
                                        {item.completed ? <CheckCircle className="w-3 h-3" /> : <ListTodo className="w-3 h-3" />}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className={`text-sm font-bold truncate ${item.completed ? 'text-slate-500 line-through' : 'text-slate-200'}`}>{item.taskTitle}</p>
                                        <span className="text-[10px] text-slate-500 font-bold">{item.projectName}</span>
                                    </div>
                                    <ChevronRight className="w-3.5 h-3.5 text-slate-600" />
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className={`text-center p-8 rounded-2xl bg-slate-900/40 border border-dashed border-slate-700 transition-all duration-500 ${planVisible ? 'opacity-100' : 'opacity-0'}`}>
                            <CalendarDays className="w-8 h-8 text-teal-500 mx-auto mb-2 opacity-50" />
                            <p className="text-sm font-bold text-slate-500">Sin items planificados para hoy</p>
                            <button onClick={() => navigate('/planner')} className="text-xs font-bold text-teal-400 hover:underline mt-2">Ir al Planner →</button>
                        </div>
                    )}
                </div>
            </section>


            {/* ═══════════════════════════════════════════════════
                SECTION 4: ESTADO DE PROYECTOS — click → project detail
            ═══════════════════════════════════════════════════ */}
            <section ref={projRef} className="py-12 px-6 relative">
                <div className="absolute inset-0 bg-gradient-to-b from-transparent via-indigo-900/5 to-transparent pointer-events-none" />
                <div className="max-w-6xl mx-auto relative">
                    <div className={`text-center mb-10 transition-all duration-700 ${projVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
                        <span className="text-xs font-black uppercase tracking-[0.2em] text-emerald-400 block mb-3">Proyectos</span>
                        <h2 className="text-3xl md:text-4xl font-black text-white mb-3">Salud de Proyectos</h2>
                        <p className="text-slate-400 text-lg max-w-2xl mx-auto">Estado actual de los proyectos activos ordenados por nivel de riesgo</p>
                    </div>

                    <div className="space-y-4">
                        {projectHealth.map((project, i) => {
                            const rc = riskColorMap[project.riskLevel] || riskColorMap.low;
                            return (
                                <div
                                    key={project.id}
                                    onClick={() => navigate(`/projects/${project.id}`)}
                                    className={`flex flex-col md:flex-row md:items-center justify-between p-5 rounded-2xl bg-slate-900/60 border border-slate-800 backdrop-blur-sm cursor-pointer
                                        hover:border-slate-700 hover:shadow-lg transition-all duration-500 gap-4
                                        ${projVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}
                                    `}
                                    style={{ transitionDelay: projVisible ? `${i * 80}ms` : '0ms' }}
                                >
                                    <div className="flex-1 min-w-0">
                                        <h4 className="font-black text-white text-base truncate">{project.name}</h4>
                                        <div className="flex items-center gap-4 mt-2">
                                            <span className="text-xs font-bold text-slate-400">{project.completedTasks}/{project.totalTasks} Tareas</span>
                                            <div className="w-32 h-2 bg-slate-800 rounded-full overflow-hidden">
                                                <div className="h-full bg-indigo-500 rounded-full transition-all duration-700" style={{ width: `${project.progress}%` }} />
                                            </div>
                                            <span className="text-xs font-black text-slate-300">{project.progress}%</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3 shrink-0">
                                        {project.overdueTasks > 0 && (
                                            <span className="text-[10px] font-black text-rose-400 bg-rose-500/10 border border-rose-500/20 px-2 py-1 rounded-lg">
                                                {project.overdueTasks} vencidas
                                            </span>
                                        )}
                                        {project.blockedTasks > 0 && (
                                            <span className="text-[10px] font-black text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-1 rounded-lg">
                                                {project.blockedTasks} bloq.
                                            </span>
                                        )}
                                        <span className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full flex items-center gap-1 border ${rc.badge}`}>
                                            {project.riskLevel === 'high' ? <Flame className="w-3 h-3" /> : project.riskLevel === 'medium' ? <AlertTriangle className="w-3 h-3" /> : <CheckCircle className="w-3 h-3" />}
                                            {project.riskLevel === 'high' ? 'Alto' : project.riskLevel === 'medium' ? 'Medio' : 'Bajo'}
                                        </span>
                                        <ChevronRight className="w-4 h-4 text-slate-600" />
                                    </div>
                                </div>
                            );
                        })}
                        {projectHealth.length === 0 && (
                            <div className={`text-center p-8 rounded-2xl bg-slate-900/40 border border-dashed border-slate-700 transition-all duration-500 ${projVisible ? 'opacity-100' : 'opacity-0'}`}>
                                <Shield className="w-8 h-8 text-emerald-500 mx-auto mb-2 opacity-50" />
                                <p className="text-sm font-bold text-slate-500">Sin proyectos activos</p>
                            </div>
                        )}
                    </div>
                    <div className={`mt-4 text-center transition-all duration-500 delay-500 ${projVisible ? 'opacity-100' : 'opacity-0'}`}>
                        <button onClick={() => navigate('/projects')} className="text-sm font-bold text-indigo-400 hover:underline flex items-center gap-1 mx-auto">
                            Ver todos los proyectos <ArrowRight className="w-4 h-4" />
                        </button>
                    </div>

                    {/* Upcoming Milestones inline */}
                    {upcomingMilestones.length > 0 && (
                        <div className={`mt-8 transition-all duration-700 delay-500 ${projVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
                            <h3 className="text-sm font-black text-slate-300 mb-4 flex items-center gap-2"><Flag className="w-4 h-4 text-amber-400" /> Próximos Hitos & Entregas</h3>
                            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-3">
                                {upcomingMilestones.slice(0, 8).map((ms, i) => {
                                    const urgency = ms.isOverdue ? 'rose' : ms.daysUntil <= 3 ? 'amber' : ms.daysUntil <= 7 ? 'orange' : 'emerald';
                                    const c = colorMap[urgency];
                                    return (
                                        <div
                                            key={ms.id}
                                            onClick={() => navigate(`/projects/${ms.projectId}`)}
                                            className="p-3 rounded-xl bg-slate-900/40 border border-slate-800/60 cursor-pointer hover:border-slate-700 transition-all"
                                        >
                                            <div className="flex items-start justify-between mb-2">
                                                <div className="min-w-0 flex-1">
                                                    <p className="text-xs font-black text-white truncate">{ms.name}</p>
                                                    <p className="text-[10px] text-slate-500 truncate">{ms.projectName}</p>
                                                </div>
                                                {ms.isProjectDeadline && <Flag className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${c.bg} ${c.border} ${c.text}`}>
                                                    {ms.isOverdue ? `${Math.abs(ms.daysUntil)}d vencido` : ms.daysUntil === 0 ? 'HOY' : `${ms.daysUntil}d restantes`}
                                                </span>
                                                <ChevronRight className="w-3 h-3 text-slate-600" />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
            </section>


            {/* ═══════════════════════════════════════════════════
                SECTION 5: ALERTAS CRÍTICAS — click → task modal or project
            ═══════════════════════════════════════════════════ */}
            <section ref={alertRef} className="py-12 px-6">
                <div className="max-w-6xl mx-auto">
                    <div className={`text-center mb-10 transition-all duration-700 ${alertVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
                        <span className="text-xs font-black uppercase tracking-[0.2em] text-rose-400 block mb-3">Alertas</span>
                        <h2 className="text-3xl md:text-4xl font-black text-white mb-3">Requiere Atención</h2>
                        <p className="text-slate-400 text-lg max-w-2xl mx-auto">Elementos que necesitan respuesta inmediata del equipo</p>
                    </div>

                    {criticalAlerts.length > 0 ? (
                        <div className="grid md:grid-cols-2 gap-4">
                            {criticalAlerts.map((alert, i) => {
                                const alertColors = {
                                    danger: { bg: 'bg-rose-500/10', border: 'border-l-rose-500', text: 'text-rose-300', icon: 'text-rose-400' },
                                    warning: { bg: 'bg-amber-500/10', border: 'border-l-amber-500', text: 'text-amber-300', icon: 'text-amber-400' },
                                    info: { bg: 'bg-slate-500/10', border: 'border-l-slate-500', text: 'text-slate-300', icon: 'text-slate-400' },
                                };
                                const ac = alertColors[alert.type] || alertColors.info;
                                const AlertIcon = alert.type === 'danger' ? AlertOctagon : alert.type === 'warning' ? AlertTriangle : Clock;

                                // Smart click: tasks open modal, projects navigate
                                const handleAlertClick = () => {
                                    if (alert.taskId) {
                                        openTask(alert.taskId);
                                    } else if (alert.projectId) {
                                        navigate(`/projects/${alert.projectId}`);
                                    }
                                };

                                return (
                                    <div
                                        key={i}
                                        onClick={handleAlertClick}
                                        className={`p-4 rounded-2xl ${ac.bg} border-l-4 ${ac.border} border border-slate-800/50 cursor-pointer
                                            hover:translate-x-1 transition-all duration-500
                                            ${alertVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}
                                        `}
                                        style={{ transitionDelay: alertVisible ? `${i * 60}ms` : '0ms' }}
                                    >
                                        <div className="flex items-start gap-3">
                                            <AlertIcon className={`w-5 h-5 ${ac.icon} shrink-0 mt-0.5`} />
                                            <div className="flex-1 min-w-0">
                                                <p className={`text-xs font-black uppercase tracking-wider ${ac.icon} mb-0.5`}>{alert.category}</p>
                                                <p className={`text-sm font-bold ${ac.text} truncate`}>{alert.title}</p>
                                                {alert.meta && (
                                                    <span className="text-[10px] font-bold text-slate-500 bg-slate-800/50 px-1.5 py-0.5 rounded mt-1.5 inline-block">{alert.meta}</span>
                                                )}
                                            </div>
                                            <ChevronRight className="w-4 h-4 text-slate-600 shrink-0 mt-1" />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className={`text-center p-12 rounded-2xl bg-slate-900/40 border border-dashed border-slate-700 transition-all duration-500 ${alertVisible ? 'opacity-100' : 'opacity-0'}`}>
                            <Shield className="w-10 h-10 text-emerald-500 mx-auto mb-3 opacity-50" />
                            <p className="text-sm font-black text-emerald-400 uppercase tracking-widest">Todo en orden</p>
                            <p className="text-xs text-slate-500 mt-1">No hay alertas críticas activas</p>
                        </div>
                    )}
                </div>
            </section>


            {/* ═══════════════════════════════════════════════════
                SECTION 5B: ACTIVE DELAYS DETAIL
            ═══════════════════════════════════════════════════ */}
            <section ref={delayRef} className="py-12 px-6">
            {activeDelaysDetail.length > 0 && (
                <div className="max-w-6xl mx-auto">
                    <div className={`text-center mb-10 transition-all duration-700 ${delayVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
                        <span className="text-xs font-black uppercase tracking-[0.2em] text-orange-400 block mb-3">Retrasos</span>
                        <h2 className="text-3xl md:text-4xl font-black text-white mb-3">🚧 Retrasos Activos</h2>
                        <p className="text-slate-400 text-lg max-w-2xl mx-auto">Demoras sin resolver: causa, duración, tarea y responsable</p>
                    </div>

                    <div className="space-y-3">
                        {activeDelaysDetail.map((delay, i) => {
                            const impactColors = {
                                critical: { bg: 'bg-rose-500/10', border: 'border-l-rose-500', badge: 'text-rose-400 bg-rose-500/15 border-rose-500/30' },
                                high: { bg: 'bg-amber-500/10', border: 'border-l-amber-500', badge: 'text-amber-400 bg-amber-500/15 border-amber-500/30' },
                                moderate: { bg: 'bg-orange-500/10', border: 'border-l-orange-500', badge: 'text-orange-400 bg-orange-500/15 border-orange-500/30' },
                            };
                            const ic = impactColors[delay.impactLevel] || impactColors.moderate;

                            return (
                                <div
                                    key={delay.id}
                                    onClick={() => delay.taskId ? openTask(delay.taskId) : navigate(`/projects/${delay.projectId}`)}
                                    className={`p-4 rounded-2xl ${ic.bg} border-l-4 ${ic.border} border border-slate-800/50 cursor-pointer
                                        hover:translate-x-1 transition-all duration-500
                                        ${delayVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}
                                    `}
                                    style={{ transitionDelay: delayVisible ? `${i * 60}ms` : '0ms' }}
                                >
                                    <div className="flex items-start gap-3">
                                        <Hourglass className="w-5 h-5 text-orange-400 shrink-0 mt-0.5" />
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap mb-1">
                                                <p className="text-sm font-black text-white truncate">{delay.taskName}</p>
                                                <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full border ${ic.badge}`}>
                                                    {delay.daysDelayed}d
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-3 text-[10px] font-bold text-slate-500">
                                                <span>📁 {delay.projectName}</span>
                                                <span>👤 {delay.ownerName}</span>
                                                <span>💡 {delay.cause}</span>
                                            </div>
                                            {delay.notes && <p className="text-[10px] text-slate-500 mt-1 line-clamp-1">{delay.notes}</p>}
                                        </div>
                                        <ChevronRight className="w-4 h-4 text-slate-600 shrink-0 mt-1" />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
            </section>


            {/* ═══════════════════════════════════════════════════
                SECTION 6: EQUIPO (leader only)
            ═══════════════════════════════════════════════════ */}
            {isLeader && (
                <section ref={teamRef} className="py-12 px-6 relative">
                    <div className="absolute inset-0 bg-gradient-to-b from-transparent via-violet-900/5 to-transparent pointer-events-none" />
                    <div className="max-w-6xl mx-auto relative">
                        <div className={`text-center mb-10 transition-all duration-700 ${teamVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
                            <span className="text-xs font-black uppercase tracking-[0.2em] text-sky-400 block mb-3">Equipo</span>
                            <h2 className="text-3xl md:text-4xl font-black text-white mb-3">Estado del Equipo</h2>
                            <p className="text-slate-400 text-lg max-w-2xl mx-auto">Carga de trabajo, bloqueos y actividad diaria por miembro</p>
                        </div>

                        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
                            {teamOverview.map((member, i) => (
                                <div
                                    key={member.uid}
                                    onClick={() => navigate('/team')}
                                    className={`group p-5 rounded-2xl bg-slate-900/60 border border-slate-800 backdrop-blur-sm transition-all duration-500 hover:border-slate-700 hover:shadow-lg cursor-pointer
                                        ${teamVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}
                                    `}
                                    style={{ transitionDelay: teamVisible ? `${i * 80}ms` : '0ms' }}
                                >
                                    <div className="flex items-center gap-3 mb-4">
                                        <div className="w-10 h-10 rounded-full bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center font-black text-sm text-indigo-400 shrink-0">
                                            {member.name[0]?.toUpperCase() || '?'}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <p className="text-sm font-black text-white truncate">{member.name}</p>
                                            <p className="text-[10px] font-bold text-slate-500 uppercase">{ROLE_LABELS[member.teamRole] || member.teamRole}</p>
                                        </div>
                                        <span className={`text-[9px] font-black uppercase px-2 py-1 rounded-full border ${
                                            member.loadLevel === 'overloaded' ? 'text-rose-400 bg-rose-500/10 border-rose-500/30' :
                                            member.loadLevel === 'heavy' ? 'text-amber-400 bg-amber-500/10 border-amber-500/30' :
                                            member.loadLevel === 'low' ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30' :
                                            'text-indigo-400 bg-indigo-500/10 border-indigo-500/30'
                                        }`}>
                                            {getLoadLabel(member.loadLevel)}
                                        </span>
                                    </div>

                                    <div className="mb-3">
                                        <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                                            <div
                                                className={`h-full rounded-full transition-all duration-700 ${getLoadColor(member.loadLevel)}`}
                                                style={{ width: `${Math.min((member.totalAssigned / 10) * 100, 100)}%` }}
                                            />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-4 gap-2">
                                        {[
                                            { label: 'Asign.', value: member.totalAssigned, color: 'text-slate-300' },
                                            { label: 'Activ.', value: member.inProgress, color: 'text-indigo-400' },
                                            { label: 'Bloq.', value: member.blocked, color: member.blocked > 0 ? 'text-rose-400' : 'text-slate-500' },
                                            { label: 'Horas', value: member.hoursToday, color: 'text-blue-400' },
                                        ].map((s, j) => (
                                            <div key={j} className="text-center">
                                                <span className={`block text-lg font-black ${s.color}`}>{s.value}</span>
                                                <span className="text-[9px] font-bold text-slate-500 uppercase">{s.label}</span>
                                            </div>
                                        ))}
                                    </div>

                                    {member.overdue > 0 && (
                                        <div className="mt-3 text-[10px] font-bold text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-lg px-2.5 py-1.5 flex items-center gap-1.5">
                                            <AlertTriangle className="w-3 h-3" /> {member.overdue} tareas vencidas
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                        {teamOverview.length === 0 && (
                            <p className={`text-sm text-slate-500 text-center py-6 transition-all duration-500 ${teamVisible ? 'opacity-100' : 'opacity-0'}`}>No hay miembros del equipo registrados.</p>
                        )}
                    </div>
                </section>
            )}




            {/* ═══════════════════════════════════════════════════
                SECTION 6B: DAILY SCRUM OVERVIEW — per-person status
            ═══════════════════════════════════════════════════ */}
            <section ref={scrumRef} className="py-12 px-6">
            {isLeader && dailyScrum.data.length > 0 && (
                    <div className="max-w-6xl mx-auto">
                        <div className={`text-center mb-10 transition-all duration-700 ${scrumVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
                            <span className="text-xs font-black uppercase tracking-[0.2em] text-purple-400 block mb-3">Daily Scrum</span>
                            <h2 className="text-3xl md:text-4xl font-black text-white mb-3">Equipo Hoy</h2>
                            <p className="text-slate-400 text-lg max-w-2xl mx-auto">Estado operativo de cada miembro: tareas, reportes, bloqueos</p>
                        </div>

                        {/* Summary strip */}
                        <div className={`grid grid-cols-2 md:grid-cols-5 gap-3 mb-6 transition-all duration-700 delay-100 ${scrumVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
                            {[
                                { label: 'Total', value: dailyScrum.summary.total, color: 'indigo', icon: Users },
                                { label: 'OK', value: dailyScrum.summary.ok, color: 'emerald', icon: CheckCircle2 },
                                { label: 'Sin Tareas', value: dailyScrum.summary.sin_tareas, color: 'amber', icon: Activity, alert: dailyScrum.summary.sin_tareas > 0 },
                                { label: 'Sin Reporte', value: dailyScrum.summary.sin_reporte, color: 'rose', icon: AlertTriangle, alert: dailyScrum.summary.sin_reporte > 0 },
                                { label: 'Bloqueados', value: dailyScrum.summary.bloqueado, color: 'rose', icon: Shield, alert: dailyScrum.summary.bloqueado > 0 },
                            ].map((s, i) => {
                                const c = colorMap[s.color];
                                const SIcon = s.icon;
                                return (
                                    <div key={i} className={`p-3 rounded-2xl border backdrop-blur-sm ${s.alert ? `${c.bg} ${c.border}` : 'bg-slate-900/40 border-slate-800/60'}`}>
                                        <div className="flex items-center gap-2 mb-1">
                                            <SIcon className={`w-4 h-4 ${c.text}`} />
                                            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">{s.label}</span>
                                        </div>
                                        <span className={`text-2xl font-black ${s.alert ? c.text : 'text-white'}`}>{s.value}</span>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Person status cards (condensed) */}
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                            {dailyScrum.data.map((person, i) => {
                                const cfg = person.statusConfig;
                                const initials = (person.displayName || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

                                const statusBorderClasses = {
                                    ok: 'border-l-emerald-500',
                                    sin_tareas: 'border-l-amber-500',
                                    sin_reporte: 'border-l-red-500',
                                    bloqueado: 'border-l-red-500',
                                    sin_plan: 'border-l-orange-500',
                                };

                                return (
                                    <div
                                        key={person.uid}
                                        onClick={() => navigate('/daily-scrum')}
                                        className={`p-3 rounded-xl bg-slate-900/60 border border-slate-800 border-l-[3px] ${statusBorderClasses[person.status] || 'border-l-slate-600'}
                                            cursor-pointer hover:border-slate-700 hover:shadow-md transition-all duration-500
                                            ${scrumVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}
                                        `}
                                        style={{ transitionDelay: scrumVisible ? `${200 + i * 50}ms` : '0ms' }}
                                    >
                                        <div className="flex items-center gap-2 mb-2">
                                            <div className="w-7 h-7 rounded-lg bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-[10px] font-black text-indigo-400 shrink-0">
                                                {initials}
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <p className="text-xs font-bold text-white truncate">{person.displayName}</p>
                                            </div>
                                            <div className="px-1.5 py-0.5 rounded-md text-[8px] font-black uppercase"
                                                style={{ background: cfg.bgColor, border: `1px solid ${cfg.borderColor}`, color: cfg.color }}>
                                                {cfg.emoji}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3 text-[10px] font-bold">
                                            <span className="text-slate-500"><ListTodo className="w-3 h-3 inline mr-0.5" />{person.todayTasks.length} hoy</span>
                                            {person.blockers.length > 0 && (
                                                <span className="text-rose-400"><AlertOctagon className="w-3 h-3 inline mr-0.5" />{person.blockers.length}</span>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        <div className={`mt-5 text-center transition-all duration-500 delay-700 ${scrumVisible ? 'opacity-100' : 'opacity-0'}`}>
                            <button onClick={() => navigate('/daily-scrum')} className="text-sm font-bold text-purple-400 hover:underline flex items-center gap-1 mx-auto">
                                <Eye className="w-4 h-4" /> Ver Daily Scrum completo <ArrowRight className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
            )}
            </section>




            {/* ═══════════════════════════════════════════════════
                SECTION 7: DISCIPLINA OPERATIVA + RIESGOS
            ═══════════════════════════════════════════════════ */}
            <section className="py-12 px-6">
                <div className="max-w-6xl mx-auto grid lg:grid-cols-2 gap-8">

                    {/* Discipline — items clickable */}
                    <div ref={discRef}>
                        <div className={`transition-all duration-700 ${discVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
                            <span className="text-xs font-black uppercase tracking-[0.2em] text-amber-400 block mb-3">Disciplina</span>
                            <h2 className="text-2xl font-black text-white mb-6">Cumplimiento del Día</h2>
                        </div>

                        <div className={`p-6 rounded-2xl bg-slate-900/60 border border-slate-800 backdrop-blur-sm transition-all duration-700 delay-200 ${discVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
                            <div className="flex items-center gap-6 mb-6">
                                <div className="relative w-20 h-20">
                                    <svg className="w-20 h-20 -rotate-90" viewBox="0 0 80 80">
                                        <circle cx="40" cy="40" r="34" fill="none" stroke="rgba(100,116,139,0.2)" strokeWidth="6" />
                                        <circle cx="40" cy="40" r="34" fill="none"
                                            stroke={discipline.score >= 75 ? '#22c55e' : discipline.score >= 50 ? '#f59e0b' : '#ef4444'}
                                            strokeWidth="6" strokeLinecap="round"
                                            strokeDasharray={`${discipline.score * 2.14} 214`}
                                            className="transition-all duration-1000"
                                        />
                                    </svg>
                                    <span className="absolute inset-0 flex items-center justify-center text-lg font-black text-white">{discipline.score}%</span>
                                </div>
                                <div>
                                    <p className="text-sm font-bold text-slate-300">Compliance Score</p>
                                    <p className="text-xs text-slate-500">
                                        {discipline.score >= 75 ? '¡Excelente disciplina hoy!' : discipline.score >= 50 ? 'Falta completar registros.' : 'Varios pendientes críticos.'}
                                    </p>
                                </div>
                            </div>

                            <div className="space-y-3">
                                {discipline.items.map((item, i) => {
                                    const discNavMap = { time: '/work-logs', plan: '/planner', tasks: '/my-work', weekPlan: '/planner' };
                                    return (
                                        <div
                                            key={item.key}
                                            onClick={() => !item.done && navigate(discNavMap[item.key] || '/my-work')}
                                            className={`flex items-center gap-3 p-3 rounded-xl transition-all duration-500 ${
                                                !item.done ? 'cursor-pointer hover:bg-slate-800/70' : ''
                                            } ${
                                                item.done ? 'bg-emerald-500/5 border border-emerald-500/10' : 'bg-slate-800/40 border border-slate-700/30'
                                            } ${discVisible ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-4'}`}
                                            style={{ transitionDelay: discVisible ? `${300 + i * 100}ms` : '0ms' }}
                                        >
                                            <div className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ${
                                                item.done ? 'bg-emerald-600 text-white' : 'bg-slate-700 text-slate-500'
                                            }`}>
                                                {item.done ? <CheckCircle className="w-3.5 h-3.5" /> : <Clock className="w-3.5 h-3.5" />}
                                            </div>
                                            <span className={`text-sm font-bold flex-1 ${item.done ? 'text-emerald-300' : 'text-slate-400'}`}>{item.label}</span>
                                            {item.done && <span className="text-[10px] font-black text-emerald-500 uppercase">Listo</span>}
                                            {!item.done && <ArrowRight className="w-3.5 h-3.5 text-slate-600" />}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    {/* Top Risks — click → project detail */}
                    <div ref={riskRef}>
                        <div className={`transition-all duration-700 ${riskVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
                            <span className="text-xs font-black uppercase tracking-[0.2em] text-rose-400 block mb-3">Riesgos</span>
                            <h2 className="text-2xl font-black text-white mb-6">Top Riesgos del Día</h2>
                        </div>

                        <div className={`p-6 rounded-2xl bg-slate-900/60 border border-slate-800 backdrop-blur-sm transition-all duration-700 delay-200 ${riskVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
                            {topRisks.length > 0 ? (
                                <div className="space-y-4">
                                    {topRisks.map((risk, i) => {
                                        const rc = riskColorMap[risk.riskLevel] || riskColorMap.low;
                                        const maxScore = 100;
                                        const barPct = Math.min((risk.riskScore / maxScore) * 100, 100);
                                        return (
                                            <div
                                                key={risk.projectId}
                                                onClick={() => navigate(`/projects/${risk.projectId}`)}
                                                className={`cursor-pointer p-4 rounded-xl bg-slate-800/40 border border-slate-700/30 hover:border-slate-600 transition-all duration-500
                                                    ${riskVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}
                                                `}
                                                style={{ transitionDelay: riskVisible ? `${300 + i * 80}ms` : '0ms' }}
                                            >
                                                <div className="flex items-center justify-between mb-2">
                                                    <h4 className="font-black text-sm text-white truncate flex-1">{risk.projectName}</h4>
                                                    <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full border ${rc.badge} ml-2`}>
                                                        Score: {risk.riskScore}
                                                    </span>
                                                </div>
                                                <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden mb-2">
                                                    <div className={`h-full rounded-full transition-all duration-700 ${rc.bar}`} style={{ width: `${barPct}%` }} />
                                                </div>
                                                {risk.riskFactors.length > 0 && (
                                                    <p className="text-[10px] text-slate-500 leading-relaxed line-clamp-2">{risk.riskFactors.map(f => typeof f === 'string' ? f : (f?.factor || f?.label || f?.name || '')).filter(Boolean).join(' · ')}</p>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="text-center py-8">
                                    <CheckCircle className="w-8 h-8 text-emerald-500 mx-auto mb-2 opacity-50" />
                                    <p className="text-sm font-bold text-emerald-400">Sin riesgos detectados</p>
                                    <p className="text-xs text-slate-500 mt-1">Todos los proyectos están estables</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </section>


            {/* ═══════════════════════════════════════════════════
                SECTION 7B: RECENT ACTIVITY FEED
            ═══════════════════════════════════════════════════ */}
            <section ref={feedRef} className="py-12 px-6">
            {recentActivity.length > 0 && (
                <div className="max-w-6xl mx-auto">
                    <div className={`text-center mb-10 transition-all duration-700 ${feedVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
                        <span className="text-xs font-black uppercase tracking-[0.2em] text-cyan-400 block mb-3">Actividad</span>
                        <h2 className="text-3xl md:text-4xl font-black text-white mb-3">📊 Actividad Reciente</h2>
                        <p className="text-slate-400 text-lg max-w-2xl mx-auto">Últimos eventos de la plataforma — auditoría en tiempo real</p>
                    </div>

                    <div className="relative">
                        {/* Timeline line */}
                        <div className="absolute left-5 top-0 bottom-0 w-px bg-slate-800" />

                        <div className="space-y-3">
                            {recentActivity.map((event, i) => {
                                const eventIcons = { task: ListTodo, time: Clock, delay: Hourglass, risk: Shield, project: FolderGit2 };
                                const EIcon = eventIcons[event.entityType] || History;
                                const severityColors = {
                                    warning: 'text-amber-400 bg-amber-500/15 border-amber-500/30',
                                    error: 'text-rose-400 bg-rose-500/15 border-rose-500/30',
                                    info: 'text-cyan-400 bg-cyan-500/15 border-cyan-500/30',
                                };
                                const sc = severityColors[event.severity] || severityColors.info;

                                return (
                                    <div
                                        key={event.id || i}
                                        className={`flex items-start gap-3 pl-2 transition-all duration-500 ${feedVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
                                        style={{ transitionDelay: feedVisible ? `${i * 50}ms` : '0ms' }}
                                    >
                                        <div className={`w-7 h-7 rounded-lg border flex items-center justify-center shrink-0 z-10 ${sc}`}>
                                            <EIcon className="w-3.5 h-3.5" />
                                        </div>
                                        <div className="flex-1 p-3 rounded-xl bg-slate-900/40 border border-slate-800/60">
                                            <div className="flex items-center justify-between">
                                                <p className="text-xs font-bold text-slate-200">{event.title}</p>
                                                <span className="text-[9px] text-slate-500">{event.timestamp ? new Date(event.timestamp).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' }) : ''}</span>
                                            </div>
                                            <div className="flex items-center gap-2 mt-1">
                                                {event.detail && <span className="text-[10px] text-slate-500">{event.detail}</span>}
                                                <span className="text-[10px] text-slate-600">• {event.user}</span>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    <div className={`mt-5 text-center transition-all duration-500 delay-700 ${feedVisible ? 'opacity-100' : 'opacity-0'}`}>
                        <button onClick={() => navigate('/audit')} className="text-sm font-bold text-cyan-400 hover:underline flex items-center gap-1 mx-auto">
                            <Eye className="w-4 h-4" /> Ver auditoría completa <ArrowRight className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            )}
            </section>


            {/* ═══════════════════════════════════════════════════
                SECTION 7C: NOTIFICATIONS INBOX
            ═══════════════════════════════════════════════════ */}
            <section ref={notifRef} className="py-12 px-6">
            {notifications.length > 0 && (
                <div className="max-w-6xl mx-auto">
                    <div className={`text-center mb-8 transition-all duration-700 ${notifVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
                        <span className="text-xs font-black uppercase tracking-[0.2em] text-violet-400 block mb-3">Inbox</span>
                        <h2 className="text-3xl md:text-4xl font-black text-white mb-3">
                            <Bell className="w-8 h-8 inline-block mr-2 text-violet-400" />
                            Notificaciones
                        </h2>
                        <p className="text-slate-400 text-lg max-w-2xl mx-auto">Últimas asignaciones, menciones y actualizaciones</p>
                    </div>

                    <div className="space-y-2">
                        {notifications.filter(n => !n.read).length > 0 && (
                            <div className={`flex items-center justify-between mb-3 transition-all duration-500 ${notifVisible ? 'opacity-100' : 'opacity-0'}`}>
                                <span className="text-sm font-black text-violet-400">{notifications.filter(n => !n.read).length} sin leer</span>
                                <button onClick={() => navigate('/notifications')} className="text-xs font-bold text-slate-500 hover:text-slate-300 transition-colors">Ver todas →</button>
                            </div>
                        )}
                        {notifications.slice(0, 5).map((notif, i) => (
                            <div
                                key={notif.id}
                                onClick={() => {
                                    if (notif.link) navigate(notif.link);
                                    else if (notif.taskId) openTask(notif.taskId);
                                    else navigate('/notifications');
                                }}
                                className={`flex items-start gap-3 p-3 rounded-xl cursor-pointer transition-all duration-500
                                    ${notif.read ? 'bg-slate-900/30 border border-slate-800/40' : 'bg-violet-500/5 border border-violet-500/20 hover:border-violet-500/40'}
                                    hover:bg-slate-900/50
                                    ${notifVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}
                                `}
                                style={{ transitionDelay: notifVisible ? `${i * 60}ms` : '0ms' }}
                            >
                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                                    notif.read ? 'bg-slate-800 text-slate-500' : 'bg-violet-500/15 border border-violet-500/30 text-violet-400'
                                }`}>
                                    {!notif.read && <div className="w-1.5 h-1.5 rounded-full bg-violet-400 absolute -top-0.5 -right-0.5" />}
                                    <Bell className="w-3.5 h-3.5" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className={`text-xs font-bold truncate ${notif.read ? 'text-slate-500' : 'text-slate-200'}`}>{notif.title || notif.message || 'Notificación'}</p>
                                    <div className="flex items-center gap-2 mt-0.5">
                                        {notif.body && <span className="text-[10px] text-slate-500 truncate">{notif.body}</span>}
                                        <span className="text-[9px] text-slate-600">{notif.createdAt ? new Date(notif.createdAt?.seconds ? notif.createdAt.seconds * 1000 : notif.createdAt).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' }) : ''}</span>
                                    </div>
                                </div>
                                <ChevronRight className="w-3.5 h-3.5 text-slate-600 shrink-0 mt-2" />
                            </div>
                        ))}
                    </div>
                </div>
            )}
            </section>


            {/* ═══════════════════════════════════════════════════
                SECTION 8: QUICK ACTIONS
            ═══════════════════════════════════════════════════ */}
            <section ref={actRef} className="py-16 px-6">
                <div className="max-w-6xl mx-auto">
                    <div className={`text-center mb-10 transition-all duration-700 ${actVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
                        <span className="text-xs font-black uppercase tracking-[0.2em] text-indigo-400 block mb-3">Acciones</span>
                        <h2 className="text-3xl md:text-4xl font-black text-white mb-3">Acciones Rápidas</h2>
                        <p className="text-slate-400 text-lg max-w-2xl mx-auto">Navega directamente a los módulos que necesitas</p>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                        {quickActions.map((action, i) => {
                            const c = colorMap[action.color];
                            const Icon = ACTION_ICONS[action.key] || Activity;
                            return (
                                <button
                                    key={action.key}
                                    onClick={() => navigate(action.path)}
                                    className={`group relative text-left p-5 rounded-2xl bg-slate-900/60 border border-slate-800 backdrop-blur-sm
                                        transition-all duration-500 hover:border-slate-700 hover:shadow-lg hover:scale-[1.02] active:scale-[0.98]
                                        ${actVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}
                                    `}
                                    style={{ transitionDelay: actVisible ? `${i * 50}ms` : '0ms' }}
                                >
                                    <div className={`w-11 h-11 rounded-xl ${c.bg} border ${c.border} flex items-center justify-center mb-3 transition-transform duration-300 group-hover:scale-110`}>
                                        <Icon className={`w-5 h-5 ${c.text}`} />
                                    </div>
                                    <h3 className="font-black text-white text-sm">{action.label}</h3>
                                    <ArrowRight className={`w-4 h-4 ${c.text} mt-2 opacity-0 group-hover:opacity-100 transition-all duration-300 transform group-hover:translate-x-1`} />
                                </button>
                            );
                        })}
                    </div>
                </div>
            </section>


            {/* ═══ CSS ANIMATIONS ═══ */}
            <style>{`
                @keyframes orbit-float {
                    0%, 100% { transform: translate(-50%, -50%) translateY(0px); }
                    50% { transform: translate(-50%, -50%) translateY(-12px); }
                }
            `}</style>
        </div>
    );
}
