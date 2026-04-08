import React from 'react';
import { ChevronRight, Flag, ExternalLink, Inbox } from 'lucide-react';
import { format } from 'date-fns';
import { TASK_PRIORITY_CONFIG, TASK_STATUS_CONFIG } from '../../models/schemas';
import { getDaysUntil, parseLocalDate } from '../../utils/dateUtils';

const PRIORITY_DOT = {
    critical: 'bg-red-500',
    high:     'bg-amber-400',
    medium:   'bg-blue-400',
    low:      'bg-slate-500',
};

const PRIORITY_BADGE = {
    critical: 'text-red-400 bg-red-500/15',
    high:     'text-amber-400 bg-amber-500/15',
    medium:   'text-blue-400 bg-blue-500/15',
    low:      'text-slate-300 bg-slate-800',
};

export default function NextUpPanel({ tasks, onOpenTask }) {
    if (tasks.length === 0) {
        return (
            <div className="bg-slate-900/70 border border-slate-800 rounded-2xl shadow-lg p-5">
                <div className="flex items-center gap-2 mb-4">
                    <ChevronRight className="w-4 h-4 text-indigo-400" />
                    <h3 className="font-black text-slate-200 text-sm">Próximamente</h3>
                </div>
                <div className="flex flex-col items-center justify-center py-4 gap-2 text-center">
                    <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center">
                        <Inbox className="w-5 h-5 text-slate-400" />
                    </div>
                    <p className="text-xs font-bold text-slate-400">No hay más tareas pendientes</p>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-slate-900/70 border border-slate-800 rounded-2xl shadow-lg overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-800 flex items-center gap-2">
                <ChevronRight className="w-4 h-4 text-indigo-500" />
                <h3 className="font-black text-slate-200 text-sm">Próximamente</h3>
                <span className="ml-auto bg-slate-800 text-slate-300 text-xs font-black px-2 py-0.5 rounded-full">
                    {tasks.length}
                </span>
            </div>

            <div className="divide-y divide-slate-800">
                {tasks.map(task => {
                    const priorityDot = PRIORITY_DOT[task.priority] || PRIORITY_DOT.medium;
                    const priorityBadge = PRIORITY_BADGE[task.priority] || PRIORITY_BADGE.medium;
                    const priorityCfg = TASK_PRIORITY_CONFIG[task.priority] || {};
                    const statusCfg = TASK_STATUS_CONFIG[task.status] || {};
                    const isOverdue = task.dueDate && getDaysUntil(task.dueDate) < 0;

                    return (
                        <div
                            key={task.id}
                            className="group flex items-center gap-3 px-5 py-3 hover:bg-slate-800 transition-colors cursor-pointer"
                            onClick={() => onOpenTask?.(task)}
                        >
                            <div className={`w-2 h-2 rounded-full shrink-0 ${priorityDot}`} />

                            <div className="flex-1 min-w-0">
                                <div className="flex flex-wrap items-center gap-1 mb-0.5">
                                    <span className="text-[10px] font-bold text-slate-400 truncate">{task.projectName}</span>
                                </div>
                                <p className="font-bold text-slate-200 text-sm truncate">{task.title}</p>
                                <div className="flex items-center gap-2 mt-0.5">
                                    <span className={`text-[9px] font-black px-1.5 py-0.5 rounded ${priorityBadge}`}>
                                        {priorityCfg.label}
                                    </span>
                                    <span className="text-[10px] text-slate-400 font-medium">{statusCfg.label}</span>
                                    {task.dueDate && (
                                        <span className={`text-[10px] font-bold flex items-center gap-0.5 ${isOverdue ? 'text-red-400' : 'text-slate-400'}`}>
                                            <Flag className="w-2.5 h-2.5" />
                                            {format(parseLocalDate(task.dueDate), 'dd MMM')}
                                        </span>
                                    )}
                                </div>
                            </div>

                            {/* Est hours */}
                            {task.estimatedHours > 0 && (
                                <span className="text-[10px] font-black text-slate-400 shrink-0">
                                    {task.estimatedHours}h
                                </span>
                            )}

                            <ExternalLink className="w-3.5 h-3.5 text-slate-300 group-hover:text-slate-500 shrink-0 transition-colors" />
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
