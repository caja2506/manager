import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useEngineeringData } from '../hooks/useEngineeringData';
import { useAuth } from '../contexts/AuthContext';
import { useRole } from '../contexts/RoleContext';
import { plannerService } from '../services/plannerService';
import { syncPlannerToGantt } from '../services/ganttPlannerSync';
import { enrichPlanItemsWithTasks } from '../utils/plannerUtils';
import PlannerSidebar from '../components/planner/PlannerSidebar';
import PlannerGrid from '../components/planner/PlannerGrid';
import WeeklyCapacitySummary from '../components/planner/WeeklyCapacitySummary';
import TaskDetailModal from '../components/tasks/TaskDetailModal';
import TaskModuleBanner from '../components/layout/TaskModuleBanner';
import {
    CalendarDays, ChevronLeft, ChevronRight, Plus, PanelLeftOpen, PanelLeftClose
} from 'lucide-react';
import {
    format, startOfWeek, addDays, addWeeks, subWeeks, isToday, isSameDay, parseISO
} from 'date-fns';
import { es } from 'date-fns/locale';

// Priority colors for the block visual palette
const PROJECT_COLOR_KEYS = ['indigo', 'violet', 'emerald', 'amber', 'rose', 'cyan', 'teal'];

export default function WeeklyPlanner() {
    const { user } = useAuth();
    const { canEdit, canDelete } = useRole();
    const { engTasks, engProjects, engSubtasks, timeLogs, teamMembers, taskTypes } = useEngineeringData();

    // ──────────────── Week navigation ────────────────
    const [weekOffset, setWeekOffset] = useState(0);
    const [filterAssignee, setFilterAssignee] = useState('all');
    const [filterProject, setFilterProject] = useState('all');
    const [searchQuery, setSearchQuery] = useState('');

    const weekStart = useMemo(() => {
        const base = startOfWeek(new Date(), { weekStartsOn: 1 }); // Monday
        return addWeeks(base, weekOffset);
    }, [weekOffset]);

    const weekDays = useMemo(() =>
        Array.from({ length: 5 }, (_, i) => {
            const d = addDays(weekStart, i);
            return { date: d, label: format(d, 'EEE d', { locale: es }), isToday: isToday(d) };
        }), [weekStart]);

    const weekStartStr = format(weekStart, 'yyyy-MM-dd');

    // ──────────────── Plan items state ────────────────
    const [rawPlanItems, setRawPlanItems] = useState([]); // Raw Firestore data
    const [loading, setLoading] = useState(false);
    const [selectedItem, setSelectedItem] = useState(null); // planner block (for moves/resize)
    const [taskModalTask, setTaskModalTask] = useState(undefined); // undefined=closed, null=new, obj=edit
    const [placingTask, setPlacingTask] = useState(null); // task being placed via "+" button
    const [plannerError, setPlannerError] = useState(null); // user-facing validation error
    const [plannerWarnings, setPlannerWarnings] = useState([]); // non-blocking warnings
    const [sidebarOpen, setSidebarOpen] = useState(false); // mobile sidebar toggle

    // Fetch plan items for the visible week
    const fetchPlanItems = useCallback(async () => {
        setLoading(true);
        try {
            const items = await plannerService.getWeeklyPlanItems(weekStartStr);
            setRawPlanItems(items);
        } catch (err) {
            console.error("Error fetching plan items:", err);
        } finally {
            setLoading(false);
        }
    }, [weekStartStr]);

    useEffect(() => { fetchPlanItems(); }, [fetchPlanItems]);

    // ──────────────── Enrich plan items with live task data ────────────────
    // This is the core change: instead of reading snapshot fields,
    // we join weeklyPlanItems with tasks/projects/teamMembers at read-time.
    const planItems = useMemo(() =>
        enrichPlanItemsWithTasks(rawPlanItems, engTasks, engProjects, teamMembers),
        [rawPlanItems, engTasks, engProjects, teamMembers]
    );

    // ──────────────── Project color map ────────────────
    const projectColorMap = useMemo(() => {
        const map = {};
        engProjects.forEach((p, i) => { map[p.id] = PROJECT_COLOR_KEYS[i % PROJECT_COLOR_KEYS.length]; });
        return map;
    }, [engProjects]);

    // ──────────────── Unscheduled tasks ────────────────
    const unscheduledTasks = useMemo(() => {
        // Calculate totalPlannedHours per taskId from current planItems
        const taskPlannedMap = {};
        planItems.forEach(pi => {
            taskPlannedMap[pi.taskId] = (taskPlannedMap[pi.taskId] || 0) + (pi.plannedHours || 0);
        });

        return engTasks
            .filter(t => !['completed', 'cancelled'].includes(t.status))
            .filter(t => {
                if (filterAssignee !== 'all' && t.assignedTo !== filterAssignee) return false;
                if (filterProject !== 'all' && t.projectId !== filterProject) return false;
                // Consider "unscheduled" = hasn't hit estimatedHours yet or zero plan
                const planned = taskPlannedMap[t.id] || 0;
                return planned < (t.estimatedHours || 0.1); // include tasks with no estimate
            })
            .map(t => ({
                ...t,
                projectName: engProjects.find(p => p.id === t.projectId)?.name || '',
                plannedHours: taskPlannedMap[t.id] || 0
            }));
    }, [engTasks, engProjects, planItems, filterAssignee, filterProject]);

    // ──────────────── Filtered plan items for grid ────────────────
    const visiblePlanItems = useMemo(() => {
        return planItems.filter(pi => {
            if (filterAssignee !== 'all' && pi.assignedTo !== filterAssignee) return false;
            if (filterProject !== 'all' && pi.projectId !== filterProject) return false;
            return true;
        });
    }, [planItems, filterAssignee, filterProject]);

    // ──────────────── Drop handler ────────────────
    const handleDropTask = useCallback(async ({ taskId, date, hour, minute }) => {
        const task = engTasks.find(t => t.id === taskId);
        if (!task) return;

        const assignedMember = teamMembers.find(m => m.uid === task.assignedTo);

        const startDt = new Date(`${date}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00`);
        const defaultHours = task.estimatedHours > 0 ? Math.min(2, task.estimatedHours) : 1;
        const endDt = new Date(startDt.getTime() + defaultHours * 3600000);

        const planItem = {
            // ── Required scheduling fields ──
            taskId: task.id,
            weekStartDate: weekStartStr,
            date,
            dayOfWeek: startDt.getDay(),
            startDateTime: startDt.toISOString(),
            endDateTime: endDt.toISOString(),
            plannedHours: defaultHours,
            createdBy: user.uid,

            // ── Optional (for filtering queries) ──
            assignedTo: task.assignedTo,
            projectId: task.projectId,

            // ── TRANSITIONAL: snapshot fields ──
            // Still written for backward compatibility with existing data.
            // The frontend reads live data via enrichPlanItemsWithTasks().
            // TODO migration: stop writing these after full migration.
            taskTitleSnapshot: task.title,
            projectNameSnapshot: engProjects.find(p => p.id === task.projectId)?.name || '',
            assignedToName: assignedMember?.displayName || assignedMember?.email || '',
            statusSnapshot: task.status,
            priority: task.priority,
            colorKey: projectColorMap[task.projectId] || 'indigo',
        };

        try {
            // Build validation context for W1-W5 warnings
            const member = teamMembers.find(m => m.uid === task.assignedTo);
            const validationContext = {
                existingItems: rawPlanItems,
                linkedTask: task,
                weeklyCapacityHours: member?.weeklyCapacityHours || 40,
                allItemsForTask: rawPlanItems.filter(pi => pi.taskId === task.id),
            };

            const { id: newId, warnings } = await plannerService.createPlanItem(planItem, validationContext);

            // Show warnings (non-blocking)
            if (warnings && warnings.length > 0) {
                setPlannerWarnings(warnings);
                setTimeout(() => setPlannerWarnings([]), 8000);
            }

            // Clear any previous error
            setPlannerError(null);

            // Add to rawPlanItems — enrichment happens automatically via useMemo
            setRawPlanItems(prev => [...prev, { id: newId, ...planItem }]);

            // Sync to Gantt: update task dates from all planner blocks
            syncPlannerToGantt(taskId).catch(console.warn);
        } catch (e) {
            if (e.name === 'PlannerValidationError') {
                setPlannerError(e.validationErrors?.join(' | ') || e.message);
                setTimeout(() => setPlannerError(null), 8000);
            } else {
                console.error("Error saving plan item:", e);
                setPlannerError('Error inesperado al guardar el bloque.');
                setTimeout(() => setPlannerError(null), 5000);
            }
        }
    }, [engTasks, engProjects, teamMembers, weekStartStr, projectColorMap, user.uid]);

    // ──────────────── Resize handler ────────────────
    const handleBlockResize = useCallback(async (itemId, newEndDateTime) => {
        const item = planItems.find(i => i.id === itemId);
        if (!item) return;

        const startDt = parseISO(item.startDateTime);
        const endDt = new Date(newEndDateTime);
        const diffH = parseFloat(((endDt - startDt) / 3600000).toFixed(2));

        try {
            await plannerService.updatePlanItem(itemId, {
                endDateTime: endDt.toISOString(),
                plannedHours: diffH,
            });
            setRawPlanItems(prev => prev.map(pi =>
                pi.id === itemId ? { ...pi, endDateTime: endDt.toISOString(), plannedHours: diffH } : pi
            ));
        } catch (e) {
            console.error("Error resizing block:", e);
        }
    }, [planItems]);

    // ──────────────── Move block handler ────────────────
    const handleBlockMove = useCallback(async ({ itemId, date, hour, minute }) => {
        const item = planItems.find(i => i.id === itemId);
        if (!item) return;

        // Preserve the original duration
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
        };

        try {
            await plannerService.updatePlanItem(itemId, updates);
            setRawPlanItems(prev => prev.map(pi => pi.id === itemId ? { ...pi, ...updates } : pi));
            // Sync to Gantt
            syncPlannerToGantt(item.taskId).catch(console.warn);
        } catch (e) {
            console.error("Error moving block:", e);
        }
    }, [planItems, weekStartStr]);

    // ──────────────── Delete handler ────────────────
    const handleBlockDelete = useCallback(async (itemId) => {
        const item = rawPlanItems.find(pi => pi.id === itemId);
        try {
            await plannerService.deletePlanItem(itemId);
            setRawPlanItems(prev => prev.filter(pi => pi.id !== itemId));
            setSelectedItem(null);
            // Sync to Gantt: recalculate dates from remaining blocks
            if (item?.taskId) syncPlannerToGantt(item.taskId).catch(console.warn);
        } catch (e) {
            console.error("Error deleting block:", e);
        }
    }, [rawPlanItems]);

    // ──────────────── Modal save handler ────────────────
    const handleModalSave = useCallback(async (updates) => {
        if (!selectedItem) return;
        try {
            await plannerService.updatePlanItem(selectedItem.id, updates);
            setRawPlanItems(prev => prev.map(pi =>
                pi.id === selectedItem.id ? { ...pi, ...updates } : pi
            ));
            setSelectedItem(null);
        } catch (e) {
            console.error("Error saving block:", e);
        }
    }, [selectedItem]);

    // ──────────────── Open TaskDetailModal when a block is clicked ────────────────
    const handleBlockClick = useCallback((planItem) => {
        // Try to find the full task in engTasks
        const fullTask = engTasks.find(t => t.id === planItem.taskId) || null;
        setTaskModalTask(fullTask);
    }, [engTasks]);

    // ──────────────── Placement mode (+ button on sidebar card) ────────────────
    const handleStartPlacement = useCallback((task) => {
        setPlacingTask(task);
    }, []);

    const handleCancelPlacement = useCallback(() => {
        setPlacingTask(null);
    }, []);

    const handlePlacementComplete = useCallback(async (placement) => {
        if (!placement) {
            // Cancelled (e.g. ESC key)
            setPlacingTask(null);
            return;
        }
        await handleDropTask(placement);
        setPlacingTask(null);
    }, [handleDropTask]);

    // ──────────────── Capacity conflict detection ────────────────
    const conflictIds = useMemo(() => {
        const ids = new Set();
        // Simple O(n^2) overlap detection per assignee per day
        const byPersonDay = {};
        visiblePlanItems.forEach(pi => {
            const key = `${pi.assignedTo}-${pi.date}`;
            if (!byPersonDay[key]) byPersonDay[key] = [];
            byPersonDay[key].push(pi);
        });

        Object.values(byPersonDay).forEach(items => {
            for (let i = 0; i < items.length; i++) {
                for (let j = i + 1; j < items.length; j++) {
                    const a = items[i], b = items[j];
                    const aStart = new Date(a.startDateTime), aEnd = new Date(a.endDateTime);
                    const bStart = new Date(b.startDateTime), bEnd = new Date(b.endDateTime);
                    if (aStart < bEnd && aEnd > bStart) {
                        ids.add(a.id);
                        ids.add(b.id);
                    }
                }
            }
        });
        return ids;
    }, [visiblePlanItems]);

    const selectedTask = selectedItem ? engTasks.find(t => t.id === selectedItem.taskId) : null;

    // Total planned hours across all blocks for the task (used by modal)
    const totalPlannedHoursForTask = useMemo(() => {
        if (!taskModalTask) return 0;
        return planItems
            .filter(pi => pi.taskId === taskModalTask.id)
            .reduce((acc, pi) => acc + (pi.plannedHours || 0), 0);
    }, [planItems, taskModalTask]);

    return (
        <div className="flex flex-col h-dvh -m-4 md:-m-8 -mb-20 md:-mb-4 overflow-hidden bg-slate-950">

            {/* ══ Validation Error Bar ══ */}
            {plannerError && (
                <div className="mx-4 mt-2 flex items-center gap-3 bg-rose-500/15 border border-rose-500/30 text-rose-300 px-4 py-2.5 rounded-xl text-xs font-bold animate-in slide-in-from-top duration-200">
                    <span className="text-rose-400">✕</span>
                    <span className="flex-1">{plannerError}</span>
                    <button onClick={() => setPlannerError(null)} className="text-rose-400 hover:text-rose-300 p-1">✕</button>
                </div>
            )}

            {/* ══ Warnings Bar ══ */}
            {plannerWarnings.length > 0 && (
                <div className="mx-4 mt-2 flex flex-col gap-1 bg-amber-500/10 border border-amber-500/25 text-amber-300 px-4 py-2.5 rounded-xl text-xs font-bold animate-in slide-in-from-top duration-200">
                    {plannerWarnings.map((w, i) => <div key={i}>{w}</div>)}
                    <button onClick={() => setPlannerWarnings([])} className="self-end text-amber-400 hover:text-amber-300 text-[10px] mt-1">Cerrar</button>
                </div>
            )}

            {/* ══ Shared Banner ══ */}
            <TaskModuleBanner onNewTask={() => setTaskModalTask(null)} canEdit={canEdit}>
                {/* Week navigation */}
                <div className="flex items-center gap-1 bg-slate-800 rounded-lg p-0.5">
                    <button onClick={() => setWeekOffset(w => w - 1)} className="p-1.5 hover:bg-slate-700 rounded-md transition-colors text-slate-400">
                        <ChevronLeft className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => setWeekOffset(0)} className="px-2.5 py-1 text-xs font-bold text-slate-300 hover:bg-slate-700 rounded-md transition-colors whitespace-nowrap">
                        Esta Semana
                    </button>
                    <button onClick={() => setWeekOffset(w => w + 1)} className="p-1.5 hover:bg-slate-700 rounded-md transition-colors text-slate-400">
                        <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                </div>

                {/* Filters */}
                <select
                    value={filterAssignee}
                    onChange={e => setFilterAssignee(e.target.value)}
                    className="bg-slate-800 border border-slate-700 text-xs font-semibold text-slate-300 py-1.5 px-2.5 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none cursor-pointer"
                >
                    <option value="all">Todo el Equipo</option>
                    {teamMembers.map(m => (
                        <option key={m.uid} value={m.uid}>{m.displayName || m.email}</option>
                    ))}
                </select>

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

            {/* ── Main workspace ── */}
            <div className="flex flex-1 min-h-0 relative">
                {/* Mobile sidebar toggle */}
                <button
                    onClick={() => setSidebarOpen(o => !o)}
                    className="md:hidden fixed bottom-20 left-3 z-50 w-10 h-10 rounded-full bg-indigo-600 text-white shadow-lg shadow-indigo-600/30 flex items-center justify-center active:scale-90 transition-all"
                    title={sidebarOpen ? 'Cerrar panel' : 'Tareas sin planificar'}
                >
                    {sidebarOpen ? <PanelLeftClose className="w-5 h-5" /> : <PanelLeftOpen className="w-5 h-5" />}
                </button>

                {/* Mobile overlay backdrop */}
                {sidebarOpen && (
                    <div
                        className="md:hidden fixed inset-0 bg-black/50 z-40"
                        onClick={() => setSidebarOpen(false)}
                    />
                )}

                {/* Unscheduled tasks sidebar: hidden on mobile, shown on md+ */}
                <div className={`${sidebarOpen ? 'translate-x-0' : '-translate-x-full'
                    } md:translate-x-0 fixed md:relative z-40 md:z-auto h-full transition-transform duration-200 ease-in-out`}>
                    <PlannerSidebar
                        unscheduledTasks={unscheduledTasks}
                        searchQuery={searchQuery}
                        setSearchQuery={setSearchQuery}
                        onStartPlacement={(task) => { handleStartPlacement(task); setSidebarOpen(false); }}
                        onTaskEdit={(task) => { setTaskModalTask(task); setSidebarOpen(false); }}
                        placingTask={placingTask}
                        onCancelPlacement={handleCancelPlacement}
                    />
                </div>

                {/* Grid area */}
                <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
                    {loading ? (
                        <div className="flex-1 flex items-center justify-center text-slate-400 font-bold text-sm">
                            Cargando planificación...
                        </div>
                    ) : (
                        <>
                            <div className="flex-1 h-full min-h-0">
                                <PlannerGrid
                                    weekDays={weekDays}
                                    planItems={visiblePlanItems}
                                    conflictIds={conflictIds}
                                    onDropTask={handleDropTask}
                                    onBlockMove={handleBlockMove}
                                    onBlockResize={handleBlockResize}
                                    onBlockClick={handleBlockClick}
                                    onBlockDelete={handleBlockDelete}
                                    placingTask={placingTask}
                                    onPlacementComplete={handlePlacementComplete}
                                />
                            </div>
                            <WeeklyCapacitySummary
                                planItems={visiblePlanItems}
                                teamMembers={teamMembers}
                                weekDays={weekDays}
                            />
                        </>
                    )}
                </div>
            </div>

            {/* ✠ Task Detail Modal — create OR edit full task */}
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
