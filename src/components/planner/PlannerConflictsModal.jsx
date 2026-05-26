import React from 'react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { X, AlertTriangle, Clock, User, Briefcase, Trash2, Pencil } from 'lucide-react';

/**
 * Modal to visualize and resolve scheduling conflicts (overlapping time blocks).
 */
export default function PlannerConflictsModal({
    isOpen,
    onClose,
    conflicts = [],
    onResolveItem,
    onDeleteItem
}) {
    if (!isOpen) return null;

    const formatBlockTime = (startStr, endStr) => {
        try {
            const s = format(parseISO(startStr), 'HH:mm');
            const e = format(parseISO(endStr), 'HH:mm');
            return `${s} – ${e}`;
        } catch {
            return '—';
        }
    };

    const formatBlockDate = (dateStr) => {
        try {
            const d = parseISO(dateStr + 'T00:00:00');
            return format(d, "EEEE d 'de' MMMM", { locale: es });
        } catch {
            return dateStr;
        }
    };

    return (
        <div className="fixed inset-0 z-[700] flex items-center justify-center p-4">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={onClose} />

            {/* Modal Container */}
            <div className="relative bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 text-slate-200">
                {/* Header */}
                <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-rose-500/10 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-xl bg-rose-500/15 text-rose-400 border border-rose-500/30 animate-pulse">
                            <AlertTriangle className="w-6 h-6" />
                        </div>
                        <div>
                            <h2 className="text-lg font-black tracking-tight text-white">Conflictos de Planificación</h2>
                            <p className="text-xs font-bold text-slate-400 mt-0.5">Se han detectado bloques que se solapan en el horario de un mismo usuario</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-xl transition-colors shrink-0 text-slate-400 hover:text-white">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {conflicts.length === 0 ? (
                        <div className="text-center py-12 space-y-3">
                            <span className="text-4xl">🎉</span>
                            <h3 className="font-black text-white text-base">¡No hay conflictos!</h3>
                            <p className="text-xs text-slate-400 font-medium">Todos los horarios están limpios y balanceados.</p>
                        </div>
                    ) : (
                        conflicts.map((conflict, idx) => {
                            const { itemA, itemB } = conflict;
                            const titleA = itemA.title || itemA.taskTitleSnapshot || 'Planificación libre';
                            const titleB = itemB.title || itemB.taskTitleSnapshot || 'Planificación libre';
                            const projA  = itemA.projectName || itemA.projectNameSnapshot || 'Sin Proyecto';
                            const projB  = itemB.projectName || itemB.projectNameSnapshot || 'Sin Proyecto';
                            const dateLabel = formatBlockDate(itemA.date);
                            const assignee = itemA.assigneeDisplayName || itemA.assignedToName || 'Sin Asignar';

                            return (
                                <div key={idx} className="border border-slate-800 bg-slate-950/40 rounded-2xl p-5 space-y-4">
                                    {/* Meta Row */}
                                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-850 pb-3 text-xs font-black uppercase tracking-wider text-slate-400">
                                        <div className="flex items-center gap-1.5 text-indigo-400">
                                            <User className="w-4 h-4" />
                                            <span>{assignee}</span>
                                        </div>
                                        <div className="text-slate-400 capitalize">
                                            {dateLabel}
                                        </div>
                                    </div>

                                    {/* Overlapping Cards */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {/* Block A */}
                                        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col justify-between gap-3 hover:border-slate-700 transition-colors">
                                            <div className="space-y-2">
                                                <div className="flex items-center justify-between gap-2">
                                                    <span className="text-[9px] font-black uppercase text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-md border border-indigo-500/20">Bloque 1</span>
                                                    <span className="text-[10px] font-black text-rose-400 flex items-center gap-1">
                                                        <Clock className="w-3.5 h-3.5" />
                                                        {formatBlockTime(itemA.startDateTime, itemA.endDateTime)}
                                                    </span>
                                                </div>
                                                <h4 className="font-bold text-sm text-white line-clamp-2 leading-snug">{titleA}</h4>
                                                <div className="flex items-center gap-1 text-[10px] text-slate-400 font-bold truncate">
                                                    <Briefcase className="w-3.5 h-3.5 text-slate-500" />
                                                    <span className="truncate">{projA}</span>
                                                </div>
                                            </div>
                                            <div className="flex gap-2 border-t border-slate-800/60 pt-3 mt-1">
                                                <button
                                                    onClick={() => { onResolveItem(itemA); onClose(); }}
                                                    className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg text-[11px] active:scale-95 transition-all"
                                                >
                                                    <Pencil className="w-3.5 h-3.5" /> Resolver
                                                </button>
                                                <button
                                                    onClick={() => { if (window.confirm('¿Eliminar este bloque?')) { onDeleteItem(itemA.id); } }}
                                                    className="p-1.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/25 hover:border-red-500/40 text-red-400 rounded-lg active:scale-95 transition-all"
                                                    title="Eliminar bloque"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        </div>

                                        {/* Block B */}
                                        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col justify-between gap-3 hover:border-slate-700 transition-colors">
                                            <div className="space-y-2">
                                                <div className="flex items-center justify-between gap-2">
                                                    <span className="text-[9px] font-black uppercase text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-md border border-indigo-500/20">Bloque 2</span>
                                                    <span className="text-[10px] font-black text-rose-400 flex items-center gap-1">
                                                        <Clock className="w-3.5 h-3.5" />
                                                        {formatBlockTime(itemB.startDateTime, itemB.endDateTime)}
                                                    </span>
                                                </div>
                                                <h4 className="font-bold text-sm text-white line-clamp-2 leading-snug">{titleB}</h4>
                                                <div className="flex items-center gap-1 text-[10px] text-slate-400 font-bold truncate">
                                                    <Briefcase className="w-3.5 h-3.5 text-slate-500" />
                                                    <span className="truncate">{projB}</span>
                                                </div>
                                            </div>
                                            <div className="flex gap-2 border-t border-slate-800/60 pt-3 mt-1">
                                                <button
                                                    onClick={() => { onResolveItem(itemB); onClose(); }}
                                                    className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg text-[11px] active:scale-95 transition-all"
                                                >
                                                    <Pencil className="w-3.5 h-3.5" /> Resolver
                                                </button>
                                                <button
                                                    onClick={() => { if (window.confirm('¿Eliminar este bloque?')) { onDeleteItem(itemB.id); } }}
                                                    className="p-1.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/25 hover:border-red-500/40 text-red-400 rounded-lg active:scale-95 transition-all"
                                                    title="Eliminar bloque"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 bg-slate-950/40 border-t border-slate-800 flex justify-end shrink-0">
                    <button
                        onClick={onClose}
                        className="px-5 py-2 border border-slate-700 hover:bg-slate-800 text-slate-300 font-bold rounded-xl active:scale-95 transition-all text-xs"
                    >
                        Cerrar
                    </button>
                </div>
            </div>
        </div>
    );
}
