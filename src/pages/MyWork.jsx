import React, { useState, useEffect, useCallback } from 'react';
import { useAppData } from '../contexts/AppDataContext';
import { useAuth } from '../contexts/AuthContext';
import { useRole } from '../contexts/RoleContext';
import { format, startOfWeek, addDays, addWeeks } from 'date-fns';
import { es } from 'date-fns/locale';
import { User, CalendarDays, ExternalLink } from 'lucide-react';

// Sub-components
import FocusNowCard from '../components/mywork/FocusNowCard';
import ActiveTimerCard from '../components/mywork/ActiveTimerCard';
import TodaySummaryCard from '../components/mywork/TodaySummaryCard';
import TodayTasksPanel from '../components/mywork/TodayTasksPanel';
import BlockedTasksPanel from '../components/mywork/BlockedTasksPanel';
import WeeklySummaryCard from '../components/mywork/WeeklySummaryCard';
import UnplannedWorkPanel from '../components/mywork/UnplannedWorkPanel';
import NextUpPanel from '../components/mywork/NextUpPanel';

// Task modal
import TaskDetailModal from '../components/tasks/TaskDetailModal';

// Data hook
import { useMyWorkData } from '../hooks/useMyWorkData';

// Planner service
import { plannerService } from '../services/plannerService';

// Time service helpers
import { updateTaskStatus } from '../services/taskService';
import { getActiveTimer } from '../services/timeService';

// Greeting helper
function getGreeting() {
    const h = new Date().getHours();
    if (h < 12) return 'Buenos días';
    if (h < 19) return 'Buenas tardes';
    return 'Buenas noches';
}

