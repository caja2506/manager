import React from 'react';
import { Ban, ExternalLink, AlertTriangle, UserX } from 'lucide-react';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

export default function BlockedTasksPanel({ tasks, onOpenTask, onUnblock }) {
    if (tasks.length === 0) {
        return (
            <div className="bg-slate-900/70 border border-slate-800 rounded-2xl shadow-lg p-5">
                <div className="flex items-center gap-2 mb-4">
                    <Ban className="w-4 h-4 text-red-400" />
                    <h3 className="font-black text-slate-200 text-sm">Bloqueadas</h3>
                    <span className="ml-auto text-xs font-bold text-slate-300">0</span>
                </div>
                <div className="flex flex-col items-center justify-center py-4 gap-2 text-center">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/20 flex items-center justify-center">
                        <Ban className="w-5 h-5 text-emerald-500" />
                    </div>
                    <p className="text-xs font-bold text-slate-400">Sin bloqueos activos ✓</p>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-slate-900/70 border border-red-500/30 rounded-2xl shadow-lg overflow-hidden">
            <div className="px-5 py-4 border-b border-red-500/20 bg-red-500/10 flex items-center gap-2">
                <Ban className="w-4 h-4 text-red-500" />
                <h3 className="font-black text-red-400 text-sm">Bloqueadas</h3>
                <span className="ml-auto bg-red-500/15 border border-red-500/30 text-red-400 text-xs font-black px-2 py-0.5 rounded-full animate-pulse">
                    {tasks.length}
                </span>
            </div>

            <div className="divide-y divide-slate-800">
                {tasks.map(task => {
                    const blockedSince = task.updatedAt
                        ? formatDistanceToNow(parseISO(task.updatedAt), { locale: es, addSuffix: false })
                        : '—';

                    return (
                        <div key={task.id} className="px-5 py-4 hover:bg-red-500/5 transition-colors group">
                            <div className="flex items-start justify-between gap-3">
                                <div className="flex-1 min-w-0">
                                    <div className="flex flex-wrap items-center gap-1.5 mb-1">
                                        <span className="text-[10px] font-bold text-slate-400">{task.projectName}</span>
                                        <span className="text-[10px] font-bold text-red-500">· bloqueada hace {blockedSince}</span>
                                    </div>
                                    <p className="font-bold text-white text-sm truncate">{task.title}</p>
                                    {task.blockedReason && (
                                        <div className="mt-1.5 flex items-start gap-1.5">
                                            <AlertTriangle className="w-3 h-3 text-amber-500 shrink-0 mt-0.5" />
                                            <p className="text-xs text-amber-400 font-medium leading-snug line-clamp-2">{task.blockedReason}</p>
                                        </div>
                                    )}
                                </div>

                                {/* Actions */}
                                <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button
                                        onClick={() => onUnblock?.(task)}
                                        title="Resolver bloqueo"
                                        className="w-7 h-7 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 flex items-center justify-center text-emerald-400 transition-colors"
                                    >
                                        <UserX className="w-3 h-3" />
                                    </button>
                                    <button
                                        onClick={() => onOpenTask?.(task)}
                                        title="Ver tarea"
                                        className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-300 transition-colors"
                                    >
                                        <ExternalLink className="w-3 h-3" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
