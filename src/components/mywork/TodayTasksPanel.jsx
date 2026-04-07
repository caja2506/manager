import React, { useState } from 'react';
import {
    Play, ExternalLink, Ban, CheckCircle2, AlarmClockOff,
    Inbox, ChevronsRight, Clock
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { TASK_STATUS_CONFIG, TASK_PRIORITY_CONFIG } from '../../models/schemas';
import { getActiveTimerFromLogs, getActiveTimerForTask, startTimer } from '../../services/timeService';

const SOURCE_LABELS = {
    in_progress: { label: 'En Progreso', icon: ChevronsRight, color: 'text-amber-400 bg-amber-500/15 border-amber-500/30' },
    planned:     { label: 'Planificado Hoy', icon: CheckCircle2, color: 'text-indigo-400 bg-indigo-500/15 border-indigo-500/30' },
    overdue:     { label: 'Vencida', icon: AlarmClockOff, color: 'text-red-400 bg-red-500/15 border-red-500/30' },
    urgent:      { label: 'Urgente Hoy', icon: Clock, color: 'text-amber-400 bg-amber-500/15 border-amber-500/30' },
};

const PRIORITY_DOT = {
    critical: 'bg-red-500',
    high:     'bg-amber-400',
    medium:   'bg-blue-400',
    low:      'bg-slate-300',
};

export default function TodayTasksPanel({ tasks, userId, timeLogs, onOpenTask, onStatusChange }) {
    const [startingId, setStartingId] = useState(null);

    const handleStartTimer = async (task) => {
        const active = getActiveTimerFromLogs(timeLogs, userId);
        if (active) { alert('Ya tienes un timer activo. Por favor detenlo antes.'); return; }
        setStartingId(task.id);
        try {
            await startTimer({ taskId: task.id, projectId: task.projectId, userId });
        } catch (e) { console.error(e); }
        setStartingId(null);
    };

    if (tasks.length === 0) {
        return (
            <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6 shadow-lg flex flex-col items-center justify-center text-center gap-3 min-h-[180px]">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 border border-emerald-500/20 flex items-center justify-center">
                    <Inbox className="w-6 h-6 text-emerald-500" />
                </div>
                <p className="text-sm font-black text-slate-500">Todo tranquilo por hoy</p>
                <p className="text-xs text-slate-400">No tienes tareas urgentes, vencidas o planificadas para hoy.</p>
            </div>
        );
    }

    return (
        <div className="bg-slate-900/70 border border-slate-800 rounded-2xl shadow-lg overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
                <h3 className="font-black text-slate-200 text-sm flex items-center gap-2">
                    <Clock className="w-4 h-4 text-indigo-500" />
                    Tareas de Hoy
                </h3>
                <span className="bg-indigo-600/20 text-indigo-400 text-xs font-black px-2.5 py-1 rounded-full">
                    {tasks.length}
                </span>
            </div>

            <div className="divide-y divide-slate-800">
                {tasks.map(task => {
                    const sourceCfg = SOURCE_LABELS[task.todaySource] || SOURCE_LABELS.planned;
                    const SourceIcon = sourceCfg.icon;
                    const priorityDot = PRIORITY_DOT[task.priority] || PRIORITY_DOT.medium;
                    const isTimerActive = !!getActiveTimerForTask(timeLogs, task.id);

                    return (
                        <div
                            key={task.id}
                            className={`group flex items-center gap-3 px-5 py-3.5 hover:bg-slate-800 transition-colors ${
                                task.todaySource === 'overdue' ? 'bg-red-500/5' : ''
                            }`}
                        >
                            {/* Priority dot */}
                            <div className={`w-2 h-2 rounded-full shrink-0 ${priorityDot}`} />

                            {/* Main content */}
                            <div className="flex-1 min-w-0">
                                <div className="flex flex-wrap items-center gap-1.5 mb-0.5">
                                    <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded border ${sourceCfg.color} flex items-center gap-1`}>
                                        <SourceIcon className="w-2.5 h-2.5" />
                                        {sourceCfg.label}
                                    </span>
                                    <span className="text-[10px] font-bold text-slate-400">{task.projectName}</span>
                                    {task.dueDate && (
                                        <span className={`text-[10px] font-bold ${
                                            new Date(task.dueDate) < new Date() ? 'text-red-400' : 'text-slate-400'
                                        }`}>
                                            · {format(parseISO(task.dueDate), 'dd MMM')}
                                        </span>
                                    )}
                                </div>
                                <p className="font-bold text-slate-100 text-sm truncate">{task.title}</p>
                            </div>

                            {/* Quick actions (visible on hover) */}
                            <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                {!isTimerActive && task.status !== 'completed' && (
                                    <button
                                        onClick={() => handleStartTimer(task)}
                                        disabled={startingId === task.id}
                                        title="Iniciar Timer"
                                        className="w-7 h-7 rounded-lg bg-indigo-500/15 hover:bg-indigo-500/25 flex items-center justify-center text-indigo-400 transition-colors"
                                    >
                                        <Play className="w-3 h-3 fill-current" />
                                    </button>
                                )}
                                {task.status !== 'blocked' && (
                                    <button
                                        onClick={() => onStatusChange?.(task, 'blocked')}
                                        title="Marcar como bloqueada"
                                        className="w-7 h-7 rounded-lg bg-red-500/15 hover:bg-red-500/25 flex items-center justify-center text-red-400 transition-colors"
                                    >
                                        <Ban className="w-3 h-3" />
                                    </button>
                                )}
                                <button
                                    onClick={() => onOpenTask?.(task)}
                                    title="Abrir tarea"
                                    className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-300 transition-colors"
                                >
                                    <ExternalLink className="w-3 h-3" />
                                </button>
                            </div>

                            {/* Timer badge */}
                            {isTimerActive && (
                                <span className="text-[9px] font-black text-green-400 bg-green-500/15 border border-green-500/30 px-2 py-0.5 rounded-full animate-pulse shrink-0">
                                    ● ACTIVO
                                </span>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
