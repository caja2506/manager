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
import TaskStatusStepper from './TaskStatusStepper';
import TaskHealthScore from './TaskHealthScore';
import SearchableInlineSelect from '../../ui/SearchableInlineSelect';
import { registerOrphanUser } from '../../../services/userAdminService';

/**
 * TaskHeader — top zone of the task editor.
 * Shows hamburger icon, status pill, task ID, inline selects
 * (project, assignee, priority, task type), and close/delete buttons.
 * 
 * MOBILE: Compact spacing, larger touch targets for selects.
 */

export default function TaskHeader({
    form, setForm, isNew, task,
    projects = [], teamMembers = [], taskTypes = [], workAreas = [], stations = [],
    canEdit, canDelete, subtaskCount,
    onClose, onDelete, onOpenListManager,
    onTaskTypeChange, onAreaChange, onStatusChange
}) {
    const currentStatusCfg = TASK_STATUS_CONFIG[form.status] || {};
    const multiIdx = hasMultipleIndexers(stations);

    const handleCreateExternal = async (name) => {
        const normalized = name.toLowerCase().replace(/[^a-z0-9]+/g, '_').trim();
        const customId = `ext_${normalized}_${Date.now()}`;
        try {
            await registerOrphanUser(customId, {
                displayName: name,
                email: `${normalized}@external.com`,
            }, 'viewer');
            setForm(f => ({ ...f, assignedTo: customId }));
        } catch (err) {
            console.error('Error creating external assignee:', err);
            alert('Error al agregar el responsable externo: ' + err.message);
        }
    };

    // Filter task types by selected area exactly like MainTable
    let filteredTaskTypes = taskTypes;
    if (form.areaId) {
        const selectedArea = workAreas.find(a => a.id === form.areaId);
        if (selectedArea) {
            const allowedValues = (selectedArea.taskTypeIds && selectedArea.taskTypeIds.length > 0)
                ? selectedArea.taskTypeIds
                : (selectedArea.defaultTaskTypes || []);

            console.log('[TaskHeader] Diagnóstico de Filtrado:', {
                areaId: form.areaId,
                areaName: selectedArea.name,
                allowedValuesLength: allowedValues.length,
                allowedValues,
                taskTypesLength: taskTypes.length,
            });

            if (allowedValues.length > 0) {
                filteredTaskTypes = taskTypes.filter(t => 
                    allowedValues.includes(t.id) || 
                    allowedValues.includes(t.name) || 
                    (t.firestoreId && allowedValues.includes(t.firestoreId)) ||
                    allowedValues.some(val => 
                        (t.name && val?.toString().toLowerCase() === t.name.toLowerCase()) ||
                        (t.firestoreId && val?.toString().toLowerCase() === t.firestoreId.toLowerCase())
                    )
                );
            }
            console.log('[TaskHeader] Diagnóstico - filteredTaskTypes:', filteredTaskTypes.map(t => ({ id: t.id, name: t.name })));
        } else {
            console.warn('[TaskHeader] No se encontró el área seleccionada en la lista global para ID:', form.areaId);
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
        <div className="p-3 lg:py-5 lg:px-8 border-b border-slate-800 flex-shrink-0 space-y-2 lg:space-y-4">
            {/* Row 1: Task ID + Title + Actions */}
            <div className="flex items-center gap-2 lg:gap-3">

                {!isNew && (
                    <span className="text-[10px] font-mono font-bold bg-slate-800 text-white px-2 py-1 rounded-md tracking-wider hidden sm:inline">
                        #{task.id.slice(0, 8)}
                    </span>
                )}

                <textarea
                    value={form.title}
                    onChange={e => setForm({ ...form, title: e.target.value })}
                    placeholder="Título de la tarea..."
                    className="flex-1 min-w-0 text-lg lg:text-xl font-black tracking-tight outline-none bg-transparent text-white placeholder-slate-600 border-b border-transparent focus:border-slate-600 transition-colors py-1 resize-none h-auto overflow-hidden"
                    rows={1}
                    disabled={!canEdit}
                    autoFocus={isNew}
                    ref={(el) => {
                        if (el) {
                            el.style.height = 'auto';
                            el.style.height = el.scrollHeight + 'px';
                        }
                    }}
                    onInput={(e) => {
                        e.target.style.height = 'auto';
                        e.target.style.height = e.target.scrollHeight + 'px';
                    }}
                />

                <div className="flex items-center gap-1 flex-shrink-0">
                    {!isNew && canDelete && (
                        <button
                            onClick={onDelete}
                            className="p-2 lg:p-1.5 text-white hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
                            title="Eliminar tarea"
                        >
                            <Trash2 className="w-4 h-4" />
                        </button>
                    )}
                    <button
                        onClick={onClose}
                        className="p-2 lg:p-1.5 text-white hover:text-slate-200 hover:bg-slate-700 rounded-lg transition-all"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>
            </div>

            {/* Row 2: Compact inline selects — Desktop only (moved to scroll on mobile) */}
            <div className="hidden lg:flex flex-wrap gap-1.5 lg:gap-2 pb-1 -mx-1 px-1">
                {/* Proyecto */}
                <SearchableInlineSelect
                    icon={<FolderGit2 className="w-3 h-3 text-white shrink-0" />}
                    options={projects.map(p => ({ value: p.id, label: p.name }))}
                    value={form.projectId}
                    onChange={val => setForm({ ...form, projectId: val, stationId: '' })}
                    placeholder="Sin proyecto"
                    disabled={!canEdit}
                />

                {/* Estación (Station) — only shows when project is selected and has stations */}
                {form.projectId && stations.length > 0 && (
                    <SearchableInlineSelect
                        icon={<MapPin className="w-3 h-3 text-white shrink-0" />}
                        options={stations.filter(s => s.active !== false).map(s => ({
                            value: s.id,
                            label: s.description || s.abbreviation
                                ? `${formatStationLabel(s, multiIdx)} — ${s.description || s.abbreviation}`
                                : formatStationLabel(s, multiIdx)
                        }))}
                        value={form.stationId || ''}
                        onChange={val => setForm({ ...form, stationId: val || null })}
                        placeholder="Estación"
                        disabled={!canEdit}
                    />
                )}

                {/* Responsable */}
                <SearchableInlineSelect
                    icon={<User className="w-3 h-3 text-white shrink-0" />}
                    options={teamMembers.map(u => ({ value: u.uid, label: u.displayName || u.email }))}
                    value={form.assignedTo}
                    onChange={val => setForm({ ...form, assignedTo: val })}
                    placeholder="Sin asignar"
                    disabled={!canEdit}
                    allowAddExternal={canEdit}
                    onAddExternal={handleCreateExternal}
                />

                {/* Prioridad */}
                <SearchableInlineSelect
                    icon={<Flag className="w-3 h-3 text-white shrink-0" />}
                    options={Object.entries(TASK_PRIORITY_CONFIG).map(([key, cfg]) => ({ value: key, label: cfg.label }))}
                    value={form.priority}
                    onChange={val => setForm({ ...form, priority: val })}
                    placeholder="Prioridad"
                    disabled={!canEdit}
                    alignRight={true}
                />

                {/* Área */}
                <div className="flex items-center gap-1 flex-shrink-0 min-w-0">
                    <SearchableInlineSelect
                        icon={<Layers className="w-3 h-3 text-white shrink-0" />}
                        options={workAreas.map(a => ({ value: a.id, label: a.name }))}
                        value={form.areaId || ''}
                        onChange={val => onAreaChange ? onAreaChange(val) : setForm({ ...form, areaId: val })}
                        placeholder="Área"
                        disabled={!canEdit}
                    />
                    {canEdit && onOpenListManager && (
                        <button
                            type="button"
                            onClick={() => onOpenListManager({ isOpen: true, type: 'workAreaType', title: 'Gestionar Áreas' })}
                            className="w-8 h-8 flex items-center justify-center rounded-lg bg-slate-800 border border-slate-700 hover:border-slate-600 hover:text-indigo-400 text-indigo-500 transition-colors cursor-pointer text-xs shrink-0"
                            title="Gestionar Áreas"
                        >
                            ⚙
                        </button>
                    )}
                </div>

                {/* Tipo de tarea */}
                <div className="flex items-center gap-1 flex-shrink-0 min-w-0">
                    <SearchableInlineSelect
                        icon={<Wrench className="w-3 h-3 text-white shrink-0" />}
                        options={filteredTaskTypes.map(t => ({ value: t.id, label: t.name }))}
                        value={form.taskTypeId}
                        onChange={val => onTaskTypeChange ? onTaskTypeChange(val) : setForm({ ...form, taskTypeId: val })}
                        placeholder="Clasificación"
                        disabled={!canEdit}
                        alignRight={true}
                    />
                    {canEdit && onOpenListManager && (
                        <button
                            type="button"
                            onClick={() => onOpenListManager({ isOpen: true, type: 'taskType', title: 'Gestionar Tipos de Tarea' })}
                            className="w-8 h-8 flex items-center justify-center rounded-lg bg-slate-800 border border-slate-700 hover:border-slate-600 hover:text-indigo-400 text-indigo-500 transition-colors cursor-pointer text-xs shrink-0"
                            title="Gestionar Tipos de Tarea"
                        >
                            ⚙
                        </button>
                    )}
                </div>

            </div>
        </div>
    );
}
