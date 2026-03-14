import React, { useState, useEffect } from 'react';
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
        estimatedHours: '',
        blockedReason: '',
        percentComplete: 0,
    });

    const [isSaving, setIsSaving] = useState(false);
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
                estimatedHours: task.estimatedHours || '',
                blockedReason: task.blockedReason || '',
                percentComplete: task.percentComplete ?? 0,
            });
        } else {
            setForm({
                title: '', description: '', projectId: '', assignedBy: userId || '',
                assignedTo: '', priority: TASK_PRIORITY.MEDIUM,
                status: TASK_STATUS.BACKLOG, taskTypeId: '', dueDate: '',
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

    const handleDelete = async () => {
        if (!task || !confirm('¿Eliminar esta tarea y todas sus subtareas?')) return;
        await deleteTask(task.id);
        onClose();
    };

    const handleOpenDelayReport = () => {
        setDelayReportTarget({ type: 'task', id: task.id, projectId: task.projectId || form.projectId });
        setIsDelayReportOpen(true);
        onClose();
    };

    // ── Render ──

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[300] flex items-start justify-center p-4 pt-6 overflow-y-auto">
            <div className="bg-slate-900 rounded-2xl shadow-2xl w-full max-w-4xl animate-in zoom-in-95 duration-200 my-4 flex flex-col max-h-[90vh] ring-1 ring-slate-700 border border-slate-800">

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
            </div>
        </div>
    );
}
