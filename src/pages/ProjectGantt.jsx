/**
 * ProjectGantt — Page
 * ===================
 * Main Gantt module with Weekly / Monthly views.
 * Includes: project filter, assignee filter, status filter, view toggle, navigation.
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
    CalendarRange, ChevronLeft, ChevronRight,
    RefreshCw, GanttChartSquare, Calendar, BarChart2,
    AlertCircle, Loader2, Plus, CalendarPlus, ListPlus,
    ChevronDown, ChevronUp, Clock, User, FolderGit2,
} from 'lucide-react';
import GanttGrid from '../components/gantt/GanttGrid';
import TaskDetailModal from '../components/tasks/TaskDetailModal';
import TaskModuleBanner from '../components/layout/TaskModuleBanner';
import { useAuth } from '../contexts/AuthContext';
import { useRole } from '../contexts/RoleContext';
import { useAppData } from '../contexts/AppDataContext';
import {
    getTasksForGantt,
    getDependencies,
    getProjectsForGantt,
    getTaskTypesForGantt,
    getUsersForGantt,
    updateTaskGanttFields,
    createDependency,
    deleteDependency,
} from '../services/ganttService';
import { syncGanttToPlanner } from '../services/ganttPlannerSync';

// ---- Date helpers ----
function getMondayOfWeek(date = new Date()) {
    const d = new Date(date);
    const day = d.getDay(); // 0=Sun
    const diff = day === 0 ? -6 : 1 - day;
    d.setDate(d.getDate() + diff);
    d.setHours(0, 0, 0, 0);
    return d;
}

function getMonthStart(date = new Date()) {
    return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addDays(date, n) {
    const d = new Date(date);
    d.setDate(d.getDate() + n);
    return d;
}

function addWeeks(date, n) { return addDays(date, n * 7); }

function addMonths(date, n) {
    const d = new Date(date);
    d.setMonth(d.getMonth() + n);
    d.setDate(1);
    return d;
}

function formatRangeLabel(viewStart, viewMode) {
    if (viewMode === 'weekly') {
        const end = addDays(viewStart, 6);
        const opts = { day: 'numeric', month: 'short' };
        return `${viewStart.toLocaleDateString('es-MX', opts)} — ${end.toLocaleDateString('es-MX', opts)}`;
    }
    return viewStart.toLocaleDateString('es-MX', { month: 'long', year: 'numeric' });
}

// ---- Main Page ----
export default function ProjectGantt() {
    const { user } = useAuth();
    const { canEdit, canDelete } = useRole();
    const { engProjects, engSubtasks, teamMembers, taskTypes: appTaskTypes } = useAppData();

    // View state
    const [viewMode, setViewMode] = useState('weekly');
    const [viewStart, setViewStart] = useState(() => getMondayOfWeek());

    // Data
    const [tasks, setTasks] = useState([]);
    const [dependencies, setDependencies] = useState([]);
    const [projects, setProjects] = useState([]);
    const [taskTypes, setTaskTypes] = useState([]);
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Filters
    const [filterProject, setFilterProject] = useState('');
    const [filterAssignee, setFilterAssignee] = useState('');
    const [filterStatus, setFilterStatus] = useState('');

    // Unscheduled tasks panel
    const [showUnscheduled, setShowUnscheduled] = useState(false);
    const [schedulingTaskId, setSchedulingTaskId] = useState(null);
    const [placingTask, setPlacingTask] = useState(null); // task being placed via "+" button

    // Modal (same pattern as TaskManager)
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedTask, setSelectedTask] = useState(null);

    const openNew = () => { setSelectedTask(null); setIsModalOpen(true); };
    const openTask = (task) => { setSelectedTask(task); setIsModalOpen(true); };
    const closeModal = () => { setIsModalOpen(false); setSelectedTask(null); loadData(); };

    // ---- Load data ----
    const loadData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const [tasksData, depsData, projectsData, typesData, usersData] = await Promise.all([
                getTasksForGantt(filterProject || null),
                getDependencies(filterProject || null),
                getProjectsForGantt(),
                getTaskTypesForGantt(),
                getUsersForGantt(),
            ]);
            setTasks(tasksData);
            setDependencies(depsData);
            setProjects(projectsData);
            setTaskTypes(typesData);
            setUsers(usersData);
        } catch (e) {
            setError(e.message || 'Error al cargar datos del Gantt.');
        } finally {
            setLoading(false);
        }
    }, [filterProject]);

    useEffect(() => { loadData(); }, [loadData]);

    // ---- Sync viewStart on mode change ----
    useEffect(() => {
        if (viewMode === 'weekly') {
            setViewStart(getMondayOfWeek());
        } else {
            setViewStart(getMonthStart());
        }
    }, [viewMode]);

    // ---- Navigation ----
    function navigate(dir) {
        if (viewMode === 'weekly') {
            setViewStart(prev => addWeeks(prev, dir));
        } else {
            setViewStart(prev => addMonths(prev, dir));
        }
    }

    function goToday() {
        if (viewMode === 'weekly') setViewStart(getMondayOfWeek());
        else setViewStart(getMonthStart());
    }

    // ---- Client-side filters (status, assignee) ----
    const filteredTasks = useMemo(() => {
        let result = tasks;
        if (filterAssignee) result = result.filter(t => t.assignedTo === filterAssignee);
        if (filterStatus) result = result.filter(t => t.status === filterStatus);
        return result;
    }, [tasks, filterAssignee, filterStatus]);

    // ---- Unscheduled tasks ----
    const unscheduledTasks = useMemo(() => {
        return filteredTasks.filter(t => !t.plannedStartDate && t.status !== 'cancelled');
    }, [filteredTasks]);

    // ---- Placement mode: click "+" on task, then click on timeline ----
    const handleStartPlacement = useCallback((task) => {
        setPlacingTask(task);
    }, []);

    const handleCancelPlacement = useCallback(() => {
        setPlacingTask(null);
    }, []);

    const handlePlacementComplete = useCallback(async (dateStr) => {
        if (!placingTask || !dateStr) {
            setPlacingTask(null);
            return;
        }
        setSchedulingTaskId(placingTask.id);
        try {
            const startDate = dateStr; // YYYY-MM-DD from grid click
            const endD = new Date(dateStr + 'T12:00:00');
            endD.setDate(endD.getDate() + 3);
            const endDate = toLocalDateStr(endD);
            await updateTaskGanttFields(placingTask.id, {
                plannedStartDate: startDate,
                plannedEndDate: endDate,
                showInGantt: true,
            });
            setTasks(prev => prev.map(t =>
                t.id === placingTask.id ? { ...t, plannedStartDate: startDate, plannedEndDate: endDate, showInGantt: true } : t
            ));
            // Sync to Weekly Planner
            syncGanttToPlanner({ taskId: placingTask.id, startDate, endDate, task: placingTask, userId: user?.uid }).catch(console.warn);
        } catch (e) {
            console.error('Error placing task:', e);
        } finally {
            setSchedulingTaskId(null);
            setPlacingTask(null);
        }
    }, [placingTask, user]);

    // ---- Schedule ALL unscheduled tasks (batch — uses today as default) ----
    const handleScheduleAll = useCallback(async () => {
        setSchedulingTaskId('__all__');
        try {
            const today = new Date();
            const startDate = toLocalDateStr(today);
            const endD = new Date(today);
            endD.setDate(endD.getDate() + 3);
            const endDate = toLocalDateStr(endD);
            for (const task of unscheduledTasks) {
                await updateTaskGanttFields(task.id, {
                    plannedStartDate: startDate,
                    plannedEndDate: endDate,
                    showInGantt: true,
                });
            }
            setTasks(prev => prev.map(t => {
                if (!t.plannedStartDate && t.status !== 'cancelled') {
                    return { ...t, plannedStartDate: startDate, plannedEndDate: endDate, showInGantt: true };
                }
                return t;
            }));
        } catch (e) {
            console.error('Error scheduling all tasks:', e);
        } finally {
            setSchedulingTaskId(null);
        }
    }, [unscheduledTasks]);

    // ---- ESC to cancel placement ----
    useEffect(() => {
        if (!placingTask) return;
        const handler = (e) => { if (e.key === 'Escape') setPlacingTask(null); };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [placingTask]);

    // ---- Stats ----
    const stats = useMemo(() => {
        const total = filteredTasks.length;
        const withDates = filteredTasks.filter(t => t.plannedStartDate).length;
        const withoutDates = total - withDates;
        const milestones = filteredTasks.filter(t => t.milestone).length;
        const delayedTasks = filteredTasks.filter(t => {
            if (!t.plannedEndDate) return false;
            const end = new Date(t.plannedEndDate);
            return end < new Date() && t.status !== 'completed' && t.status !== 'cancelled';
        }).length;
        return { total, withDates, withoutDates, milestones, delayedTasks };
    }, [filteredTasks]);

    const userMap = useMemo(() => {
        const m = new Map();
        users.forEach(u => m.set(u.id, u));
        return m;
    }, [users]);

    // ---- Bar drag handler ----
    const handleBarDragEnd = useCallback(async ({ taskId, newStartDate, newEndDate }) => {
        try {
            await updateTaskGanttFields(taskId, {
                plannedStartDate: newStartDate,
                plannedEndDate: newEndDate,
            });
            // Update local state
            setTasks(prev => prev.map(t =>
                t.id === taskId ? { ...t, plannedStartDate: newStartDate, plannedEndDate: newEndDate } : t
            ));
            // Cascade dependencies
            await cascadeSuccessors(taskId, newEndDate);
            // Sync to Weekly Planner
            const task = tasks.find(t => t.id === taskId);
            syncGanttToPlanner({ taskId, startDate: newStartDate, endDate: newEndDate, task, userId: user?.uid }).catch(console.warn);
        } catch (e) {
            console.error('Error updating bar dates:', e);
        }
    }, [dependencies, tasks, user]);

    // ---- Cascade dependency dates ----
    const toLocalDateStr = (d) => {
        const yy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        return `${yy}-${mm}-${dd}`;
    };

    const cascadeSuccessors = useCallback(async (predecessorId, predEndDate) => {
        const affectedDeps = dependencies.filter(d => d.predecessorTaskId === predecessorId);
        for (const dep of affectedDeps) {
            const successor = tasks.find(t => t.id === dep.successorTaskId);
            if (!successor || !successor.plannedStartDate) continue;
            const succStart = new Date(successor.plannedStartDate + 'T12:00:00');
            const predEnd = new Date(predEndDate + 'T12:00:00');
            // If successor starts before predecessor ends, push it forward
            if (succStart <= predEnd) {
                const nextDay = new Date(predEnd);
                nextDay.setDate(nextDay.getDate() + 1);
                const newStart = toLocalDateStr(nextDay);
                // Keep same duration
                const duration = successor.plannedEndDate
                    ? Math.round((new Date(successor.plannedEndDate + 'T12:00:00') - new Date(successor.plannedStartDate + 'T12:00:00')) / (24 * 60 * 60 * 1000))
                    : 0;
                const newEndD = new Date(nextDay);
                newEndD.setDate(newEndD.getDate() + duration);
                const newEnd = toLocalDateStr(newEndD);
                await updateTaskGanttFields(dep.successorTaskId, {
                    plannedStartDate: newStart,
                    plannedEndDate: newEnd,
                });
                setTasks(prev => prev.map(t =>
                    t.id === dep.successorTaskId ? { ...t, plannedStartDate: newStart, plannedEndDate: newEnd } : t
                ));
                // Recurse for chained deps
                await cascadeSuccessors(dep.successorTaskId, newEnd);
            }
        }
    }, [dependencies, tasks]);

    // ---- Link created handler ----
    const handleLinkCreated = useCallback(async (predecessorId, successorId) => {
        // Don't create duplicate or self-links
        if (predecessorId === successorId) return;
        if (dependencies.some(d => d.predecessorTaskId === predecessorId && d.successorTaskId === successorId)) return;
        try {
            const pred = tasks.find(t => t.id === predecessorId);
            const succ = tasks.find(t => t.id === successorId);
            const newDep = await createDependency({
                predecessorTaskId: predecessorId,
                successorTaskId: successorId,
                type: 'FS',
                projectId: pred?.projectId || null,
                createdBy: user?.uid || null,
            });
            const depObj = {
                id: newDep,
                predecessorTaskId: predecessorId,
                successorTaskId: successorId,
                type: 'FS',
            };
            setDependencies(prev => [...prev, depObj]);

            // Enforce FS: successor starts day after predecessor ends
            if (pred?.plannedEndDate && succ) {
                const predEnd = new Date(pred.plannedEndDate + 'T12:00:00');
                const nextDay = new Date(predEnd);
                nextDay.setDate(nextDay.getDate() + 1);
                const newStart = toLocalDateStr(nextDay);

                // Keep same duration
                const duration = (succ.plannedStartDate && succ.plannedEndDate)
                    ? Math.round((new Date(succ.plannedEndDate + 'T12:00:00') - new Date(succ.plannedStartDate + 'T12:00:00')) / (24 * 60 * 60 * 1000))
                    : 0;
                const newEndD = new Date(nextDay);
                newEndD.setDate(newEndD.getDate() + duration);
                const newEnd = toLocalDateStr(newEndD);

                await updateTaskGanttFields(successorId, {
                    plannedStartDate: newStart,
                    plannedEndDate: newEnd,
                });

                // Cascade any chained successors
                await cascadeSuccessors(successorId, newEnd);

                // Sync successor to Weekly Planner
                syncGanttToPlanner({ taskId: successorId, startDate: newStart, endDate: newEnd, task: succ, userId: user?.uid }).catch(console.warn);
            }

            // Reload tasks to reflect updated positions
            await loadData();
        } catch (e) {
            console.error('Error creating dependency:', e);
        }
    }, [dependencies, tasks, user, cascadeSuccessors, loadData]);

    // ---- Delete dependency handler ----
    const handleDeleteDependency = useCallback(async (depId) => {
        try {
            await deleteDependency(depId);
            setDependencies(prev => prev.filter(d => d.id !== depId));
        } catch (e) {
            console.error('Error deleting dependency:', e);
        }
    }, []);

    return (
        <div className="-m-4 md:-m-8 flex flex-col bg-slate-950 text-white" style={{ minHeight: '100vh' }}>

            {/* ══════ SHARED BANNER ══════ */}
            <TaskModuleBanner onNewTask={canEdit ? openNew : null} canEdit={canEdit}>
                {/* View toggle */}
                <div className="flex items-center bg-slate-800 rounded-lg p-0.5 gap-0.5 border border-slate-700 h-8">
                    <button
                        onClick={() => setViewMode('weekly')}
                        className={`flex items-center gap-1 px-2.5 h-full rounded-md text-[10px] font-bold transition-all ${viewMode === 'weekly' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'}`}
                    >
                        <Calendar className="w-3 h-3" />
                        Semanal
                    </button>
                    <button
                        onClick={() => setViewMode('monthly')}
                        className={`flex items-center gap-1 px-2.5 h-full rounded-md text-[10px] font-bold transition-all ${viewMode === 'monthly' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'}`}
                    >
                        <BarChart2 className="w-3 h-3" />
                        Mensual
                    </button>
                </div>

                {/* Navigation */}
                <div className="flex items-center gap-0.5 bg-slate-800 rounded-lg border border-slate-700 p-0.5 h-8">
                    <button onClick={() => navigate(-1)} className="p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-slate-700 transition-all">
                        <ChevronLeft className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={goToday} className="px-2 rounded-md text-[10px] font-bold text-slate-300 hover:text-white hover:bg-slate-700 transition-all h-full">
                        Hoy
                    </button>
                    <button onClick={() => navigate(1)} className="p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-slate-700 transition-all">
                        <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                </div>

                {/* Range label */}
                <div className="flex items-center gap-1 px-2.5 bg-slate-800/60 rounded-lg border border-slate-700/50 h-8">
                    <CalendarRange className="w-3 h-3 text-indigo-400" />
                    <span className="text-[10px] font-semibold text-slate-200">
                        {formatRangeLabel(viewStart, viewMode)}
                    </span>
                </div>

                {/* Filters */}
                <select
                    value={filterProject}
                    onChange={e => setFilterProject(e.target.value)}
                    className="bg-slate-800 border border-slate-700 rounded-lg px-2 text-[10px] font-semibold text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 max-w-[130px] h-8"
                >
                    <option value="">Proyectos</option>
                    {projects.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                </select>
                <select
                    value={filterAssignee}
                    onChange={e => setFilterAssignee(e.target.value)}
                    className="bg-slate-800 border border-slate-700 rounded-lg px-2 text-[10px] font-semibold text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 max-w-[130px] h-8"
                >
                    <option value="">Miembros</option>
                    {users.map(u => (
                        <option key={u.id} value={u.id}>{u.name || u.email}</option>
                    ))}
                </select>
                <select
                    value={filterStatus}
                    onChange={e => setFilterStatus(e.target.value)}
                    className="bg-slate-800 border border-slate-700 rounded-lg px-2 text-[10px] font-semibold text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 max-w-[110px] h-8"
                >
                    <option value="">Estado</option>
                    <option value="backlog">Backlog</option>
                    <option value="pending">Pendiente</option>
                    <option value="in_progress">En Progreso</option>
                    <option value="validation">Validación</option>
                    <option value="completed">Completado</option>
                    <option value="blocked">Bloqueado</option>
                </select>

                {(filterProject || filterAssignee || filterStatus) && (
                    <button
                        onClick={() => { setFilterProject(''); setFilterAssignee(''); setFilterStatus(''); }}
                        className="text-[9px] text-slate-400 hover:text-white underline"
                    >
                        Limpiar
                    </button>
                )}

                <button
                    onClick={loadData}
                    className="p-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-400 hover:text-white hover:bg-slate-700 transition-all"
                    title="Actualizar"
                >
                    <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                </button>
            </TaskModuleBanner>

            {/* ======== STATS BAR ======== */}
            <div className="flex-shrink-0 flex items-center gap-3 md:gap-6 px-3 md:px-6 py-2 bg-slate-900/30 border-b border-slate-800/50 overflow-x-auto scrollbar-none">
                <StatChip label="Tareas" value={stats.total} color="indigo" />
                <StatChip label="Con fechas" value={stats.withDates} color="green" />

                <StatChip label="Hitos" value={stats.milestones} color="amber" />
                {stats.delayedTasks > 0 && (
                    <StatChip label="Atrasadas" value={stats.delayedTasks} color="red" icon={<AlertCircle className="w-3 h-3" />} />
                )}
                <span className="text-xs text-slate-600 ml-auto">Haz click en una barra para editar fechas</span>
            </div>



            {/* ======== PLACEMENT MODE INDICATOR ======== */}
            {placingTask && (
                <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 bg-amber-500 text-slate-900 px-5 py-2.5 rounded-xl text-xs font-black shadow-xl flex items-center gap-2.5 animate-bounce">
                    <CalendarPlus className="w-4 h-4" />
                    Click en el timeline para colocar "{placingTask.title}"
                    <button onClick={handleCancelPlacement} className="ml-2 px-2 py-0.5 bg-slate-900/30 text-white rounded-lg text-[10px] font-bold hover:bg-slate-900/50 transition-colors">
                        ESC Cancelar
                    </button>
                </div>
            )}

            {/* ======== BODY ======== */}
            <div className="flex-1 min-h-0 p-2 md:p-4 flex flex-col">
                {loading ? (
                    <div className="flex-1 flex items-center justify-center">
                        <div className="text-center space-y-3">
                            <Loader2 className="w-10 h-10 text-indigo-500 animate-spin mx-auto" />
                            <p className="text-sm text-slate-400 font-medium">Cargando Gantt...</p>
                        </div>
                    </div>
                ) : error ? (
                    <div className="flex-1 flex items-center justify-center">
                        <div className="text-center max-w-sm space-y-3">
                            <AlertCircle className="w-10 h-10 text-red-500 mx-auto" />
                            <p className="text-sm text-red-400">{error}</p>
                            <button onClick={loadData} className="px-4 py-2 bg-indigo-600 rounded-xl text-sm font-bold text-white hover:bg-indigo-500 transition-all">
                                Reintentar
                            </button>
                        </div>
                    </div>
                ) : filteredTasks.length === 0 ? (
                    <EmptyState viewMode={viewMode} />
                ) : (
                    <GanttGrid
                        tasks={filteredTasks}
                        dependencies={dependencies}
                        viewMode={viewMode}
                        viewStart={viewStart}
                        taskTypes={taskTypes}
                        placingTask={placingTask}
                        onPlacementComplete={handlePlacementComplete}
                        onStartPlacement={handleStartPlacement}
                        users={users}
                        onTaskClick={openTask}
                        onBarDragEnd={handleBarDragEnd}
                        onLinkCreated={handleLinkCreated}
                        onDeleteDependency={handleDeleteDependency}
                    />
                )}
            </div>

            {/* ======== TASK DETAIL MODAL ======== */}
            <TaskDetailModal
                isOpen={isModalOpen}
                onClose={closeModal}
                task={selectedTask}
                projects={engProjects}
                teamMembers={teamMembers}
                subtasks={selectedTask ? engSubtasks.filter(s => s.taskId === selectedTask.id) : []}
                taskTypes={appTaskTypes}
                userId={user?.uid}
                canEdit={canEdit}
                canDelete={canDelete}
            />
        </div>
    );
}

