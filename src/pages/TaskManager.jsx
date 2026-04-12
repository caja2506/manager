import React, { useState, useMemo, useCallback } from 'react';
import {
    DndContext, DragOverlay, closestCorners,
    PointerSensor, TouchSensor, useSensor, useSensors,
} from '@dnd-kit/core';
import {
    SortableContext, verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { useDroppable } from '@dnd-kit/core';

import { useAuth } from '../contexts/AuthContext';
import { useRole } from '../contexts/RoleContext';
import { useEngineeringData } from '../hooks/useEngineeringData';
import TaskCard from '../components/tasks/TaskCard';
import TaskDetailModal from '../components/tasks/TaskDetailModal';
import TransitionConfirmModal from '../components/workflow/TransitionConfirmModal';
import TaskModuleBanner from '../components/layout/TaskModuleBanner';
import { useWorkflowTransition } from '../hooks/useWorkflowTransition';
import { handleTaskStatusTimerSync, canManageOthersTimers } from '../services/timeService';
import {
    TASK_STATUS, TASK_STATUS_CONFIG, TASK_PRIORITY_CONFIG
} from '../models/schemas';
import { getAvailableTransitions } from '../core/workflow/workflowModel';
import {
    Plus, Search
} from 'lucide-react';

// ============================================================
// DROPPABLE COLUMN COMPONENT
// ============================================================

function KanbanColumn({ status, children, taskCount, isPlacementTarget, onPlacementClick }) {
    const cfg = TASK_STATUS_CONFIG[status];
    const { isOver, setNodeRef } = useDroppable({
        id: `column-${status}`,
        data: { type: 'column', status },
    });

    return (
        <div className="min-w-[250px] flex-1 flex flex-col">
            {/* Column Header */}
            <div className="flex items-center gap-2.5 mb-4 px-1">
                <span
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0 shadow-sm"
                    style={{ backgroundColor: cfg.color }}
                />
                <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.15em] leading-none">
                    {cfg.label.toUpperCase()}
                </h3>
                <span className="text-[10px] font-bold text-slate-500 bg-slate-800/80 px-2 py-0.5 rounded-full border border-slate-700/50 leading-none">
                    {taskCount}
                </span>
            </div>

            {/* Column Drop Zone */}
            <div
                ref={setNodeRef}
                onClick={onPlacementClick}
                className={`flex-1 space-y-3 overflow-y-auto pr-1 rounded-2xl transition-all duration-200 min-h-[120px] ${isOver
                    ? 'bg-indigo-500/10 ring-2 ring-indigo-500/40 ring-dashed p-2.5'
                    : isPlacementTarget
                        ? 'bg-emerald-500/10 ring-2 ring-emerald-400/50 ring-dashed p-2.5 cursor-pointer hover:bg-emerald-500/15'
                        : 'p-0'
                    }`}
            >
                {isPlacementTarget && (
                    <div className="flex items-center justify-center gap-2 py-3 text-emerald-400 animate-pulse">
                        <span className="text-xs font-bold">Click para mover aquí</span>
                    </div>
                )}
                {children}
            </div>
        </div>
    );
}

// ============================================================
// KANBAN COLUMNS CONFIG
// ============================================================

const KANBAN_COLUMNS = [
    TASK_STATUS.BACKLOG,
    TASK_STATUS.PENDING,
    TASK_STATUS.IN_PROGRESS,
    TASK_STATUS.VALIDATION,
    TASK_STATUS.COMPLETED,
    TASK_STATUS.BLOCKED,
];

// ============================================================
// MAIN COMPONENT
// ============================================================

