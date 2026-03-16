import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
    TASK_STATUS, TASK_PRIORITY, COLLECTIONS,
} from '../../models/schemas';
import { createTask, updateTask, updateTaskStatus, deleteTask } from '../../services/taskService';
import { startTimer, stopTimer, getActiveTimer } from '../../services/timeService';
import { useAppData } from '../../contexts/AppDataContext';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../../firebase';

// Editor subcomponents
import TaskHeader from './editor/TaskHeader';
import TaskStatusStepper from './editor/TaskStatusStepper';
import TaskHealthScore from './editor/TaskHealthScore';
import TaskMainPanel from './editor/TaskMainPanel';
import TaskControlPanel from './editor/TaskControlPanel';
import TaskFooter from './editor/TaskFooter';

export default function TaskDetailModal({
    isOpen, onClose, task, projects, teamMembers, subtasks,
    taskTypes, userId, canEdit, canDelete
}) {
    const {
        setIsDelayReportOpen, setDelayReportTarget, setListManager,
        timeLogs, engTasks, delays,
    } = useAppData();
    const isNew = !task;

    const [form, setForm] = useState({
        title: '',
        description: '',
        projectId: '',
        assignedBy: userId || '',
        assignedTo: '',
        priority: TASK_PRIORITY.MEDIUM,
        status: TASK_STATUS.BACKLOG,
        taskTypeId: '',
        dueDate: '',
        plannedStartDate: '',
        plannedEndDate: '',
        estimatedHours: '',
        blockedReason: '',
        percentComplete: 0,
    });

    const [isSaving, setIsSaving] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [deleteError, setDeleteError] = useState(null);
    const [dependencies, setDependencies] = useState([]);
    const [plannerItems, setPlannerItems] = useState([]);

    useEffect(() => {
        const toDate = (iso) => iso ? iso.substring(0, 10) : '';
        if (task) {
            setForm({
                title: task.title || '',
                description: task.description || '',
                projectId: task.projectId || '',
                assignedBy: task.assignedBy || userId || '',
                assignedTo: task.assignedTo || '',
                priority: task.priority || TASK_PRIORITY.MEDIUM,
                status: task.status || TASK_STATUS.BACKLOG,
                taskTypeId: task.taskTypeId || '',
                dueDate: toDate(task.dueDate),
                plannedStartDate: toDate(task.plannedStartDate),
                plannedEndDate: toDate(task.plannedEndDate),
                estimatedHours: task.estimatedHours || '',
                blockedReason: task.blockedReason || '',
                percentComplete: task.percentComplete ?? 0,
            });
        } else {
            setForm({
                title: '', description: '', projectId: '', assignedBy: userId || '',
                assignedTo: '', priority: TASK_PRIORITY.MEDIUM,
                status: TASK_STATUS.BACKLOG, taskTypeId: '', dueDate: '',
                plannedStartDate: '', plannedEndDate: '',
                estimatedHours: '', blockedReason: '', percentComplete: 0,
            });
        }
    }, [task]);

    // Fetch dependencies & planner items for this task
    useEffect(() => {
        if (!task?.id) {
            setDependencies([]);
            setPlannerItems([]);
            return;
        }
        let cancelled = false;

        const fetchExtra = async () => {
            try {
                // Dependencies (this task as predecessor or successor)
                const depsRef = collection(db, COLLECTIONS.TASK_DEPENDENCIES);
                const [predSnap, succSnap] = await Promise.all([
                    getDocs(query(depsRef, where('successorTaskId', '==', task.id))),
                    getDocs(query(depsRef, where('predecessorTaskId', '==', task.id))),
                ]);
                if (!cancelled) {
                    const all = [
                        ...predSnap.docs.map(d => ({ id: d.id, ...d.data() })),
                        ...succSnap.docs.map(d => ({ id: d.id, ...d.data() })),
                    ];
                    // Deduplicate by id
                    const unique = Array.from(new Map(all.map(d => [d.id, d])).values());
                    setDependencies(unique);
                }

                // Weekly planner items for this task
                const planRef = collection(db, COLLECTIONS.WEEKLY_PLAN_ITEMS || 'weeklyPlanItems');
                const planSnap = await getDocs(query(planRef, where('taskId', '==', task.id)));
                if (!cancelled) {
                    setPlannerItems(planSnap.docs.map(d => ({ id: d.id, ...d.data() })));
                }
            } catch (err) {
                console.warn('TaskDetailModal: error fetching extra data:', err);
            }
        };

        fetchExtra();
        return () => { cancelled = true; };
    }, [task?.id]);

    if (!isOpen) return null;

    // ── Handlers (business logic preserved) ──

    const handleSave = async () => {
        if (!form.title.trim()) return;
        setIsSaving(true);
        try {
            const toISO = (d) => d ? new Date(d + 'T00:00:00').toISOString() : null;

            // Auto-compute progress from subtasks when they exist
            const taskSubtasks = subtasks || [];
            const autoProgress = taskSubtasks.length > 0
                ? Math.round((taskSubtasks.filter(s => s.completed).length / taskSubtasks.length) * 100)
                : null;

            const data = {
                ...form,
                dueDate: toISO(form.dueDate),
                plannedStartDate: form.plannedStartDate || null,
                plannedEndDate: form.plannedEndDate || null,
                estimatedHours: form.estimatedHours ? Number(form.estimatedHours) : 0,
                percentComplete: autoProgress !== null ? autoProgress : Number(form.percentComplete ?? 0),
            };

            if (isNew) {
                await createTask(data, userId);
            } else {
                await updateTask(task.id, data);
            }
            onClose();
        } catch (err) {
            console.error('Error saving task:', err);
        }
        setIsSaving(false);
    };

    const handleStatusChange = async (newStatus) => {
        if (!task) return;
        const oldStatus = form.status;
        setForm(f => ({ ...f, status: newStatus }));
        await updateTaskStatus(task.id, newStatus, task.projectId || form.projectId);

        // Auto-Timer logic for IN_PROGRESS
        if (newStatus === TASK_STATUS.IN_PROGRESS && oldStatus !== TASK_STATUS.IN_PROGRESS) {
            const currentActive = getActiveTimer();
            if (!currentActive && userId) {
                await startTimer({ taskId: task.id, projectId: task.projectId || form.projectId, userId, notes: 'Auto-started in detail modal' });
            }
        } else if (oldStatus === TASK_STATUS.IN_PROGRESS && newStatus !== TASK_STATUS.IN_PROGRESS) {
            const currentActive = getActiveTimer();
            if (currentActive && currentActive.taskId === task.id) {
                await stopTimer(currentActive.logId);
            }
        }
    };

    const handleDelete = () => {
        if (!task) return;
        setDeleteError(null);
        setShowDeleteConfirm(true);
    };

    const confirmDeleteTask = async () => {
        if (!task) return;
        setIsDeleting(true);
        setDeleteError(null);
        try {
            await deleteTask(task.id);
            setShowDeleteConfirm(false);
            onClose();
        } catch (err) {
            console.error('Error deleting task:', err);
            setDeleteError(err.message || 'Error al eliminar la tarea. Verifica tus permisos.');
        } finally {
            setIsDeleting(false);
        }
    };

    const handleOpenDelayReport = () => {
        setDelayReportTarget({ type: 'task', id: task.id, projectId: task.projectId || form.projectId });
        setIsDelayReportOpen(true);
        onClose();
    };

    // ── Render ──

    return createPortal(
        <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[300] flex items-start md:items-start justify-center md:p-4 md:pt-6 overflow-y-auto"
            onClick={e => { if (e.target === e.currentTarget) onClose(); }}
        >
            <div className="relative bg-slate-900 shadow-2xl w-full md:max-w-4xl animate-in zoom-in-95 duration-200 flex flex-col min-h-screen md:min-h-0 md:max-h-[90vh] md:my-4 md:rounded-2xl md:ring-1 md:ring-slate-700 md:border md:border-slate-800">

                {/* Header */}
                <TaskHeader
                    form={form}
                    setForm={setForm}
                    isNew={isNew}
                    task={task}
                    projects={projects}
                    teamMembers={teamMembers}
                    taskTypes={taskTypes}
                    canEdit={canEdit}
                    canDelete={canDelete}
                    onClose={onClose}
                    onDelete={handleDelete}
                    onOpenListManager={setListManager}
                />

                {/* Horizontal Status Stepper — only for existing tasks */}
                {!isNew && (
                    <TaskStatusStepper
                        currentStatus={form.status}
                        onStatusChange={handleStatusChange}
                        canEdit={canEdit}
                    />
                )}

                {/* Health Score — quality indicator */}
                {!isNew && (
                    <div className="py-2">
                        <TaskHealthScore
                            form={form}
                            subtaskCount={(subtasks || []).length}
                        />
                    </div>
                )}

                {/* Body — Two Columns */}
                <div className="flex flex-col lg:flex-row flex-1 overflow-hidden">

                    {/* Left: Content & Execution */}
                    <TaskMainPanel
                        form={form}
                        setForm={setForm}
                        isNew={isNew}
                        task={task}
                        subtasks={subtasks}
                        canEdit={canEdit}
                    />

                    {/* Right: Control */}
                    <TaskControlPanel
                        form={form}
                        setForm={setForm}
                        isNew={isNew}
                        task={task}
                        canEdit={canEdit}
                        subtasks={subtasks}
                        teamMembers={teamMembers}
                        taskTypes={taskTypes}
                        timeLogs={timeLogs}
                        allTasks={engTasks}
                        delays={delays}
                        dependencies={dependencies}
                        plannerItems={plannerItems}
                        onStatusChange={handleStatusChange}
                        onOpenDelayReport={handleOpenDelayReport}
                        onOpenListManager={setListManager}
                    />
                </div>

                {/* Footer */}
                <TaskFooter
                    isNew={isNew}
                    isSaving={isSaving}
                    canSave={!!form.title.trim()}
                    canEdit={canEdit}
                    onSave={handleSave}
                    onClose={onClose}
                />

                {/* Custom Delete Confirmation Overlay */}
                {showDeleteConfirm && (
                    <div className="absolute inset-0 bg-black/70 backdrop-blur-sm rounded-2xl z-50 flex items-center justify-center p-6">
                        <div className="bg-slate-800 rounded-2xl p-6 max-w-sm w-full border border-slate-700 shadow-2xl space-y-4 animate-in zoom-in-95 duration-150">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-red-500/15 flex items-center justify-center flex-shrink-0">
                                    <svg className="w-5 h-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                </div>
                                <div>
                                    <h3 className="text-sm font-bold text-white">Eliminar Tarea</h3>
                                    <p className="text-xs text-slate-400 mt-0.5">Esta acción no se puede deshacer</p>
                                </div>
                            </div>
                            <p className="text-sm text-slate-300">
                                ¿Estás seguro de que deseas eliminar <span className="font-bold text-white">"{task?.title}"</span> y todas sus subtareas?
                            </p>
                            {deleteError && (
                                <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-3 py-2 text-xs text-red-400 font-medium">
                                    ⚠️ {deleteError}
                                </div>
                            )}
                            <div className="flex gap-3 pt-1">
                                <button
                                    onClick={() => { setShowDeleteConfirm(false); setDeleteError(null); }}
                                    disabled={isDeleting}
                                    className="flex-1 px-4 py-2.5 rounded-xl text-sm font-bold text-slate-300 bg-slate-700 hover:bg-slate-600 border border-slate-600 transition-all disabled:opacity-50"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={confirmDeleteTask}
                                    disabled={isDeleting}
                                    className="flex-1 px-4 py-2.5 rounded-xl text-sm font-bold text-white bg-red-600 hover:bg-red-500 border border-red-500 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                                >
                                    {isDeleting ? (
                                        <>
                                            <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                            </svg>
                                            Eliminando…
                                        </>
                                    ) : 'Sí, Eliminar'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>,
        document.body
    );
}