// ---- Sub-components ----

function StatChip({ label, value, color = 'indigo', icon }) {
    const colors = {
        indigo: 'text-indigo-400 bg-indigo-500/10',
        green: 'text-emerald-400 bg-emerald-500/10',
        amber: 'text-amber-400 bg-amber-500/10',
        red: 'text-red-400 bg-red-500/10',
    };
    return (
        <div className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-bold ${colors[color] || colors.indigo}`}>
            {icon}
            <span className="text-slate-400 font-medium">{label}</span>
            <span>{value}</span>
        </div>
    );
}

function EmptyState({ viewMode }) {
    return (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center py-16">
            <div className="w-16 h-16 rounded-2xl bg-slate-800/60 border border-slate-700 flex items-center justify-center">
                <GanttChartSquare className="w-8 h-8 text-slate-600" />
            </div>
            <div className="space-y-1.5">
                <p className="text-slate-300 font-semibold">No hay tareas en el Gantt</p>
                <p className="text-slate-500 text-sm max-w-xs">
                    Para que una tarea aparezca aquí, debe tener una <strong className="text-slate-400">Fecha inicio planificada</strong>.
                    Haz click en cualquier tarea y activa "Mostrar en Gantt".
                </p>
            </div>
            <div className="grid grid-cols-2 gap-3 mt-2 text-left">
                <Tip title="Vista Semanal" text="Detalle de los próximos 7 días — fechas exactas y dependencias inmediatas" />
                <Tip title="Vista Mensual" text="Panorama de 5 semanas — fases, hitos y camino lógico del proyecto" />
            </div>
        </div>
    );
}

function Tip({ title, text }) {
    return (
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-3 max-w-[200px]">
            <p className="text-xs font-bold text-indigo-400 mb-1">{title}</p>
            <p className="text-[11px] text-slate-400 leading-relaxed">{text}</p>
        </div>
    );
}
