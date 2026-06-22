import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useEngineeringData } from '../hooks/useEngineeringData';
import { useAuth } from '../contexts/AuthContext';
import { useRole } from '../contexts/RoleContext';
import { format, startOfWeek } from 'date-fns';
import { es } from 'date-fns/locale';
import { 
    User, CalendarDays, ExternalLink, Play, Square, Pause, 
    Check, AlertCircle, ChevronRight, MessageSquare, ChevronDown, Calendar, Plus
} from 'lucide-react';

// Task modals
import TaskDetailModal from '../components/tasks/TaskDetailModal';
import WipBlockModal from '../components/tasks/WipBlockModal';

// Data hook
import { useMyWorkData } from '../hooks/useMyWorkData';

// Planner service & Supabase
import { plannerService } from '../services/plannerService';
import { supabase } from '../supabase';

// Services
import { updateTask, updateTaskStatus, toggleSubtask, createSubtask } from '../services/taskService';
import { 
    getActiveTimerFromLogs, formatElapsed, stopTimer, startTimerSafe, clearLegacyTimer 
} from '../services/timeService';

// Configurations
import { TASK_STATUS_CONFIG, TASK_PRIORITY_CONFIG } from '../models/schemas';

// Greeting helper
function getGreeting() {
    const h = new Date().getHours();
    if (h < 12) return 'Buenos días';
    if (h < 19) return 'Buenas tardes';
    return 'Buenas noches';
}

const GRID_COLS = '28px minmax(180px, 1.2fr) minmax(120px, 1fr) 32px 50px 86px 68px 56px minmax(100px, 140px) 76px 85px 60px';

const PRIORITY_BADGES = {
    critical: { label: 'CRÍTICA', bg: 'rgba(239, 68, 68, 0.15)', text: '#ef4444' },
    high:     { label: 'ALTA',    bg: 'rgba(245, 158, 11, 0.15)', text: '#f59e0b' },
    medium:   { label: 'MEDIA',   bg: 'rgba(59, 130, 246, 0.15)', text: '#3b82f6' },
    low:      { label: 'BAJA',    bg: 'rgba(71, 85, 105, 0.15)',  text: '#94a3b8' },
};

