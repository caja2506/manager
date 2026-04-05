import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useEngineeringData } from '../hooks/useEngineeringData';
import { useAuth } from '../contexts/AuthContext';
import { useRole } from '../contexts/RoleContext';
import { plannerService } from '../services/plannerService';
import { syncPlannerToGantt } from '../services/ganttPlannerSync';
import { enrichPlanItemsWithTasks } from '../utils/plannerUtils';
import PlannerSidebar from '../components/planner/PlannerSidebar';
import DailyTeamGrid from '../components/planner/DailyTeamGrid';
import TaskDetailModal from '../components/tasks/TaskDetailModal';
import TaskModuleBanner from '../components/layout/TaskModuleBanner';
import {
    ChevronLeft, ChevronRight, PanelLeftOpen, PanelLeftClose,
    Users as UsersIcon,
} from 'lucide-react';
import {
    format, addDays, isToday, startOfWeek, parseISO,
} from 'date-fns';
import { es } from 'date-fns/locale';

const PROJECT_COLOR_KEYS = ['indigo', 'violet', 'emerald', 'amber', 'rose', 'cyan', 'teal'];

export default function DailyTeamBoard() {
    const { user } = useAuth();
    const { canEdit, canDelete } = useRole();
    const { engTasks, engProjects, engSubtasks, teamMembers, taskTypes } = useEngineeringData();

    // ──────────────── Day navigation ────────────────
    const [dayOffset, setDayOffset] = useState(0);
    const [filterProject, setFilterProject] = useState('all');
    const [searchQuery, setSearchQuery] = useState('');

    const selectedDate = useMemo(() => addDays(new Date(), dayOffset), [dayOffset]);
    const selectedDateStr = format(selectedDate, 'yyyy-MM-dd');
    const weekStartStr = format(startOfWeek(selectedDate, { weekStartsOn: 1 }), 'yyyy-MM-dd');

    // ──────────────── Plan items state ────────────────
    const [rawPlanItems, setRawPlanItems] = useState([]);
    const [loading, setLoading] = useState(false);
    const [taskModalTask, setTaskModalTask] = useState(undefined);
    const [placingTask, setPlacingTask] = useState(null);
    const [plannerError, setPlannerError] = useState(null);
    const [plannerWarnings, setPlannerWarnings] = useState([]);
    const [sidebarOpen, setSidebarOpen] = useState(false);

    // Fetch plan items for the week containing the selected day
    const fetchPlanItems = useCallback(async () => {
        setLoading(true);
        try {
            const items = await plannerService.getWeeklyPlanItems(weekStartStr);
            setRawPlanItems(items);
        } catch (err) {
            console.error('Error fetching plan items:', err);
        } finally {
            setLoading(false);
        }
    }, [weekStartStr]);

    useEffect(() => { fetchPlanItems(); }, [fetchPlanItems]);

    // Enrich with live task data
    const allPlanItems = useMemo(() =>
        enrichPlanItemsWithTasks(rawPlanItems, engTasks, engProjects, teamMembers),
        [rawPlanItems, engTasks, engProjects, teamMembers]
    );

    // Filter to selected day only
    const dayPlanItems = useMemo(() => {
        let items = allPlanItems.filter(pi => pi.date === selectedDateStr);
        if (filterProject !== 'all') items = items.filter(pi => pi.projectId === filterProject);
        return items;
    }, [allPlanItems, selectedDateStr, filterProject]);

    // Project color map
    const projectColorMap = useMemo(() => {
        const map = {};
        engProjects.forEach((p, i) => { map[p.id] = PROJECT_COLOR_KEYS[i % PROJECT_COLOR_KEYS.length]; });
        return map;
    }, [engProjects]);

    // Members to show (non-manager team members with active tasks or any assignments)
    const visibleMembers = useMemo(() => {
        return teamMembers
            .filter(m => m.teamRole !== 'manager')
            .sort((a, b) => {
                const roleOrder = { team_lead: 0, engineer: 1, technician: 2 };
                return (roleOrder[a.teamRole] ?? 3) - (roleOrder[b.teamRole] ?? 3);
            });
    }, [teamMembers]);

    // ──────────────── Unscheduled tasks ────────────────
    const unscheduledTasks = useMemo(() => {
        const taskPlannedMap = {};
        allPlanItems.forEach(pi => {
            taskPlannedMap[pi.taskId] = (taskPlannedMap[pi.taskId] || 0) + (pi.plannedHours || 0);
        });

        return engTasks
            .filter(t => !['completed', 'cancelled'].includes(t.status))
            .filter(t => {
                if (filterProject !== 'all' && t.projectId !== filterProject) return false;
                const planned = taskPlannedMap[t.id] || 0;
                return planned < (t.estimatedHours || 0.1);
            })
            .map(t => ({
                ...t,
                projectName: engProjects.find(p => p.id === t.projectId)?.name || '',
                plannedHours: taskPlannedMap[t.id] || 0,
            }));
    }, [engTasks, engProjects, allPlanItems, filterProject]);

    // ──────────────── Drop handler ────────────────
    const handleDropTask = useCallback(async ({ taskId, date, hour, minute, assignedTo }) => {
        const task = engTasks.find(t => t.id === taskId);
        if (!task) return;

        // If dropped into a member column, override assignedTo
        const finalAssignedTo = assignedTo || task.assignedTo;
        const assignedMember = teamMembers.find(m => m.uid === finalAssignedTo);

        const startDt = new Date(`${date}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00`);
        const defaultHours = task.estimatedHours > 0 ? Math.min(2, task.estimatedHours) : 1;
        const endDt = new Date(startDt.getTime() + defaultHours * 3600000);

        const planItem = {
            taskId: task.id,
            weekStartDate: weekStartStr,
            date,
            dayOfWeek: startDt.getDay(),
            startDateTime: startDt.toISOString(),
            endDateTime: endDt.toISOString(),
            plannedHours: defaultHours,
            createdBy: user.uid,
            assignedTo: finalAssignedTo,
            projectId: task.projectId,
            taskTitleSnapshot: task.title,
            projectNameSnapshot: engProjects.find(p => p.id === task.projectId)?.name || '',
            assignedToName: assignedMember?.displayName || assignedMember?.email || '',
            statusSnapshot: task.status,
            priority: task.priority,
            colorKey: projectColorMap[task.projectId] || 'indigo',
        };

        try {
            const member = teamMembers.find(m => m.uid === finalAssignedTo);
            const validationContext = {
                existingItems: rawPlanItems,
                linkedTask: task,
                weeklyCapacityHours: member?.weeklyCapacityHours || 40,
                allItemsForTask: rawPlanItems.filter(pi => pi.taskId === task.id),
            };

            const { id: newId, warnings } = await plannerService.createPlanItem(planItem, validationContext);

            if (warnings?.length > 0) {
                setPlannerWarnings(warnings);
                setTimeout(() => setPlannerWarnings([]), 8000);
            }
            setPlannerError(null);
            setRawPlanItems(prev => [...prev, { id: newId, ...planItem }]);
            syncPlannerToGantt(taskId).catch(console.warn);
        } catch (e) {
            if (e.name === 'PlannerValidationError') {
                setPlannerError(e.validationErrors?.join(' | ') || e.message);
                setTimeout(() => setPlannerError(null), 8000);
            } else {
                console.error('Error saving plan item:', e);
                setPlannerError('Error inesperado al guardar el bloque.');
                setTimeout(() => setPlannerError(null), 5000);
            }
        }
    }, [engTasks, engProjects, teamMembers, weekStartStr, projectColorMap, user.uid, rawPlanItems]);

    // ──────────────── Resize handler ────────────────
    const handleBlockResize = useCallback(async (itemId, newEndDateTime) => {
        const item = allPlanItems.find(i => i.id === itemId);
        if (!item) return;
        const startDt = parseISO(item.startDateTime);
        const endDt = new Date(newEndDateTime);
        const diffH = parseFloat(((endDt - startDt) / 3600000).toFixed(2));
        try {
            await plannerService.updatePlanItem(itemId, { endDateTime: endDt.toISOString(), plannedHours: diffH });
            setRawPlanItems(prev => prev.map(pi =>
                pi.id === itemId ? { ...pi, endDateTime: endDt.toISOString(), plannedHours: diffH } : pi
            ));
        } catch (e) { console.error('Error resizing block:', e); }
    }, [allPlanItems]);

    // ──────────────── Move handler ────────────────
    const handleBlockMove = useCallback(async ({ itemId, date, hour, minute, assignedTo }) => {
        const item = allPlanItems.find(i => i.id === itemId);
        if (!item) return;
        const origStart = parseISO(item.startDateTime);
        const origEnd = parseISO(item.endDateTime);
        const durationMs = origEnd - origStart;
        const newStart = new Date(`${date}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00`);
        const newEnd = new Date(newStart.getTime() + durationMs);

        const updates = {
            date,
            dayOfWeek: newStart.getDay(),
            startDateTime: newStart.toISOString(),
            endDateTime: newEnd.toISOString(),
            weekStartDate: weekStartStr,
            ...(assignedTo ? { assignedTo } : {}),
        };

        try {
            await plannerService.updatePlanItem(itemId, updates);
            setRawPlanItems(prev => prev.map(pi => pi.id === itemId ? { ...pi, ...updates } : pi));
            syncPlannerToGantt(item.taskId).catch(console.warn);
        } catch (e) { console.error('Error moving block:', e); }
    }, [allPlanItems, weekStartStr]);

    // ──────────────── Delete handler ────────────────
    const handleBlockDelete = useCallback(async (itemId) => {
        const item = rawPlanItems.find(pi => pi.id === itemId);
        try {
            await plannerService.deletePlanItem(itemId);
            setRawPlanItems(prev => prev.filter(pi => pi.id !== itemId));
            if (item?.taskId) syncPlannerToGantt(item.taskId).catch(console.warn);
        } catch (e) { console.error('Error deleting block:', e); }
    }, [rawPlanItems]);

    // ──────────────── Block click → open task modal ────────────────
    const handleBlockClick = useCallback((planItem) => {
        const fullTask = engTasks.find(t => t.id === planItem.taskId) || null;
        setTaskModalTask(fullTask);
    }, [engTasks]);

    // ──────────────── Placement ────────────────
    const handlePlacementComplete = useCallback(async (placement) => {
        if (!placement) { setPlacingTask(null); return; }
        await handleDropTask(placement);
        setPlacingTask(null);
    }, [handleDropTask]);

    // ──────────────── Conflict detection ────────────────
    const conflictIds = useMemo(() => {
        const ids = new Set();
        const byPersonDay = {};
        dayPlanItems.forEach(pi => {
            const key = `${pi.assignedTo}-${pi.date}`;
            if (!byPersonDay[key]) byPersonDay[key] = [];
            byPersonDay[key].push(pi);
        });
        Object.values(byPersonDay).forEach(items => {
            for (let i = 0; i < items.length; i++) {
                for (let j = i + 1; j < items.length; j++) {
                    const a = items[i], b = items[j];
                    const aS = new Date(a.startDateTime), aE = new Date(a.endDateTime);
                    const bS = new Date(b.startDateTime), bE = new Date(b.endDateTime);
                    if (aS < bE && aE > bS) { ids.add(a.id); ids.add(b.id); }
                }
            }
        });
        return ids;
    }, [dayPlanItems]);

    const isTodaySelected = isToday(selectedDate);

    return (
        <div className="flex flex-col h-[calc(100vh-5rem)] -m-4 md:-m-8 overflow-hidden bg-slate-950">

            {/* Validation error */}
            {plannerError && (
                <div className="mx-4 mt-2 flex items-center gap-3 bg-rose-500/15 border border-rose-500/30 text-rose-300 px-4 py-2.5 rounded-xl text-xs font-bold animate-in slide-in-from-top duration-200">
                    <span className="text-rose-400">✕</span>
                    <span className="flex-1">{plannerError}</span>
                    <button onClick={() => setPlannerError(null)} className="text-rose-400 hover:text-rose-300 p-1">✕</button>
                </div>
            )}

            {/* Warnings */}
            {plannerWarnings.length > 0 && (
                <div className="mx-4 mt-2 flex flex-col gap-1 bg-amber-500/10 border border-amber-500/25 text-amber-300 px-4 py-2.5 rounded-xl text-xs font-bold animate-in slide-in-from-top duration-200">
                    {plannerWarnings.map((w, i) => <div key={i}>{w}</div>)}
                    <button onClick={() => setPlannerWarnings([])} className="self-end text-amber-400 hover:text-amber-300 text-[10px] mt-1">Cerrar</button>
                </div>
            )}

            {/* Banner */}
            <TaskModuleBanner onNewTask={() => setTaskModalTask(null)} canEdit={canEdit}>
                {/* Day navigation */}
                <div className="flex items-center gap-1 bg-slate-800 rounded-lg p-0.5">
                    <button onClick={() => setDayOffset(d => d - 1)} className="p-1.5 hover:bg-slate-700 rounded-md transition-colors text-slate-400">
                        <ChevronLeft className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => setDayOffset(0)} className={`px-2.5 py-1 text-xs font-bold rounded-md transition-colors whitespace-nowrap ${isTodaySelected ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:bg-slate-700'}`}>
                        Hoy
                    </button>
                    <button onClick={() => setDayOffset(d => d + 1)} className="p-1.5 hover:bg-slate-700 rounded-md transition-colors text-slate-400">
                        <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                </div>

                {/* Date label */}
                <div className="flex items-center gap-2">
                    <UsersIcon className="w-4 h-4 text-indigo-400" />
                    <span className="text-sm font-black text-slate-200 capitalize">
                        {format(selectedDate, "EEEE d 'de' MMMM", { locale: es })}
                    </span>
                </div>

                {/* Project filter */}
                <select
                    value={filterProject}
                    onChange={e => setFilterProject(e.target.value)}
                    className="bg-slate-800 border border-slate-700 text-xs font-semibold text-slate-300 py-1.5 px-2.5 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none cursor-pointer"
                >
                    <option value="all">Todos los Proyectos</option>
                    {engProjects.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                </select>

                {conflictIds.size > 0 && (
                    <div className="flex items-center gap-1.5 bg-rose-500/15 border border-rose-500/30 text-rose-400 px-2.5 py-1 rounded-lg text-[10px] font-bold animate-pulse">
                        ⚠️ {conflictIds.size} conflicto(s)
                    </div>
                )}
            </TaskModuleBanner>

            {/* Main workspace */}
            <div className="flex flex-1 min-h-0 relative">
                {/* Mobile sidebar toggle */}
                <button
                    onClick={() => setSidebarOpen(o => !o)}
                    className="md:hidden fixed bottom-20 left-3 z-50 w-10 h-10 rounded-full bg-indigo-600 text-white shadow-lg shadow-indigo-600/30 flex items-center justify-center active:scale-90 transition-all"
                    title={sidebarOpen ? 'Cerrar panel' : 'Tareas sin planificar'}
                >
                    {sidebarOpen ? <PanelLeftClose className="w-5 h-5" /> : <PanelLeftOpen className="w-5 h-5" />}
                </button>

                {sidebarOpen && (
                    <div className="md:hidden fixed inset-0 bg-black/50 z-40" onClick={() => setSidebarOpen(false)} />
                )}

                <div className={`${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 fixed md:relative z-40 md:z-auto h-full transition-transform duration-200 ease-in-out`}>
                    <PlannerSidebar
                        unscheduledTasks={unscheduledTasks}
                        searchQuery={searchQuery}
                        setSearchQuery={setSearchQuery}
                        onStartPlacement={(task) => { setPlacingTask(task); setSidebarOpen(false); }}
                        onTaskEdit={(task) => { setTaskModalTask(task); setSidebarOpen(false); }}
                        placingTask={placingTask}
                        onCancelPlacement={() => setPlacingTask(null)}
                    />
                </div>

                {/* Grid area */}
                <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
                    {loading ? (
                        <div className="flex-1 flex items-center justify-center text-slate-400 font-bold text-sm">
                            Cargando planificación...
                        </div>
                    ) : (
                        <DailyTeamGrid
                            members={visibleMembers}
                            planItems={dayPlanItems}
                            dateStr={selectedDateStr}
                            conflictIds={conflictIds}
                            onDropTask={handleDropTask}
                            onBlockMove={handleBlockMove}
                            onBlockResize={handleBlockResize}
                            onBlockClick={handleBlockClick}
                            onBlockDelete={handleBlockDelete}
                            placingTask={placingTask}
                            onPlacementComplete={handlePlacementComplete}
                        />
                    )}
                </div>
            </div>

            {/* Task Detail Modal */}
            {taskModalTask !== undefined && (
                <TaskDetailModal
                    isOpen={true}
                    onClose={() => setTaskModalTask(undefined)}
                    task={taskModalTask}
                    projects={engProjects}
                    teamMembers={teamMembers}
                    subtasks={taskModalTask ? engSubtasks.filter(s => s.taskId === taskModalTask.id) : []}
                    taskTypes={taskTypes}
                    userId={user.uid}
                    canEdit={canEdit}
                    canDelete={canDelete}
                />
            )}
        </div>
    );
}
