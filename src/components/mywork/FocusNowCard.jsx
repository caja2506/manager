import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Square, ExternalLink, Clock, Flag, Folder, Zap, Target, ChevronRight } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { startTimer, stopTimer, getActiveTimerFromLogs, formatElapsed } from '../../services/timeService';
import { TASK_PRIORITY_CONFIG, TASK_STATUS_CONFIG } from '../../models/schemas';

const PRIORITY_STYLES = {
    critical: 'bg-red-500/15 text-red-400 border-red-500/30',
    high: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    medium: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
    low: 'bg-slate-800 text-slate-300 border-slate-700',
};

const PRIORITY_GLOW = {
    critical: 'shadow-red-500/20',
    high: 'shadow-amber-500/20',
    medium: 'shadow-indigo-500/20',
    low: 'shadow-slate-800/40',
};

export default function FocusNowCard({ task, userId, engTasks, timeLogs, onOpenTask, onStatusChange }) {
    const activeTimer = getActiveTimerFromLogs(timeLogs, userId);
    const [elapsed, setElapsed] = useState('0:00:00');
    const [isStarting, setIsStarting] = useState(false);
    const [isStopping, setIsStopping] = useState(false);
    const intervalRef = useRef(null);

    const timerIsForThisTask = activeTimer?.taskId === task?.id;
    const anyActiveTimer = !!activeTimer;

    // Tick elapsed
    useEffect(() => {
        if (timerIsForThisTask && activeTimer?.startTime) {
            const tick = () => setElapsed(formatElapsed(activeTimer.startTime));
            tick();
            intervalRef.current = setInterval(tick, 1000);
            return () => clearInterval(intervalRef.current);
        } else {
            setElapsed('0:00:00');
        }
    }, [activeTimer?.startTime, activeTimer?.id, timerIsForThisTask]);

    const handleStartTimer = useCallback(async () => {
        if (!task || anyActiveTimer) return;
        setIsStarting(true);
        try {
            await startTimer({
                taskId: task.id,
                projectId: task.projectId,
                userId,
            });
        } catch (e) { console.error(e); }
        setIsStarting(false);
    }, [task, userId, anyActiveTimer]);

    const handleStopTimer = useCallback(async () => {
        if (!activeTimer) return;
        setIsStopping(true);
        try {
            await stopTimer(activeTimer.id);
        } catch (e) { console.error(e); }
        setIsStopping(false);
    }, [activeTimer]);

    if (!task) {
        return (
            <div className="bg-slate-900/30 border-2 border-dashed border-slate-700 rounded-2xl p-8 flex flex-col items-center justify-center text-center gap-3 h-full min-h-[200px]">
                <div className="w-14 h-14 rounded-2xl bg-slate-800 flex items-center justify-center">
                    <Target className="w-7 h-7 text-slate-400" />
                </div>
                <div>
                    <p className="font-black text-slate-500 text-base">No hay tarea de enfoque</p>
                    <p className="text-xs text-slate-400 mt-1">Asígnate una tarea o planifica tu semana para comenzar.</p>
                </div>
            </div>
        );
    }

    const priorityCfg = TASK_PRIORITY_CONFIG[task.priority] || TASK_PRIORITY_CONFIG.medium;
    const statusCfg = TASK_STATUS_CONFIG[task.status] || {};
    const priorityStyle = PRIORITY_STYLES[task.priority] || PRIORITY_STYLES.medium;
    const priorityGlow = PRIORITY_GLOW[task.priority] || PRIORITY_GLOW.medium;
    const subtasksDone = task.subtasks?.filter(s => s.completed).length || 0;
    const subtasksTotal = task.subtasks?.length || 0;
    const subtaskPct = subtasksTotal > 0 ? Math.round((subtasksDone / subtasksTotal) * 100) : 0;

    return (
        <div className={`bg-gradient-to-br from-slate-900 to-slate-800/80 border border-slate-700 rounded-2xl p-4 md:p-6 shadow-xl ${priorityGlow} relative overflow-hidden`}>
            {/* Decorative glows */}
            <div className="absolute -top-8 -right-8 w-32 h-32 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />
            <div className="absolute -bottom-8 -left-8 w-24 h-24 bg-purple-500/10 rounded-full blur-2xl pointer-events-none" />

            {/* Label */}
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-500">FOCUS NOW</span>
                </div>
                {timerIsForThisTask && (
                    <span className="text-xs font-black text-emerald-400 bg-emerald-500/15 border border-emerald-500/30 px-3 py-1 rounded-full flex items-center gap-1.5 animate-pulse">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                        {elapsed}
                    </span>
                )}
            </div>

            {/* Task info */}
            <div className="mb-5">
                <div className="flex flex-wrap items-center gap-2 mb-2">
                    <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1">
                        <Folder className="w-3 h-3" />
                        {task.projectName}
                    </span>
                    <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full border ${priorityStyle}`}>
                        {priorityCfg.label}
                    </span>
                    <span className="text-[9px] font-bold text-slate-500 bg-slate-800 px-2 py-0.5 rounded-full">
                        {statusCfg.label || task.status}
                    </span>
                </div>
                <h2 className="text-lg md:text-xl font-black text-white leading-tight mb-3">{task.title}</h2>

                {/* Hours bar */}
                <div className="flex items-center gap-4 text-xs font-bold text-slate-500 mb-2">
                    <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        Est. {task.estimatedHours || 0}h
                    </span>
                    <span className="flex items-center gap-1 text-indigo-400">
                        <Zap className="w-3.5 h-3.5" />
                        Real {(task.actualHours || 0).toFixed(1)}h
                    </span>
                    {task.dueDate && (
                        <span className={`flex items-center gap-1 ${new Date(task.dueDate) < new Date() ? 'text-red-400 font-black' : 'text-slate-500'
                            }`}>
                            <Flag className="w-3.5 h-3.5" />
                            {format(parseISO(task.dueDate), 'dd MMM')}
                        </span>
                    )}
                </div>

                {/* Subtask progress */}
                {subtasksTotal > 0 && (
                    <div className="mt-3">
                        <div className="flex justify-between items-center text-[10px] font-bold text-slate-400 mb-1">
                            <span>Subtareas</span>
                            <span>{subtasksDone}/{subtasksTotal}</span>
                        </div>
                        <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-500"
                                style={{ width: `${subtaskPct}%` }}
                            />
                        </div>
                    </div>
                )}
            </div>

            {/* Actions */}
            <div className="grid grid-cols-2 md:flex md:flex-wrap gap-2">
                {timerIsForThisTask ? (
                    <button
                        onClick={handleStopTimer}
                        disabled={isStopping}
                        className="flex items-center justify-center gap-2 px-4 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-xl font-black text-sm shadow-lg shadow-red-500/30 active:scale-95 transition-all disabled:opacity-60"
                    >
                        <Square className="w-4 h-4 fill-current" />
                        {isStopping ? 'Deteniendo...' : 'Detener Timer'}
                    </button>
                ) : (
                    <button
                        onClick={handleStartTimer}
                        disabled={isStarting || anyActiveTimer}
                        title={anyActiveTimer ? 'Tienes un timer activo en otra tarea' : ''}
                        className="flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-black text-sm shadow-lg shadow-indigo-500/30 active:scale-95 transition-all disabled:opacity-50"
                    >
                        <Play className="w-4 h-4 fill-current" />
                        {isStarting ? 'Iniciando...' : 'Iniciar Timer'}
                    </button>
                )}

                {task.status !== 'in_progress' && (
                    <button
                        onClick={() => onStatusChange?.(task, 'in_progress')}
                        className="flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-900/70 border border-slate-700 hover:border-amber-500/50 hover:text-amber-400 text-slate-400 rounded-xl font-bold text-sm transition-all active:scale-95"
                    >
                        <ChevronRight className="w-4 h-4" />
                        En Progreso
                    </button>
                )}

                <button
                    onClick={() => onOpenTask?.(task)}
                    className="flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-900/70 border border-slate-700 hover:border-indigo-500/50 hover:text-indigo-400 text-slate-400 rounded-xl font-bold text-sm transition-all active:scale-95 col-span-2 md:col-span-1 md:ml-auto"
                >
                    <ExternalLink className="w-4 h-4" />
                    Ver Tarea
                </button>
            </div>
        </div>
    );
}
