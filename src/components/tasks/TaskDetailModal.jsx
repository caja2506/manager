import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
    TASK_STATUS, TASK_PRIORITY,
} from '../../models/schemas';
import { createTask, updateTask, updateTaskStatus, deleteTask } from '../../services/taskService';
import { startTimer, stopTimer, getActiveTimerForTask, canManageOthersTimers } from '../../services/timeService';
import { resolveAreaSync } from '../../services/mappingService';
import { onProjectStations } from '../../services/stationService';
import { logActivity, ACTIVITY_TYPES } from '../../services/activityLogService';
import { useRole } from '../../contexts/RoleContext';
import { useAppData } from '../../contexts/AppDataContext';
import { useEngineeringData } from '../../hooks/useEngineeringData';
import {
    fetchProjectMilestones,
    fetchMilestoneWorkAreas,
    fetchTaskDependencies,
    fetchTaskPlannerItems,
} from '../../services/engineeringDataService';
import { deleteDependency } from '../../services/ganttService';

// Editor subcomponents
import TaskHeader from './editor/TaskHeader';
import TaskStatusStepper from './editor/TaskStatusStepper';
import TaskHealthScore from './editor/TaskHealthScore';
import TaskMainPanel from './editor/TaskMainPanel';
import TaskControlPanel from './editor/TaskControlPanel';
import TaskFooter from './editor/TaskFooter';