export default function MyWork() {
    const { user } = useAuth();
    const { canEdit, canDelete } = useRole();
    const {
        engTasks, engProjects, engSubtasks,
        taskTypes, teamMembers, timeLogs,
    } = useAppData();

    // ── Weekly plan items (fetched for current week) ──
    const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
    const weekStartStr = format(weekStart, 'yyyy-MM-dd');
    const [weekPlanItems, setWeekPlanItems] = useState([]);

    useEffect(() => {
        plannerService.getWeeklyPlanItems(weekStartStr)
            .then(setWeekPlanItems)
            .catch(console.error);
    }, [weekStartStr]);

    // ── Derived data via hook ──
    const data = useMyWorkData({
        engTasks,
        engProjects,
        engSubtasks,
        timeLogs,
        weekPlanItems,
        userId: user?.uid,
    });

    const {
        myTasks, focusTask, todayTasks, blockedTasks, urgentTasks,
        overdueTasks, nextUpTasks, myTodayLogs, todayHours,
        todayOvertimeHours, weeklyStats, unplannedTasks,
        weekStart: ws, weekEnd: we,
    } = data;

    // ── Task Detail Modal state ──
    const [taskModalTask, setTaskModalTask] = useState(undefined); // undefined=closed, null=new, obj=edit

    const handleOpenTask = useCallback((task) => {
        setTaskModalTask(task || null);
    }, []);

    // ── Status change handler ──
    const handleStatusChange = useCallback(async (task, newStatus) => {
        try {
            await updateTaskStatus(task.id, newStatus, task.projectId);
        } catch (e) { console.error('Error updating status:', e); }
    }, []);

    // ── Quick Plan handler (add plan block today) ──
    const handleQuickPlan = useCallback(async (task, hours) => {
        const today = format(new Date(), 'yyyy-MM-dd');
        const now = new Date();
        const startHour = now.getHours() < 17 ? now.getHours() + 1 : 9;
        const startDt = new Date(`${today}T${String(startHour).padStart(2, '0')}:00:00`);
        const endDt = new Date(startDt.getTime() + hours * 3600000);
        const member = teamMembers.find(m => m.uid === user.uid);

        try {
            const { id: newId } = await plannerService.createPlanItem({
                taskId: task.id,
                taskTitleSnapshot: task.title,
                projectId: task.projectId,
                projectNameSnapshot: task.projectName || '',
                assignedTo: user.uid,
                assignedToName: member?.displayName || member?.email || '',
                weekStartDate: weekStartStr,
                date: today,
                dayOfWeek: startDt.getDay(),
                startDateTime: startDt.toISOString(),
                endDateTime: endDt.toISOString(),
                plannedHours: hours,
                priority: task.priority,
                statusSnapshot: task.status,
                colorKey: 'indigo',
                createdBy: user.uid,
            });
            setWeekPlanItems(prev => [...prev, {
                id: newId, taskId: task.id, date: today, assignedTo: user.uid,
                plannedHours: hours, weekStartDate: weekStartStr,
            }]);
        } catch (e) {
            if (e.name === 'PlannerValidationError') {
                alert(e.validationErrors?.join('\n') || e.message);
            } else {
                console.error('Quick plan error:', e);
            }
        }
    }, [user, weekStartStr, teamMembers]);

    // ── Unblock handler (changes status to in_progress) ──
    const handleUnblock = useCallback(async (task) => {
        await handleStatusChange(task, 'in_progress');
    }, [handleStatusChange]);

    // ── Timer stop callback (refresh plan items if needed) ──
    const handleTimerStop = useCallback(() => {
        // Re-fetch week plan items if something changed externally
        plannerService.getWeeklyPlanItems(weekStartStr)
            .then(setWeekPlanItems)
            .catch(console.error);
    }, [weekStartStr]);

    // ── Active timer state (for FocusNowCard) ──
    const activeTimer = getActiveTimer();
    const focusTimerTask = activeTimer
        ? (engTasks.find(t => t.id === activeTimer.taskId) || focusTask)
        : focusTask;

    // ── Date/greeting header ──
    const todayLabel = format(new Date(), "EEEE, d 'de' MMMM", { locale: es });
    const userName = user?.displayName?.split(' ')[0] || user?.email?.split('@')[0] || 'ahí';

    const myActiveOpenTasks = engTasks.filter(t =>
        t.assignedTo === user?.uid && t.status !== 'completed' && t.status !== 'cancelled'
    );

    return (
        <div className="space-y-4 md:space-y-6 animate-in fade-in duration-300">

            {/* ══════════════════════════════════════════
                HEADER — greeting + date
            ══════════════════════════════════════════ */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight flex items-center gap-2 md:gap-3">
                        <div className="w-9 h-9 md:w-10 md:h-10 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center shrink-0">
                            <User className="w-5 h-5 text-indigo-400" />
                        </div>
                        My Work
                    </h1>
                    <p className="text-xs md:text-sm font-bold text-slate-400 mt-1 ml-1 capitalize">
                        {getGreeting()}, {userName} · {todayLabel}
                    </p>
                </div>
                {/* Quick link to planner */}
                <a
                    href="/planner"
                    className="flex items-center gap-2 px-4 py-2.5 bg-slate-900/70 border border-slate-800 hover:border-indigo-500/50 hover:text-indigo-400 text-slate-400 rounded-xl font-bold text-sm transition-all active:scale-95 self-start"
                >
                    <CalendarDays className="w-4 h-4" />
                    Weekly Planner
                    <ExternalLink className="w-3.5 h-3.5 opacity-60" />
                </a>
            </div>

            {/* ══════════════════════════════════════════
                STAT BAR — today summary
            ══════════════════════════════════════════ */}
            <TodaySummaryCard
                todayTasksCount={todayTasks.length}
                urgentCount={urgentTasks.length}
                blockedCount={blockedTasks.length}
                todayHours={todayHours}
                todayOvertimeHours={todayOvertimeHours}
            />

            {/* ══════════════════════════════════════════
                ROW A — FocusNow (2/3) + Timer + Blocked (1/3)
            ══════════════════════════════════════════ */}
            <div className="grid lg:grid-cols-3 gap-6">
                {/* Left 2/3: Focus Now */}
                <div className="lg:col-span-2 flex flex-col gap-6">
                    <FocusNowCard
                        task={focusTimerTask || focusTask}
                        userId={user?.uid}
                        engTasks={engTasks}
                        onOpenTask={handleOpenTask}
                        onStatusChange={handleStatusChange}
                    />

                    {/* Today Tasks Panel */}
                    <TodayTasksPanel
                        tasks={todayTasks}
                        userId={user?.uid}
                        onOpenTask={handleOpenTask}
                        onStatusChange={handleStatusChange}
                    />
                </div>

                {/* Right 1/3: Timer + Blocked */}
                <div className="flex flex-col gap-6">
                    <ActiveTimerCard
                        tasks={myActiveOpenTasks}
                        allTasks={engTasks}
                        projects={engProjects}
                        userId={user?.uid}
                        onTimerStop={handleTimerStop}
                    />

                    <BlockedTasksPanel
                        tasks={blockedTasks}
                        onOpenTask={handleOpenTask}
                        onUnblock={handleUnblock}
                    />
                </div>
            </div>

            {/* ══════════════════════════════════════════
                ROW B — Weekly Summary + Unplanned + Next Up
            ══════════════════════════════════════════ */}
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                <WeeklySummaryCard
                    weeklyStats={weeklyStats}
                    weekStart={ws}
                    weekEnd={we}
                />
                <UnplannedWorkPanel
                    tasks={unplannedTasks}
                    onOpenTask={handleOpenTask}
                    onQuickPlan={handleQuickPlan}
                />
                <NextUpPanel
                    tasks={nextUpTasks}
                    onOpenTask={handleOpenTask}
                />
            </div>

            {/* ══════════════════════════════════════════
                TASK DETAIL MODAL
            ══════════════════════════════════════════ */}
            {taskModalTask !== undefined && (
                <TaskDetailModal
                    isOpen={true}
                    onClose={() => setTaskModalTask(undefined)}
                    task={taskModalTask}
                    projects={engProjects}
                    teamMembers={teamMembers}
                    subtasks={taskModalTask
                        ? engSubtasks.filter(s => s.taskId === taskModalTask.id)
                        : []
                    }
                    taskTypes={taskTypes}
                    userId={user?.uid}
                    canEdit={canEdit}
                    canDelete={canDelete}
                />
            )}
        </div>
    );
}
