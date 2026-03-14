import React, { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { X, Clock, User, Briefcase, Trash2, Save, AlertTriangle } from 'lucide-react';
import { TASK_PRIORITY_CONFIG, TASK_STATUS_CONFIG } from '../../models/schemas';

/**
 * Modal/drawer to view and edit a planner time block.
 *
 * Data source: enriched plan items via enrichPlanItemsWithTasks().
 * Uses `item.title`, `item.projectName`, `item.status`, `item.assigneeDisplayName`
 * which are resolved from live task data with snapshot fallback.
 */
export default function PlannerTaskModal({ item, task, onClose, onSave, onDelete }) {
    if (!item) return null;

    // Use enriched fields (with snapshot fallback already applied by enrichPlanItemsWithTasks)
    const displayTitle    = item.title || item.taskTitleSnapshot || '(Sin título)';
    const displayProject  = item.projectName || item.projectNameSnapshot || '';
    const displayStatus   = item.status || item.statusSnapshot || 'pending';
    const displayAssignee = item.assigneeDisplayName || item.assignedToName || '';
    const displayPriority = item.priority || 'medium';
    const isOrphan        = item._taskNotFound;

    const [startTime, setStartTime] = useState(
        item.startDateTime ? format(parseISO(item.startDateTime), "yyyy-MM-dd'T'HH:mm") : ''
    );
    const [endTime, setEndTime] = useState(
        item.endDateTime ? format(parseISO(item.endDateTime), "yyyy-MM-dd'T'HH:mm") : ''
    );
    const [notes, setNotes] = useState(item.notes || '');

    const plannedHoursCalc = () => {
        try {
            const s = new Date(startTime);
            const e = new Date(endTime);
            const diff = (e - s) / 3600000;
            return diff > 0 ? diff.toFixed(1) : '—';
        } catch { return '—'; }
    };

    const estimatedHours = task?.estimatedHours || item.estimatedHours || 0;
    const allTaskPlanned  = task?.totalPlannedHours || item.plannedHours || 0;
    const remaining       = estimatedHours - allTaskPlanned;

    const handleSave = () => {
        const s = new Date(startTime);
        const e = new Date(endTime);
        if (isNaN(s) || isNaN(e) || e <= s) {
            alert('Por favor revisa las horas de inicio y fin.');
            return;
        }
        const diffH = (e - s) / 3600000;
        onSave && onSave({
            startDateTime: s.toISOString(),
            endDateTime:   e.toISOString(),
            plannedHours:  parseFloat(diffH.toFixed(2)),
            notes,
        });
    };

    return (
        <div className="fixed inset-0 z-[600] flex items-center justify-end">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

            {/* Drawer sliding from right */}
            <aside className="relative bg-slate-900 w-full max-w-sm h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-300 overflow-y-auto">
                {/* Header */}
                <div className="p-5 border-b border-slate-800 flex justify-between items-center bg-indigo-600 text-white shrink-0">
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-indigo-200 mb-1">Detalle del Bloque</p>
                        <h2 className="font-black text-lg leading-tight">{displayTitle}</h2>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-indigo-700 rounded-xl transition-colors ml-4 shrink-0">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Orphan warning */}
                {isOrphan && (
                    <div className="mx-5 mt-4 flex items-center gap-2 bg-amber-500/15 border border-amber-500/30 text-amber-400 px-3 py-2 rounded-xl text-xs font-bold">
                        <AlertTriangle className="w-4 h-4 shrink-0" />
                        Tarea no encontrada — mostrando datos legacy del snapshot
                    </div>
                )}

                {/* Content */}
                <div className="flex-1 p-5 space-y-5">
                    {/* Meta */}
                    <div className="flex flex-wrap gap-2">
                        {displayProject && (
                            <span className="flex items-center gap-1 text-[10px] font-black bg-slate-800 text-slate-600 px-2.5 py-1 rounded-lg uppercase tracking-wider">
                                <Briefcase className="w-3 h-3" /> {displayProject}
                            </span>
                        )}
                        {displayPriority && TASK_PRIORITY_CONFIG[displayPriority] && (
                            <span className="text-[10px] font-black bg-amber-500/15 text-amber-400 border border-amber-200 px-2.5 py-1 rounded-lg uppercase tracking-wider">
                                {TASK_PRIORITY_CONFIG[displayPriority].label}
                            </span>
                        )}
                        {displayStatus && TASK_STATUS_CONFIG[displayStatus] && (
                            <span className="text-[10px] font-black bg-indigo-50 text-indigo-400 border border-indigo-100 px-2.5 py-1 rounded-lg uppercase tracking-wider">
                                {TASK_STATUS_CONFIG[displayStatus].label}
                            </span>
                        )}
                    </div>

                    {/* Assigned */}
                    {displayAssignee && (
                        <div className="flex items-center gap-2 text-sm text-slate-700 font-bold">
                            <User className="w-4 h-4 text-slate-400" />
                            {displayAssignee}
                        </div>
                    )}

                    {/* === HOURS COMPARISON === */}
                    {estimatedHours > 0 && (
                        <div className="bg-slate-800 rounded-2xl p-4 space-y-2 border border-slate-800">
                            <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2">Comparativo de Horas</p>
                            <div className="grid grid-cols-3 gap-2 text-center">
                                <div>
                                    <div className="text-xl font-black text-slate-700">{estimatedHours}h</div>
                                    <div className="text-[9px] uppercase font-black text-slate-400">Estimadas</div>
                                </div>
                                <div>
                                    <div className="text-xl font-black text-indigo-400">{allTaskPlanned}h</div>
                                    <div className="text-[9px] uppercase font-black text-slate-400">Planificadas</div>
                                </div>
                                <div>
                                    <div className={`text-xl font-black ${remaining < 0 ? 'text-red-400' : remaining === 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
                                        {remaining > 0 ? `${remaining}h` : remaining < 0 ? `+${Math.abs(remaining)}h` : '✓'}
                                    </div>
                                    <div className="text-[9px] uppercase font-black text-slate-400">
                                        {remaining < 0 ? 'Sobreplan.' : remaining === 0 ? 'Balanceado' : 'Pendiente'}
                                    </div>
                                </div>
                            </div>
                            {/* Progress strip */}
                            <div className="h-1.5 bg-slate-200 rounded-full mt-2 overflow-hidden">
                                <div
                                    className={`h-full rounded-full ${remaining < 0 ? 'bg-red-500' : remaining === 0 ? 'bg-emerald-500' : 'bg-indigo-500'}`}
                                    style={{ width: `${Math.min(100, (allTaskPlanned / estimatedHours) * 100)}%` }}
                                />
                            </div>
                        </div>
                    )}

                    {/* Time editors */}
                    <div className="space-y-3">
                        <label className="block">
                            <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider block mb-1">Inicio</span>
                            <input
                                type="datetime-local"
                                value={startTime}
                                onChange={e => setStartTime(e.target.value)}
                                className="w-full border border-slate-700 rounded-xl px-3 py-2.5 text-sm font-bold text-slate-700 focus:ring-2 focus:ring-indigo-300 outline-none"
                            />
                        </label>
                        <label className="block">
                            <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider block mb-1">Fin</span>
                            <input
                                type="datetime-local"
                                value={endTime}
                                onChange={e => setEndTime(e.target.value)}
                                className="w-full border border-slate-700 rounded-xl px-3 py-2.5 text-sm font-bold text-slate-700 focus:ring-2 focus:ring-indigo-300 outline-none"
                            />
                        </label>
                        <div className="text-right text-sm font-black text-indigo-400">
                            Duración calculada: <span className="text-indigo-400">{plannedHoursCalc()} horas</span>
                        </div>
                    </div>

                    {/* Notes */}
                    <label className="block">
                        <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider block mb-1">Notas</span>
                        <textarea
                            rows={3}
                            value={notes}
                            onChange={e => setNotes(e.target.value)}
                            placeholder="Notas adicionales sobre este bloque..."
                            className="w-full border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-slate-700 focus:ring-2 focus:ring-indigo-300 outline-none resize-none"
                        />
                    </label>
                </div>

                {/* Footer actions */}
                <div className="p-5 border-t border-slate-800 flex gap-3 shrink-0">
                    <button 
                        onClick={() => { if (window.confirm('¿Eliminar este bloque de planificación?')) onDelete && onDelete(); }}
                        className="p-3 rounded-xl border border-red-100 bg-red-500/15 text-red-400 hover:bg-red-100 transition-colors"
                    >
                        <Trash2 className="w-5 h-5" />
                    </button>
                    <button onClick={onClose} className="flex-1 border border-slate-700 text-slate-600 font-bold py-3 rounded-xl hover:bg-slate-800 transition-colors">
                        Cancelar
                    </button>
                    <button onClick={handleSave} className="flex-1 bg-indigo-600 text-white font-bold py-3 rounded-xl hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2">
                        <Save className="w-4 h-4" /> Guardar
                    </button>
                </div>
            </aside>
        </div>
    );
}
