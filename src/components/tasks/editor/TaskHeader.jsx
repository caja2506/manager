import React from 'react';
import {
    X, Trash2, ListTodo, FolderGit2, User, Flag, Menu, Wrench, Layers, MapPin
} from 'lucide-react';
import {
    TASK_STATUS_CONFIG,
    TASK_PRIORITY_CONFIG,
    formatStationLabel,
} from '../../../models/schemas';
import { hasMultipleIndexers } from '../../../services/stationService';

/**
 * TaskHeader — top zone of the task editor.
 * Shows hamburger icon, status pill, task ID, inline selects
 * (project, assignee, priority, task type), and close/delete buttons.
 */

export default function TaskHeader({
    form, setForm, isNew, task,
    projects = [], teamMembers = [], taskTypes = [], workAreas = [], stations = [],
    canEdit, canDelete,
    onClose, onDelete, onOpenListManager,
    onTaskTypeChange, onAreaChange
}) {
    const currentStatusCfg = TASK_STATUS_CONFIG[form.status] || {};
    const multiIdx = hasMultipleIndexers(stations);

    // Filter task types by selected area exactly like MainTable
    let filteredTaskTypes = taskTypes;
    if (form.areaId) {
        const selectedArea = workAreas.find(a => a.id === form.areaId);
        if (selectedArea) {
            const allowedValues = selectedArea.taskTypeIds || selectedArea.defaultTaskTypes || [];
            if (allowedValues.length > 0) {
                filteredTaskTypes = taskTypes.filter(t => allowedValues.includes(t.id) || allowedValues.includes(t.name));
            }
        }
    }

    // Map config hex colors to Tailwind safe classes
    const STATUS_PILL_COLORS = {
        '#64748b': { bg: 'bg-slate-500', dot: 'bg-slate-400' },
        '#ef4444': { bg: 'bg-red-500', dot: 'bg-red-400' },
        '#f59e0b': { bg: 'bg-amber-500', dot: 'bg-amber-400' },
        '#8b5cf6': { bg: 'bg-purple-500', dot: 'bg-purple-400' },
        '#22c55e': { bg: 'bg-emerald-500', dot: 'bg-emerald-400' },
        '#6b7280': { bg: 'bg-gray-500', dot: 'bg-gray-400' },
    };
    const pillColor = STATUS_PILL_COLORS[currentStatusCfg.color] || STATUS_PILL_COLORS['#64748b'];

    return (
        <div className="p-3 md:p-4 lg:p-5 border-b border-slate-800 flex-shrink-0 space-y-2.5 md:space-y-3">
            {/* Row 1: Menu icon + Status pill + Task ID + Actions */}
            <div className="flex items-center gap-3">
                <button className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-700 rounded-lg transition-all flex-shrink-0">
                    <Menu className="w-5 h-5" />
                </button>

                <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center flex-shrink-0">
                    <ListTodo className="w-4 h-4 text-indigo-400" />
                </div>

                {!isNew && (
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black ${pillColor.bg} text-white`}>
                        <span className={`w-1.5 h-1.5 rounded-full bg-white/60`} />
                        {currentStatusCfg.label}
                    </span>
                )}

                {!isNew && (
                    <span className="text-[10px] font-mono text-slate-500 tracking-wide hidden sm:inline">
                        {task.id.slice(0, 10)}
                    </span>
                )}

                <div className="flex-1" />

                <div className="flex items-center gap-1 flex-shrink-0">
                    {!isNew && canDelete && (
                        <button
                            onClick={onDelete}
                            className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
                            title="Eliminar tarea"
                        >
                            <Trash2 className="w-4 h-4" />
                        </button>
                    )}
                    <button
                        onClick={onClose}
                        className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-700 rounded-lg transition-all"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>
            </div>

            {/* Row 2: Compact inline selects */}
            <div className="grid grid-cols-2 md:flex md:flex-wrap gap-2">
                {/* Proyecto */}
                <div className="flex items-center gap-1.5 bg-slate-800 rounded-lg px-2.5 py-1.5 border border-slate-700 hover:border-slate-600 transition-colors min-w-0">
                    <FolderGit2 className="w-3 h-3 text-slate-400 flex-shrink-0" />
                    <select
                        value={form.projectId}
                        onChange={e => setForm({ ...form, projectId: e.target.value, stationId: '' })}
                        className="bg-slate-800 text-xs font-bold text-slate-200 outline-none cursor-pointer min-w-0"
                        disabled={!canEdit}
                    >
                        <option value="">Sin proyecto</option>
                        {projects.map(p => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                    </select>
                </div>

                {/* Estación (Station) — only shows when project is selected and has stations */}
                {form.projectId && stations.length > 0 && (
                    <div className="flex items-center gap-1.5 bg-slate-800 rounded-lg px-2.5 py-1.5 border border-cyan-500/20 hover:border-cyan-500/40 transition-colors min-w-0">
                        <MapPin className="w-3 h-3 text-cyan-400 shrink-0" />
                        <select
                            value={form.stationId || ''}
                            onChange={e => setForm({ ...form, stationId: e.target.value || null })}
                            className="bg-slate-800 text-xs font-bold text-cyan-300 outline-none cursor-pointer min-w-0"
                            disabled={!canEdit}
                        >
                            <option value="">Estación</option>
                            {stations.filter(s => s.active !== false).map(s => (
                                <option key={s.id} value={s.id}>
                                    {s.abbreviation
                                        ? `${formatStationLabel(s, multiIdx)} — ${s.abbreviation}`
                                        : formatStationLabel(s, multiIdx)}
                                </option>
                            ))}
                        </select>
                    </div>
                )}

                {/* Responsable */}
                <div className="flex items-center gap-1.5 bg-slate-800 rounded-lg px-2.5 py-1.5 border border-slate-700 hover:border-slate-600 transition-colors min-w-0">
                    <User className="w-3 h-3 text-slate-400 flex-shrink-0" />
                    <select
                        value={form.assignedTo}
                        onChange={e => setForm({ ...form, assignedTo: e.target.value })}
                        className="bg-slate-800 text-xs font-bold text-slate-200 outline-none cursor-pointer min-w-0"
                        disabled={!canEdit}
                    >
                        <option value="">Sin asignar</option>
                        {teamMembers.map(u => (
                            <option key={u.uid} value={u.uid}>{u.displayName || u.email}</option>
                        ))}
                    </select>
                </div>

                {/* Prioridad */}
                <div className="flex items-center gap-1.5 bg-slate-800 rounded-lg px-2.5 py-1.5 border border-slate-700 hover:border-slate-600 transition-colors min-w-0">
                    <Flag className="w-3 h-3 text-slate-400 flex-shrink-0" />
                    <select
                        value={form.priority}
                        onChange={e => setForm({ ...form, priority: e.target.value })}
                        className="bg-slate-800 text-xs font-bold text-slate-200 outline-none cursor-pointer min-w-0"
                        disabled={!canEdit}
                    >
                        {Object.entries(TASK_PRIORITY_CONFIG).map(([key, cfg]) => (
                            <option key={key} value={key}>{cfg.label}</option>
                        ))}
                    </select>
                </div>

                {/* Área */}
                <div className="flex items-center gap-1.5 bg-slate-800 rounded-lg px-2.5 py-1.5 border border-slate-700 hover:border-slate-600 transition-colors min-w-0">
                    <Layers className="w-3 h-3 text-slate-400 flex-shrink-0" />
                    <select
                        value={form.areaId || ''}
                        onChange={e => onAreaChange ? onAreaChange(e.target.value) : setForm({ ...form, areaId: e.target.value })}
                        className="bg-slate-800 text-xs font-bold text-slate-200 outline-none cursor-pointer min-w-0"
                        disabled={!canEdit}
                    >
                        <option value="">Área</option>
                        {workAreas.map(a => (
                            <option key={a.id} value={a.id}>{a.name}</option>
                        ))}
                    </select>
                    {canEdit && onOpenListManager && (
                        <button
                            type="button"
                            onClick={() => onOpenListManager({ isOpen: true, type: 'workAreaType', title: 'Gestionar Áreas' })}
                            className="text-[8px] font-bold text-indigo-500 hover:text-indigo-400 transition-colors whitespace-nowrap ml-0.5"
                        >
                            ⚙
                        </button>
                    )}
                </div>

                {/* Tipo de tarea */}
                <div className="flex items-center gap-1.5 bg-slate-800 rounded-lg px-2.5 py-1.5 border border-slate-700 hover:border-slate-600 transition-colors min-w-0">
                    <Wrench className="w-3 h-3 text-slate-400 flex-shrink-0" />
                    <select
                        value={form.taskTypeId}
                        onChange={e => onTaskTypeChange ? onTaskTypeChange(e.target.value) : setForm({ ...form, taskTypeId: e.target.value })}
                        className="bg-slate-800 text-xs font-bold text-slate-200 outline-none cursor-pointer min-w-0"
                        disabled={!canEdit}
                    >
                        <option value="">Clasificación</option>
                        {filteredTaskTypes.map(t => (
                            <option key={t.id} value={t.id}>{t.name}</option>
                        ))}
                    </select>
                    {canEdit && onOpenListManager && (
                        <button
                            type="button"
                            onClick={() => onOpenListManager({ isOpen: true, type: 'taskType', title: 'Gestionar Tipos de Tarea' })}
                            className="text-[8px] font-bold text-indigo-500 hover:text-indigo-400 transition-colors whitespace-nowrap ml-0.5"
                        >
                            ⚙
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