export default function TaskManager() {
    const { user } = useAuth();
    const { canEdit, canDelete, role, teamRole } = useRole();
    const { engProjects, engTasks, engSubtasks, teamMembers, taskTypes, timeLogs } = useEngineeringData();

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedTask, setSelectedTask] = useState(null);
    const [search, setSearch] = useState('');
    const [filterProject, setFilterProject] = useState('');
    const [filterAssignee, setFilterAssignee] = useState('');
    const [filterPriority, setFilterPriority] = useState('');

    // Drag state
    const [activeId, setActiveId] = useState(null);
    const [movingTask, setMovingTask] = useState(null);

    const openNew = () => { setSelectedTask(null); setIsModalOpen(true); };
    const openTask = (task) => { setSelectedTask(task); setIsModalOpen(true); };
    const closeModal = () => { setIsModalOpen(false); setSelectedTask(null); };

    // Workflow transition hook
    const {
        requestTransition, confirmTransition, cancelTransition,
        pendingTransition, transitionError, isTransitioning,
    } = useWorkflowTransition();

    // --- Sensors ---
    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
        useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } }),
    );

    // --- Filter tasks ---
    const filteredTasks = useMemo(() => {
        return engTasks.filter(task => {
            const s = search.toLowerCase();
            const matchSearch = !s || (task.title || '').toLowerCase().includes(s) || (task.description || '').toLowerCase().includes(s);
            const matchProject = !filterProject || task.projectId === filterProject;
            const matchAssignee = !filterAssignee || task.assignedTo === filterAssignee;
            const matchPriority = !filterPriority || task.priority === filterPriority;
            return matchSearch && matchProject && matchAssignee && matchPriority;
        });
    }, [engTasks, search, filterProject, filterAssignee, filterPriority]);

    // --- Group by status ---
    const tasksByStatus = useMemo(() => {
        const map = {};
        Object.values(TASK_STATUS).forEach(s => { map[s] = []; });
        filteredTasks.forEach(t => {
            if (map[t.status]) map[t.status].push(t);
            else map[TASK_STATUS.BACKLOG].push(t);
        });
        const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
        Object.keys(map).forEach(key => {
            map[key].sort((a, b) => (priorityOrder[a.priority] || 2) - (priorityOrder[b.priority] || 2));
        });
        return map;
    }, [filteredTasks]);

    // Active dragged task
    const activeTask = activeId ? engTasks.find(t => t.id === activeId) : null;

    // Cancelled (only shown if any exist, in a collapsed section)
    const cancelledTasks = tasksByStatus[TASK_STATUS.CANCELLED] || [];

    // --- DnD Handlers ---
    const handleDragStart = useCallback((event) => {
        setActiveId(event.active.id);
    }, []);

    const handleDragEnd = useCallback(async (event) => {
        setActiveId(null);
        const { active, over } = event;
        if (!over || !canEdit) return;

        const taskId = active.id;
        const task = engTasks.find(t => t.id === taskId);
        if (!task) return;

        let targetStatus = null;

        if (over.data?.current?.type === 'column') {
            targetStatus = over.data.current.status;
        } else if (over.data?.current?.type === 'task') {
            const overTask = engTasks.find(t => t.id === over.id);
            if (overTask) targetStatus = overTask.status;
        }

        if (!targetStatus || targetStatus === task.status) return;

        const result = requestTransition(task, targetStatus, user.uid);

        if (!result.allowed) {
            console.warn('Transition blocked:', result.error);
            return;
        }

        if (result.needsConfirmation) return;

        try {
            await result.execute();

            // Auto-timer: start for the task's assignedTo, not the dragging user
            const taskOwner = task.assignedTo;
            const isSelf = taskOwner === user.uid;
            const canManageOthers = canManageOthersTimers(role, teamRole);

            if (targetStatus === TASK_STATUS.IN_PROGRESS && task.status !== TASK_STATUS.IN_PROGRESS) {
                if (taskOwner && (isSelf || canManageOthers)) {
                    const proj = engProjects.find(p => p.id === task.projectId);
                    const owner = teamMembers.find(m => (m.uid || m.id) === taskOwner);
                    await handleTaskStatusTimerSync({
                        taskId, projectId: task.projectId, newStatus: targetStatus,
                        userId: taskOwner, timeLogs,
                        taskTitle: task.title || '',
                        projectName: proj?.name || '',
                        displayName: owner?.displayName || owner?.email || '',
                        onConfirm: ({ activeTaskTitle, newTaskTitle }) =>
                            window.confirm(`Ya tienes un timer activo en "${activeTaskTitle}". ¿Detenerlo e iniciar "${newTaskTitle}"?`),
                    });
                }
            } else if (task.status === TASK_STATUS.IN_PROGRESS && targetStatus !== TASK_STATUS.IN_PROGRESS) {
                if (isSelf || canManageOthers) {
                    await handleTaskStatusTimerSync({
                        taskId, projectId: task.projectId, newStatus: targetStatus,
                        userId: taskOwner, timeLogs,
                    });
                }
            }
        } catch (err) {
            console.error('Error updating task status:', err);
        }
    }, [engTasks, engProjects, teamMembers, canEdit, user, requestTransition, role, teamRole, timeLogs]);

    const handleDragCancel = useCallback(() => {
        setActiveId(null);
    }, []);

    // --- Placement mode: valid target statuses ---
    const validMoveTargets = useMemo(() => {
        if (!movingTask) return new Set();
        return new Set(getAvailableTransitions(movingTask.status));
    }, [movingTask]);

    // --- Handle placement click on column ---
    const handlePlacementClick = useCallback(async (targetStatus) => {
        if (!movingTask) return;
        const task = movingTask;
        setMovingTask(null);

        const result = requestTransition(task, targetStatus, user.uid);
        if (!result.allowed) {
            console.warn('Transition blocked:', result.error);
            return;
        }
        if (result.needsConfirmation) return;

        try {
            await result.execute();

            const taskOwner = task.assignedTo;
            const isSelf = taskOwner === user.uid;
            const canManageOthers = canManageOthersTimers(role, teamRole);

            if (targetStatus === TASK_STATUS.IN_PROGRESS && task.status !== TASK_STATUS.IN_PROGRESS) {
                if (taskOwner && (isSelf || canManageOthers)) {
                    const proj = engProjects.find(p => p.id === task.projectId);
                    const owner = teamMembers.find(m => (m.uid || m.id) === taskOwner);
                    await handleTaskStatusTimerSync({
                        taskId: task.id, projectId: task.projectId, newStatus: targetStatus,
                        userId: taskOwner, timeLogs,
                        taskTitle: task.title || '',
                        projectName: proj?.name || '',
                        displayName: owner?.displayName || owner?.email || '',
                        onConfirm: ({ activeTaskTitle, newTaskTitle }) =>
                            window.confirm(`Ya tienes un timer activo en "${activeTaskTitle}". ¿Detenerlo e iniciar "${newTaskTitle}"?`),
                    });
                }
            } else if (task.status === TASK_STATUS.IN_PROGRESS && targetStatus !== TASK_STATUS.IN_PROGRESS) {
                if (isSelf || canManageOthers) {
                    await handleTaskStatusTimerSync({
                        taskId: task.id, projectId: task.projectId, newStatus: targetStatus,
                        userId: taskOwner, timeLogs,
                    });
                }
            }
        } catch (err) {
            console.error('Error updating task status:', err);
        }
    }, [movingTask, engProjects, teamMembers, user, requestTransition, role, teamRole, timeLogs]);

    return (
        <div className="-m-4 md:-m-8 flex flex-col bg-slate-950 text-white" style={{ minHeight: '100vh' }}>
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

            <TransitionConfirmModal
                isOpen={!!pendingTransition}
                pending={pendingTransition}
                isTransitioning={isTransitioning}
                onConfirm={confirmTransition}
                onCancel={cancelTransition}
            />

            {/* Transition Error Toast */}
            {transitionError && (
                <div className="fixed bottom-24 md:bottom-4 left-1/2 -translate-x-1/2 z-[201] bg-rose-600 text-white text-sm font-bold px-4 py-2.5 rounded-xl shadow-lg animate-in fade-in slide-in-from-bottom-4">
                    {transitionError}
                </div>
            )}

            {/* ══════════════ SHARED BANNER ══════════════ */}
            <TaskModuleBanner onNewTask={canEdit ? openNew : null} canEdit={canEdit} />

            {/* ══════════════ FILTERS BAR (always visible) ══════════════ */}
            <div className="flex flex-wrap gap-2 items-center px-6 py-2 border-b border-slate-800/40">
                <div className="relative flex-1 min-w-[160px] max-w-xs">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
                    <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar..."
                        className="pl-8 pr-3 py-1.5 w-full border border-slate-700/60 rounded-lg text-xs text-white outline-none focus:ring-1 focus:ring-indigo-500/50 bg-slate-800/60 placeholder:text-slate-600" />
                </div>
                <select value={filterProject} onChange={e => setFilterProject(e.target.value)}
                    className="px-3 py-1.5 border border-slate-700/60 rounded-lg text-xs text-slate-300 outline-none focus:ring-1 focus:ring-indigo-500/50 bg-slate-800/60 cursor-pointer">
                    <option value="">Todos los proyectos</option>
                    {engProjects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <select value={filterAssignee} onChange={e => setFilterAssignee(e.target.value)}
                    className="px-3 py-1.5 border border-slate-700/60 rounded-lg text-xs text-slate-300 outline-none focus:ring-1 focus:ring-indigo-500/50 bg-slate-800/60 cursor-pointer">
                    <option value="">Todos los miembros</option>
                    {teamMembers.map(u => <option key={u.uid} value={u.uid}>{u.displayName || u.email}</option>)}
                </select>
                <select value={filterPriority} onChange={e => setFilterPriority(e.target.value)}
                    className="px-3 py-1.5 border border-slate-700/60 rounded-lg text-xs text-slate-300 outline-none focus:ring-1 focus:ring-indigo-500/50 bg-slate-800/60 cursor-pointer">
                    <option value="">Todas las prioridades</option>
                    {Object.entries(TASK_PRIORITY_CONFIG).map(([key, cfg]) => <option key={key} value={key}>{cfg.label}</option>)}
                </select>
                {(search || filterProject || filterAssignee || filterPriority) && (
                    <button onClick={() => { setSearch(''); setFilterProject(''); setFilterAssignee(''); setFilterPriority(''); }}
                        className="text-[11px] text-rose-400 hover:text-rose-300 px-2 py-1 rounded hover:bg-rose-500/10 transition-colors">
                        Limpiar
                    </button>
                )}
            </div>

            {/* ══════════════ KANBAN BOARD ══════════════ */}
            <DndContext
                sensors={sensors}
                collisionDetection={closestCorners}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
                onDragCancel={handleDragCancel}
            >
                <div className="flex-1 overflow-x-auto pb-4 px-6 pt-4">
                    <div className="flex gap-5 h-full min-h-[400px]">
                        {KANBAN_COLUMNS.map((status) => {
                            const columnTasks = tasksByStatus[status] || [];
                            return (
                                <KanbanColumn key={status} status={status} taskCount={columnTasks.length}
                                    isPlacementTarget={movingTask && movingTask.status !== status && validMoveTargets.has(status)}
                                    onPlacementClick={movingTask && validMoveTargets.has(status) ? () => handlePlacementClick(status) : undefined}
                                >
                                    <SortableContext
                                        items={columnTasks.map(t => t.id)}
                                        strategy={verticalListSortingStrategy}
                                    >
                                        {columnTasks.length === 0 ? (
                                            <div className="border-2 border-dashed border-slate-700/50 rounded-2xl p-8 text-center min-h-[100px] flex items-center justify-center">
                                                <p className="text-[12px] text-slate-600 font-medium">Sin tareas</p>
                                            </div>
                                        ) : (
                                            columnTasks.map(task => (
                                                <TaskCard
                                                    key={task.id}
                                                    task={task}
                                                    project={engProjects.find(p => p.id === task.projectId)}
                                                    teamMembers={teamMembers}
                                                    subtasks={engSubtasks.filter(s => s.taskId === task.id)}
                                                    timeLogs={timeLogs}
                                                    onClick={() => openTask(task)}
                                                    currentUserId={user?.uid}
                                                    userRole={role}
                                                    userTeamRole={teamRole}
                                                    onStartMove={canEdit ? (t) => setMovingTask(movingTask?.id === t.id ? null : t) : undefined}
                                                    isMoving={movingTask?.id === task.id}
                                                />
                                            ))
                                        )}
                                    </SortableContext>
                                </KanbanColumn>
                            );
                        })}
                    </div>
                </div>

                {/* Drag Overlay */}
                <DragOverlay dropAnimation={{
                    duration: 200,
                    easing: 'cubic-bezier(0.18, 0.67, 0.6, 1.22)',
                }}>
                    {activeTask ? (
                        <div className="w-[280px]">
                            <TaskCard
                                task={activeTask}
                                project={engProjects.find(p => p.id === activeTask.projectId)}
                                teamMembers={teamMembers}
                                subtasks={engSubtasks.filter(s => s.taskId === activeTask.id)}
                                timeLogs={timeLogs}
                                onClick={() => { }}
                                isDragOverlay
                                currentUserId={user?.uid}
                                userRole={role}
                                userTeamRole={teamRole}
                            />
                        </div>
                    ) : null}
                </DragOverlay>
            </DndContext>

            {/* ══════════════ CANCELLED (separate, collapsed) ══════════════ */}
            {cancelledTasks.length > 0 && (
                <div className="bg-slate-900/50 rounded-2xl border border-slate-800/60 p-5 flex-shrink-0 mx-6 mb-4">
                    <div className="flex items-center gap-2.5 mb-3">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: TASK_STATUS_CONFIG.cancelled.color }} />
                        <h3 className="text-[11px] font-black text-slate-500 uppercase tracking-[0.15em]">
                            Canceladas ({cancelledTasks.length})
                        </h3>
                    </div>
                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                        {cancelledTasks.map(task => (
                            <TaskCard
                                key={task.id}
                                task={task}
                                project={engProjects.find(p => p.id === task.projectId)}
                                teamMembers={teamMembers}
                                subtasks={engSubtasks.filter(s => s.taskId === task.id)}
                                timeLogs={timeLogs}
                                onClick={() => openTask(task)}
                                currentUserId={user?.uid}
                                userRole={role}
                                userTeamRole={teamRole}
                            />
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
