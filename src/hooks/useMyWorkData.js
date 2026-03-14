/**
 * useMyWorkData
 * =============
 * Custom hook that centralizes all derived state for the My Work page.
 * Keeps the page component thin and computations memoized.
 */

import { useMemo } from 'react';
import {
    format, startOfWeek, endOfWeek, addDays, parseISO,
    isToday, isBefore, isAfter, startOfDay, endOfDay
} from 'date-fns';
import { TASK_PRIORITY } from '../models/schemas';

const URGENT_PRIORITIES = [TASK_PRIORITY.CRITICAL, TASK_PRIORITY.HIGH];

export function useMyWorkData({ engTasks, engProjects, engSubtasks, timeLogs, weekPlanItems, userId }) {

    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const now = new Date();

    // Week boundaries (Monday-based)
    const weekStart = startOfWeek(now, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
    const weekStartStr = format(weekStart, 'yyyy-MM-dd');
    const weekEndStr = format(weekEnd, 'yyyy-MM-dd');

    // ── 1. My Tasks (assigned, not done/cancelled) ──────────────────────
    const myTasks = useMemo(() => {
        if (!engTasks || !userId) return [];
        return engTasks
            .filter(t => t.assignedTo === userId && t.status !== 'completed' && t.status !== 'cancelled')
            .map(t => {
                const project = engProjects?.find(p => p.id === t.projectId);
                const subtasks = engSubtasks?.filter(s => s.taskId === t.id) || [];
                return { ...t, projectName: project?.name || '—', projectColor: project?.colorKey || 'indigo', subtasks };
            });
    }, [engTasks, engProjects, engSubtasks, userId]);

    // ── 2. Categorized tasks ────────────────────────────────────────────
    const overdueTasks = useMemo(() =>
        myTasks.filter(t => t.dueDate && isBefore(parseISO(t.dueDate), startOfDay(now)) && t.status !== 'completed'),
    [myTasks, now]);

    const urgentTasks = useMemo(() =>
        myTasks.filter(t => URGENT_PRIORITIES.includes(t.priority)),
    [myTasks]);

    const blockedTasks = useMemo(() =>
        myTasks.filter(t => t.status === 'blocked'),
    [myTasks]);

    const inProgressTasks = useMemo(() =>
        myTasks.filter(t => t.status === 'in_progress'),
    [myTasks]);

    // ── 3. Today's plan items for this user ─────────────────────────────
    const todayPlanItems = useMemo(() => {
        if (!weekPlanItems || !userId) return [];
        return weekPlanItems.filter(pi => pi.date === todayStr && pi.assignedTo === userId);
    }, [weekPlanItems, userId, todayStr]);

    // Task IDs planned for today
    const todayPlannedTaskIds = useMemo(() =>
        new Set(todayPlanItems.map(pi => pi.taskId)),
    [todayPlanItems]);

    // ── 4. Today Tasks panel (unique set of relevant tasks) ─────────────
    const todayTasks = useMemo(() => {
        const ids = new Set();
        const result = [];

        const add = (task, source) => {
            if (!ids.has(task.id)) {
                ids.add(task.id);
                result.push({ ...task, todaySource: source });
            }
        };

        // In-progress first
        inProgressTasks.forEach(t => add(t, 'in_progress'));
        // Planned for today
        myTasks.filter(t => todayPlannedTaskIds.has(t.id)).forEach(t => add(t, 'planned'));
        // Overdue
        overdueTasks.forEach(t => add(t, 'overdue'));
        // Urgent due today
        myTasks.filter(t => t.dueDate && t.dueDate.startsWith(todayStr) && URGENT_PRIORITIES.includes(t.priority)).forEach(t => add(t, 'urgent'));

        return result;
    }, [inProgressTasks, myTasks, todayPlannedTaskIds, overdueTasks, todayStr]);

    // ── 5. Focus Task (the #1 task to show) ─────────────────────────────
    const focusTask = useMemo(() => {
        // 1st: if timer is active, show that task
        // (active timer task id passed in separately by caller)
        // 2nd: in_progress task
        if (inProgressTasks.length > 0) return inProgressTasks[0];
        // 3rd: overdue urgent
        const overdueUrgent = overdueTasks.find(t => URGENT_PRIORITIES.includes(t.priority));
        if (overdueUrgent) return overdueUrgent;
        // 4th: task planned for today
        const plannedToday = myTasks.find(t => todayPlannedTaskIds.has(t.id));
        if (plannedToday) return plannedToday;
        // 5th: urgent task
        if (urgentTasks.length > 0) return urgentTasks[0];
        // 6th: any open task
        if (myTasks.length > 0) return myTasks[0];
        return null;
    }, [inProgressTasks, overdueTasks, myTasks, todayPlannedTaskIds, urgentTasks]);

    // ── 6. Next Up (upcoming tasks excl. focus) ─────────────────────────
    const nextUpTasks = useMemo(() => {
        return myTasks
            .filter(t => t.id !== focusTask?.id && t.status !== 'blocked')
            .sort((a, b) => {
                // Sort by priority then due date
                const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
                const pa = priorityOrder[a.priority] ?? 2;
                const pb = priorityOrder[b.priority] ?? 2;
                if (pa !== pb) return pa - pb;
                if (a.dueDate && b.dueDate) return new Date(a.dueDate) - new Date(b.dueDate);
                if (a.dueDate) return -1;
                if (b.dueDate) return 1;
                return 0;
            })
            .slice(0, 6);
    }, [myTasks, focusTask]);

    // ── 7. Time Logs ────────────────────────────────────────────────────
    const myTodayLogs = useMemo(() => {
        if (!timeLogs || !userId) return [];
        return timeLogs.filter(log =>
            log.userId === userId &&
            log.startTime?.startsWith(todayStr)
        );
    }, [timeLogs, userId, todayStr]);

    const myWeekLogs = useMemo(() => {
        if (!timeLogs || !userId) return [];
        return timeLogs.filter(log => {
            if (log.userId !== userId || !log.startTime) return false;
            const d = log.startTime.slice(0, 10);
            return d >= weekStartStr && d <= weekEndStr;
        });
    }, [timeLogs, userId, weekStartStr, weekEndStr]);

    const todayHours = useMemo(() =>
        myTodayLogs.reduce((acc, log) => acc + (log.totalHours || 0), 0),
    [myTodayLogs]);

    const todayOvertimeHours = useMemo(() =>
        myTodayLogs.reduce((acc, log) => acc + (log.overtimeHours || 0), 0),
    [myTodayLogs]);

    const weekActualHours = useMemo(() =>
        myWeekLogs.reduce((acc, log) => acc + (log.totalHours || 0), 0),
    [myWeekLogs]);

    // ── 8. Weekly Plan hours for this user ──────────────────────────────
    const myWeekPlanItems = useMemo(() => {
        if (!weekPlanItems || !userId) return [];
        return weekPlanItems.filter(pi => pi.assignedTo === userId);
    }, [weekPlanItems, userId]);

    const weekPlannedHours = useMemo(() =>
        myWeekPlanItems.reduce((acc, pi) => acc + (pi.plannedHours || 0), 0),
    [myWeekPlanItems]);

    // ── 9. Weekly estimated (sum of active tasks) ───────────────────────
    const weekEstimatedHours = useMemo(() =>
        myTasks.reduce((acc, t) => acc + (t.estimatedHours || 0), 0),
    [myTasks]);

    // ── 10. Completed tasks this week ───────────────────────────────────
    const completedThisWeek = useMemo(() => {
        if (!engTasks || !userId) return [];
        return engTasks.filter(t =>
            t.assignedTo === userId &&
            t.status === 'completed' &&
            t.completedDate &&
            t.completedDate.slice(0, 10) >= weekStartStr &&
            t.completedDate.slice(0, 10) <= weekEndStr
        );
    }, [engTasks, userId, weekStartStr, weekEndStr]);

    // ── 11. Unplanned Work ──────────────────────────────────────────────
    const unplannedTasks = useMemo(() => {
        const taskPlannedMap = {};
        myWeekPlanItems.forEach(pi => {
            taskPlannedMap[pi.taskId] = (taskPlannedMap[pi.taskId] || 0) + (pi.plannedHours || 0);
        });

        return myTasks
            .filter(t => t.status !== 'blocked')
            .map(t => ({
                ...t,
                plannedThisWeek: taskPlannedMap[t.id] || 0,
                remainingToplan: Math.max(0, (t.estimatedHours || 0) - (taskPlannedMap[t.id] || 0))
            }))
            .filter(t => t.remainingToplan > 0 || (t.estimatedHours === 0 && t.plannedThisWeek === 0))
            .sort((a, b) => {
                const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
                return (priorityOrder[a.priority] ?? 2) - (priorityOrder[b.priority] ?? 2);
            });
    }, [myTasks, myWeekPlanItems]);

    // ── 12. Weekly stats summary ─────────────────────────────────────────
    const weeklyStats = useMemo(() => ({
        plannedHours: weekPlannedHours,
        actualHours: weekActualHours,
        estimatedHours: weekEstimatedHours,
        completedCount: completedThisWeek.length,
        overdueCount: overdueTasks.length,
        blockedCount: blockedTasks.length,
        remainingPlanned: Math.max(0, weekPlannedHours - weekActualHours),
        remainingEstimated: Math.max(0, weekEstimatedHours - weekActualHours),
        utilizationPct: weekPlannedHours > 0 ? Math.min(100, Math.round((weekActualHours / weekPlannedHours) * 100)) : 0,
    }), [weekPlannedHours, weekActualHours, weekEstimatedHours, completedThisWeek, overdueTasks, blockedTasks]);

    return {
        myTasks,
        focusTask,
        todayTasks,
        todayPlanItems,
        overdueTasks,
        urgentTasks,
        blockedTasks,
        inProgressTasks,
        nextUpTasks,
        myTodayLogs,
        myWeekLogs,
        myWeekPlanItems,
        todayHours,
        todayOvertimeHours,
        weekActualHours,
        weekPlannedHours,
        weekEstimatedHours,
        weeklyStats,
        unplannedTasks,
        completedThisWeek,
        todayStr,
        weekStart,
        weekEnd,
    };
}
