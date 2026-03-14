/**
 * GanttTaskEditDrawer
 * ===================
 * Slide-in panel for quick editing of Gantt fields on a selected task.
 * Fields: plannedStartDate, plannedEndDate, percentComplete, showInGantt
 */

import React, { useState, useEffect } from 'react';
import { X, Calendar, CheckCircle2, BarChart2, Eye } from 'lucide-react';
import { updateTaskGanttFields } from '../../services/ganttService';

export default function GanttTaskEditDrawer({ task, onClose, onSaved }) {
    const [form, setForm] = useState({
        plannedStartDate: '',
        plannedEndDate: '',
        percentComplete: 0,
        showInGantt: false,
    });
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!task) return;
        const toDate = (iso) => {
            if (!iso) return '';
            return iso.substring(0, 10);
        };
        setForm({
            plannedStartDate: toDate(task.plannedStartDate),
            plannedEndDate: toDate(task.plannedEndDate),
            percentComplete: task.percentComplete ?? 0,
            showInGantt: task.showInGantt ?? false,
        });
        setError(null);
    }, [task]);

    if (!task) return null;

    const handleSave = async () => {
        if (!form.plannedStartDate) {
            setError('La fecha de inicio es requerida.');
            return;
        }
        setSaving(true);
        setError(null);
        try {
            const iso = (dateStr) => dateStr ? new Date(dateStr + 'T00:00:00').toISOString() : null;
            await updateTaskGanttFields(task.id, {
                plannedStartDate: iso(form.plannedStartDate),
                plannedEndDate: iso(form.plannedEndDate),
                percentComplete: Number(form.percentComplete),
                showInGantt: form.showInGantt,
            });
            onSaved?.({ ...task, ...form });
            onClose();
        } catch (e) {
            setError(e.message || 'Error al guardar.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex justify-end pointer-events-none">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/40 pointer-events-auto"
                onClick={onClose}
            />
            {/* Drawer */}
            <div className="relative w-full max-w-sm bg-slate-900 border-l border-slate-700 h-full flex flex-col shadow-2xl pointer-events-auto animate-in slide-in-from-right duration-300">
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700">
                    <div>
                        <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">Editar Gantt</p>
                        <h3 className="text-sm font-bold text-white truncate max-w-[240px]">{task.title}</h3>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition-all">
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">

                    {/* Show in Gantt toggle */}
                    <div className="flex items-center justify-between bg-slate-800 rounded-xl p-3">
                        <div className="flex items-center gap-2">
                            <Eye className="w-4 h-4 text-indigo-400" />
                            <span className="text-sm font-semibold text-slate-200">Mostrar en Gantt</span>
                        </div>
                        <button
                            onClick={() => setForm(f => ({ ...f, showInGantt: !f.showInGantt }))}
                            className={`relative w-11 h-6 rounded-full transition-colors duration-200 ${form.showInGantt ? 'bg-indigo-600' : 'bg-slate-600'}`}
                        >
                            <span
                                className={`absolute top-0.5 w-5 h-5 bg-slate-900 rounded-full shadow transition-transform duration-200 ${form.showInGantt ? 'translate-x-5' : 'translate-x-0.5'}`}
                            />
                        </button>
                    </div>

                    {/* Planned Start Date */}
                    <div className="space-y-1.5">
                        <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                            <Calendar className="w-3.5 h-3.5" />
                            Fecha inicio planificada
                        </label>
                        <input
                            type="date"
                            value={form.plannedStartDate}
                            onChange={e => setForm(f => ({ ...f, plannedStartDate: e.target.value }))}
                            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                    </div>

                    {/* Planned End Date */}
                    <div className="space-y-1.5">
                        <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                            <Calendar className="w-3.5 h-3.5" />
                            Fecha fin planificada
                        </label>
                        <input
                            type="date"
                            value={form.plannedEndDate}
                            onChange={e => setForm(f => ({ ...f, plannedEndDate: e.target.value }))}
                            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                    </div>

                    {/* Percent Complete */}
                    <div className="space-y-2">
                        <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                            <BarChart2 className="w-3.5 h-3.5" />
                            % Avance
                            <span className="ml-auto text-indigo-400 font-bold text-sm normal-case">{form.percentComplete}%</span>
                        </label>
                        <input
                            type="range"
                            min={0}
                            max={100}
                            step={5}
                            value={form.percentComplete}
                            onChange={e => setForm(f => ({ ...f, percentComplete: Number(e.target.value) }))}
                            className="w-full accent-indigo-500"
                        />
                        <div className="w-full bg-slate-700 rounded-full h-2">
                            <div
                                className="bg-indigo-500 h-2 rounded-full transition-all duration-300"
                                style={{ width: `${form.percentComplete}%` }}
                            />
                        </div>
                    </div>

                    {/* Summary Info */}
                    <div className="bg-slate-800/60 rounded-xl p-3 space-y-1.5">
                        <p className="text-xs text-slate-500 font-medium">Estado actual</p>
                        <p className="text-xs text-slate-300 capitalize">{task.status?.replace('_', ' ')}</p>
                        <p className="text-xs text-slate-500 font-medium mt-2">Horas estimadas</p>
                        <p className="text-xs text-slate-300">{task.estimatedHours || 0} hrs</p>
                    </div>

                    {error && (
                        <div className="bg-red-900/40 border border-red-700 rounded-lg px-3 py-2 text-xs text-red-300">
                            {error}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-5 py-4 border-t border-slate-700 flex gap-3">
                    <button
                        onClick={onClose}
                        className="flex-1 px-4 py-2 rounded-xl border border-slate-600 text-slate-400 text-sm font-semibold hover:bg-slate-800 transition-all"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="flex-1 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-bold transition-all flex items-center justify-center gap-2"
                    >
                        {saving ? (
                            <span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                        ) : (
                            <CheckCircle2 className="w-4 h-4" />
                        )}
                        Guardar
                    </button>
                </div>
            </div>
        </div>
    );
}
