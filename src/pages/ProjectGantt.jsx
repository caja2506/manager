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
    Workflow,
} from 'lucide-react';
import GanttGrid from '../components/gantt/GanttGrid';
import TaskDetailModal from '../components/tasks/TaskDetailModal';
import TaskModuleBanner from '../components/layout/TaskModuleBanner';
import MilestoneModal from '../components/milestones/MilestoneModal';
import { useAuth } from '../contexts/AuthContext';
import { useRole } from '../contexts/RoleContext';
import { useEngineeringData } from '../hooks/useEngineeringData';
import {
    getTasksForGantt,
    getDependencies,
    getProjectsForGantt,
    getTaskTypesForGantt,
    getUsersForGantt,
    getMilestonesForGantt,
    updateTaskGanttFields,
    createDependency,
    deleteDependency,
} from '../services/ganttService';
import { syncGanttToPlanner } from '../services/ganttPlannerSync';
import { useRef } from 'react';
import { parsePlannerExcel } from '../services/plannerExcelParser';
import { syncPlannerExcelToSupabase } from '../services/plannerExcelSyncService';
import PlannerImportModal from '../components/gantt/PlannerImportModal';

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
export default function ProjectGantt({ forceProjectId = null, renderMilestoneModal = null }) {
    const isEmbedded = !!forceProjectId;
    const { user } = useAuth();
    const { canEdit, canEditDates, canDelete } = useRole();
    const { engProjects, engTasks: globalTasks, engSubtasks, teamMembers, taskTypes: appTaskTypes } = useEngineeringData();

    // View state
    const [viewMode, setViewMode] = useState('weeks');
    const [viewStart, setViewStart] = useState(() => getMondayOfWeek());
    const [zoomLevel, setZoomLevel] = useState(1);
    const [showCriticalPath, setShowCriticalPath] = useState(false);

    // Data
    const [tasks, setTasks] = useState([]);
    const [dependencies, setDependencies] = useState([]);
    const [projects, setProjects] = useState([]);
    const [taskTypes, setTaskTypes] = useState([]);
    const [users, setUsers] = useState([]);
    const [milestones, setMilestones] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [groupBy, setGroupBy] = useState('milestone'); // 'type' | 'milestone'

    // Filters
    const [filterProject, setFilterProject] = useState(forceProjectId || '');
    const [filterAssignee, setFilterAssignee] = useState('');
    const [filterStatus, setFilterStatus] = useState('');

    // Unscheduled tasks panel
    const [showUnscheduled, setShowUnscheduled] = useState(false);
    const [schedulingTaskId, setSchedulingTaskId] = useState(null);
    const [placingTask, setPlacingTask] = useState(null); // task being placed via "+" button

    // Modal (same pattern as TaskManager)
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedTask, setSelectedTask] = useState(null);
    const [taskModalInitialData, setTaskModalInitialData] = useState({});
    const [pendingLink, setPendingLink] = useState(null); // { predecessorId, successorId }

    const openNew = () => { setSelectedTask(null); setTaskModalInitialData({}); setIsModalOpen(true); };
    const openTask = (task) => { setSelectedTask(task); setTaskModalInitialData({}); setIsModalOpen(true); };

    // Planner Excel Import States
    const plannerFileInputRef = useRef(null);
    const [isPlannerModalOpen, setIsPlannerModalOpen] = useState(false);
    const [plannerParsedData, setPlannerParsedData] = useState(null);
    const [plannerProjectName, setPlannerProjectName] = useState('');
    const [isSyncingPlanner, setIsSyncingPlanner] = useState(false);

    const handlePlannerExcelUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const activePid = forceProjectId || filterProject;
        if (!activePid) {
            alert('Por favor selecciona un proyecto antes de importar el Planner.');
            e.target.value = null;
            return;
        }

        try {
            const arrayBuffer = await file.arrayBuffer();
            const parsed = parsePlannerExcel(arrayBuffer, tasks, teamMembers, milestones);
            
            setPlannerProjectName(parsed.projectName);
            setPlannerParsedData(parsed);
            setIsPlannerModalOpen(true);
        } catch (err) {
            console.error('Error al analizar el Excel de Planner:', err);
            alert('Error al analizar el Excel: ' + err.message);
        } finally {
            e.target.value = null;
        }
    };

    const handleConfirmPlannerSync = async () => {
        const activePid = forceProjectId || filterProject;
        if (!activePid || !plannerParsedData) return;

        setIsSyncingPlanner(true);
        try {
            await syncPlannerExcelToSupabase(activePid, plannerParsedData, user?.uid);
            setIsPlannerModalOpen(false);
            setPlannerParsedData(null);
            alert('¡Sincronización de Planner completada con éxito!');
            await loadData();
        } catch (err) {
            console.error('Error al sincronizar Planner:', err);
            alert('Error al sincronizar: ' + err.message);
        } finally {
            setIsSyncingPlanner(false);
        }
    };

    // ---- Load data ----
    const loadData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const [tasksData, depsData, projectsData, typesData, usersData, milestonesData] = await Promise.all([
                getTasksForGantt(forceProjectId || filterProject || null),
                getDependencies(filterProject || null),
                getProjectsForGantt(),
                getTaskTypesForGantt(),
                getUsersForGantt(),
                getMilestonesForGantt(forceProjectId || filterProject || null),
            ]);
            setTasks(tasksData);
            setDependencies(depsData);
            setProjects(projectsData);
            setTaskTypes(typesData);
            setUsers(usersData);
            setMilestones(milestonesData);
        } catch (e) {
            setError(e.message || 'Error al cargar datos del Gantt.');
        } finally {
            setLoading(false);
        }
    }, [filterProject, forceProjectId]);

    useEffect(() => { loadData(); }, [loadData]);
    
    // Sync tasks reactively with Supabase real-time updates from hook
    useEffect(() => {
        if (globalTasks && globalTasks.length > 0) {
            const pid = forceProjectId || filterProject;
            const filtered = pid ? globalTasks.filter(t => t.projectId === pid) : globalTasks;
            const mappedTasks = filtered.map(t => ({
                ...t,
                taskType: t.taskTypeId || t.taskType, // bridge property names
            }));
            setTasks(mappedTasks);
        }
    }, [globalTasks, filterProject, forceProjectId]);

    const closeModal = () => { setIsModalOpen(false); setSelectedTask(null); loadData(); };

    // Milestone creation (defined AFTER loadData to avoid TDZ)
    const [isMilestoneModalOpen, setIsMilestoneModalOpen] = useState(false);
    const [milestoneParentId, setMilestoneParentId] = useState(null);
    const [milestoneParentName, setMilestoneParentName] = useState('');

    const handleCreateMilestone = useCallback(async (parentId, parentName) => {
        setMilestoneParentId(parentId);
        setMilestoneParentName(parentName || '');
        setIsMilestoneModalOpen(true);
    }, []);

    const handleSaveMilestone = useCallback(async (data) => {
        const projectId = forceProjectId || filterProject;
        if (!projectId) {
            alert('Selecciona un proyecto primero para crear un milestone.');
            return;
        }
        const { createMilestone } = await import('../services/milestoneService');
        await createMilestone(projectId, data, user?.uid);
        setIsMilestoneModalOpen(false);
        await loadData();
    }, [forceProjectId, filterProject, user, loadData]);

    const handleCreateTaskInMilestone = useCallback((milestoneId) => {
        setSelectedTask(null);
        setTaskModalInitialData({ milestoneId, projectId: forceProjectId || filterProject });
        setIsModalOpen(true);
    }, [forceProjectId, filterProject]);

    const handleDeleteMilestone = useCallback(async (milestoneId, milestoneName) => {
        if (!window.confirm(`¿Estás seguro de que deseas eliminar el milestone "${milestoneName}"?`)) return;
        try {
            const { deleteMilestone } = await import('../services/milestoneService');
            await deleteMilestone(milestoneId);
            await loadData();
        } catch (err) {
            console.error('Error deleting milestone:', err);
            alert('Error: ' + err.message);
        }
    }, [loadData]);

    // ---- Sync viewStart on mode change ----
    useEffect(() => {
        if (viewMode === 'weekly' || viewMode === 'weeks') {
            setViewStart(getMondayOfWeek());
        } else {
            setViewStart(getMonthStart());
        }
    }, [viewMode]);

    // ---- Navigation ----
    function navigate(dir) {
        if (viewMode === 'weekly' || viewMode === 'weeks') {
            setViewStart(prev => addWeeks(prev, dir));
        } else {
            setViewStart(prev => addMonths(prev, dir));
        }
    }

    function goToday() {
        if (viewMode === 'weekly' || viewMode === 'weeks') setViewStart(getMondayOfWeek());
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

    const handleAssignMilestone = useCallback(async (taskId, milestoneId) => {
        const val = milestoneId || null;
        try {
            await updateTaskGanttFields(taskId, { milestone: val });
            setTasks(prev => prev.map(t =>
                t.id === taskId ? { ...t, milestone: val, milestoneId: val } : t
            ));
        } catch (e) {
            console.error('Error assigning milestone:', e);
            alert('Error al asignar el milestone: ' + e.message);
        }
    }, []);

    const handleRemoveFromGantt = useCallback(async (task) => {
        if (!window.confirm(`¿Estás seguro de que deseas quitar la tarea "${task.title}" del Gantt?`)) return;
        try {
            await updateTaskGanttFields(task.id, {
                plannedStartDate: null,
                plannedEndDate: null,
                showInGantt: false,
            });
            // Update local state
            setTasks(prev => prev.map(t =>
                t.id === task.id ? { ...t, plannedStartDate: null, plannedEndDate: null, showInGantt: false } : t
            ));
        } catch (e) {
            console.error('Error removing task from Gantt:', e);
            alert('Error al quitar la tarea del Gantt: ' + e.message);
        }
    }, []);

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
        if (!canEditDates) return; // Technicians cannot drag existing bars
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
        const predecessor = tasks.find(t => t.id === predecessorId);
        if (!predecessor) return;

        for (const dep of affectedDeps) {
            const successor = tasks.find(t => t.id === dep.successorTaskId);
            if (!successor || !successor.plannedStartDate) continue;

            const duration = successor.plannedEndDate
                ? Math.round((new Date(successor.plannedEndDate + 'T12:00:00') - new Date(successor.plannedStartDate + 'T12:00:00')) / (24 * 60 * 60 * 1000))
                : 0;

            let needsUpdate = false;
            let newStart = successor.plannedStartDate;
            let newEnd = successor.plannedEndDate;

            const type = dep.type || 'FS';

            if (type === 'FS') {
                const succStart = new Date(successor.plannedStartDate + 'T12:00:00');
                const predEnd = new Date(predEndDate + 'T12:00:00');
                if (succStart <= predEnd) {
                    const nextDay = new Date(predEnd);
                    nextDay.setDate(nextDay.getDate() + 1);
                    newStart = toLocalDateStr(nextDay);
                    
                    const newEndD = new Date(nextDay);
                    newEndD.setDate(newEndD.getDate() + duration);
                    newEnd = toLocalDateStr(newEndD);
                    needsUpdate = true;
                }
            } else if (type === 'SS') {
                const succStart = new Date(successor.plannedStartDate + 'T12:00:00');
                const predStart = new Date(predecessor.plannedStartDate + 'T12:00:00');
                if (succStart < predStart) {
                    newStart = predecessor.plannedStartDate;
                    
                    const newEndD = new Date(predStart);
                    newEndD.setDate(newEndD.getDate() + duration);
                    newEnd = toLocalDateStr(newEndD);
                    needsUpdate = true;
                }
            } else if (type === 'FF') {
                const succEnd = new Date(successor.plannedEndDate + 'T12:00:00');
                const predEnd = new Date(predEndDate + 'T12:00:00');
                if (succEnd < predEnd) {
                    newEnd = predEndDate;
                    
                    const newStartD = new Date(predEnd);
                    newStartD.setDate(newStartD.getDate() - duration);
                    newStart = toLocalDateStr(newStartD);
                    needsUpdate = true;
                }
            } else if (type === 'SF') {
                const succEnd = new Date(successor.plannedEndDate + 'T12:00:00');
                const predStart = new Date(predecessor.plannedStartDate + 'T12:00:00');
                if (succEnd <= predStart) {
                    const nextDay = new Date(predStart);
                    nextDay.setDate(nextDay.getDate() + 1);
                    newEnd = toLocalDateStr(nextDay);
                    
                    const newStartD = new Date(nextDay);
                    newStartD.setDate(newStartD.getDate() - duration);
                    newStart = toLocalDateStr(newStartD);
                    needsUpdate = true;
                }
            }

            if (needsUpdate) {
                await updateTaskGanttFields(dep.successorTaskId, {
                    plannedStartDate: newStart,
                    plannedEndDate: newEnd,
                });
                setTasks(prev => prev.map(t =>
                    t.id === dep.successorTaskId ? { ...t, plannedStartDate: newStart, plannedEndDate: newEnd } : t
                ));
                // Recurse for chained successors
                await cascadeSuccessors(dep.successorTaskId, newEnd);
                
                // Sync to Weekly Planner
                syncGanttToPlanner({ taskId: dep.successorTaskId, startDate: newStart, endDate: newEnd, task: successor, userId: user?.uid }).catch(console.warn);
            }
        }
    }, [dependencies, tasks, user, toLocalDateStr]);

    // ---- Link created handler ----
    const handleLinkCreated = useCallback((predecessorId, successorId) => {
        if (predecessorId === successorId) return;
        if (dependencies.some(d => d.predecessorTaskId === predecessorId && d.successorTaskId === successorId)) {
            alert('Esta dependencia ya existe.');
            return;
        }
        setPendingLink({ predecessorId, successorId });
    }, [dependencies]);

    // ---- Link confirmed handler ----
    const handleConfirmPendingLink = async (type) => {
        if (!pendingLink) return;
        const { predecessorId, successorId } = pendingLink;
        setPendingLink(null);
        setLoading(true);
        try {
            const pred = tasks.find(t => t.id === predecessorId);
            const succ = tasks.find(t => t.id === successorId);
            const newDep = await createDependency({
                predecessorTaskId: predecessorId,
                successorTaskId: successorId,
                type: type,
                projectId: pred?.projectId || null,
                createdBy: user?.uid || null,
            });
            const depObj = {
                id: newDep,
                predecessorTaskId: predecessorId,
                successorTaskId: successorId,
                type: type,
            };
            setDependencies(prev => [...prev, depObj]);

            // Enforce selected relation dates
            if (pred && succ) {
                let newStart = succ.plannedStartDate;
                let newEnd = succ.plannedEndDate;

                const duration = (succ.plannedStartDate && succ.plannedEndDate)
                    ? Math.round((new Date(succ.plannedEndDate + 'T12:00:00') - new Date(succ.plannedStartDate + 'T12:00:00')) / (24 * 60 * 60 * 1000))
                    : 0;

                if (type === 'FS' && pred.plannedEndDate) {
                    const predEnd = new Date(pred.plannedEndDate + 'T12:00:00');
                    const nextDay = new Date(predEnd);
                    nextDay.setDate(nextDay.getDate() + 1);
                    newStart = toLocalDateStr(nextDay);

                    const newEndD = new Date(nextDay);
                    newEndD.setDate(newEndD.getDate() + duration);
                    newEnd = toLocalDateStr(newEndD);
                } else if (type === 'SS' && pred.plannedStartDate) {
                    newStart = pred.plannedStartDate;

                    const newEndD = new Date(newStart + 'T12:00:00');
                    newEndD.setDate(newEndD.getDate() + duration);
                    newEnd = toLocalDateStr(newEndD);
                } else if (type === 'FF' && pred.plannedEndDate) {
                    newEnd = pred.plannedEndDate;

                    const newStartD = new Date(newEnd + 'T12:00:00');
                    newStartD.setDate(newStartD.getDate() - duration);
                    newStart = toLocalDateStr(newStartD);
                } else if (type === 'SF' && pred.plannedStartDate) {
                    const predStart = new Date(pred.plannedStartDate + 'T12:00:00');
                    const nextDay = new Date(predStart);
                    nextDay.setDate(nextDay.getDate() + 1);
                    newEnd = toLocalDateStr(nextDay);

                    const newStartD = new Date(nextDay);
                    newStartD.setDate(newStartD.getDate() - duration);
                    newStart = toLocalDateStr(newStartD);
                }

                if (newStart !== succ.plannedStartDate || newEnd !== succ.plannedEndDate) {
                    await updateTaskGanttFields(successorId, {
                        plannedStartDate: newStart,
                        plannedEndDate: newEnd,
                    });

                    setTasks(prev => prev.map(t =>
                        t.id === successorId ? { ...t, plannedStartDate: newStart, plannedEndDate: newEnd } : t
                    ));

                    // Cascade any chained successors
                    await cascadeSuccessors(successorId, newEnd);

                    // Sync successor to Weekly Planner
                    syncGanttToPlanner({ taskId: successorId, startDate: newStart, endDate: newEnd, task: succ, userId: user?.uid }).catch(console.warn);
                }
            }

            await loadData();
        } catch (e) {
            console.error('Error creating dependency:', e);
            alert('Error al crear la dependencia: ' + e.message);
        } finally {
            setLoading(false);
        }
    };


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
        <div 
            className={isEmbedded ? 'flex flex-col text-white' : '-m-4 md:-m-8 flex flex-col bg-slate-950 text-white overflow-hidden'} 
            style={{ 
                minHeight: isEmbedded ? 'auto' : 'auto',
                height: isEmbedded ? '100%' : 'calc(100vh - 64px)'
            }}
        >

            {/* ══════ SHARED BANNER ══════ */}
            {!isEmbedded && (
                <TaskModuleBanner onNewTask={canEdit ? openNew : null} canEdit={canEdit} />
            )}

            {/* ══════ GANTT TOOLBAR (VISTA COMPLETA) ══════ */}
            {!isEmbedded && (
                <div className="flex flex-wrap items-center justify-between gap-3 py-1.5 px-4 bg-slate-900/40 border-b border-slate-800/50 shrink-0">
                    {/* Sección izquierda: Filtros y Estadísticas */}
                    <div className="flex flex-wrap items-center gap-3">
                        <div className="flex flex-wrap items-center gap-2">
                            <select
                                value={filterProject}
                                onChange={e => setFilterProject(e.target.value)}
                                className="bg-slate-800 border border-slate-700 rounded-lg px-2 text-[10px] font-semibold text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 max-w-[130px] h-8 cursor-pointer"
                            >
                                <option value="">Proyectos</option>
                                {projects.map(p => (
                                    <option key={p.id} value={p.id}>{p.name}</option>
                                ))}
                            </select>
                            <select
                                value={filterAssignee}
                                onChange={e => setFilterAssignee(e.target.value)}
                                className="bg-slate-800 border border-slate-700 rounded-lg px-2 text-[10px] font-semibold text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 max-w-[130px] h-8 cursor-pointer"
                            >
                                <option value="">Miembros</option>
                                {users.map(u => (
                                    <option key={u.id} value={u.id}>{u.displayName || u.email}</option>
                                ))}
                            </select>
                            <select
                                value={filterStatus}
                                onChange={e => setFilterStatus(e.target.value)}
                                className="bg-slate-800 border border-slate-700 rounded-lg px-2 text-[10px] font-semibold text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 max-w-[110px] h-8 cursor-pointer"
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
                                    className="text-[9px] text-slate-400 hover:text-white underline cursor-pointer"
                                >
                                    Limpiar
                                </button>
                            )}
                        </div>

                        <div className="flex flex-wrap items-center gap-2 border-l border-slate-800 pl-3">
                            <StatChip label="Tareas" value={stats.total} color="indigo" />
                            <StatChip label="Con fechas" value={stats.withDates} color="green" />
                            <StatChip label="Hitos" value={stats.milestones} color="amber" />
                            {stats.delayedTasks > 0 && (
                                <StatChip label="Atrasadas" value={stats.delayedTasks} color="red" icon={<AlertCircle className="w-3 h-3" />} />
                            )}
                        </div>
                    </div>

                    {/* Sección derecha: Herramientas Visuales (Toggle, Zoom, Refresh) */}
                    <div className="flex flex-wrap items-center gap-3">
                        {/* View toggle */}
                        <div className="flex items-center bg-slate-800 rounded-lg p-0.5 gap-0.5 border border-slate-700 h-8">
                            <button
                                onClick={() => setViewMode('weekly')}
                                className={`flex items-center gap-1 px-2.5 h-full rounded-md text-[10px] font-bold transition-all cursor-pointer ${viewMode === 'weekly' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'}`}
                            >
                                <Calendar className="w-3 h-3" />
                                Días
                            </button>
                            <button
                                onClick={() => setViewMode('monthly')}
                                className={`flex items-center gap-1 px-2.5 h-full rounded-md text-[10px] font-bold transition-all cursor-pointer ${viewMode === 'monthly' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'}`}
                            >
                                <BarChart2 className="w-3 h-3" />
                                Semanas
                            </button>
                            <button
                                onClick={() => setViewMode('weeks')}
                                className={`flex items-center gap-1 px-2.5 h-full rounded-md text-[10px] font-bold transition-all cursor-pointer ${viewMode === 'weeks' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'}`}
                            >
                                <CalendarRange className="w-3 h-3" />
                                Year by weeks
                            </button>
                        </div>
                        {/* Importar Planner */}
                        {canEdit && (forceProjectId || filterProject) && (
                            <button
                                onClick={() => plannerFileInputRef.current.click()}
                                className="flex items-center gap-1.5 px-2.5 h-8 rounded-lg text-[10px] font-bold border border-green-500/40 bg-green-500/15 text-green-400 hover:bg-green-500/25 transition-all cursor-pointer shadow-sm"
                                title="Importar Cronograma desde Excel (Planner)"
                            >
                                <CalendarPlus className="w-3.5 h-3.5" />
                                Importar Planner
                            </button>
                        )}

                        {/* Ruta Crítica */}
                        <button
                            onClick={() => setShowCriticalPath(prev => !prev)}
                            className={`flex items-center gap-1.5 px-2.5 h-8 rounded-lg text-[10px] font-bold border transition-all cursor-pointer ${showCriticalPath ? 'bg-red-500/20 text-red-400 border-red-500/40 shadow-sm' : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white hover:bg-slate-700'}`}
                            title="Mostrar Ruta Crítica"
                        >
                            <Workflow className="w-3.5 h-3.5" />
                            Ruta Crítica
                        </button>

                        {/* Zoom Slider */}
                        <div className="flex items-center gap-2 px-3 bg-slate-800/40 border border-slate-700/50 rounded-lg h-8">
                            <span className="text-[10px] text-slate-400 font-bold">Zoom</span>
                            <input
                                type="range"
                                min="0.5"
                                max="2"
                                step="0.1"
                                value={zoomLevel}
                                onChange={(e) => setZoomLevel(parseFloat(e.target.value))}
                                className="w-24 h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                            />
                        </div>

                    </div>
                </div>
            )}

            {/* ══════ GANTT TOOLBAR (VISTA EMBEDBIDA) ══════ */}
            {isEmbedded && (
                <div className="flex flex-wrap items-center justify-between gap-3 py-1.5 px-3 bg-slate-900/50 border-b border-slate-800/50 shrink-0">
                    {/* Sección izquierda: Filtros y Estadísticas */}
                    <div className="flex flex-wrap items-center gap-3">
                        <div className="flex flex-wrap items-center gap-2">
                            <select
                                value={filterAssignee}
                                onChange={e => setFilterAssignee(e.target.value)}
                                className="bg-slate-800 border border-slate-700 rounded-lg px-2 text-[10px] font-semibold text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 max-w-[130px] h-8 cursor-pointer"
                            >
                                <option value="">Miembros</option>
                                {users.map(u => (
                                    <option key={u.id} value={u.id}>{u.displayName || u.email}</option>
                                ))}
                            </select>
                            <select
                                value={filterStatus}
                                onChange={e => setFilterStatus(e.target.value)}
                                className="bg-slate-800 border border-slate-700 rounded-lg px-2 text-[10px] font-semibold text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 max-w-[110px] h-8 cursor-pointer"
                            >
                                <option value="">Estado</option>
                                <option value="backlog">Backlog</option>
                                <option value="pending">Pendiente</option>
                                <option value="in_progress">En Progreso</option>
                                <option value="completed">Completado</option>
                                <option value="blocked">Bloqueado</option>
                            </select>

                            {(filterAssignee || filterStatus) && (
                                <button
                                    onClick={() => { setFilterAssignee(''); setFilterStatus(''); }}
                                    className="text-[9px] text-slate-400 hover:text-white underline cursor-pointer"
                                >
                                    Limpiar
                                </button>
                            )}
                        </div>

                        <div className="flex flex-wrap items-center gap-2 border-l border-slate-800 pl-3">
                            <StatChip label="Tareas" value={stats.total} color="indigo" />
                            <StatChip label="Con fechas" value={stats.withDates} color="green" />
                            <StatChip label="Hitos" value={stats.milestones} color="amber" />
                            {stats.delayedTasks > 0 && (
                                <StatChip label="Atrasadas" value={stats.delayedTasks} color="red" icon={<AlertCircle className="w-3 h-3" />} />
                            )}
                        </div>
                    </div>

                    {/* Sección derecha: Herramientas Visuales */}
                    <div className="flex flex-wrap items-center gap-3">
                        {/* View toggle */}
                        <div className="flex items-center bg-slate-800 rounded-lg p-0.5 gap-0.5 border border-slate-700 h-8">
                            <button
                                onClick={() => setViewMode('weekly')}
                                className={`flex items-center gap-1 px-2.5 h-full rounded-md text-[10px] font-bold transition-all cursor-pointer ${viewMode === 'weekly' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'}`}
                            >
                                <Calendar className="w-3 h-3" /> Días
                            </button>
                            <button
                                onClick={() => setViewMode('monthly')}
                                className={`flex items-center gap-1 px-2.5 h-full rounded-md text-[10px] font-bold transition-all cursor-pointer ${viewMode === 'monthly' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'}`}
                            >
                                <BarChart2 className="w-3 h-3" /> Semanas
                            </button>
                            <button
                                onClick={() => setViewMode('weeks')}
                                className={`flex items-center gap-1 px-2.5 h-full rounded-md text-[10px] font-bold transition-all cursor-pointer ${viewMode === 'weeks' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'}`}
                            >
                                <CalendarRange className="w-3 h-3" /> Year by weeks
                            </button>
                        </div>
                        {/* Importar Planner Embebido */}
                        {canEdit && (forceProjectId || filterProject) && (
                            <button
                                onClick={() => plannerFileInputRef.current.click()}
                                className="flex items-center gap-1.5 px-2.5 h-8 rounded-lg text-[10px] font-bold border border-green-500/40 bg-green-500/15 text-green-400 hover:bg-green-500/25 transition-all cursor-pointer shadow-sm"
                                title="Importar Cronograma desde Excel (Planner)"
                            >
                                <CalendarPlus className="w-3.5 h-3.5" />
                                Importar Planner
                            </button>
                        )}

                        {/* Ruta Crítica Embebida */}
                        <button
                            onClick={() => setShowCriticalPath(prev => !prev)}
                            className={`flex items-center gap-1.5 px-2.5 h-8 rounded-lg text-[10px] font-bold border transition-all cursor-pointer ${showCriticalPath ? 'bg-red-500/20 text-red-400 border-red-500/40 shadow-sm' : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white hover:bg-slate-700'}`}
                            title="Mostrar Ruta Crítica"
                        >
                            <Workflow className="w-3.5 h-3.5" /> Ruta Crítica
                        </button>

                        {/* Zoom Slider */}
                        <div className="flex items-center gap-2 px-3 bg-slate-800/40 border border-slate-700/50 rounded-lg h-8">
                            <span className="text-[10px] text-slate-400 font-bold">Zoom</span>
                            <input
                                type="range"
                                min="0.5"
                                max="2"
                                step="0.1"
                                value={zoomLevel}
                                onChange={(e) => setZoomLevel(parseFloat(e.target.value))}
                                className="w-20 h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                            />
                        </div>

                    </div>
                </div>
            )}

            {/* ======== LEYENDA DE COLORES (AYUDA VISUAL) ======== */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 py-1.5 px-4 bg-slate-950 border-b border-slate-800/60 text-[10px] text-slate-400 shrink-0 font-medium select-none">
                <span className="font-bold text-slate-500 uppercase tracking-wider text-[9px]">Ayuda Visual (Colores):</span>
                <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded bg-emerald-500" />
                    <span>Completada</span>
                </div>

                <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded bg-amber-400" />
                    <span>En Riesgo (&lt;=3d, &lt;75% avance)</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded bg-indigo-500" />
                    <span>Al día (Color proyecto/tipo)</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded bg-slate-500" />
                    <span>Cancelada</span>
                </div>
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
            <div className="flex-1 min-h-0 p-0 flex flex-col overflow-hidden">
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
                        milestones={milestones}
                        groupBy={groupBy}
                        onGroupByChange={setGroupBy}
                        onCreateMilestone={handleCreateMilestone}
                        onCreateTaskInMilestone={handleCreateTaskInMilestone}
                        onDeleteMilestone={handleDeleteMilestone}
                        placingTask={placingTask}
                        onPlacementComplete={handlePlacementComplete}
                        onStartPlacement={handleStartPlacement}
                        onAssignMilestone={handleAssignMilestone}
                        users={users}
                        onTaskClick={openTask}
                        onBarDragEnd={handleBarDragEnd}
                        onLinkCreated={handleLinkCreated}
                        onDeleteDependency={handleDeleteDependency}
                        zoomLevel={zoomLevel}
                        showCriticalPath={showCriticalPath}
                        projects={projects}
                        onRemoveFromGantt={handleRemoveFromGantt}
                    />
                )}
            </div>

            {/* ======== TASK DETAIL MODAL ======== */}
            <TaskDetailModal
                isOpen={isModalOpen}
                onClose={closeModal}
                task={selectedTask}
                initialData={taskModalInitialData}
                projects={engProjects}
                teamMembers={teamMembers}
                subtasks={selectedTask ? engSubtasks.filter(s => s.taskId === selectedTask.id) : []}
                taskTypes={appTaskTypes}
                userId={user?.uid}
                canEdit={canEdit}
                canDelete={canDelete}
            />

            {/* ======== MILESTONE MODAL ======== */}
            <MilestoneModal
                isOpen={isMilestoneModalOpen}
                onClose={() => { setIsMilestoneModalOpen(false); setMilestoneParentId(null); setMilestoneParentName(''); }}
                onSave={handleSaveMilestone}
                parentMilestoneId={milestoneParentId}
                parentMilestoneName={milestoneParentName}
            />

            {/* ======== PLANNER IMPORT MODAL ======== */}
            <input
                type="file"
                ref={plannerFileInputRef}
                onChange={handlePlannerExcelUpload}
                accept=".xlsx, .xls"
                className="hidden"
            />
            <PlannerImportModal
                isOpen={isPlannerModalOpen}
                onClose={() => { setIsPlannerModalOpen(false); setPlannerParsedData(null); }}
                projectName={plannerProjectName}
                parsedData={plannerParsedData}
                onConfirm={handleConfirmPlannerSync}
                isSyncing={isSyncingPlanner}
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
