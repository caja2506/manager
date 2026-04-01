import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Square, Clock, Zap, ListTodo, FolderGit2, Play, AlertTriangle, Info } from 'lucide-react';
import {
    formatElapsed, stopTimer, startTimer,
    getActiveTimerFromLogs, clearLegacyTimer
} from '../../services/timeService';

export default function ActiveTimerCard({ tasks, allTasks, projects, userId, timeLogs, onTimerStop }) {
    // Active timer from Firestore (via timeLogs)
    const activeTimer = getActiveTimerFromLogs(timeLogs, userId);
    const [elapsed, setElapsed] = useState('0:00:00');
    const [isStopping, setIsStopping] = useState(false);
    const [showStartForm, setShowStartForm] = useState(false);
    const [formTask, setFormTask] = useState('');
    const [formProject, setFormProject] = useState('');
    const [isStarting, setIsStarting] = useState(false);
    const intervalRef = useRef(null);

    const elapsedHours = parseInt(elapsed.split(':')[0] || '0');

    // One-time cleanup of legacy localStorage timer
    useEffect(() => {
        clearLegacyTimer();
    }, []);

    // Tick elapsed
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

    const handleStop = useCallback(async () => {
        if (!activeTimer) return;
        setIsStopping(true);
        try {
            const result = await stopTimer(activeTimer.id);
            onTimerStop?.(result);
        } catch (e) {
            console.error(e);
        }
        setIsStopping(false);
    }, [activeTimer, onTimerStop]);

    const handleStart = useCallback(async () => {
        if (!formTask && !formProject) return;
        setIsStarting(true);
        try {
            const task = tasks.find(t => t.id === formTask);
            await startTimer({
                taskId: formTask || null,
                projectId: formProject || task?.projectId || null,
                userId,
                notes: '',
                overtime: false,
            });
            setShowStartForm(false);
            setFormTask(''); setFormProject('');
        } catch (e) { console.error(e); }
        setIsStarting(false);
    }, [formTask, formProject, tasks, userId]);

    const lookupTasks = allTasks || tasks;
    const activeTaskName = activeTimer?.taskId
        ? (lookupTasks?.find(t => t.id === activeTimer.taskId)?.title || activeTimer.taskTitle || 'Tarea desconocida')
        : null;
    const activeProjectName = activeTimer?.projectId
        ? (projects?.find(p => p.id === activeTimer.projectId)?.name || activeTimer.projectName || 'Proyecto')
        : null;

    return (
        <div className="bg-slate-900/70 border border-slate-800 rounded-2xl shadow-lg overflow-hidden">
            {/* Header */}
            <div className="px-5 py-4 border-b border-slate-800 flex items-center gap-2">
                <Clock className="w-4 h-4 text-indigo-500" />
                <span className="text-xs font-black uppercase tracking-widest text-slate-500">Timer Activo</span>
                {activeTimer && (
                    <span className="ml-auto">
                        <span className="w-2 h-2 rounded-full bg-green-500 inline-block animate-pulse" />
                    </span>
                )}
            </div>

            <div className="p-5">
                {activeTimer ? (
                    <div className={`space-y-4 ${elapsedHours >= 8 ? 'animate-pulse' : ''}`}>
                        {/* Big timer display */}
                        <div className="text-center">
                            <span className={`text-4xl font-black tabular-nums tracking-tight ${elapsedHours >= 8 ? 'text-red-400' : 'text-indigo-400'
                                }`}>
                                {elapsed}
                            </span>
                            {activeTimer.overtime && (
                                <div className="flex items-center justify-center gap-1 mt-1">
                                    <Zap className="w-3 h-3 text-amber-500" />
                                    <span className="text-[10px] font-black text-amber-400 uppercase tracking-widest">Tiempo Extra</span>
                                </div>
                            )}
                        </div>

                        {/* Task / Project chips */}
                        <div className="flex flex-col gap-1.5">
                            {activeTaskName && (
                                <div className="flex items-center gap-2 bg-indigo-500/10 border border-indigo-500/20 rounded-xl px-3 py-2">
                                    <ListTodo className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                                    <span className="text-xs font-bold text-indigo-400 truncate">{activeTaskName}</span>
                                </div>
                            )}
                            {activeProjectName && (
                                <div className="flex items-center gap-2 bg-purple-500/10 border border-purple-500/20 rounded-xl px-3 py-2">
                                    <FolderGit2 className="w-3.5 h-3.5 text-purple-500 shrink-0" />
                                    <span className="text-xs font-bold text-purple-400 truncate">{activeProjectName}</span>
                                </div>
                            )}
                        </div>

                        {/* Stop button */}
                        <button
                            onClick={handleStop}
                            disabled={isStopping}
                            className="w-full py-3 bg-red-500 hover:bg-red-600 text-white rounded-2xl font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-red-500/30 active:scale-95 transition-all disabled:opacity-60"
                        >
                            <Square className="w-4 h-4 fill-current" />
                            {isStopping ? 'Deteniendo...' : 'Detener Timer'}
                        </button>
                    </div>
                ) : !showStartForm ? (
                    <div className="text-center py-4 space-y-3">
                        <div className="w-14 h-14 rounded-2xl bg-slate-800 flex items-center justify-center mx-auto">
                            <Clock className="w-6 h-6 text-slate-400" />
                        </div>
                        <p className="text-xs font-bold text-slate-400">No hay timer activo</p>
                        <button
                            onClick={() => setShowStartForm(true)}
                            className="w-full py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-2xl font-black text-sm flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-all"
                        >
                            <Play className="w-4 h-4 fill-current" />
                            Iniciar Timer
                        </button>
                    </div>
                ) : (
                    <div className="space-y-3 animate-in fade-in zoom-in-95 duration-200">
                        <select
                            value={formTask}
                            onChange={e => {
                                setFormTask(e.target.value);
                                const t = tasks?.find(t => t.id === e.target.value);
                                if (t?.projectId) setFormProject(t.projectId);
                            }}
                            className="w-full px-3 py-2.5 border border-slate-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-400 bg-slate-800 font-medium"
                        >
                            <option value="">Sin tarea específica</option>
                            {tasks?.filter(t => t.status !== 'completed' && t.status !== 'cancelled').map(t => (
                                <option key={t.id} value={t.id}>{t.title}</option>
                            ))}
                        </select>
                        <select
                            value={formProject}
                            onChange={e => setFormProject(e.target.value)}
                            className="w-full px-3 py-2.5 border border-slate-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-400 bg-slate-800 font-medium"
                        >
                            <option value="">Sin proyecto</option>
                            {projects?.map(p => (
                                <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                        </select>
                        <div className="flex gap-2">
                            <button
                                onClick={() => { setShowStartForm(false); setFormTask(''); setFormProject(''); }}
                                className="flex-1 py-2.5 border border-slate-700 bg-slate-800 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-800 transition-all"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleStart}
                                disabled={isStarting || (!formTask && !formProject)}
                                className="flex-[2] py-2.5 bg-green-500 hover:bg-green-600 text-white rounded-xl font-black text-sm flex items-center justify-center gap-1.5 shadow-md active:scale-95 transition-all disabled:opacity-50"
                            >
                                <Play className="w-3.5 h-3.5 fill-current" />
                                {isStarting ? 'Iniciando...' : 'Iniciar'}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
