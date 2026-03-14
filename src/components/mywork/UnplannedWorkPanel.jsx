import React from 'react';
import { CalendarPlus, Inbox, ExternalLink, Clock } from 'lucide-react';

const PRIORITY_STYLES = {
    critical: 'border-red-500/30 bg-red-500/5',
    high:     'border-amber-500/30 bg-amber-500/5',
    medium:   'border-slate-800',
    low:      'border-slate-800',
};

const PRIORITY_PILL = {
    critical: 'bg-red-500/15 text-red-400',
    high:     'bg-amber-500/15 text-amber-400',
    medium:   'bg-blue-500/15 text-blue-400',
    low:      'bg-slate-800 text-slate-400',
};

const PRIORITY_LABELS = {
    critical: 'Crítica',
    high:     'Alta',
    medium:   'Media',
    low:      'Baja',
};

export default function UnplannedWorkPanel({ tasks, onOpenTask, onQuickPlan }) {
    if (tasks.length === 0) {
        return (
            <div className="bg-slate-900/70 border border-slate-800 rounded-2xl shadow-lg p-5">
                <div className="flex items-center gap-2 mb-4">
                    <CalendarPlus className="w-4 h-4 text-indigo-400" />
                    <h3 className="font-black text-slate-200 text-sm">Trabajo sin Planificar</h3>
                    <span className="ml-auto text-xs font-bold text-slate-300">0</span>
                </div>
                <div className="flex flex-col items-center justify-center py-4 gap-2 text-center">
                    <div className="w-10 h-10 rounded-xl bg-indigo-600/20 flex items-center justify-center">
                        <Inbox className="w-5 h-5 text-indigo-500" />
                    </div>
                    <p className="text-xs font-bold text-slate-400">Toda tu carga está planificada ✓</p>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-slate-900/70 border border-slate-800 rounded-2xl shadow-lg overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-800 flex items-center gap-2">
                <CalendarPlus className="w-4 h-4 text-indigo-500" />
                <h3 className="font-black text-slate-200 text-sm">Trabajo sin Planificar</h3>
                <span className="ml-auto bg-amber-500/15 border border-amber-500/30 text-amber-400 text-xs font-black px-2 py-0.5 rounded-full">
                    {tasks.length}
                </span>
            </div>

            <div className="divide-y divide-slate-800">
                {tasks.slice(0, 7).map(task => {
                    const borderStyle = PRIORITY_STYLES[task.priority] || PRIORITY_STYLES.medium;
                    const pill = PRIORITY_PILL[task.priority] || PRIORITY_PILL.medium;
                    const priorityLabel = PRIORITY_LABELS[task.priority] || task.priority;

                    return (
                        <div key={task.id} className={`group px-5 py-3.5 border-l-2 ${borderStyle} hover:bg-slate-800 transition-colors`}>
                            <div className="flex items-start gap-3">
                                <div className="flex-1 min-w-0">
                                    <div className="flex flex-wrap items-center gap-1.5 mb-0.5">
                                        <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded ${pill}`}>
                                            {priorityLabel}
                                        </span>
                                        <span className="text-[10px] font-bold text-slate-400">{task.projectName}</span>
                                    </div>
                                    <p className="font-bold text-white text-sm truncate mb-1.5">{task.title}</p>

                                    {/* Hours mini-bar */}
                                    <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400">
                                        <Clock className="w-3 h-3" />
                                        <span>Est. {task.estimatedHours || 0}h</span>
                                        <span className="text-indigo-500">Plan. {task.plannedThisWeek.toFixed(1)}h</span>
                                        <span className="text-amber-400 font-black">Falta {task.remainingToplan.toFixed(1)}h</span>
                                    </div>
                                </div>

                                {/* Actions */}
                                <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button
                                        onClick={() => onQuickPlan?.(task, 1)}
                                        title="Planificar 1h hoy"
                                        className="text-[9px] font-black px-2 py-1.5 bg-indigo-600/20 hover:bg-indigo-500/25 text-indigo-400 rounded-lg transition-colors whitespace-nowrap"
                                    >
                                        +1h
                                    </button>
                                    <button
                                        onClick={() => onQuickPlan?.(task, 2)}
                                        title="Planificar 2h hoy"
                                        className="text-[9px] font-black px-2 py-1.5 bg-indigo-600/20 hover:bg-indigo-500/25 text-indigo-400 rounded-lg transition-colors whitespace-nowrap"
                                    >
                                        +2h
                                    </button>
                                    <button
                                        onClick={() => onOpenTask?.(task)}
                                        className="w-6 h-6 rounded-lg bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-300 transition-colors"
                                    >
                                        <ExternalLink className="w-3 h-3" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    );
                })}

                {tasks.length > 7 && (
                    <div className="px-5 py-3 text-center">
                        <span className="text-xs font-bold text-slate-400">+{tasks.length - 7} más sin planificar</span>
                    </div>
                )}
            </div>
        </div>
    );
}
