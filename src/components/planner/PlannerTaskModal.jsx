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
const COLOR_CLASSES = {
    indigo: { bg: 'bg-indigo-600', text: 'text-indigo-200', border: 'border-indigo-500' },
    violet: { bg: 'bg-violet-600', text: 'text-violet-200', border: 'border-violet-500' },
    emerald: { bg: 'bg-emerald-600', text: 'text-emerald-200', border: 'border-emerald-500' },
    amber: { bg: 'bg-amber-600', text: 'text-amber-200', border: 'border-amber-500' },
    rose: { bg: 'bg-rose-600', text: 'text-rose-200', border: 'border-rose-500' },
    cyan: { bg: 'bg-cyan-600', text: 'text-cyan-200', border: 'border-cyan-500' },
    teal: { bg: 'bg-teal-600', text: 'text-teal-200', border: 'border-teal-500' },
};

export default function PlannerTaskModal({
    item,
    task,
    projects = [],
    teamMembers = [],
    onClose,
    onSave,
    onDelete,
    onOpenTaskDetail
}) {
    if (!item) return null;

    // Use enriched fields (with snapshot fallback already applied by enrichPlanItemsWithTasks)
    const isOrphan        = item._taskNotFound;

    const [startTime, setStartTime] = useState(
        item.startDateTime ? format(parseISO(item.startDateTime), "yyyy-MM-dd'T'HH:mm") : ''
    );
    const [endTime, setEndTime] = useState(
        item.endDateTime ? format(parseISO(item.endDateTime), "yyyy-MM-dd'T'HH:mm") : ''
    );
    const [notes, setNotes] = useState(item.notes || '');

    // Form fields for free planning block (when taskId is null)
    const [tempTitle, setTempTitle] = useState(item.taskTitleSnapshot || item.title || '');
    const [tempProjectId, setTempProjectId] = useState(item.projectId || '');
    const [tempAssignedTo, setTempAssignedTo] = useState(item.assignedTo || '');
    const [tempColorKey, setTempColorKey] = useState(item.colorKey || 'indigo');

    const displayTitle    = item.taskId ? (item.title || item.taskTitleSnapshot || '(Sin título)') : (tempTitle || 'Planificación libre');
    const displayProject  = item.taskId ? (item.projectName || item.projectNameSnapshot || '') : (projects.find(p => p.id === tempProjectId)?.name || '');
    const displayStatus   = item.status || item.statusSnapshot || 'planned';
    const displayAssignee = item.taskId ? (item.assigneeDisplayName || item.assignedToName || '') : (teamMembers.find(m => m.uid === tempAssignedTo)?.displayName || '');
    const displayPriority = item.priority || 'medium';

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

        const extraUpdates = {};
        if (!item.taskId) {
            extraUpdates.taskTitleSnapshot = tempTitle || 'Planificación libre';
            extraUpdates.projectId = tempProjectId || null;
            extraUpdates.projectNameSnapshot = tempProjectId ? (projects.find(p => p.id === tempProjectId)?.name || '') : '';
            extraUpdates.assignedTo = tempAssignedTo || null;
            extraUpdates.assignedToName = tempAssignedTo ? (teamMembers.find(m => m.uid === tempAssignedTo)?.displayName || '') : '';
            extraUpdates.colorKey = tempColorKey;
            extraUpdates.date = startTime.split('T')[0];
        }

        onSave && onSave({
            startDateTime: s.toISOString(),
            endDateTime:   e.toISOString(),
            plannedHours:  parseFloat(diffH.toFixed(2)),
            notes,
            ...extraUpdates
        });
    };

    const colorClasses = COLOR_CLASSES[tempColorKey] || COLOR_CLASSES.indigo;

    return (
        <div className="fixed inset-0 z-[600] flex items-center justify-end">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

            {/* Drawer sliding from right */}
            <aside className="relative bg-slate-900 w-full max-w-sm h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-300 overflow-y-auto text-slate-200">
                {/* Header */}
                <div className={`p-5 border-b border-slate-800 flex justify-between items-center ${colorClasses.bg} text-white shrink-0`}>
                    <div className="min-w-0 flex-1">
                        <p className="text-[10px] font-black uppercase tracking-widest opacity-80 mb-1">
                            {item.taskId ? 'Detalle del Bloque' : 'Planificación Libre'}
                        </p>
                        <h2 className="font-black text-lg leading-tight truncate">{displayTitle}</h2>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-black/10 rounded-xl transition-colors ml-4 shrink-0">
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
                    {/* Dynamic metadata / fields */}
                    {!item.taskId ? (
                        /* Manual/Free block fields */
                        <div className="space-y-4 bg-slate-800/40 p-4 rounded-2xl border border-slate-800/80">
                            <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">Editar Información del Bloque</p>
                            
                            <label className="block">
                                <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider block mb-1">Título</span>
                                <input
                                    type="text"
                                    value={tempTitle}
                                    onChange={e => setTempTitle(e.target.value)}
                                    placeholder="Ej. Reunión de diseño, revisión de planos..."
                                    className="w-full border border-slate-700 bg-slate-950 rounded-xl px-3 py-2 text-sm font-bold text-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none"
                                />
                            </label>

                            <label className="block">
                                <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider block mb-1">Proyecto</span>
                                <select
                                    value={tempProjectId}
                                    onChange={e => setTempProjectId(e.target.value)}
                                    className="w-full border border-slate-700 bg-slate-950 rounded-xl px-3 py-2 text-sm font-bold text-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none cursor-pointer"
                                >
                                    <option value="">Sin Proyecto</option>
                                    {projects.map(p => (
                                        <option key={p.id} value={p.id}>{p.name}</option>
                                    ))}
                                </select>
                            </label>

                            <label className="block">
                                <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider block mb-1">Asignado a</span>
                                <select
                                    value={tempAssignedTo}
                                    onChange={e => setTempAssignedTo(e.target.value)}
                                    className="w-full border border-slate-700 bg-slate-950 rounded-xl px-3 py-2 text-sm font-bold text-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none cursor-pointer"
                                >
                                    <option value="">Sin Asignar</option>
                                    {teamMembers.map(m => (
                                        <option key={m.uid} value={m.uid}>{m.displayName || m.email}</option>
                                    ))}
                                </select>
                            </label>

                            <div>
                                <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider block mb-2">Color</span>
                                <div className="flex gap-2 flex-wrap">
                                    {Object.keys(COLOR_CLASSES).map(color => (
                                        <button
                                            key={color}
                                            type="button"
                                            onClick={() => setTempColorKey(color)}
                                            className={`w-6 h-6 rounded-full transition-transform ${COLOR_CLASSES[color].bg} ${
                                                tempColorKey === color ? 'ring-2 ring-white scale-110' : 'hover:scale-105'
                                            }`}
                                            title={color}
                                        />
                                    ))}
                                </div>
                            </div>
                        </div>
                    ) : (
                        /* Task-bound metadata */
                        <div className="space-y-4">
                            <div className="flex flex-wrap gap-2">
                                {displayProject && (
                                    <span className="flex items-center gap-1 text-[10px] font-black bg-slate-800 text-slate-400 px-2.5 py-1 rounded-lg uppercase tracking-wider">
                                        <Briefcase className="w-3 h-3" /> {displayProject}
                                    </span>
                                )}
                                {displayPriority && TASK_PRIORITY_CONFIG[displayPriority] && (
                                    <span className="text-[10px] font-black bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2.5 py-1 rounded-lg uppercase tracking-wider">
                                        {TASK_PRIORITY_CONFIG[displayPriority].label}
                                    </span>
                                )}
                                {displayStatus && TASK_STATUS_CONFIG[displayStatus] && (
                                    <span className="text-[10px] font-black bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-2.5 py-1 rounded-lg uppercase tracking-wider">
                                        {TASK_STATUS_CONFIG[displayStatus].label}
                                    </span>
                                )}
                            </div>

                            {displayAssignee && (
                                <div className="flex items-center gap-2 text-sm text-slate-300 font-bold">
                                    <User className="w-4 h-4 text-slate-400" />
                                    {displayAssignee}
                                </div>
                            )}

                            {onOpenTaskDetail && (
                                <button
                                    onClick={onOpenTaskDetail}
                                    className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2 px-4 rounded-xl active:scale-95 transition-all text-xs"
                                >
                                    <Briefcase className="w-4 h-4" /> Ver Detalles de la Tarea
                                </button>
                            )}

                            {/* === HOURS COMPARISON === */}
                            {estimatedHours > 0 && (
                                <div className="bg-slate-800/60 rounded-2xl p-4 space-y-2 border border-slate-800">
                                    <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2">Comparativo de Horas</p>
                                    <div className="grid grid-cols-3 gap-2 text-center">
                                        <div>
                                            <div className="text-xl font-black text-slate-300">{estimatedHours}h</div>
                                            <div className="text-[9px] uppercase font-black text-slate-500">Estimadas</div>
                                        </div>
                                        <div>
                                            <div className="text-xl font-black text-indigo-400">{allTaskPlanned}h</div>
                                            <div className="text-[9px] uppercase font-black text-slate-500">Planificadas</div>
                                        </div>
                                        <div>
                                            <div className={`text-xl font-black ${remaining < 0 ? 'text-red-400' : remaining === 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
                                                {remaining > 0 ? `${remaining}h` : remaining < 0 ? `+${Math.abs(remaining)}h` : '✓'}
                                            </div>
                                            <div className="text-[9px] uppercase font-black text-slate-500">
                                                {remaining < 0 ? 'Sobreplan.' : remaining === 0 ? 'Balanceado' : 'Pendiente'}
                                            </div>
                                        </div>
                                    </div>
                                    {/* Progress strip */}
                                    <div className="h-1.5 bg-slate-700 rounded-full mt-2 overflow-hidden">
                                        <div
                                            className={`h-full rounded-full ${remaining < 0 ? 'bg-red-500' : remaining === 0 ? 'bg-emerald-500' : 'bg-indigo-500'}`}
                                            style={{ width: `${Math.min(100, (allTaskPlanned / estimatedHours) * 100)}%` }}
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Time editors */}
                    <div className="space-y-3 bg-slate-800/30 p-4 rounded-2xl border border-slate-800/50">
                        <label className="block">
                            <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider block mb-1">Inicio</span>
                            <input
                                type="datetime-local"
                                value={startTime}
                                onChange={e => setStartTime(e.target.value)}
                                className="w-full border border-slate-700 bg-slate-950 rounded-xl px-3 py-2 text-sm font-bold text-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none"
                            />
                        </label>
                        <label className="block">
                            <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider block mb-1">Fin</span>
                            <input
                                type="datetime-local"
                                value={endTime}
                                onChange={e => setEndTime(e.target.value)}
                                className="w-full border border-slate-700 bg-slate-950 rounded-xl px-3 py-2 text-sm font-bold text-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none"
                            />
                        </label>
                        <div className="text-right text-xs font-black text-slate-400">
                            Duración calculada: <span className="text-indigo-400">{plannedHoursCalc()} horas</span>
                        </div>
                    </div>

                    {/* Notes */}
                    <label className="block bg-slate-800/30 p-4 rounded-2xl border border-slate-800/50">
                        <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider block mb-1">Notas del Bloque</span>
                        <textarea
                            rows={3}
                            value={notes}
                            onChange={e => setNotes(e.target.value)}
                            placeholder="Notas o comentarios sobre este bloque de tiempo..."
                            className="w-full border border-slate-700 bg-slate-950 rounded-xl px-3 py-2 text-sm text-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
                        />
                    </label>
                </div>

                {/* Footer actions */}
                <div className="p-5 border-t border-slate-800 flex gap-3 shrink-0 bg-slate-950/20">
                    <button 
                        onClick={() => { if (window.confirm('¿Eliminar este bloque de planificación?')) onDelete && onDelete(); }}
                        className="p-3 rounded-xl border border-red-900 bg-red-500/10 text-red-400 hover:bg-red-500/20 active:scale-95 transition-all"
                        title="Eliminar bloque"
                    >
                        <Trash2 className="w-5 h-5" />
                    </button>
                    <button onClick={onClose} className="flex-1 border border-slate-700 text-slate-300 font-bold py-3 rounded-xl hover:bg-slate-850 active:scale-95 transition-all text-sm">
                        Cancelar
                    </button>
                    <button onClick={handleSave} className="flex-1 bg-indigo-600 text-white font-bold py-3 rounded-xl hover:bg-indigo-550 active:scale-95 transition-all flex items-center justify-center gap-2 text-sm">
                        <Save className="w-4 h-4" /> Guardar
                    </button>
                </div>
            </aside>
        </div>
    );
}

