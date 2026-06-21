import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useEngineeringData } from '../hooks/useEngineeringData';
import { useAuth } from '../contexts/AuthContext';
import { useRole } from '../contexts/RoleContext';
import { format, startOfWeek } from 'date-fns';
import { es } from 'date-fns/locale';
import { 
    User, CalendarDays, ExternalLink, Play, Square, Pause, 
    Check, AlertCircle, Clock, ChevronRight, BookOpen, Inbox, Info
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
import { updateTaskStatus } from '../services/taskService';
import { 
    getActiveTimerFromLogs, formatElapsed, stopTimer, startTimerSafe, clearLegacyTimer 
} from '../services/timeService';

// Schema & priorities config
import { TASK_STATUS, TASK_PRIORITY } from '../models/schemas';

// Greeting helper
function getGreeting() {
    const h = new Date().getHours();
    if (h < 12) return 'Buenos días';
    if (h < 19) return 'Buenas tardes';
    return 'Buenas noches';
}

const PRIORITY_BADGES = {
    critical: { label: 'CRÍTICA', bg: 'bg-red-500/15 text-red-400 border border-red-500/30' },
    high:     { label: 'ALTA',    bg: 'bg-amber-500/15 text-amber-400 border border-amber-500/30' },
    medium:   { label: 'MEDIA',   bg: 'bg-blue-500/15 text-blue-400 border border-blue-500/30' },
    low:      { label: 'BAJA',    bg: 'bg-slate-800 text-slate-300 border border-slate-700' },
};

const PRIORITY_BORDERS = {
    critical: 'border-l-4 border-l-red-500',
    high:     'border-l-4 border-l-amber-500',
    medium:   'border-l-4 border-l-blue-500',
    low:      'border-l-4 border-l-slate-600',
};

export default function MyWork() {
    const { user } = useAuth();
    const { canEdit, canDelete } = useRole();
    const {
        engTasks, engProjects, engSubtasks,
        taskTypes, teamMembers, timeLogs, delayCauses,
        refetchTable,
    } = useEngineeringData();

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

    const {
        myTasks, todayTasks, blockedTasks, weeklyStats,
        todayHours, myTodayLogs, todayPlanItems
    } = myWorkData;

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
        } catch (e) {
            console.error('Error updating status:', e);
            alert('No se pudo cambiar el estado: ' + (e.message || 'Error desconocido'));
        }
    }, [engTasks, user?.uid]);

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
        } catch (err) {
            console.error('WIP switch error:', err);
            alert('Error en cambio WIP: ' + (err.message || 'Error desconocido'));
        }
        setWipSwitching(false);
    }, [wipCurrentTask, wipPendingTask, wipPendingStatus, user?.uid]);

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
            } catch (e) {
                console.error(e);
            }
        } else {
            await handleStatusChange(task, 'in_progress');
            await handleStartTimer(task);
        }
    }, [handleStatusChange, handleStartTimer]);

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

    // ── Manual timer select ──
    const [manualTaskSelect, setManualTaskSelect] = useState('');
    const handleManualTimerStart = async () => {
        if (!manualTaskSelect) return;
        const task = myTasks.find(t => t.id === manualTaskSelect);
        if (task) {
            await handleStartTask(task);
            setManualTaskSelect('');
        }
    };

    // ── Categorizar las tareas de manera limpia y visual ──
    const immediateTasks = useMemo(() => {
        return myTasks.filter(t => 
            t.status === 'blocked' || 
            t.priority === 'critical' || 
            t.priority === 'high' || 
            (t.dueDate && new Date(t.dueDate) < new Date() && t.status !== 'completed')
        );
    }, [myTasks]);

    const todayTasksList = useMemo(() => {
        return todayTasks.filter(t => !immediateTasks.some(it => it.id === t.id));
    }, [todayTasks, immediateTasks]);

    const otherTasksList = useMemo(() => {
        return myTasks.filter(t => 
            !immediateTasks.some(it => it.id === t.id) && 
            !todayTasksList.some(tt => tt.id === t.id)
        );
    }, [myTasks, immediateTasks, todayTasksList]);

    // Lookup para render del cronómetro
    const activeTaskName = activeTimer?.taskId
        ? (myTasks.find(t => t.id === activeTimer.taskId)?.title || activeTimer.taskTitle || 'Tarea en Progreso')
        : null;
    const activeProjectName = activeTimer?.projectId
        ? (engProjects.find(p => p.id === activeTimer.projectId)?.name || activeTimer.projectName || 'Proyecto')
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

                <a
                    href="/planner"
                    className="flex items-center gap-2 px-4 py-2.5 bg-slate-900 border border-slate-800 hover:border-indigo-500/50 hover:text-indigo-400 text-slate-400 rounded-xl font-bold text-xs transition-all active:scale-95 self-start"
                >
                    <CalendarDays className="w-4 h-4" />
                    Planificador Semanal
                    <ExternalLink className="w-3.5 h-3.5 opacity-60" />
                </a>
            </div>

            {/* Layout de 2 Columnas */}
            <div className="grid lg:grid-cols-3 gap-6">
                
                {/* Columna de Tareas (2/3) */}
                <div className="lg:col-span-2 space-y-6">
                    
                    {/* Atención Inmediata */}
                    {immediateTasks.length > 0 && (
                        <div className="bg-red-500/5 border border-red-500/20 rounded-2xl p-5 space-y-4">
                            <div className="flex items-center gap-2 text-red-400">
                                <AlertCircle className="w-5 h-5" />
                                <h2 className="text-sm font-black uppercase tracking-wider">Atención Inmediata</h2>
                                <span className="bg-red-500/20 text-red-400 text-xs px-2 py-0.5 rounded-full font-bold">
                                    {immediateTasks.length}
                                </span>
                            </div>
                            <div className="space-y-3">
                                {immediateTasks.map(task => (
                                    <TaskRow 
                                        key={task.id} 
                                        task={task} 
                                        isActive={activeTimer?.taskId === task.id}
                                        onStart={handleStartTask}
                                        onPause={handlePauseTask}
                                        onComplete={handleCompleteTask}
                                        onOpen={handleOpenTask}
                                    />
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Para Hoy */}
                    <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-5 space-y-4">
                        <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
                            <div className="flex items-center gap-2 text-indigo-400">
                                <Clock className="w-4 h-4" />
                                <h2 className="text-sm font-black uppercase tracking-wider text-slate-200">Tareas para Hoy</h2>
                                <span className="bg-indigo-500/20 text-indigo-400 text-xs px-2 py-0.5 rounded-full font-bold">
                                    {todayTasksList.length}
                                </span>
                            </div>
                        </div>
                        {todayTasksList.length > 0 ? (
                            <div className="space-y-3">
                                {todayTasksList.map(task => (
                                    <TaskRow 
                                        key={task.id} 
                                        task={task} 
                                        isActive={activeTimer?.taskId === task.id}
                                        onStart={handleStartTask}
                                        onPause={handlePauseTask}
                                        onComplete={handleCompleteTask}
                                        onOpen={handleOpenTask}
                                    />
                                ))}
                            </div>
                        ) : (
                            <p className="text-xs text-slate-500 italic py-2">No hay tareas programadas para hoy.</p>
                        )}
                    </div>

                    {/* Resto de Tareas Asignadas */}
                    <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-5 space-y-4">
                        <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
                            <div className="flex items-center gap-2 text-slate-400">
                                <BookOpen className="w-4 h-4" />
                                <h2 className="text-sm font-black uppercase tracking-wider text-slate-200">Otras Tareas Asignadas</h2>
                                <span className="bg-slate-800 text-slate-400 text-xs px-2 py-0.5 rounded-full font-bold">
                                    {otherTasksList.length}
                                </span>
                            </div>
                        </div>
                        {otherTasksList.length > 0 ? (
                            <div className="space-y-3">
                                {otherTasksList.map(task => (
                                    <TaskRow 
                                        key={task.id} 
                                        task={task} 
                                        isActive={activeTimer?.taskId === task.id}
                                        onStart={handleStartTask}
                                        onPause={handlePauseTask}
                                        onComplete={handleCompleteTask}
                                        onOpen={handleOpenTask}
                                    />
                                ))}
                            </div>
                        ) : (
                            <p className="text-xs text-slate-500 italic py-2">No tienes otras tareas abiertas asignadas.</p>
                        )}
                    </div>

                </div>

                {/* Columna Control de Tiempos (1/3) */}
                <div className="space-y-6">
                    
                    {/* Widget Cronómetro */}
                    <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 shadow-xl relative overflow-hidden flex flex-col justify-between">
                        {activeTimer ? (
                            <>
                                <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-2xl -mr-10 -mt-10" />
                                <div className="relative space-y-4">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
                                            <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">Cronómetro Activo</span>
                                        </div>
                                    </div>
                                    <div className="py-2">
                                        <h3 className="text-4xl font-mono font-black text-white tracking-tight leading-none drop-shadow-md">
                                            {elapsed}
                                        </h3>
                                        <p className="text-[11px] text-indigo-300 font-bold mt-2 truncate">
                                            {activeProjectName}
                                        </p>
                                        <p className="text-xs text-slate-300 font-black mt-0.5 line-clamp-2">
                                            {activeTaskName}
                                        </p>
                                    </div>
                                    <button
                                        onClick={handleTimerStop}
                                        disabled={isStopping}
                                        className="w-full flex items-center justify-center gap-2 py-3 bg-red-600 hover:bg-red-500 active:scale-98 text-white rounded-2xl font-black text-xs uppercase tracking-wider transition-all shadow-lg shadow-red-500/15"
                                    >
                                        <Square className="w-4 h-4 fill-white" />
                                        Detener Registro
                                    </button>
                                </div>
                            </>
                        ) : (
                            <div className="space-y-4">
                                <div className="flex items-center gap-2">
                                    <span className="w-2.5 h-2.5 rounded-full bg-slate-700" />
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Sin temporizador activo</span>
                                </div>
                                <div className="py-2">
                                    <h3 className="text-4xl font-mono font-black text-slate-600 tracking-tight leading-none">
                                        0:00:00
                                    </h3>
                                    <p className="text-[11px] text-slate-500 mt-2">
                                        Inicia el tiempo en cualquier tarea de la lista para registrar tu progreso.
                                    </p>
                                </div>
                                
                                {/* Manual Timer Trigger */}
                                <div className="pt-2 border-t border-slate-800/80 space-y-2">
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Iniciar en otra tarea:</label>
                                    <div className="flex gap-2">
                                        <select
                                            value={manualTaskSelect}
                                            onChange={e => setManualTaskSelect(e.target.value)}
                                            className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-2.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer h-9"
                                        >
                                            <option value="">Selecciona una tarea...</option>
                                            {myTasks.map(t => (
                                                <option key={t.id} value={t.id}>
                                                    {t.projectName} - {t.title}
                                                </option>
                                            ))}
                                        </select>
                                        <button
                                            onClick={handleManualTimerStart}
                                            disabled={!manualTaskSelect}
                                            className="h-9 px-3.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:hover:bg-indigo-600 text-white rounded-xl flex items-center justify-center transition-all active:scale-95"
                                        >
                                            <Play className="w-4 h-4 fill-white" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Resumen de Horas */}
                    <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-5 space-y-4">
                        <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-800 pb-2">Registro de Horas</h3>
                        
                        <div className="space-y-4">
                            {/* Hoy */}
                            <div>
                                <div className="flex items-center justify-between text-xs font-bold mb-1.5">
                                    <span className="text-slate-300">Hoy</span>
                                    <span className="text-indigo-400">{todayHours.toFixed(2)} / 8.0 hrs</span>
                                </div>
                                <div className="w-full h-2 bg-slate-950 rounded-full overflow-hidden">
                                    <div 
                                        className="h-full bg-indigo-500 rounded-full transition-all duration-500" 
                                        style={{ width: `${Math.min(100, (todayHours / 8.0) * 100)}%` }}
                                    />
                                </div>
                            </div>

                            {/* Semana */}
                            <div>
                                <div className="flex items-center justify-between text-xs font-bold mb-1.5">
                                    <span className="text-slate-300">Esta Semana</span>
                                    <span className="text-emerald-400">{weeklyStats.actualHours.toFixed(2)} / {weeklyStats.plannedHours.toFixed(2)} hrs</span>
                                </div>
                                <div className="w-full h-2 bg-slate-950 rounded-full overflow-hidden">
                                    <div 
                                        className="h-full bg-emerald-500 rounded-full transition-all duration-500" 
                                        style={{ width: `${weeklyStats.utilizationPct}%` }}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Bitácora del Día */}
                    <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-5 space-y-4">
                        <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-800 pb-2">Actividad de Hoy</h3>
                        {myTodayLogs.length > 0 ? (
                            <div className="space-y-2.5 max-h-[220px] overflow-y-auto pr-1">
                                {myTodayLogs.map(log => (
                                    <div key={log.id} className="flex flex-col gap-1 p-2 bg-slate-950/60 border border-slate-850 rounded-xl">
                                        <div className="flex items-center justify-between text-[11px] font-bold text-slate-300">
                                            <span className="truncate max-w-[130px]">{log.taskTitle || 'Sin título'}</span>
                                            <span className="text-indigo-400 shrink-0">{(log.totalHours || 0).toFixed(2)}h</span>
                                        </div>
                                        {log.notes && (
                                            <p className="text-[9px] text-slate-500 line-clamp-1 italic">
                                                {log.notes}
                                            </p>
                                        )}
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-[10px] text-slate-500 italic">Aún no has registrado horas hoy.</p>
                        )}
                    </div>

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

// ── Componente Fila de Tarea Simplificada ──
function TaskRow({ task, isActive, onStart, onPause, onComplete, onOpen }) {
    const pStyle = PRIORITY_BADGES[task.priority] || PRIORITY_BADGES.medium;
    const borderStyle = PRIORITY_BORDERS[task.priority] || PRIORITY_BORDERS.medium;
    const isBlocked = task.status === 'blocked';

    return (
        <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 bg-slate-950/60 hover:bg-slate-900 border border-slate-900 rounded-xl transition-all duration-200 ${borderStyle} ${isActive ? 'ring-1 ring-indigo-500 bg-slate-900/60' : ''}`}>
            
            {/* Información Tarea */}
            <div className="flex-1 min-w-0 space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                    {/* Proyecto */}
                    <span className="text-[10px] font-black uppercase px-2 py-0.5 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded">
                        {task.projectName}
                    </span>
                    {/* Prioridad */}
                    <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded ${pStyle.bg}`}>
                        {pStyle.label}
                    </span>
                    {/* Estado Bloqueado */}
                    {isBlocked && (
                        <span className="text-[9px] font-black uppercase px-1.5 py-0.5 bg-red-600 text-white rounded animate-pulse">
                            BLOQUEADO
                        </span>
                    )}
                </div>

                <h3 
                    onClick={() => onOpen(task)}
                    className="text-xs font-black text-slate-200 hover:text-indigo-400 cursor-pointer transition-colors truncate max-w-full"
                >
                    {task.title}
                </h3>
            </div>

            {/* Acciones */}
            <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                {isActive ? (
                    <>
                        <button
                            onClick={() => onComplete(task)}
                            className="h-8 px-3 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white rounded-lg flex items-center justify-center gap-1 text-[10px] font-black uppercase tracking-wider transition-all"
                        >
                            <Check className="w-3.5 h-3.5" />
                            Completar
                        </button>
                        <button
                            onClick={() => onPause(task)}
                            className="h-8 px-3 bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-300 border border-slate-700 rounded-lg flex items-center justify-center gap-1 text-[10px] font-black uppercase tracking-wider transition-all"
                        >
                            <Pause className="w-3.5 h-3.5" />
                            Pausar
                        </button>
                    </>
                ) : (
                    <button
                        onClick={() => onStart(task)}
                        className={`h-8 px-3.5 rounded-lg flex items-center justify-center gap-1 text-[10px] font-black uppercase tracking-wider transition-all active:scale-95 ${
                            isBlocked
                                ? 'bg-amber-600 hover:bg-amber-500 text-white shadow-md shadow-amber-600/10'
                                : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/10'
                        }`}
                    >
                        <Play className="w-3.5 h-3.5 fill-white" />
                        {isBlocked ? 'Desbloquear' : 'Iniciar'}
                    </button>
                )}
                
                {/* Botón de detalle */}
                <button
                    onClick={() => onOpen(task)}
                    className="h-8 w-8 bg-slate-900 border border-slate-800 hover:border-slate-700 active:scale-95 text-slate-400 hover:text-white rounded-lg flex items-center justify-center transition-all"
                >
                    <ChevronRight className="w-4 h-4" />
                </button>
            </div>

        </div>
    );
}
