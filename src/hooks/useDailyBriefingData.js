/**
 * useDailyBriefingData
 * ====================
 * Composition hook for the Daily Briefing page.
 * Aggregates data from useEngineeringData, useAuth, useRole
 * and derives daily-specific operational metrics.
 *
 * NO new Firestore subscriptions — only reuses existing data.
 *
 * @module hooks/useDailyBriefingData
 */

import { useMemo, useState, useEffect } from 'react';
import { format, startOfWeek, endOfWeek, parseISO, isBefore, startOfDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { getDaysUntil, parseLocalDate } from '../utils/dateUtils';
import { useEngineeringData } from './useEngineeringData';
import { useAuth } from '../contexts/AuthContext';
import { useRole } from '../contexts/RoleContext';
import { plannerService } from '../services/plannerService';
import { TASK_PRIORITY } from '../models/schemas';
import { buildDailyScrumData, buildSummary } from '../core/dailyScrum/dailyScrumEngine';
import { getActiveAssignments } from '../services/resourceAssignmentService';
import { fetchAuditHistory } from '../services/auditPersistence';
import { subscribeToNotifications } from '../services/notificationService';
import { getActiveTeamMembers } from '../utils/teamFilters';

const URGENT_PRIORITIES = [TASK_PRIORITY.CRITICAL, TASK_PRIORITY.HIGH];

// Greeting helper
function getGreeting() {
    const h = new Date().getHours();
    if (h < 12) return 'Buenos días';
    if (h < 19) return 'Buenas tardes';
    return 'Buenas noches';
}

/**
 * Determine effective role for visibility decisions.
 * manager / team_lead → 'leader' (sees team blocks)
 * engineer / technician → 'individual' (personal focus only)
 * admin → 'leader'
 */
function getEffectiveRole(teamRole, rbacRole) {
    if (rbacRole === 'admin') return 'leader';
    if (['manager', 'team_lead'].includes(teamRole)) return 'leader';
    return 'individual';
}

export function useDailyBriefingData() {
    const {
        engProjects, engTasks, engSubtasks, teamMembers,
        timeLogs, delays, delayCauses, isReady,
    } = useEngineeringData();
    const { user } = useAuth();
    const { role: rbacRole, isAdmin } = useRole();

    const userId = user?.uid;
    const now = new Date();
    const todayStr = format(now, 'yyyy-MM-dd');

    // Week boundaries
    const weekStart = startOfWeek(now, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
    const weekStartStr = format(weekStart, 'yyyy-MM-dd');
    const weekEndStr = format(weekEnd, 'yyyy-MM-dd');

    // ── Fetch weekly plan items (same pattern as MyWork) ──
    const [weekPlanItems, setWeekPlanItems] = useState([]);
    useEffect(() => {
        plannerService.getWeeklyPlanItems(weekStartStr)
            .then(setWeekPlanItems)
            .catch(console.error);
    }, [weekStartStr]);

    // ── Fetch active assignments for Daily Scrum ──
    const [assignments, setAssignments] = useState([]);
    useEffect(() => {
        getActiveAssignments()
            .then(setAssignments)
            .catch(console.error);
    }, []);

    // ── Resolve user info ──
    const currentTeamMember = useMemo(() =>
        teamMembers.find(m => m.uid === userId),
    [teamMembers, userId]);

    const teamRole = currentTeamMember?.teamRole || '';
    const effectiveRole = getEffectiveRole(teamRole, rbacRole);
    const isLeader = effectiveRole === 'leader';

    const userName = user?.displayName?.split(' ')[0] || user?.email?.split('@')[0] || '';

    // ── Greeting data ──
    const greeting = useMemo(() => ({
        text: getGreeting(),
        userName,
        dateLabel: format(now, "EEEE, d 'de' MMMM yyyy", { locale: es }),
        teamRole: currentTeamMember?.teamRole || rbacRole || 'engineer',
        effectiveRole,
    }), [userName, currentTeamMember, rbacRole, effectiveRole]);

    // ═══════════════════════════════════════════════════════
    // SECTION 1: Quick KPIs
    // ═══════════════════════════════════════════════════════
    const kpis = useMemo(() => {
        const activeProjects = engProjects.filter(p => !['completed', 'on_hold', 'cancelled'].includes(p.status));
        const projectsAtRisk = engProjects.filter(p => p.riskLevel === 'high' || p.riskLevel === 'medium');
        const activeTasks = engTasks.filter(t => !['completed', 'cancelled'].includes(t.status));
        const blockedTasks = activeTasks.filter(t => t.status === 'blocked');
        const activeDelays = delays?.filter(d => !d.resolved).length || 0;

        const todayLogs = timeLogs?.filter(log => log.startTime?.startsWith(todayStr)) || [];
        const todayHours = todayLogs.reduce((acc, log) => acc + (log.totalHours || 0), 0);
        const todayOvertime = todayLogs.reduce((acc, log) => acc + (log.overtimeHours || 0), 0);

        // My personal KPIs
        const myActiveTasks = activeTasks.filter(t => t.assignedTo === userId);
        const myOverdue = myActiveTasks.filter(t => t.dueDate && getDaysUntil(t.dueDate) < 0);
        const myBlocked = myActiveTasks.filter(t => t.status === 'blocked');
        const myInProgress = myActiveTasks.filter(t => t.status === 'in_progress');

        return {
            totalActiveProjects: activeProjects.length,
            projectsAtRisk: projectsAtRisk.length,
            totalActiveTasks: activeTasks.length,
            blockedTasks: blockedTasks.length,
            activeDelays,
            todayHours: parseFloat(todayHours.toFixed(1)),
            todayOvertime: parseFloat(todayOvertime.toFixed(1)),
            myActiveTasks: myActiveTasks.length,
            myOverdue: myOverdue.length,
            myBlocked: myBlocked.length,
            myInProgress: myInProgress.length,
        };
    }, [engProjects, engTasks, timeLogs, delays, todayStr, userId]);

    // ═══════════════════════════════════════════════════════
    // SECTION 2: Mi Foco del Día
    // ═══════════════════════════════════════════════════════
    const myFocus = useMemo(() => {
        if (!userId) return { overdue: [], blocked: [], inProgress: [], urgent: [], upcoming: [] };

        const myActive = engTasks
            .filter(t => t.assignedTo === userId && !['completed', 'cancelled'].includes(t.status))
            .map(t => {
                const project = engProjects.find(p => p.id === t.projectId);
                return { ...t, projectName: project?.name || '—' };
            });

        const overdue = myActive.filter(t => t.dueDate && getDaysUntil(t.dueDate) < 0);
        const blocked = myActive.filter(t => t.status === 'blocked');
        const inProgress = myActive.filter(t => t.status === 'in_progress');
        const urgent = myActive.filter(t => URGENT_PRIORITIES.includes(t.priority) && t.status !== 'blocked');

        // Upcoming: due within next 3 days, not overdue
        const threeDays = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
        const upcoming = myActive.filter(t =>
            t.dueDate &&
            getDaysUntil(t.dueDate) >= 0 &&
            isBefore(parseLocalDate(t.dueDate), threeDays) &&
            t.status !== 'blocked'
        );

        return { overdue, blocked, inProgress, urgent, upcoming };
    }, [engTasks, engProjects, userId]);

    // ═══════════════════════════════════════════════════════
    // SECTION 3: Estado de Proyectos
    // ═══════════════════════════════════════════════════════
    const projectHealth = useMemo(() => {
        return engProjects
            .filter(p => !['completed', 'cancelled'].includes(p.status))
            .map(project => {
                const projectTasks = engTasks.filter(t => t.projectId === project.id);
                const completed = projectTasks.filter(t => t.status === 'completed').length;
                const total = projectTasks.length;
                const progress = total > 0 ? Math.round((completed / total) * 100) : 0;
                const blocked = projectTasks.filter(t => t.status === 'blocked').length;
                const overdue = projectTasks.filter(t =>
                    t.dueDate && getDaysUntil(t.dueDate) < 0 && t.status !== 'completed'
                ).length;

                return {
                    ...project,
                    progress,
                    completedTasks: completed,
                    totalTasks: total,
                    blockedTasks: blocked,
                    overdueTasks: overdue,
                };
            })
            .sort((a, b) => {
                // Sort: high risk first, then medium, then low
                const riskOrder = { high: 0, medium: 1, low: 2 };
                return (riskOrder[a.riskLevel] ?? 2) - (riskOrder[b.riskLevel] ?? 2);
            })
            .slice(0, 6);
    }, [engProjects, engTasks]);

    // ═══════════════════════════════════════════════════════
    // SECTION 4: Alertas Críticas
    // ═══════════════════════════════════════════════════════
    const criticalAlerts = useMemo(() => {
        const alerts = [];

        // Blocked tasks
        engTasks.filter(t => t.status === 'blocked').forEach(t => {
            const project = engProjects.find(p => p.id === t.projectId);
            alerts.push({
                type: 'danger', category: 'Tarea Bloqueada',
                title: t.title, meta: project?.name || '',
                taskId: t.id, projectId: t.projectId,
                time: t.updatedAt || t.createdAt,
            });
        });

        // Unreported delays
        if (delays) {
            delays.filter(d => !d.resolved).forEach(d => {
                const project = engProjects.find(p => p.id === d.projectId);
                alerts.push({
                    type: 'warning', category: 'Retraso Activo',
                    title: d.causeName || d.cause || 'Sin causa',
                    meta: project?.name || '',
                    taskId: d.taskId, projectId: d.projectId,
                    delayId: d.id,
                    time: d.createdAt,
                });
            });
        }

        // High-risk projects
        engProjects.filter(p => p.riskLevel === 'high').forEach(p => {
            alerts.push({
                type: 'warning', category: 'Proyecto en Alto Riesgo',
                title: p.name, meta: `Score: ${p.riskScore || 0}`,
                projectId: p.id,
                time: p.riskUpdatedAt || p.updatedAt,
            });
        });

        // Overdue tasks (globally, not just user's)
        engTasks.filter(t =>
            t.dueDate && getDaysUntil(t.dueDate) < 0
            && !['completed', 'cancelled'].includes(t.status)
        ).slice(0, 5).forEach(t => {
            const project = engProjects.find(p => p.id === t.projectId);
            if (!alerts.some(a => a.taskId === t.id)) {
                alerts.push({
                    type: 'info', category: 'Tarea Vencida',
                    title: t.title, meta: project?.name || '',
                    taskId: t.id, projectId: t.projectId,
                    time: t.dueDate,
                });
            }
        });

        return alerts.sort((a, b) => {
            const typePriority = { danger: 0, warning: 1, info: 2 };
            return (typePriority[a.type] ?? 2) - (typePriority[b.type] ?? 2);
        }).slice(0, 10);
    }, [engTasks, engProjects, delays]);

    // ═══════════════════════════════════════════════════════
    // SECTION 5: Equipo (leader only)
    // ═══════════════════════════════════════════════════════
    const teamOverview = useMemo(() => {
        if (!isLeader) return [];

        return getActiveTeamMembers(teamMembers, engTasks, timeLogs)
            .map(member => {
                const memberTasks = engTasks.filter(t =>
                    t.assignedTo === member.uid && !['completed', 'cancelled'].includes(t.status)
                );
                const inProgress = memberTasks.filter(t => t.status === 'in_progress').length;
                const blocked = memberTasks.filter(t => t.status === 'blocked').length;
                const overdue = memberTasks.filter(t =>
                    t.dueDate && getDaysUntil(t.dueDate) < 0 && t.status !== 'completed'
                ).length;

                // Today's hours for this member
                const memberTodayLogs = timeLogs?.filter(log =>
                    log.userId === member.uid && log.startTime?.startsWith(todayStr)
                ) || [];
                const hoursToday = memberTodayLogs.reduce((acc, log) => acc + (log.totalHours || 0), 0);

                let loadLevel = 'normal';
                if (memberTasks.length > 8) loadLevel = 'overloaded';
                else if (memberTasks.length > 5) loadLevel = 'heavy';
                else if (memberTasks.length < 2) loadLevel = 'low';

                return {
                    uid: member.uid,
                    name: member.displayName || member.email || '?',
                    teamRole: member.teamRole || 'engineer',
                    totalAssigned: memberTasks.length,
                    inProgress, blocked, overdue,
                    hoursToday: parseFloat(hoursToday.toFixed(1)),
                    loadLevel,
                };
            })
            .sort((a, b) => b.totalAssigned - a.totalAssigned);
    }, [isLeader, teamMembers, engTasks, timeLogs, todayStr]);

    // ═══════════════════════════════════════════════════════
    // SECTION 6: Disciplina Operativa
    // ═══════════════════════════════════════════════════════
    const discipline = useMemo(() => {
        if (!userId) return { items: [], score: 0 };

        // Time logged today?
        const myTodayLogs = timeLogs?.filter(log =>
            log.userId === userId && log.startTime?.startsWith(todayStr)
        ) || [];
        const timeLoggedToday = myTodayLogs.length > 0;

        // Plan filled for today?
        const todayPlanItems = weekPlanItems.filter(pi =>
            pi.date === todayStr && pi.assignedTo === userId
        );
        const planFilledToday = todayPlanItems.length > 0;

        // Any tasks updated today?
        const taskUpdatedToday = engTasks.some(t =>
            t.assignedTo === userId &&
            t.updatedAt?.startsWith(todayStr)
        );

        // Week plan exists for this week?
        const myWeekPlan = weekPlanItems.filter(pi => pi.assignedTo === userId);
        const weekPlanFilled = myWeekPlan.length > 0;

        const items = [
            { label: 'Horas registradas hoy', done: timeLoggedToday, key: 'time' },
            { label: 'Plan del día completado', done: planFilledToday, key: 'plan' },
            { label: 'Tareas actualizadas hoy', done: taskUpdatedToday, key: 'tasks' },
            { label: 'Plan semanal cargado', done: weekPlanFilled, key: 'weekPlan' },
        ];

        const doneCount = items.filter(i => i.done).length;
        const score = Math.round((doneCount / items.length) * 100);

        return { items, score };
    }, [userId, timeLogs, todayStr, weekPlanItems, engTasks]);

    // ═══════════════════════════════════════════════════════
    // SECTION 7: Riesgos del Día
    // ═══════════════════════════════════════════════════════
    const topRisks = useMemo(() => {
        return engProjects
            .filter(p => (p.riskScore || 0) > 0 && !['completed', 'cancelled'].includes(p.status))
            .sort((a, b) => (b.riskScore || 0) - (a.riskScore || 0))
            .slice(0, 5)
            .map(p => ({
                projectId: p.id,
                projectName: p.name,
                riskScore: p.riskScore || 0,
                riskLevel: p.riskLevel || 'low',
                riskFactors: p.riskFactors || [],
                riskSummary: p.riskSummary || '',
            }));
    }, [engProjects]);

    // ═══════════════════════════════════════════════════════
    // SECTION 7B: Time Tracking Snapshot
    // ═══════════════════════════════════════════════════════
    const timeSnapshot = useMemo(() => {
        const myTodayLogs = timeLogs?.filter(log => log.userId === userId && log.startTime?.startsWith(todayStr)) || [];
        const myWeekLogs = timeLogs?.filter(log => {
            if (log.userId !== userId) return false;
            const logDate = log.startTime?.substring(0, 10);
            return logDate >= weekStartStr && logDate <= weekEndStr;
        }) || [];

        const todayHours = myTodayLogs.reduce((s, l) => s + (l.totalHours || 0), 0);
        const weekHours = myWeekLogs.reduce((s, l) => s + (l.totalHours || 0), 0);
        const expectedWeekHours = 40;
        const weekProgress = Math.min(Math.round((weekHours / expectedWeekHours) * 100), 100);

        // Per-project hours today
        const projectHoursMap = {};
        myTodayLogs.forEach(log => {
            const pid = log.projectId || 'sin_proyecto';
            const proj = engProjects.find(p => p.id === pid);
            const name = proj?.name || 'Sin Proyecto';
            projectHoursMap[pid] = projectHoursMap[pid] || { name, hours: 0 };
            projectHoursMap[pid].hours += (log.totalHours || 0);
        });
        const projectHoursToday = Object.values(projectHoursMap).sort((a, b) => b.hours - a.hours);

        // Active timer (any log without endTime for current user)
        const activeTimer = myTodayLogs.find(l => l.status === 'running' || (!l.endTime && l.startTime));

        // Per-day of the week breakdown
        const weekDays = [];
        for (let i = 0; i < 7; i++) {
            const d = new Date(weekStart);
            d.setDate(d.getDate() + i);
            const dStr = format(d, 'yyyy-MM-dd');
            const dayLogs = myWeekLogs.filter(l => l.startTime?.startsWith(dStr));
            const h = dayLogs.reduce((s, l) => s + (l.totalHours || 0), 0);
            weekDays.push({ date: dStr, dayLabel: format(d, 'EEE', { locale: es }), hours: parseFloat(h.toFixed(1)), isToday: dStr === todayStr });
        }

        return {
            todayHours: parseFloat(todayHours.toFixed(1)),
            weekHours: parseFloat(weekHours.toFixed(1)),
            weekProgress,
            projectHoursToday,
            activeTimer: activeTimer || null,
            weekDays,
            totalLogsToday: myTodayLogs.length,
        };
    }, [timeLogs, userId, todayStr, weekStartStr, weekEndStr, engProjects, weekStart]);

    // ═══════════════════════════════════════════════════════
    // SECTION 7C: Active Delays Detail
    // ═══════════════════════════════════════════════════════
    const activeDelaysDetail = useMemo(() => {
        if (!delays || delays.length === 0) return [];
        return delays
            .filter(d => !d.resolved)
            .map(d => {
                const task = engTasks.find(t => t.id === d.taskId);
                const project = engProjects.find(p => p.id === d.projectId);
                const cause = delayCauses?.find(c => c.id === d.causeId);
                const owner = teamMembers.find(m => m.uid === (task?.assignedTo || d.reportedBy));
                const daysDelayed = d.createdAt ? Math.max(1, Math.round((now - new Date(d.createdAt)) / (1000 * 60 * 60 * 24))) : 0;

                return {
                    id: d.id,
                    taskName: task?.title || 'Tarea desconocida',
                    taskId: d.taskId,
                    projectName: project?.name || '—',
                    projectId: d.projectId,
                    cause: cause?.name || d.causeName || d.cause || 'Sin causa',
                    daysDelayed,
                    impactLevel: daysDelayed > 5 ? 'critical' : daysDelayed > 2 ? 'high' : 'moderate',
                    ownerName: owner?.displayName || '—',
                    notes: d.notes || '',
                    createdAt: d.createdAt,
                };
            })
            .sort((a, b) => b.daysDelayed - a.daysDelayed)
            .slice(0, 8);
    }, [delays, engTasks, engProjects, delayCauses, teamMembers]);

    // ═══════════════════════════════════════════════════════
    // SECTION 7D: Weekly Planner Snapshot
    // ═══════════════════════════════════════════════════════
    const weekPlannerSnapshot = useMemo(() => {
        const myItems = weekPlanItems.filter(pi => pi.assignedTo === userId);
        const todayItems = myItems.filter(pi => pi.date === todayStr);
        const completedThisWeek = myItems.filter(pi => pi.completed || pi.status === 'completed');

        // Build day-by-day summary
        const daySummary = [];
        for (let i = 0; i < 7; i++) {
            const d = new Date(weekStart);
            d.setDate(d.getDate() + i);
            const dStr = format(d, 'yyyy-MM-dd');
            const dayItems = myItems.filter(pi => pi.date === dStr);
            const done = dayItems.filter(pi => pi.completed || pi.status === 'completed').length;
            daySummary.push({ date: dStr, dayLabel: format(d, 'EEE', { locale: es }), total: dayItems.length, done, isToday: dStr === todayStr });
        }

        return {
            todayItems: todayItems.map(pi => {
                const task = engTasks.find(t => t.id === pi.taskId);
                const project = engProjects.find(p => p.id === (task?.projectId || pi.projectId));
                return { ...pi, taskTitle: task?.title || pi.title || '—', projectName: project?.name || '—', taskId: pi.taskId };
            }),
            totalThisWeek: myItems.length,
            completedThisWeek: completedThisWeek.length,
            weekProgress: myItems.length > 0 ? Math.round((completedThisWeek.length / myItems.length) * 100) : 0,
            daySummary,
        };
    }, [weekPlanItems, userId, todayStr, engTasks, engProjects, weekStart]);

    // ═══════════════════════════════════════════════════════
    // SECTION 7E: Upcoming Milestones
    // ═══════════════════════════════════════════════════════
    const upcomingMilestones = useMemo(() => {
        const milestones = [];
        engProjects
            .filter(p => !['completed', 'cancelled'].includes(p.status))
            .forEach(project => {
                // Check milestones array in project
                const projectMilestones = project.milestones || [];
                projectMilestones.forEach(ms => {
                    const dueDate = ms.dueDate || ms.targetDate;
                    if (!dueDate) return;
                    const daysUntil = getDaysUntil(dueDate);
                    if (daysUntil < 0 && ms.status === 'completed') return; // skip completed past
                    milestones.push({
                        id: ms.id || `${project.id}-${ms.name}`,
                        name: ms.name || ms.title || 'Hito sin nombre',
                        projectName: project.name,
                        projectId: project.id,
                        dueDate,
                        daysUntil,
                        status: ms.status || (daysUntil < 0 ? 'overdue' : 'pending'),
                        progress: ms.progress || 0,
                        isOverdue: daysUntil < 0,
                    });
                });

                // Also check project-level dueDate as a milestone
                if (project.dueDate) {
                    const daysUntil = getDaysUntil(project.dueDate);
                    if (daysUntil <= 30 && project.status !== 'completed') {
                        milestones.push({
                            id: `proj-deadline-${project.id}`,
                            name: `Entrega: ${project.name}`,
                            projectName: project.name,
                            projectId: project.id,
                            dueDate: project.dueDate,
                            daysUntil,
                            status: daysUntil < 0 ? 'overdue' : 'pending',
                            progress: 0,
                            isOverdue: daysUntil < 0,
                            isProjectDeadline: true,
                        });
                    }
                }
            });

        return milestones.sort((a, b) => a.daysUntil - b.daysUntil).slice(0, 8);
    }, [engProjects]);

    // ═══════════════════════════════════════════════════════
    // SECTION 7F: Recent Activity Feed
    // ═══════════════════════════════════════════════════════
    const [recentActivity, setRecentActivity] = useState([]);
    useEffect(() => {
        fetchAuditHistory(12)
            .then(events => {
                setRecentActivity(events.map(e => ({
                    id: e.id,
                    type: e.type || e.action || 'event',
                    title: e.title || e.description || e.action || 'Evento',
                    detail: e.detail || e.entityName || '',
                    user: e.userName || e.userId || '—',
                    timestamp: e.timestamp || e.createdAt || '',
                    entityType: e.entityType || '',
                    entityId: e.entityId || '',
                    severity: e.severity || 'info',
                })));
            })
            .catch(() => setRecentActivity([]));
    }, []);

    // ═══════════════════════════════════════════════════════
    // SECTION 8: Daily Scrum Summary
    // ═══════════════════════════════════════════════════════
    const dailyScrum = useMemo(() => {
        if (teamMembers.length === 0) return { data: [], summary: { total: 0, ok: 0, sin_tareas: 0, sin_reporte: 0, bloqueado: 0, needsAttention: 0 } };
        const data = buildDailyScrumData(teamMembers, engTasks, timeLogs || [], delays || [], assignments);
        const summary = buildSummary(data);
        return { data, summary };
    }, [teamMembers, engTasks, timeLogs, delays, assignments]);

    // ═══════════════════════════════════════════════════════
    // SECTION 9: Quick Actions (role-based)
    // ═══════════════════════════════════════════════════════
    const quickActions = useMemo(() => {
        const base = [
            { label: 'Mi Trabajo', path: '/my-work', color: 'indigo', key: 'mywork' },
            { label: 'Tareas', path: '/tasks', color: 'violet', key: 'tasks' },
            { label: 'Weekly Planner', path: '/planner', color: 'blue', key: 'planner' },
            { label: 'Proyectos', path: '/projects', color: 'emerald', key: 'projects' },
        ];

        const leaderActions = [
            { label: 'Equipo', path: '/team', color: 'sky', key: 'team' },
            { label: 'Control Tower', path: '/control-tower', color: 'rose', key: 'control' },
            { label: 'Auditoría', path: '/audit', color: 'orange', key: 'audit' },
            { label: 'Analítica', path: '/analytics', color: 'amber', key: 'analytics' },
        ];

        const individualActions = [
            { label: 'Registro Horas', path: '/work-logs', color: 'amber', key: 'logs' },
            { label: 'Reporte Diario', path: '/reports/daily', color: 'teal', key: 'report' },
        ];

        return isLeader ? [...base, ...leaderActions] : [...base, ...individualActions];
    }, [isLeader]);

    // ═══════════════════════════════════════════════════════
    // PREMIUM: Executive Summary (auto-generated paragraph)
    // ═══════════════════════════════════════════════════════
    const executiveSummary = useMemo(() => {
        if (!userId || !isReady) return '';
        const parts = [];

        // Task situation
        const myActive = kpis.myActiveTasks || 0;
        const myOverdue = kpis.myOverdue || 0;
        const myBlocked = kpis.myBlocked || 0;
        if (myActive === 0) {
            parts.push('No tienes tareas activas asignadas');
        } else {
            parts.push(`Tienes ${myActive} tarea${myActive > 1 ? 's' : ''} activa${myActive > 1 ? 's' : ''}`);
            const issues = [];
            if (myOverdue > 0) issues.push(`${myOverdue} vencida${myOverdue > 1 ? 's' : ''}`);
            if (myBlocked > 0) issues.push(`${myBlocked} bloqueada${myBlocked > 1 ? 's' : ''}`);
            if (issues.length > 0) parts[0] += ` (${issues.join(', ')})`;
        }

        // Projects
        const activeProj = kpis.totalActiveProjects || 0;
        const riskProj = kpis.projectsAtRisk || 0;
        if (activeProj > 0) {
            parts.push(`${activeProj} proyecto${activeProj > 1 ? 's' : ''} activo${activeProj > 1 ? 's' : ''}${riskProj > 0 ? `, ${riskProj} en riesgo` : ''}`);
        }

        // Time
        const th = timeSnapshot?.todayHours || 0;
        const wh = timeSnapshot?.weekHours || 0;
        if (th > 0) {
            parts.push(`llevas ${th}h registradas hoy y ${wh}h esta semana`);
        } else {
            parts.push(`aún no registras horas hoy (${wh}h esta semana)`);
        }

        // Delays
        const activeDelayCount = kpis.activeDelays || 0;
        if (activeDelayCount > 0) {
            parts.push(`⚠️ ${activeDelayCount} retraso${activeDelayCount > 1 ? 's' : ''} sin resolver`);
        }

        // Discipline
        if (discipline.score === 100) {
            parts.push('✅ Disciplina al 100%');
        } else if (discipline.score < 50) {
            parts.push('⚡ Faltan registros de disciplina');
        }

        return parts.join('. ') + '.';
    }, [userId, isReady, kpis, timeSnapshot, discipline]);

    // ═══════════════════════════════════════════════════════
    // PREMIUM: Priority #1 — The single most important task
    // ═══════════════════════════════════════════════════════
    const priorityOne = useMemo(() => {
        if (!userId) return null;
        const myActive = engTasks
            .filter(t => t.assignedTo === userId && !['completed', 'cancelled'].includes(t.status))
            .map(t => {
                const project = engProjects.find(p => p.id === t.projectId);
                let score = 0;
                // Priority boost
                if (t.priority === TASK_PRIORITY.CRITICAL) score += 100;
                else if (t.priority === TASK_PRIORITY.HIGH) score += 60;
                else if (t.priority === TASK_PRIORITY.MEDIUM) score += 30;
                // Overdue urgency boost
                if (t.dueDate && getDaysUntil(t.dueDate) < 0) score += 80;
                // Due soon boost
                else if (t.dueDate) {
                    const daysUntil = getDaysUntil(t.dueDate);
                    if (daysUntil <= 1) score += 50;
                    else if (daysUntil <= 3) score += 30;
                }
                // In progress boost (already started = finish it)
                if (t.status === 'in_progress') score += 20;
                // Blocked penalty (can't work on it)
                if (t.status === 'blocked') score -= 50;
                return { ...t, projectName: project?.name || '—', urgencyScore: score };
            })
            .filter(t => t.urgencyScore > 0)
            .sort((a, b) => b.urgencyScore - a.urgencyScore);

        return myActive[0] || null;
    }, [engTasks, engProjects, userId]);

    // ═══════════════════════════════════════════════════════
    // PREMIUM: Productivity Streak
    // ═══════════════════════════════════════════════════════
    const productivityStreak = useMemo(() => {
        if (!userId || !timeLogs || timeLogs.length === 0) return { days: 0, label: 'Sin actividad reciente', status: 'cold' };

        // Check consecutive days with time logs (going back from yesterday)
        let streak = 0;
        const todayDate = new Date(now);
        todayDate.setHours(0, 0, 0, 0);

        // Check if logged today
        const loggedToday = timeLogs.some(l => l.userId === userId && l.startTime?.startsWith(todayStr));
        if (loggedToday) streak = 1;

        // Go backwards from yesterday
        for (let i = 1; i <= 30; i++) {
            const checkDate = new Date(todayDate);
            checkDate.setDate(checkDate.getDate() - i);
            const dateStr = format(checkDate, 'yyyy-MM-dd');
            // Skip weekends
            const dayOfWeek = checkDate.getDay();
            if (dayOfWeek === 0 || dayOfWeek === 6) continue;
            const hasLog = timeLogs.some(l => l.userId === userId && l.startTime?.startsWith(dateStr));
            if (hasLog) {
                streak++;
            } else {
                break; // streak broken
            }
        }

        let label, status;
        if (streak >= 10) { label = `🔥 ${streak} días seguidos registrando horas`; status = 'fire'; }
        else if (streak >= 5) { label = `💪 ${streak} días de constancia`; status = 'strong'; }
        else if (streak >= 2) { label = `✨ ${streak} días consecutivos`; status = 'growing'; }
        else if (streak === 1) { label = '⚡ Hoy registraste — mantén la racha'; status = 'started'; }
        else { label = '💤 Sin registros recientes — empieza hoy'; status = 'cold'; }

        return { days: streak, label, status };
    }, [userId, timeLogs, todayStr]);

    // ═══════════════════════════════════════════════════════
    // PREMIUM: Notifications Inline (real-time)
    // ═══════════════════════════════════════════════════════
    const [notifications, setNotifications] = useState([]);
    useEffect(() => {
        if (!userId) return;
        const unsub = subscribeToNotifications(
            userId,
            (items) => setNotifications(items.slice(0, 8)),
            (err) => console.error('[DailyBriefing] Notifications error:', err)
        );
        return unsub;
    }, [userId]);

    return {
        // Meta
        greeting,
        isReady,
        isLeader,
        effectiveRole,
        userId,

        // Sections
        kpis,
        myFocus,
        projectHealth,
        criticalAlerts,
        teamOverview,
        discipline,
        topRisks,
        dailyScrum,
        quickActions,

        // New enriched sections
        timeSnapshot,
        activeDelaysDetail,
        weekPlannerSnapshot,
        upcomingMilestones,
        recentActivity,

        // Premium enhancements
        executiveSummary,
        priorityOne,
        productivityStreak,
        notifications,
    };
}
