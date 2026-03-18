import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    Play, Pause, Square, Clock, Zap, ListTodo, FolderGit2,
    FileText, ChevronDown, Timer as TimerIcon
} from 'lucide-react';
import {
    startTimer, stopTimer, getActiveTimer, formatElapsed
} from '../../services/timeService';

export default function ActiveTimer({
    tasks, projects, userId, onTimerStop
}) {
    const [activeTimer, setActiveTimerState] = useState(() => getActiveTimer());
    const [elapsed, setElapsed] = useState('0:00:00');
    const [showForm, setShowForm] = useState(false);
    const [isStarting, setIsStarting] = useState(false);
    const [isStopping, setIsStopping] = useState(false);

    // New timer form
    const [formTask, setFormTask] = useState('');
    const [formProject, setFormProject] = useState('');
    const [formNotes, setFormNotes] = useState('');
    const [formOvertime, setFormOvertime] = useState(false);

    const intervalRef = useRef(null);

    // Tick elapsed time
    useEffect(() => {
        if (activeTimer?.startTime) {
            const tick = () => setElapsed(formatElapsed(activeTimer.startTime));
            tick();
            intervalRef.current = setInterval(tick, 1000);
            return () => clearInterval(intervalRef.current);
        } else {
            setElapsed('0:00:00');
        }
    }, [activeTimer]);

    // Check localStorage on mount (in case timer was started in another tab)
    useEffect(() => {
        const check = () => {
            const stored = getActiveTimer();
            if (stored && !activeTimer) setActiveTimerState(stored);
            else if (!stored && activeTimer) setActiveTimerState(null);
        };
        window.addEventListener('storage', check);
        return () => window.removeEventListener('storage', check);
    }, [activeTimer]);

    const handleStart = useCallback(async () => {
        if (!formTask && !formProject) return;
        setIsStarting(true);
        try {
            const timer = await startTimer({
                taskId: formTask || null,
                projectId: formProject || null,
                userId,
                notes: formNotes,
                overtime: formOvertime,
            });
            setActiveTimerState(timer);
            setShowForm(false);
            setFormTask(''); setFormProject(''); setFormNotes(''); setFormOvertime(false);
        } catch (err) {
            console.error('Error starting timer:', err);
        }
        setIsStarting(false);
    }, [formTask, formProject, formNotes, formOvertime, userId]);

    const handleStop = useCallback(async () => {
        if (!activeTimer) return;
        setIsStopping(true);
        try {
            const result = await stopTimer(activeTimer.logId, {
                notes: activeTimer.notes || '',
                overtime: activeTimer.overtime || false,
            });
            setActiveTimerState(null);
            clearInterval(intervalRef.current);
            setElapsed('0:00:00');
            onTimerStop?.(result);
        } catch (err) {
            console.error('Error stopping timer:', err);
        }
        setIsStopping(false);
    }, [activeTimer, onTimerStop]);

    // Resolve task/project names
    const activeTaskName = activeTimer?.taskId
        ? (tasks.find(t => t.id === activeTimer.taskId)?.title || 'Tarea')
        : null;
    const activeProjectName = activeTimer?.projectId
        ? (projects.find(p => p.id === activeTimer.projectId)?.name || 'Proyecto')
        : null;

    // Parse elapsed for color coding
    const elapsedParts = elapsed.split(':');
    const elapsedHours = parseInt(elapsedParts[0] || '0');

    return (
        <div className="space-y-3">
            {/* Active Timer Display */}
            {activeTimer ? (
                <div className={`rounded-3xl border-2 p-5 shadow-lg transition-all ${elapsedHours >= 8
                    ? 'bg-red-500/15 border-red-500/30 animate-pulse'
                    : 'bg-gradient-to-br from-indigo-50 to-purple-50 border-indigo-500/30'
                    }`}>
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                            <div className={`w-3 h-3 rounded-full animate-pulse ${elapsedHours >= 8 ? 'bg-red-500' : 'bg-green-500'}`} />
                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                                Timer activo
                            </span>
                            {activeTimer.overtime && (
                                <span className="text-[9px] font-bold text-amber-400 bg-amber-100 px-2 py-0.5 rounded-full flex items-center gap-1">
                                    <Zap className="w-3 h-3" /> EXTRA
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Elapsed Time - Big Display */}
                    <div className="text-center py-4">
                        <span className={`text-5xl font-black tracking-tight tabular-nums ${elapsedHours >= 8 ? 'text-red-400' : 'text-indigo-400'
                            }`}>
                            {elapsed}
                        </span>
                    </div>

                    {/* What's being tracked */}
                    <div className="flex flex-wrap gap-2 justify-center mb-4">
                        {activeTaskName && (
                            <span className="text-[10px] font-bold text-indigo-400 bg-indigo-600/20 px-3 py-1 rounded-full flex items-center gap-1">
                                <ListTodo className="w-3 h-3" /> {activeTaskName}
                            </span>
                        )}
                        {activeProjectName && (
                            <span className="text-[10px] font-bold text-purple-600 bg-purple-100 px-3 py-1 rounded-full flex items-center gap-1">
                                <FolderGit2 className="w-3 h-3" /> {activeProjectName}
                            </span>
                        )}
                    </div>

                    {/* Stop Button */}
                    <button
                        onClick={handleStop}
                        disabled={isStopping}
                        className="w-full py-3.5 bg-red-500 hover:bg-red-600 text-white rounded-2xl font-black shadow-lg flex items-center justify-center gap-2 active:scale-95 transition-all disabled:bg-slate-300"
                    >
                        <Square className="w-5 h-5 fill-current" />
                        {isStopping ? 'Deteniendo...' : 'Detener Timer'}
                    </button>
                </div>
            ) : (
                /* Start Timer UI */
                <>
                    {!showForm ? (
                        <button
                            onClick={() => setShowForm(true)}
                            className="w-full py-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-3xl font-black shadow-lg flex items-center justify-center gap-2 active:scale-95 transition-all hover:shadow-xl"
                        >
                            <Play className="w-5 h-5 fill-current" /> Iniciar Timer
                        </button>
                    ) : (
                        <div className="bg-slate-900/70 rounded-2xl border-2 border-indigo-100 p-5 shadow-lg space-y-3 animate-in fade-in zoom-in-95 duration-200">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-black text-slate-700 flex items-center gap-2">
                                    <TimerIcon className="w-4 h-4 text-indigo-500" /> Nuevo Timer
                                </span>
                                <button onClick={() => setShowForm(false)} className="text-xs text-slate-400 hover:text-slate-600">
                                    Cancelar
                                </button>
                            </div>

                            {/* Project Selector (FIRST) */}
                            <div>
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1 block">
                                    <FolderGit2 className="w-3 h-3 inline mr-1" />Proyecto
                                </span>
                                <select
                                    value={formProject}
                                    onChange={e => { setFormProject(e.target.value); setFormTask(''); }}
                                    className="w-full px-3 py-2.5 border border-slate-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-800"
                                >
                                    <option value="">Sin proyecto</option>
                                    {projects.map(p => (
                                        <option key={p.id} value={p.id}>{p.name}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Task Selector (filtered by project) */}
                            <div>
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1 block">
                                    <ListTodo className="w-3 h-3 inline mr-1" />Tarea (opcional)
                                </span>
                                <select
                                    value={formTask}
                                    onChange={e => {
                                        setFormTask(e.target.value);
                                        const t = tasks.find(t => t.id === e.target.value);
                                        if (t?.projectId && !formProject) setFormProject(t.projectId);
                                    }}
                                    className="w-full px-3 py-2.5 border border-slate-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-800"
                                >
                                    <option value="">Sin tarea específica</option>
                                    {tasks
                                        .filter(t => t.status !== 'completed' && t.status !== 'cancelled')
                                        .filter(t => {
                                            if (!formProject) return !t.projectId;
                                            return t.projectId === formProject;
                                        })
                                        .map(t => (
                                            <option key={t.id} value={t.id}>{t.title}</option>
                                        ))}
                                </select>
                            </div>

                            {/* Notes */}
                            <div>
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1 block">
                                    <FileText className="w-3 h-3 inline mr-1" />Notas
                                </span>
                                <input
                                    value={formNotes}
                                    onChange={e => setFormNotes(e.target.value)}
                                    placeholder="¿En qué estás trabajando?"
                                    className="w-full px-3 py-2.5 border border-slate-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-800"
                                />
                            </div>

                            {/* Overtime toggle */}
                            <label className="flex items-center gap-3 px-3 py-2 bg-amber-500/15 rounded-xl cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={formOvertime}
                                    onChange={e => setFormOvertime(e.target.checked)}
                                    className="w-4 h-4 rounded accent-amber-500"
                                />
                                <div className="flex items-center gap-1.5">
                                    <Zap className="w-4 h-4 text-amber-500" />
                                    <span className="text-xs font-bold text-amber-400">Marcar como tiempo extra</span>
                                </div>
                            </label>

                            {/* Start button */}
                            <button
                                onClick={handleStart}
                                disabled={isStarting || (!formTask && !formProject)}
                                className="w-full py-3.5 bg-green-500 hover:bg-green-600 text-white rounded-2xl font-black shadow-lg flex items-center justify-center gap-2 active:scale-95 transition-all disabled:bg-slate-700 disabled:text-slate-500 disabled:shadow-none"
                            >
                                <Play className="w-5 h-5 fill-current" />
                                {isStarting ? 'Iniciando...' : 'Iniciar'}
                            </button>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