export default function TaskDetailModal({
    isOpen, onClose, task, projects = [], teamMembers = [], subtasks = [],
    taskTypes = [], userId, canEdit, canDelete
}) {
    const {
        setIsDelayReportOpen, setDelayReportTarget, setListManager,
    } = useAppData();
    const { role, teamRole, canEditDates } = useRole();
    const { timeLogs, engTasks, delays, workAreaTypes } = useEngineeringData();
    const isNew = !task;
    
    // El usuario puede editar si tiene permisos globales, si es el encargado de la tarea, o si es una tarea nueva
    const effectiveCanEdit = canEdit || (userId && task?.assignedTo === userId) || isNew;
    // Si el usuario es el encargado pero es técnico, le quitamos canEditDates 
    const effectiveCanEditDates = canEditDates || (effectiveCanEdit && teamRole !== 'technician');

    const [form, setForm] = useState({
        title: '',
        description: '',
        projectId: '',
        assignedBy: userId || '',
        assignedTo: '',
        priority: TASK_PRIORITY.MEDIUM,
        status: TASK_STATUS.BACKLOG,
        taskTypeId: '',
        areaId: '',
        milestoneId: '',
        stationId: '',
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
    // V5: Milestones and work areas for current project
    const [projectMilestones, setProjectMilestones] = useState([]);
    const [milestoneWorkAreas, setMilestoneWorkAreas] = useState([]);
    // Station support
    const [projectStations, setProjectStations] = useState([]);
    // Manual time tracking state
    const [isSavingManualTime, setIsSavingManualTime] = useState(false);

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
                areaId: task.areaId || task.workAreaTypeId || '',
                milestoneId: task.milestoneId || '',
                stationId: task.stationId || '',
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
                status: TASK_STATUS.BACKLOG, taskTypeId: '', areaId: '', milestoneId: '', stationId: '',
                dueDate: '',
                plannedStartDate: '', plannedEndDate: '',
                estimatedHours: '', blockedReason: '', percentComplete: 0,
            });
        }
    }, [task]);

    // Auto-resolve areaId if task has a taskTypeId but no areaId 
    // (runs when workAreaTypes finish loading or when task loads)
    useEffect(() => {
        if (!form.areaId && form.taskTypeId && workAreaTypes.length > 0) {
            const resolved = form.milestoneId
                ? resolveAreaSync(form.taskTypeId, milestoneWorkAreas)
                : resolveAreaSync(form.taskTypeId, workAreaTypes);
            if (resolved) {
                setForm(f => ({ ...f, areaId: resolved }));
            }
        }
    }, [form.areaId, form.taskTypeId, form.milestoneId, workAreaTypes, milestoneWorkAreas]);

    // V5: Fetch milestones for the current project
    useEffect(() => {
        const projectId = form.projectId;
        if (!projectId) {
            setProjectMilestones([]);
            setMilestoneWorkAreas([]);
            return;
        }
        let cancelled = false;
        fetchProjectMilestones(projectId)
            .then(ms => { if (!cancelled) setProjectMilestones(ms); })
            .catch(err => console.warn('TaskDetailModal: error fetching milestones:', err));
        return () => { cancelled = true; };
    }, [form.projectId]);

    // Load stations for the current project (real-time)
    useEffect(() => {
        const projectId = form.projectId;
        if (!projectId) {
            setProjectStations([]);
            return;
        }
        const unsub = onProjectStations(projectId, (stations) => {
            setProjectStations(stations);
        });
        return unsub;
    }, [form.projectId]);

    // V5: Fetch work areas when milestone changes
    useEffect(() => {
        const milestoneId = form.milestoneId;
        if (!milestoneId) {
            setMilestoneWorkAreas([]);
            return;
        }
        let cancelled = false;
        fetchMilestoneWorkAreas(milestoneId)
            .then(areas => { if (!cancelled) setMilestoneWorkAreas(areas); })
            .catch(err => console.warn('TaskDetailModal: error fetching work areas:', err));
        return () => { cancelled = true; };
    }, [form.milestoneId]);

    // Fetch dependencies & planner items for this task
    useEffect(() => {
        if (!task?.id) {
            setDependencies([]);
            setPlannerItems([]);
            return;
        }
        let cancelled = false;

        Promise.all([
            fetchTaskDependencies(task.id),
            fetchTaskPlannerItems(task.id),
        ]).then(([deps, planItems]) => {
            if (!cancelled) {
                setDependencies(deps);
                setPlannerItems(planItems);
            }
        }).catch(err => console.warn('TaskDetailModal: error fetching extra data:', err));

        return () => { cancelled = true; };
    }, [task?.id]);

    if (!isOpen) return null;

    // ── Handlers (business logic preserved) ──

    const handleAreaChange = (newAreaId) => {
        let newTypeId = form.taskTypeId;
        if (newAreaId && form.taskTypeId) {
            const selectedArea = workAreaTypes.find(a => a.id === newAreaId);
            if (selectedArea) {
                const allowedValues = selectedArea.taskTypeIds || selectedArea.defaultTaskTypes || [];
                const currentType = taskTypes.find(t => t.id === form.taskTypeId);
                if (currentType && allowedValues.length > 0 && !allowedValues.includes(currentType.id) && !allowedValues.includes(currentType.name)) {
                    newTypeId = ''; // Clear it if it doesn't belong
                }
            }
        }
        setForm(f => ({ ...f, areaId: newAreaId, taskTypeId: newTypeId }));
    };

    const handleTaskTypeChange = (newTypeId) => {
        let newAreaId = form.areaId;
        if (newTypeId) {
            const resolved = form.milestoneId
                ? resolveAreaSync(newTypeId, milestoneWorkAreas)
                : resolveAreaSync(newTypeId, workAreaTypes);
            if (resolved) newAreaId = resolved;
        }
        setForm(f => ({ ...f, taskTypeId: newTypeId, areaId: newAreaId }));
    };

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

            // Resolve areaId (prioritize explicit selection, then milestone mapping, then global mapping)
            let finalAreaId = form.areaId;
            if (!finalAreaId && form.taskTypeId) {
                finalAreaId = form.milestoneId 
                    ? resolveAreaSync(form.taskTypeId, milestoneWorkAreas)
                    : resolveAreaSync(form.taskTypeId, workAreaTypes);
            }

            const data = {
                ...form,
                milestoneId: form.milestoneId || null,
                areaId: finalAreaId || null,
                workAreaTypeId: finalAreaId || null, // V5-legacy bridge
                countsForScore: !!form.milestoneId,
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

                // ── Detect and log field changes ──
                const loggedInUserName = teamMembers?.find(m => m.uid === userId)?.displayName || null;

                if (form.priority !== task.priority) {
                    logActivity(task.id, {
                        type: ACTIVITY_TYPES.PRIORITY_CHANGED,
                        description: `Prioridad: ${task.priority} → ${form.priority}`,
                        userId, userName: loggedInUserName,
                        meta: { from: task.priority, to: form.priority },
                    });
                }
                if (form.assignedTo !== task.assignedTo) {
                    const fromName = teamMembers?.find(m => m.uid === task.assignedTo)?.displayName || task.assignedTo || '—';
                    const toName = teamMembers?.find(m => m.uid === form.assignedTo)?.displayName || form.assignedTo || '—';
                    logActivity(task.id, {
                        type: ACTIVITY_TYPES.ASSIGNEE_CHANGED,
                        description: `Reasignado: ${fromName} → ${toName}`,
                        userId, userName: loggedInUserName,
                        meta: { fromUser: task.assignedTo, toUser: form.assignedTo, fromName, toName },
                    });
                }
                if (form.dueDate !== (task.dueDate ? task.dueDate.substring(0, 10) : '')) {
                    logActivity(task.id, {
                        type: ACTIVITY_TYPES.DUE_DATE_CHANGED,
                        description: `Fecha límite: ${task.dueDate?.substring(0, 10) || '—'} → ${form.dueDate || '—'}`,
                        userId, userName: loggedInUserName,
                        meta: { from: task.dueDate?.substring(0, 10) || null, to: form.dueDate || null },
                    });
                }
                if (form.title !== task.title) {
                    logActivity(task.id, {
                        type: ACTIVITY_TYPES.TITLE_CHANGED,
                        description: `Título: "${task.title}" → "${form.title}"`,
                        userId, userName: loggedInUserName,
                        meta: { from: task.title, to: form.title },
                    });
                }
                if (form.description !== (task.description || '')) {
                    logActivity(task.id, {
                        type: ACTIVITY_TYPES.DESCRIPTION_CHANGED,
                        description: 'Descripción actualizada',
                        userId, userName: loggedInUserName,
                    });
                }
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

        // Log the status change (who made the change, not the assignee)
        const loggedInUserName = teamMembers?.find(m => m.uid === userId)?.displayName || null;
        logActivity(task.id, {
            type: ACTIVITY_TYPES.STATUS_CHANGED,
            description: `Estado: ${oldStatus} → ${newStatus}`,
            userId,
            userName: loggedInUserName,
            meta: { from: oldStatus, to: newStatus },
        });

        // If task is now completed, log that too
        if (newStatus === 'done') {
            logActivity(task.id, {
                type: ACTIVITY_TYPES.TASK_COMPLETED,
                description: `Tarea completada: ${form.title}`,
                userId,
                userName: loggedInUserName,
                meta: { completedAt: new Date().toISOString() },
            });
        }

        // Auto-Timer logic for IN_PROGRESS
        // Timer is created for the task's assignedTo user (not the logged-in user)
        const taskOwner = form.assignedTo || task?.assignedTo;
        const isSelf = taskOwner === userId;
        const canManageOthers = canManageOthersTimers(role, teamRole);

        if (newStatus === TASK_STATUS.IN_PROGRESS && oldStatus !== TASK_STATUS.IN_PROGRESS) {
            // Only start if: user is the assignee OR has permission to manage others
            if (taskOwner && (isSelf || canManageOthers)) {
                const existingTimer = getActiveTimerForTask(timeLogs, task.id);
                if (!existingTimer) {
                    const proj = projects?.find(p => p.id === (task.projectId || form.projectId));
                    const owner = teamMembers?.find(m => (m.uid || m.id) === taskOwner);
                    await startTimer({
                        taskId: task.id, projectId: task.projectId || form.projectId, userId: taskOwner,
                        notes: 'Auto-started in detail modal',
                        taskTitle: form.title || task.title || '',
                        projectName: proj?.name || '',
                        displayName: owner?.displayName || owner?.email || '',
                    });
                }
            }
        } else if (oldStatus === TASK_STATUS.IN_PROGRESS && newStatus !== TASK_STATUS.IN_PROGRESS) {
            // Stop the task's active timer (if any)
            if (isSelf || canManageOthers) {
                const activeLog = getActiveTimerForTask(timeLogs, task.id);
                if (activeLog) {
                    await stopTimer(activeLog.id);
                }
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

    const handleDeleteDependency = async (depId) => {
        try {
            await deleteDependency(depId);
            setDependencies(prev => prev.filter(d => d.id !== depId));
        } catch (err) {
            console.error('Error deleting dependency:', err);
        }
    };

    const handleAddManualTime = async (hours, date, notes) => {
        if (!task?.id) return;
        setIsSavingManualTime(true);
        try {
            const { addSimpleManualTimeLog } = await import('../../services/timeService');
            await addSimpleManualTimeLog({
                taskId: task.id,
                projectId: form.projectId,
                userId: userId,
                dateIso: date,
                hours: hours,
                notes: notes,
                overtime: false
            });
        } catch (err) {
            console.error("Error agregando tiempo manual:", err);
            alert("Hubo un error al agregar las horas manuales.");
        } finally {
            setIsSavingManualTime(false);
        }
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
                    workAreas={workAreaTypes}
                    stations={projectStations}
                    canEdit={effectiveCanEdit}
                    canDelete={canDelete}
                    onClose={onClose}
                    onDelete={handleDelete}
                    onOpenListManager={setListManager}
                    onTaskTypeChange={handleTaskTypeChange}
                    onAreaChange={handleAreaChange}
                />

                {/* Horizontal Status Stepper — only for existing tasks */}
                {!isNew && (
                    <TaskStatusStepper
                        currentStatus={form.status}
                        onStatusChange={handleStatusChange}
                        canEdit={effectiveCanEdit}
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
                        canEdit={effectiveCanEdit}
                        userId={userId}
                        userName={teamMembers?.find(m => m.uid === userId)?.displayName || null}
                    />

                    {/* Right: Control */}
                    <TaskControlPanel
                        form={form}
                        setForm={setForm}
                        isNew={isNew}
                        task={task}
                        canEdit={effectiveCanEdit}
                        canEditDates={effectiveCanEditDates}
                        subtasks={subtasks}
                        teamMembers={teamMembers}
                        taskTypes={taskTypes}
                        timeLogs={timeLogs}
                        allTasks={engTasks}
                        delays={delays}
                        dependencies={dependencies}
                        plannerItems={plannerItems}
                        projectMilestones={projectMilestones}
                        milestoneWorkAreas={milestoneWorkAreas}
                        onStatusChange={handleStatusChange}
                        onOpenDelayReport={handleOpenDelayReport}
                        onOpenListManager={setListManager}
                        onDeleteDependency={handleDeleteDependency}
                        onAddManualTime={handleAddManualTime}
                        isSavingManualTime={isSavingManualTime}
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
