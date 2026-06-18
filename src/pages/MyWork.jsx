import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useEngineeringData } from '../hooks/useEngineeringData';
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
import WipBlockModal from '../components/tasks/WipBlockModal';

// Data hook
import { useMyWorkData } from '../hooks/useMyWorkData';

// Planner service
import { plannerService } from '../services/plannerService';
import { supabase } from '../supabase';

// Time service helpers
import { updateTaskStatus } from '../services/taskService';
import { getActiveTimerFromLogs } from '../services/timeService';

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
        taskTypes, teamMembers, timeLogs, delayCauses,
        refetchTable,
    } = useEngineeringData();

    // ── Weekly plan items (fetched for current week) ──
    const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
    const weekStartStr = format(weekStart, 'yyyy-MM-dd');
    const [weekPlanItems, setWeekPlanItems] = useState([]);

    useEffect(() => {
        plannerService.getWeeklyPlanItems(weekStartStr)
            .then(setWeekPlanItems)
            .catch(console.error);
    }, [weekStartStr]);

    const itemsInCreationRef = useRef(new Set());

    // ── Autocuración de Borradores de Tiempos Faltantes ──
    useEffect(() => {
        if (!user?.uid || !weekPlanItems.length || !timeLogs || !timeLogs.length) return;

        const todayStr = format(new Date(), 'yyyy-MM-dd');
        
        // Obtener plan items de hoy para este usuario
        const todayUserPlanItems = weekPlanItems.filter(pi => 
            pi.date === todayStr && 
            pi.assignedTo === user.uid &&
            pi.startDateTime &&
            pi.endDateTime
        );

        // Identificar cuáles no tienen borrador ni ningún log asociado, y no están en proceso de creación
        const missingItems = todayUserPlanItems.filter(pi => {
            const hasLog = timeLogs.some(log => log.planItemId === pi.id);
            const isCreating = itemsInCreationRef.current.has(pi.id);
            return !hasLog && !isCreating;
        });

        if (missingItems.length > 0) {
            console.log(`[MyWork] Autocuración: Detectados ${missingItems.length} bloques planificados sin logs. Creándolos...`);
            
            // Marcar inmediatamente como en proceso de creación para evitar re-entradas
            missingItems.forEach(item => itemsInCreationRef.current.add(item.id));

            const createMissingDrafts = async () => {
                const { getEffectiveHours } = await import('../utils/breakTimeUtils');
                
                let createdAny = false;
                for (const item of missingItems) {
                    const start = new Date(item.startDateTime);
                    const end = new Date(item.endDateTime);
                    const totalMs = end - start;
                    const totalHoursGross = parseFloat((totalMs / 3600000).toFixed(6));
                    let totalHours = getEffectiveHours(start, end);
                    if (totalHours < 0.016666) totalHours = 0.016666;
                    const breakHoursDeducted = parseFloat((totalHoursGross - totalHours).toFixed(4));

                    try {
                        const { error } = await supabase
                            .from('time_logs')
                            .insert({
                                task_id: item.taskId || null,
                                project_id: item.projectId || null,
                                user_id: item.assignedTo || null,
                                start_time: item.startDateTime,
                                end_time: item.endDateTime,
                                total_hours: totalHours,
                                total_hours_gross: totalHoursGross,
                                break_hours_deducted: breakHoursDeducted,
                                overtime: false,
                                overtime_hours: 0,
                                notes: item.notes || 'Sugerido desde el planificador',
                                task_title: item.taskTitleSnapshot || item.taskTitle || '',
                                project_name: item.projectNameSnapshot || item.projectName || '',
                                display_name: item.assignedToName || '',
                                source: 'planner_suggestion',
                                plan_item_id: item.id,
                                status: 'draft',
                            });
                        
                        if (!error) {
                            createdAny = true;
                            console.log(`[MyWork] Borrador autocreado para item: ${item.id}`);
                        } else {
                            console.error(`[MyWork] Error al insertar borrador:`, error.message);
                            itemsInCreationRef.current.delete(item.id);
                        }
                    } catch (err) {
                        console.error(`[MyWork] Error en insert de autocuración:`, err);
                        itemsInCreationRef.current.delete(item.id);
                    }
                }

                if (createdAny) {
                    refetchTable('time_logs');
                }
            };

            createMissingDrafts();
        }
    }, [user, weekPlanItems, timeLogs, refetchTable]);

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
        weekStart: ws, weekEnd: we, todayPlanItems,
    } = data;

    // ── Task Detail Modal state ──
    const [taskModalTask, setTaskModalTask] = useState(undefined); // undefined=closed, null=new, obj=edit

    const handleOpenTask = useCallback((task) => {
        setTaskModalTask(task || null);
    }, []);

    // ── WIP enforcement state ──
    const [wipModalOpen, setWipModalOpen] = useState(false);
    const [wipPendingTask, setWipPendingTask] = useState(null);
    const [wipPendingStatus, setWipPendingStatus] = useState(null);
    const [wipCurrentTask, setWipCurrentTask] = useState(null);
    const [wipSwitching, setWipSwitching] = useState(false);

    // ── Status change handler ──
    const handleStatusChange = useCallback(async (task, newStatus) => {
        // WIP check: if going to in_progress, see if there's already one active
        if (newStatus === 'in_progress') {
            const inProgress = engTasks.filter(
                t => t.assignedTo === user?.uid && t.status === 'in_progress' && t.id !== task.id
            );
            if (inProgress.length > 0) {
                setWipCurrentTask(inProgress[0]);
                setWipPendingTask(task);
                setWipPendingStatus(newStatus);
                setWipModalOpen(true);
                return;
            }
        }
        try {
            await updateTaskStatus(task.id, newStatus, task.projectId);
        } catch (e) {
            console.error('Error updating status:', e);
            alert('No se pudo cambiar el estado: ' + (e.message || 'Error desconocido'));
        }
    }, [engTasks, user?.uid]);

    const handleWipConfirm = useCallback(async (blockData) => {
        if (!wipCurrentTask || !wipPendingTask || !wipPendingStatus) return;
        setWipSwitching(true);
        try {
            // Step 1: Block the current task
            await updateTaskStatus(
                wipCurrentTask.id,
                'blocked',
                wipCurrentTask.projectId,
                true,
                {
                    blockedReason: blockData.blockedReason,
                    blockedByUserId: blockData.blockedByUserId,
                    blockedByName: blockData.blockedByName,
                }
            );
            // Step 2: Start the new task
            await updateTaskStatus(wipPendingTask.id, wipPendingStatus, wipPendingTask.projectId);

            setWipModalOpen(false);
            setWipCurrentTask(null);
            setWipPendingTask(null);
            setWipPendingStatus(null);
        } catch (err) {
            console.error('WIP switch error:', err);
            alert('Error en cambio WIP: ' + (err.message || 'Error desconocido'));
        }
        setWipSwitching(false);
    }, [wipCurrentTask, wipPendingTask, wipPendingStatus]);

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

    // ── Active timer state (for FocusNowCard) — from Firestore ──
    const activeTimer = getActiveTimerFromLogs(timeLogs, user?.uid);
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
                BACK BUTTON
            ══════════════════════════════════════════ */}
            

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
                        timeLogs={timeLogs}
                        onOpenTask={handleOpenTask}
                        onStatusChange={handleStatusChange}
                        todayPlanItems={todayPlanItems}
                    />

                    {/* Today Tasks Panel */}
                    <TodayTasksPanel
                        tasks={todayTasks}
                        userId={user?.uid}
                        timeLogs={timeLogs}
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
                        timeLogs={timeLogs}
                        onTimerStop={handleTimerStop}
                        todayPlanItems={todayPlanItems}
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

            {/* ── WIP Block Modal ── */}
            <WipBlockModal
                delayCauses={delayCauses}
                isOpen={wipModalOpen}
                onClose={() => { setWipModalOpen(false); setWipCurrentTask(null); setWipPendingTask(null); setWipPendingStatus(null); }}
                onConfirm={handleWipConfirm}
                currentTask={wipCurrentTask}
                newTask={wipPendingTask}
                teamMembers={teamMembers}
                isLoading={wipSwitching}
            />
        </div>
    );
}