export default function MyWork() {
    const { user } = useAuth();
    const { canEdit, canDelete } = useRole();
    const {
        engTasks, engProjects, engSubtasks,
        taskTypes, teamMembers, timeLogs, delayCauses,
        refetch: refetchTable,
    } = useEngineeringData();

    // Detectar si es dispositivo móvil
    const [isMobile, setIsMobile] = useState(false);
    useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth < 768);
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    // ── Weekly plan items ──
    const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
    const weekStartStr = format(weekStart, 'yyyy-MM-dd');
    const [weekPlanItems, setWeekPlanItems] = useState([]);

    useEffect(() => {
        plannerService.getWeeklyPlanItems(weekStartStr)
            .then(setWeekPlanItems)
            .catch(console.error);
    }, [weekStartStr]);

    const itemsInCreationRef = useRef(new Set());

    // ── One-time cleanup of legacy localStorage timer ──
    useEffect(() => {
        clearLegacyTimer();
    }, []);

    // ── Autocuración de Borradores de Tiempos Faltantes ──
    useEffect(() => {
        if (!user?.uid || !weekPlanItems.length || !timeLogs || !timeLogs.length) return;

        const todayStr = format(new Date(), 'yyyy-MM-dd');
        
        const todayUserPlanItems = weekPlanItems.filter(pi => 
            pi.date === todayStr && 
            pi.assignedTo === user.uid &&
            pi.startDateTime &&
            pi.endDateTime
        );

        const missingItems = todayUserPlanItems.filter(pi => {
            const hasLog = timeLogs.some(log => log.planItemId === pi.id);
            const isCreating = itemsInCreationRef.current.has(pi.id);
            return !hasLog && !isCreating;
        });

        if (missingItems.length > 0) {
            console.log(`[MyWork] Autocuración: Detectados ${missingItems.length} bloques planificados sin logs. Creándolos...`);
            
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

    // ── Derived data hook ──
    const myWorkData = useMyWorkData({
        engTasks,
        engProjects,
        engSubtasks,
        timeLogs,
        weekPlanItems,
        userId: user?.uid,
    });

    const { myTasks } = myWorkData;

    // ── Task Detail Modal state ──
    const [taskModalTask, setTaskModalTask] = useState(undefined); // undefined=closed, null=new, obj=edit
    const handleOpenTask = useCallback((task) => {
        setTaskModalTask(task || null);
    }, []);

    // ── Subtask expansion state ──
    const [expandedTaskIds, setExpandedTaskIds] = useState(new Set());
    const toggleTaskExpanded = useCallback((taskId) => {
        setExpandedTaskIds(prev => {
            const next = new Set(prev);
            if (next.has(taskId)) {
                next.delete(taskId);
            } else {
                next.add(taskId);
            }
            return next;
        });
    }, []);

    // ── WIP enforcement state ──
    const [wipModalOpen, setWipModalOpen] = useState(false);
    const [wipPendingTask, setWipPendingTask] = useState(null);
    const [wipPendingStatus, setWipPendingStatus] = useState(null);
    const [wipCurrentTask, setWipCurrentTask] = useState(null);
    const [wipSwitching, setWipSwitching] = useState(false);

    // ── Active Timer & tick ──
    const activeTimer = getActiveTimerFromLogs(timeLogs, user?.uid);
    const [elapsed, setElapsed] = useState('0:00:00');
    const [isStarting, setIsStarting] = useState(false);
    const [isStopping, setIsStopping] = useState(false);
    const intervalRef = useRef(null);

    useEffect(() => {
        if (activeTimer?.startTime) {
            const tick = () => setElapsed(formatElapsed(activeTimer.startTime));
            tick();
            intervalRef.current = setInterval(tick, 1000);
            return () => clearInterval(intervalRef.current);
        } else {
            setElapsed('0:00:00');
        }
    }, [activeTimer?.startTime, activeTimer?.id]);

    // ── Timer stop helper ──
    const handleTimerStop = useCallback(async () => {
        if (!activeTimer) return;
        setIsStopping(true);
        try {
            await stopTimer(activeTimer.id);
            plannerService.getWeeklyPlanItems(weekStartStr)
                .then(setWeekPlanItems)
                .catch(console.error);
        } catch (e) {
            console.error('Error stopping timer:', e);
        }
        setIsStopping(false);
    }, [activeTimer, weekStartStr]);

    // ── Status change handler ──
    const handleStatusChange = useCallback(async (task, newStatus) => {
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
            refetchTable('tasks');
        } catch (e) {
            console.error('Error updating status:', e);
            alert('No se pudo cambiar el estado: ' + (e.message || 'Error desconocido'));
        }
    }, [engTasks, user?.uid, refetchTable]);

    // ── WIP switch confirm ──
    const handleWipConfirm = useCallback(async (blockData) => {
        if (!wipCurrentTask || !wipPendingTask || !wipPendingStatus) return;
        setWipSwitching(true);
        try {
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
            await updateTaskStatus(wipPendingTask.id, wipPendingStatus, wipPendingTask.projectId);

            // Iniciar timer en la nueva tarea si el cambio fue exitoso
            await startTimerSafe({
                taskId: wipPendingTask.id,
                projectId: wipPendingTask.projectId,
                userId: user?.uid,
                onConfirm: () => true
            });

            setWipModalOpen(false);
            setWipCurrentTask(null);
            setWipPendingTask(null);
            setWipPendingStatus(null);
            refetchTable('tasks');
        } catch (err) {
            console.error('WIP switch error:', err);
            alert('Error en cambio WIP: ' + (err.message || 'Error desconocido'));
        }
        setWipSwitching(false);
    }, [wipCurrentTask, wipPendingTask, wipPendingStatus, user?.uid, refetchTable]);

    // ── Timer Start helper ──
    const handleStartTimer = useCallback(async (task) => {
        if (!task) return;
        setIsStarting(true);
        try {
            await startTimerSafe({
                taskId: task.id,
                projectId: task.projectId,
                userId: user?.uid,
                onConfirm: ({ activeTaskTitle, newTaskTitle }) =>
                    window.confirm(`Ya tienes un timer activo en "${activeTaskTitle}". ¿Detenerlo e iniciar "${newTaskTitle}"?`),
            });
        } catch (e) {
            console.error('Error starting timer:', e);
        }
        setIsStarting(false);
    }, [user?.uid]);

    // ── Acciones Rápidas directas de la Tarjeta ──
    const handleStartTask = useCallback(async (task) => {
        if (task.status === 'blocked') {
            try {
                await updateTaskStatus(task.id, 'in_progress', task.projectId, false);
                await handleStartTimer(task);
                refetchTable('tasks');
            } catch (e) {
                console.error(e);
            }
        } else {
            await handleStatusChange(task, 'in_progress');
            await handleStartTimer(task);
        }
    }, [handleStatusChange, handleStartTimer, refetchTable]);

    const handlePauseTask = useCallback(async (task) => {
        if (activeTimer && activeTimer.taskId === task.id) {
            await handleTimerStop();
        }
        await handleStatusChange(task, 'pending');
    }, [activeTimer, handleTimerStop, handleStatusChange]);

    const handleCompleteTask = useCallback(async (task) => {
        if (activeTimer && activeTimer.taskId === task.id) {
            await handleTimerStop();
        }
        await handleStatusChange(task, 'completed');
    }, [activeTimer, handleTimerStop, handleStatusChange]);

    // ── Priority update handler ──
    const handlePriorityChange = useCallback(async (task, newPriority) => {
        try {
            await updateTask(task.id, { priority: newPriority });
            refetchTable('tasks');
        } catch (e) {
            console.error('Error updating priority:', e);
            alert('No se pudo cambiar la prioridad: ' + (e.message || 'Error desconocido'));
        }
    }, [refetchTable]);

    // ── Ordenar tareas por prioridad (Critical -> High -> Medium -> Low) ──
    const sortedTasks = useMemo(() => {
        const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
        return [...myTasks].sort((a, b) => {
            const pa = priorityOrder[a.priority] ?? 2;
            const pb = priorityOrder[b.priority] ?? 2;
            return pa - pb;
        });
    }, [myTasks]);

    // Lookup para render del cronómetro
    const activeTaskName = activeTimer?.taskId
        ? (myTasks.find(t => t.id === activeTimer.taskId)?.title || activeTimer.taskTitle || 'Tarea activa')
        : null;

    const todayLabel = format(new Date(), "EEEE, d 'de' MMMM", { locale: es });
    const userName = user?.displayName?.split(' ')[0] || user?.email?.split('@')[0] || 'ahí';

    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight flex items-center gap-2">
                        <div className="w-10 h-10 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center shrink-0">
                            <User className="w-5 h-5 text-indigo-400" />
                        </div>
                        Mi Trabajo
                    </h1>
                    <p className="text-xs md:text-sm font-bold text-slate-400 mt-1 capitalize">
                        {getGreeting()}, {userName} · {todayLabel}
                    </p>
                </div>

                {/* Cabecera Central: Mini Timer Activo */}
                {activeTimer && (
                    <div className="flex items-center gap-3 px-4 py-2 bg-slate-900 border border-slate-800 rounded-2xl shadow-md border-emerald-500/20">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0 animate-ping" />
                        <div className="text-[11px] font-black text-slate-300 truncate max-w-[150px] md:max-w-[280px]">
                            Trabajando en: <span className="text-white font-bold">{activeTaskName}</span>
                        </div>
                        <div className="text-xs font-mono font-black text-emerald-400 shrink-0 border-l border-slate-800 pl-3">
                            {elapsed}
                        </div>
                        <button
                            onClick={handleTimerStop}
                            disabled={isStopping}
                            className="p-1 hover:bg-red-500/10 text-red-400 hover:text-red-300 rounded transition-all ml-1 shrink-0"
                            title="Detener Registro"
                        >
                            <Square className="w-3.5 h-3.5 fill-red-400" />
                        </button>
                    </div>
                )}

                <a
                    href="/planner"
                    className="flex items-center gap-2 px-4 py-2.5 bg-slate-900 border border-slate-800 hover:border-indigo-500/50 hover:text-indigo-400 text-slate-400 rounded-xl font-bold text-xs transition-all active:scale-95 self-start"
                >
                    <CalendarDays className="w-4 h-4" />
                    Planificador Semanal
                    <ExternalLink className="w-3.5 h-3.5 opacity-60" />
                </a>
            </div>

            {/* Layout de Columna Única: Tabla con diseño MainTable */}
            <div className="rounded-xl border border-slate-800/50 bg-slate-800/20 max-h-[78vh] overflow-auto">
                {!isMobile && (
                    <div
                        className="grid items-center px-2 py-2 text-[9px] font-black text-slate-500 uppercase tracking-[0.12em] border-b border-slate-800/50 bg-slate-900/90 text-center sticky top-0 z-20 min-w-[1100px]"
                        style={{ gridTemplateColumns: GRID_COLS }}
                    >
                        <div className="sticky left-0 z-10 bg-slate-900 h-full flex items-center justify-center border-l-3 border-l-slate-700"></div>
                        <div className="sticky left-[28px] z-10 text-left bg-slate-900 h-full flex items-center">Tarea</div>
                        <div className="text-left px-2">Proyecto</div>
                        <div className="text-center">💬</div>
                        <div>STN</div>
                        <div>Estado</div>
                        <div>Tipo</div>
                        <div>Avance</div>
                        <div>Timeline</div>
                        <div>Horas</div>
                        <div>Prioridad</div>
                        <div className="text-right pr-2">Acciones</div>
                    </div>
                )}

                <div className={isMobile ? "divide-y divide-slate-800/20" : "min-w-[1100px] divide-y divide-slate-800/30"}>
                    {sortedTasks.map((task, idx) => {
                        const isTaskActive = activeTimer?.taskId === task.id;
                        const isBlocked = task.status === 'blocked';
                        const isCritical = task.priority === 'critical';
                        
                        const project = engProjects.find(p => p.id === task.projectId);
                        const projectColor = project?.colorKey || '#6366f1';
                        
                        const statusCfg = TASK_STATUS_CONFIG[task.status] || {};
                        const pStyle = PRIORITY_BADGES[task.priority] || PRIORITY_BADGES.medium;

                        // Subtask progress
                        const totalSubs = task.subtasks?.length || 0;
                        const doneSubs = task.subtasks?.filter(s => s.completed || s.done).length || 0;
                        const subsPct = totalSubs > 0 ? Math.round((doneSubs / totalSubs) * 100) : 0;

                        // Timeline calculate
                        const startRaw = task.plannedStartDate || task.createdAt;
                        const endRaw = task.dueDate || task.plannedEndDate;
                        const startDate = startRaw ? new Date(startRaw) : null;
                        const endDate = endRaw ? new Date(endRaw) : null;
                        const now = new Date();

                        let timelinePct = 0;
                        let timelineColor = '#6366f1';
                        let daysLeft = null;
                        if (startDate && endDate) {
                            const total = Math.max(1, (endDate - startDate) / (1000 * 60 * 60 * 24));
                            const elapsed = Math.max(0, (now - startDate) / (1000 * 60 * 60 * 24));
                            timelinePct = Math.min(100, Math.max(0, (elapsed / total) * 100));
                            daysLeft = Math.ceil((endDate - now) / (1000 * 60 * 60 * 24));
                            if (daysLeft < 0 && task.status !== 'completed' && task.status !== 'cancelled') timelineColor = '#ef4444';
                            else if (timelinePct > 80) timelineColor = '#f59e0b';
                        }
                        const isOverdue = daysLeft !== null && daysLeft < 0 && task.status !== 'completed' && task.status !== 'cancelled';
                        const formattedDueDate = endDate ? endDate.toLocaleDateString('es-MX', { month: 'short', day: 'numeric' }) : '—';

                        // % Avance
                        const progressPct = task.percentComplete != null 
                            ? Math.round(task.percentComplete) 
                            : (task.status === 'completed' ? 100 : subsPct);
                        const progressColor = progressPct === 100 ? '#22c55e' : progressPct >= 60 ? '#6366f1' : progressPct >= 30 ? '#f59e0b' : '#ef4444';

                        // Hours
                        const actual = task.actualHours || 0;
                        const estimated = task.estimatedHours || 0;

                        // Station name
                        const stationLabel = task.stationId ? task.stationId.replace('station_', 'ST ').toUpperCase() : '—';

                        // Task Type name
                        const typeName = taskTypes?.find(tt => tt.id === task.taskTypeId)?.name || '—';

                        const isExpanded = expandedTaskIds.has(task.id);
                        const taskSubtasks = engSubtasks.filter(s => s.taskId === task.id);

                        if (isMobile) {
                            return (
                                <React.Fragment key={task.id}>
                                    <div
                                        onDoubleClick={() => handleOpenTask(task)}
                                        className={`flex flex-col gap-2 p-3 hover:bg-slate-800/10 transition-colors text-xs cursor-pointer border-b border-slate-850
                                            ${isTaskActive ? 'bg-indigo-500/5 hover:bg-indigo-500/10' : 'bg-slate-900/10'}
                                            ${isOverdue ? 'ring-1 ring-inset ring-rose-500/20' : ''}
                                        `}
                                        style={{ borderLeft: `3px solid ${isCritical ? '#ef4444' : '#6366f1'}` }}
                                    >
                                        {/* Renglón 1: Título y controles esenciales */}
                                        <div className="flex items-center gap-2 w-full">
                                            {/* Chevron de Subtareas */}
                                            {totalSubs > 0 ? (
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); toggleTaskExpanded(task.id); }}
                                                    className="shrink-0 text-slate-500 hover:text-slate-200 transition-colors"
                                                    title={isExpanded ? 'Ocultar subtareas' : 'Ver subtareas'}
                                                >
                                                    {isExpanded
                                                        ? <ChevronDown className="w-3.5 h-3.5" />
                                                        : <ChevronRight className="w-3.5 h-3.5" />
                                                    }
                                                </button>
                                            ) : (
                                                <span className="w-3.5 shrink-0" />
                                            )}

                                            {/* Título de la tarea */}
                                            <span 
                                                onClick={(e) => { e.stopPropagation(); handleOpenTask(task); }}
                                                className="hover:text-indigo-400 font-semibold text-slate-200 flex-1 truncate text-[12.5px] pr-1"
                                            >
                                                {task.title || 'Sin título'}
                                            </span>

                                            {/* Badge Subtareas */}
                                            {totalSubs > 0 && (
                                                <span className={`text-[9px] font-black px-1.5 py-0.5 rounded shrink-0 ${
                                                    subsPct === 100 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-700/60 text-slate-400'
                                                }`}>
                                                    {doneSubs}/{totalSubs}
                                                </span>
                                            )}

                                            {/* Badge Bloqueada */}
                                            {isBlocked && (
                                                <span className="text-[9px] font-black uppercase px-1 py-0.5 bg-red-600 text-white rounded shrink-0 scale-90">
                                                    Bloqueada
                                                </span>
                                            )}

                                            {/* Icono Comentarios */}
                                            <div 
                                                className="flex items-center justify-center text-slate-500 hover:text-slate-200 cursor-pointer p-1 shrink-0"
                                                onClick={(e) => { e.stopPropagation(); handleOpenTask(task); }}
                                                onDoubleClick={(e) => e.stopPropagation()}
                                            >
                                                <MessageSquare className="w-3.5 h-3.5" />
                                            </div>

                                            {/* Controles del timer (Acciones) */}
                                            <div className="flex items-center gap-1 shrink-0 ml-1" onClick={(e) => e.stopPropagation()} onDoubleClick={(e) => e.stopPropagation()}>
                                                {isTaskActive ? (
                                                    <>
                                                        <button
                                                            onClick={() => handleCompleteTask(task)}
                                                            className="p-1 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white rounded transition-all"
                                                            title="Completar"
                                                        >
                                                            <Check className="w-3.5 h-3.5" />
                                                        </button>
                                                        <button
                                                            onClick={() => handlePauseTask(task)}
                                                            className="p-1 bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-300 border border-slate-750 rounded transition-all"
                                                            title="Pausar"
                                                        >
                                                            <Pause className="w-3.5 h-3.5" />
                                                        </button>
                                                    </>
                                                ) : (
                                                    <button
                                                        onClick={() => handleStartTask(task)}
                                                        className={`p-1 rounded transition-all active:scale-95 text-white ${
                                                            isBlocked ? 'bg-amber-600 hover:bg-amber-500' : 'bg-indigo-600 hover:bg-indigo-500'
                                                        }`}
                                                        title={isBlocked ? 'Iniciar' : 'Iniciar'}
                                                    >
                                                        <Play className="w-3 h-3 fill-white" />
                                                    </button>
                                                )}
                                            </div>
                                        </div>

                                        {/* Renglón 2: Atributos scrollables horizontalmente */}
                                        <div 
                                            className="flex items-center gap-3 overflow-x-auto py-1 scrollbar-none select-none pr-2 ml-3.5"
                                            onClick={(e) => e.stopPropagation()}
                                            onDoubleClick={(e) => e.stopPropagation()}
                                        >
                                            {/* Proyecto */}
                                            <div className="shrink-0">
                                                <span className="text-[9.5px] font-black px-2 py-0.5 bg-slate-900 border border-slate-800/80 rounded whitespace-nowrap" style={{ color: projectColor, borderColor: `${projectColor}30` }}>
                                                    {task.projectName}
                                                </span>
                                            </div>

                                            {/* Estado */}
                                            <div className="shrink-0 w-[86px]">
                                                <select
                                                    value={task.status}
                                                    onChange={e => handleStatusChange(task, e.target.value)}
                                                    className="w-full text-center py-0.5 rounded text-[9.5px] font-black text-white cursor-pointer focus:outline-none"
                                                    style={{ background: statusCfg.color || '#64748b' }}
                                                >
                                                    {Object.entries(TASK_STATUS_CONFIG)
                                                        .filter(([k]) => k !== 'backlog')
                                                        .map(([k, cfg]) => (
                                                            <option key={k} value={k} className="bg-slate-900 text-slate-200 text-xs font-semibold text-left">
                                                                {cfg.label}
                                                            </option>
                                                        ))
                                                    }
                                                </select>
                                            </div>

                                            {/* Prioridad */}
                                            <div className="shrink-0 w-[80px]">
                                                <select
                                                    value={task.priority}
                                                    onChange={e => handlePriorityChange(task, e.target.value)}
                                                    className="w-full text-center py-0.5 rounded text-[9.5px] font-black cursor-pointer focus:outline-none"
                                                    style={{ 
                                                        background: pStyle.bg,
                                                        color: pStyle.text
                                                    }}
                                                >
                                                    {Object.entries(TASK_PRIORITY_CONFIG).map(([k, cfg]) => (
                                                        <option key={k} value={k} className="bg-slate-900 text-slate-200 text-xs font-semibold text-left">
                                                            {cfg.label}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>

                                            {/* Estación (STN) */}
                                            <div className="shrink-0 text-[9.5px] font-bold text-slate-400 bg-slate-900/60 px-1.5 py-0.5 rounded border border-slate-800/40">
                                                {stationLabel}
                                            </div>

                                            {/* Tipo */}
                                            {typeName !== '—' && (
                                                <div className="shrink-0 text-[9.5px] text-slate-450 bg-slate-900/60 px-1.5 py-0.5 rounded border border-slate-800/40">
                                                    {typeName}
                                                </div>
                                            )}

                                            {/* Horas */}
                                            <div className="shrink-0 text-[9.5px] font-bold text-slate-355 bg-slate-900/60 px-1.5 py-0.5 rounded border border-slate-800/20">
                                                {actual.toFixed(1)} / {estimated.toFixed(1)} h
                                            </div>

                                            {/* Avance */}
                                            <div className="shrink-0 flex items-center gap-1.5">
                                                <div className="w-14 h-1 bg-slate-950 rounded-full overflow-hidden shrink-0">
                                                    <div className="h-full rounded-full" style={{ width: `${progressPct}%`, backgroundColor: progressColor }} />
                                                </div>
                                                <span className="text-[9px] font-black text-slate-400">{progressPct}%</span>
                                            </div>

                                            {/* Timeline */}
                                            <div className="shrink-0 flex items-center gap-1 text-[9px] font-bold text-slate-400 bg-slate-900/40 px-1.5 py-0.5 rounded">
                                                <Calendar className="w-3 h-3 text-slate-500" style={{ color: timelineColor }} />
                                                <span className={isOverdue ? 'text-red-400 font-black' : ''}>{formattedDueDate}</span>
                                                {daysLeft !== null && (
                                                    <span className={`text-[8px] font-black uppercase ${isOverdue ? 'text-red-400' : 'text-slate-550'} ml-1`}>
                                                        ({isOverdue ? `atraso` : `${daysLeft}d`})
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        {/* Subtareas */}
                                        {isExpanded && totalSubs > 0 && (
                                            <SubtaskExpander
                                                subtasks={taskSubtasks}
                                                taskId={task.id}
                                                canEdit={canEdit}
                                            />
                                        )}
                                    </div>
                                </React.Fragment>
                            );
                        }

                        return (
                            <React.Fragment key={task.id}>
                                <div
                                    onDoubleClick={() => handleOpenTask(task)}
                                    className={`grid items-center px-2 py-2 hover:bg-slate-800/10 transition-colors text-xs text-center cursor-pointer
                                        ${isTaskActive ? 'bg-indigo-500/5 hover:bg-indigo-500/10' : 'bg-slate-900/10'}
                                        ${isOverdue ? 'ring-1 ring-inset ring-rose-500/20' : ''}
                                    `}
                                    style={{ gridTemplateColumns: GRID_COLS }}
                                >
                                    {/* Borde izquierdo de color + Checkbox virtual */}
                                    <div className="sticky left-0 z-10 bg-slate-950/40 h-full flex items-center justify-center" style={{ borderLeft: `3px solid ${isCritical ? '#ef4444' : '#6366f1'}` }}>
                                        <span className={`w-2 h-2 rounded-full ${isTaskActive ? 'bg-emerald-500 animate-pulse' : 'bg-slate-700'}`} />
                                    </div>

                                    {/* Tarea */}
                                    <div className="sticky left-[28px] z-10 bg-slate-950/40 text-left px-1 flex items-center gap-1.5 font-semibold text-slate-200">
                                        {totalSubs > 0 ? (
                                            <button
                                                onClick={(e) => { e.stopPropagation(); toggleTaskExpanded(task.id); }}
                                                className="shrink-0 text-slate-500 hover:text-slate-200 transition-colors"
                                                title={isExpanded ? 'Ocultar subtareas' : 'Ver subtareas'}
                                            >
                                                {isExpanded
                                                    ? <ChevronDown className="w-3.5 h-3.5" />
                                                    : <ChevronRight className="w-3.5 h-3.5" />
                                                }
                                            </button>
                                        ) : (
                                            <span className="w-3.5 shrink-0" />
                                        )}
                                        <span 
                                            onClick={(e) => { e.stopPropagation(); handleOpenTask(task); }}
                                            className="hover:text-indigo-400 cursor-pointer transition-colors truncate block max-w-full"
                                        >
                                            {task.title || 'Sin título'}
                                        </span>
                                        {totalSubs > 0 && (
                                            <span className={`text-[9px] font-black px-1.5 py-0.5 rounded shrink-0 ${
                                                subsPct === 100 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-700/60 text-slate-400'
                                            }`}>
                                                {doneSubs}/{totalSubs}
                                            </span>
                                        )}
                                        {isBlocked && (
                                            <span className="text-[9px] font-black uppercase px-1 py-0.5 bg-red-600 text-white rounded shrink-0 scale-90">
                                                Bloqueada
                                            </span>
                                        )}
                                    </div>

                                    {/* Proyecto */}
                                    <div className="text-left px-2">
                                        <span className="text-[10px] font-black px-2 py-0.5 bg-slate-900 border border-slate-800 rounded whitespace-nowrap" style={{ color: projectColor, borderColor: `${projectColor}30` }}>
                                            {task.projectName}
                                        </span>
                                    </div>

                                    {/* Comentarios Link */}
                                    <div 
                                        className="flex items-center justify-center text-slate-500 hover:text-slate-200 cursor-pointer"
                                        onClick={(e) => { e.stopPropagation(); handleOpenTask(task); }}
                                        onDoubleClick={(e) => e.stopPropagation()}
                                    >
                                        <MessageSquare className="w-3.5 h-3.5" />
                                    </div>

                                    {/* Estación */}
                                    <div className="text-[10px] font-bold text-slate-400">{stationLabel}</div>

                                    {/* Estado Dropdown */}
                                    <div className="flex items-stretch px-0.5" onClick={(e) => e.stopPropagation()} onDoubleClick={(e) => e.stopPropagation()}>
                                        <select
                                            value={task.status}
                                            onChange={e => handleStatusChange(task, e.target.value)}
                                            className="w-full text-center py-1 rounded text-[10px] font-black text-white cursor-pointer focus:outline-none"
                                            style={{ background: statusCfg.color || '#64748b' }}
                                        >
                                            {Object.entries(TASK_STATUS_CONFIG)
                                                .filter(([k]) => k !== 'backlog')
                                                .map(([k, cfg]) => (
                                                    <option key={k} value={k} className="bg-slate-900 text-slate-200 text-xs font-semibold text-left">
                                                        {cfg.label}
                                                    </option>
                                                ))
                                            }
                                        </select>
                                    </div>

                                    {/* Tipo */}
                                    <div className="text-[10px] text-slate-400 truncate">{typeName}</div>

                                    {/* Avance */}
                                    <div className="flex items-center gap-1.5 px-2">
                                        <div className="w-full h-1.5 bg-slate-950 rounded-full overflow-hidden shrink-0">
                                            <div className="h-full rounded-full" style={{ width: `${progressPct}%`, backgroundColor: progressColor }} />
                                        </div>
                                        <span className="text-[9px] font-black text-slate-400">{progressPct}%</span>
                                    </div>

                                    {/* Timeline */}
                                    <div className="flex flex-col items-center justify-center gap-0.5">
                                        <div className="flex items-center gap-1 text-[9px] font-bold">
                                            <Calendar className="w-3 h-3 text-slate-500" style={{ color: timelineColor }} />
                                            <span className={isOverdue ? 'text-red-400 font-black' : 'text-slate-400'}>{formattedDueDate}</span>
                                        </div>
                                        {daysLeft !== null && (
                                            <span className={`text-[8px] font-black uppercase tracking-wider ${isOverdue ? 'text-red-400' : 'text-slate-550'}`}>
                                                {isOverdue ? `${Math.abs(daysLeft)}d atraso` : `${daysLeft}d restantes`}
                                            </span>
                                        )}
                                    </div>

                                    {/* Horas */}
                                    <div className="text-[10px] font-bold text-slate-300">
                                        {actual.toFixed(1)} <span className="text-slate-500">/</span> {estimated.toFixed(1)} h
                                    </div>

                                    {/* Prioridad Dropdown */}
                                    <div className="flex items-stretch px-0.5" onClick={(e) => e.stopPropagation()} onDoubleClick={(e) => e.stopPropagation()}>
                                        <select
                                            value={task.priority}
                                            onChange={e => handlePriorityChange(task, e.target.value)}
                                            className="w-full text-center py-1 rounded text-[10px] font-black cursor-pointer focus:outline-none"
                                            style={{ 
                                                background: pStyle.bg,
                                                color: pStyle.text
                                            }}
                                        >
                                            {Object.entries(TASK_PRIORITY_CONFIG).map(([k, cfg]) => (
                                                <option key={k} value={k} className="bg-slate-900 text-slate-200 text-xs font-semibold text-left">
                                                    {cfg.label}
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    {/* Acciones */}
                                    <div className="flex items-center justify-end gap-1 px-1" onClick={(e) => e.stopPropagation()} onDoubleClick={(e) => e.stopPropagation()}>
                                        {isTaskActive ? (
                                            <>
                                                <button
                                                    onClick={() => handleCompleteTask(task)}
                                                    className="p-1 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white rounded transition-all"
                                                    title="Completar tarea"
                                                >
                                                    <Check className="w-3.5 h-3.5" />
                                                </button>
                                                <button
                                                    onClick={() => handlePauseTask(task)}
                                                    className="p-1 bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-300 border border-slate-750 rounded transition-all"
                                                    title="Pausar tarea"
                                                >
                                                    <Pause className="w-3.5 h-3.5" />
                                                </button>
                                            </>
                                        ) : (
                                            <button
                                                onClick={() => handleStartTask(task)}
                                                className={`p-1 rounded transition-all active:scale-95 text-white ${
                                                    isBlocked ? 'bg-amber-600 hover:bg-amber-500' : 'bg-indigo-600 hover:bg-indigo-500'
                                                }`}
                                                title={isBlocked ? 'Desbloquear y empezar' : 'Iniciar tiempo'}
                                            >
                                                <Play className="w-3 h-3 fill-white" />
                                            </button>
                                        )}
                                    </div>
                                </div>
                                {isExpanded && totalSubs > 0 && (
                                    <SubtaskExpander
                                        subtasks={taskSubtasks}
                                        taskId={task.id}
                                        canEdit={canEdit}
                                    />
                                )}
                            </React.Fragment>
                        );
                    })}
                    {sortedTasks.length === 0 && (
                        <div className="py-8 text-center text-xs text-slate-500 italic">
                            No tienes tareas abiertas asignadas.
                        </div>
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

            {/* WIP Block Modal */}
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

function SubtaskExpander({ subtasks, taskId, canEdit }) {
    const [newTitle, setNewTitle] = useState('');
    const inputRef = useRef(null);

    const handleToggle = async (sub) => {
        try {
            const completedCount = subtasks.filter(s => s.id !== sub.id ? (s.completed || s.done) : !sub.completed).length;
            await toggleSubtask(sub.id, !sub.completed, {
                taskId,
                subtaskTitle: sub.title,
                totalSubtasks: subtasks.length,
                completedSubtasks: completedCount,
            });
        } catch (err) { console.error('Toggle subtask failed:', err); }
    };

    const handleAdd = async () => {
        if (!newTitle.trim()) return;
        try {
            await createSubtask(taskId, newTitle.trim());
            setNewTitle('');
            inputRef.current?.focus();
        } catch (err) { console.error('Add subtask failed:', err); }
    };

    return (
        <div className="pl-10 pr-4 py-2.5 bg-slate-900/50 border-t border-slate-700/30 animate-in fade-in slide-in-from-top-1 duration-200" onClick={e => e.stopPropagation()}>
            <div className="space-y-1 max-w-md">
                {[...subtasks].sort((a, b) => {
                    const ta = (a.title || '').toLowerCase();
                    const tb = (b.title || '').toLowerCase();
                    const partsA = ta.match(/(\d+|\D+)/g) || [];
                    const partsB = tb.match(/(\d+|\D+)/g) || [];
                    for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
                        if (i >= partsA.length) return -1;
                        if (i >= partsB.length) return 1;
                        const isNumA = /^\d+$/.test(partsA[i]);
                        const isNumB = /^\d+$/.test(partsB[i]);
                        if (isNumA && isNumB) {
                            const diff = parseInt(partsA[i], 10) - parseInt(partsB[i], 10);
                            if (diff !== 0) return diff;
                        } else {
                            const cmp = partsA[i].localeCompare(partsB[i]);
                            if (cmp !== 0) return cmp;
                        }
                    }
                    return 0;
                }).map(sub => (
                    <div key={sub.id} className="flex items-center gap-2 py-0.5 group/sub" onClick={e => e.stopPropagation()} onDoubleClick={e => e.stopPropagation()}>
                        <button
                            onClick={() => handleToggle(sub)}
                            className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 transition-all ${
                                sub.completed ? 'bg-emerald-500 border-emerald-500' : 'border-slate-600 hover:border-slate-400'
                            }`}
                        >
                            {sub.completed && <Check className="w-2.5 h-2.5 text-white" />}
                        </button>
                        <span className={`text-xs ${sub.completed ? 'line-through text-slate-600' : 'text-slate-300'}`}>
                            {sub.title}
                        </span>
                    </div>
                ))}
                {canEdit && (
                    <div className="flex items-center gap-2 pt-1" onClick={e => e.stopPropagation()} onDoubleClick={e => e.stopPropagation()}>
                        <Plus className="w-3 h-3 text-slate-600 shrink-0" />
                        <input
                            ref={inputRef}
                            value={newTitle}
                            onChange={e => setNewTitle(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') handleAdd(); }}
                            placeholder="Agregar subtarea..."
                            className="flex-1 bg-transparent text-xs text-slate-400 placeholder:text-slate-700 outline-none"
                        />
                        {newTitle.trim() && (
                            <button onClick={handleAdd} className="text-[10px] font-bold text-indigo-400 hover:text-indigo-300">+</button>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
