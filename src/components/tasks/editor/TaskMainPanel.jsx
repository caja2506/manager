import React, { useState, useEffect } from 'react';
import { FileText, BarChart2, Activity, ChevronDown } from 'lucide-react';
import SubtaskList from '../SubtaskList';
import { fetchTaskActivityLog } from '../../../services/activityLogService';

const EVENT_ICONS = {
    subtask_completed: '✅',
    subtask_unchecked: '⬜',
    status_changed: '🔄',
    timer_started: '▶️',
    timer_stopped: '⏹️',
    delay_reported: '⚠️',
};

const EVENT_COLORS = {
    subtask_completed: '#22c55e',
    subtask_unchecked: '#64748b',
    status_changed: '#6366f1',
    timer_started: '#f59e0b',
    timer_stopped: '#f59e0b',
    delay_reported: '#ef4444',
};

/**
 * TaskMainPanel — left column of the task editor.
 * Contains title input, description, progress, subtasks, and activity timeline.
 */
export default function TaskMainPanel({
    form, setForm, isNew, task,
    subtasks, canEdit, onSubtaskProgressChange,
    userId, userName,
}) {
    const totalSubtasks = (subtasks || []).length;
    const hasSubtasks = totalSubtasks > 0;

    // Activity timeline state
    const [showTimeline, setShowTimeline] = useState(false);
    const [activityLogs, setActivityLogs] = useState([]);
    const [loadingLogs, setLoadingLogs] = useState(false);

    useEffect(() => {
        if (!showTimeline || !task?.id) return;
        let cancelled = false;
        (async () => {
            setLoadingLogs(true);
            try {
                const logs = await fetchTaskActivityLog(task.id, 50);
                if (!cancelled) setActivityLogs(logs);
            } catch { /* ignore */ }
            finally { if (!cancelled) setLoadingLogs(false); }
        })();
        return () => { cancelled = true; };
    }, [showTimeline, task?.id]);

    const formatTime = (isoStr) => {
        if (!isoStr) return '';
        const d = new Date(isoStr);
        return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
    };

    return (
        <div className="w-full lg:w-1/2 p-4 lg:p-5 overflow-y-auto space-y-4 lg:border-r border-slate-800">
            {/* Title input */}
            <div>
                <input
                    value={form.title}
                    onChange={e => setForm({ ...form, title: e.target.value })}
                    placeholder="Título de la tarea..."
                    className="w-full text-lg font-black tracking-tight outline-none bg-transparent text-white placeholder-slate-600 border-b border-transparent focus:border-indigo-500 pb-1 transition-colors"
                    disabled={!canEdit}
                    autoFocus={isNew}
                />
            </div>

            {/* Description */}
            <div>
                <div className="flex items-center gap-1.5 mb-1.5">
                    <FileText className="w-3 h-3 text-slate-500" />
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        Descripción / Instrucciones
                    </span>
                </div>
                <textarea
                    value={form.description}
                    onChange={e => setForm({ ...form, description: e.target.value })}
                    placeholder="Detalles, notas, instrucciones..."
                    className="w-full px-3 py-2.5 border border-slate-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-800 text-slate-200 placeholder-slate-500 resize-none"
                    rows={3}
                    disabled={!canEdit}
                />
            </div>

            {/* Manual progress slider — only when NO subtasks (otherwise SubtaskList handles it) */}
            {!isNew && !hasSubtasks && (
                <div className="border-t border-slate-700 pt-3">
                    <div className="flex items-center gap-1.5 mb-2">
                        <BarChart2 className="w-3 h-3 text-slate-500" />
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                            Progreso
                        </span>
                        <span className="text-[9px] font-bold text-indigo-400 bg-indigo-500/15 px-1.5 py-0.5 rounded-full">
                            {form.percentComplete || 0}%
                        </span>
                    </div>
                    <div className="flex items-center gap-3">
                        <input
                            type="range" min={0} max={100} step={5}
                            value={form.percentComplete}
                            onChange={e => setForm(f => ({ ...f, percentComplete: Number(e.target.value) }))}
                            className="flex-1 accent-indigo-500"
                            disabled={!canEdit}
                        />
                        <span className="text-xs font-bold text-indigo-400 w-10 text-right">{form.percentComplete}%</span>
                    </div>
                    <p className="text-[10px] text-slate-500 mt-1">
                        Progreso manual (agrega subtareas para cálculo automático)
                    </p>
                </div>
            )}

            {/* Subtasks — includes its own progress bar when subtasks exist */}
            {!isNew && (
                <div className="border-t border-slate-700 pt-4">
                    <SubtaskList
                        subtasks={subtasks}
                        taskId={task.id}
                        readOnly={!canEdit}
                        onProgressChange={onSubtaskProgressChange}
                        userId={userId}
                        userName={userName}
                    />
                </div>
            )}

            {isNew && (
                <div className="border-t border-slate-700 pt-4">
                    <p className="text-xs text-slate-500 italic">
                        Las subtareas podrán agregarse después de crear la tarea.
                    </p>
                </div>
            )}

            {/* Activity Timeline — collapsible */}
            {!isNew && task?.id && (
                <div className="border-t border-slate-700 pt-3">
                    <button
                        onClick={() => setShowTimeline(prev => !prev)}
                        className="w-full flex items-center justify-between group"
                    >
                        <div className="flex items-center gap-1.5">
                            <Activity className="w-3 h-3 text-emerald-500" />
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest group-hover:text-emerald-400 transition-colors">
                                Historial de Actividad
                            </span>
                            {activityLogs.length > 0 && (
                                <span className="text-[9px] font-bold text-emerald-400 bg-emerald-500/15 px-1.5 py-0.5 rounded-full">
                                    {activityLogs.length}
                                </span>
                            )}
                        </div>
                        <ChevronDown className={`w-3.5 h-3.5 text-slate-500 transition-transform duration-200 ${showTimeline ? 'rotate-180' : ''}`} />
                    </button>

                    {showTimeline && (
                        <div className="mt-2 space-y-0.5 max-h-[250px] overflow-y-auto">
                            {loadingLogs ? (
                                <p className="text-[10px] text-slate-500 animate-pulse py-2">Cargando historial...</p>
                            ) : activityLogs.length === 0 ? (
                                <p className="text-[10px] text-slate-500 italic py-2">Sin actividad registrada aún.</p>
                            ) : (
                                <div className="ml-1 border-l-2 border-slate-700/50 pl-3 space-y-0.5">
                                    {activityLogs.map(log => (
                                        <div key={log.id} className="flex items-start gap-1.5 py-1 hover:bg-slate-800/30 rounded px-1 -ml-1 transition-colors">
                                            <span className="text-xs shrink-0 mt-px">{EVENT_ICONS[log.type] || '📋'}</span>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-[11px] text-slate-300 font-medium leading-snug truncate">
                                                    {log.description}
                                                </p>
                                                <span className="text-[9px] font-bold text-slate-500">
                                                    {formatTime(log.timestamp)}
                                                    {log.userName && ` · ${log.userName}`}
                                                </span>
                                            </div>
                                            <div
                                                className="w-1.5 h-1.5 rounded-full shrink-0 mt-1.5"
                                                style={{ backgroundColor: EVENT_COLORS[log.type] || '#64748b' }}
                                            />
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
