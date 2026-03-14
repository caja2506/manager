import React, { useState } from 'react';
import { X, Save, Clock, Zap, ListTodo, FolderGit2, FileText } from 'lucide-react';
import { createManualTimeLog } from '../../services/timeService';

export default function ManualTimeEntry({
    isOpen, onClose, tasks, projects, userId
}) {
    const [form, setForm] = useState({
        taskId: '',
        projectId: '',
        date: new Date().toISOString().split('T')[0],
        startHour: '09:00',
        endHour: '10:00',
        notes: '',
        overtime: false,
    });
    const [isSaving, setIsSaving] = useState(false);

    if (!isOpen) return null;

    const handleSave = async () => {
        if (!form.date || !form.startHour || !form.endHour) return;
        setIsSaving(true);
        try {
            const startTime = `${form.date}T${form.startHour}:00`;
            const endTime = `${form.date}T${form.endHour}:00`;
            await createManualTimeLog({
                taskId: form.taskId || null,
                projectId: form.projectId || null,
                userId,
                startTime,
                endTime,
                notes: form.notes,
                overtime: form.overtime,
            });
            onClose();
            setForm({
                taskId: '', projectId: '',
                date: new Date().toISOString().split('T')[0],
                startHour: '09:00', endHour: '10:00', notes: '', overtime: false,
            });
        } catch (err) {
            console.error('Error creating time log:', err);
        }
        setIsSaving(false);
    };

    // Calculate preview hours
    const previewHours = (() => {
        try {
            const s = new Date(`${form.date}T${form.startHour}:00`);
            const e = new Date(`${form.date}T${form.endHour}:00`);
            const h = (e - s) / 3600000;
            return h > 0 ? h.toFixed(1) : '0';
        } catch { return '0'; }
    })();

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[300] flex items-center justify-center p-4">
            <div className="bg-slate-900 rounded-2xl shadow-2xl border border-slate-800 w-full max-w-md animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-slate-800">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-green-100 rounded-2xl flex items-center justify-center">
                            <Clock className="w-5 h-5 text-green-400" />
                        </div>
                        <h2 className="font-black text-lg tracking-tight">Registro Manual</h2>
                    </div>
                    <button onClick={onClose} className="p-2 text-slate-400 hover:bg-slate-800 rounded-xl">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-6 space-y-4">
                    {/* Task selector */}
                    <div>
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1 block">
                            <ListTodo className="w-3 h-3 inline mr-1" />Tarea
                        </span>
                        <select
                            value={form.taskId}
                            onChange={e => {
                                setForm({ ...form, taskId: e.target.value });
                                const t = tasks.find(t => t.id === e.target.value);
                                if (t?.projectId) setForm(f => ({ ...f, projectId: t.projectId }));
                            }}
                            className="w-full px-3 py-2.5 border border-slate-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-800"
                        >
                            <option value="">Sin tarea</option>
                            {tasks.map(t => (
                                <option key={t.id} value={t.id}>{t.title}</option>
                            ))}
                        </select>
                    </div>

                    {/* Project selector */}
                    <div>
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1 block">
                            <FolderGit2 className="w-3 h-3 inline mr-1" />Proyecto
                        </span>
                        <select
                            value={form.projectId}
                            onChange={e => setForm({ ...form, projectId: e.target.value })}
                            className="w-full px-3 py-2.5 border border-slate-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-800"
                        >
                            <option value="">Sin proyecto</option>
                            {projects.map(p => (
                                <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                        </select>
                    </div>

                    {/* Date */}
                    <div>
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1 block">Fecha</span>
                        <input
                            type="date"
                            value={form.date}
                            onChange={e => setForm({ ...form, date: e.target.value })}
                            className="w-full px-3 py-2.5 border border-slate-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-800"
                        />
                    </div>

                    {/* Start + End times */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1 block">Hora inicio</span>
                            <input
                                type="time"
                                value={form.startHour}
                                onChange={e => setForm({ ...form, startHour: e.target.value })}
                                className="w-full px-3 py-2.5 border border-slate-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-800"
                            />
                        </div>
                        <div>
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1 block">Hora fin</span>
                            <input
                                type="time"
                                value={form.endHour}
                                onChange={e => setForm({ ...form, endHour: e.target.value })}
                                className="w-full px-3 py-2.5 border border-slate-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-800"
                            />
                        </div>
                    </div>

                    {/* Preview */}
                    <div className="text-center py-2">
                        <span className="text-3xl font-black text-indigo-400 tabular-nums">{previewHours}h</span>
                        <p className="text-[10px] text-slate-400 font-bold mt-0.5">Horas calculadas</p>
                    </div>

                    {/* Notes */}
                    <div>
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1 block">
                            <FileText className="w-3 h-3 inline mr-1" />Notas
                        </span>
                        <input
                            value={form.notes}
                            onChange={e => setForm({ ...form, notes: e.target.value })}
                            placeholder="¿Qué hiciste?"
                            className="w-full px-3 py-2.5 border border-slate-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-800"
                        />
                    </div>

                    {/* Overtime toggle */}
                    <label className="flex items-center gap-3 px-3 py-2 bg-amber-500/15 rounded-xl cursor-pointer">
                        <input
                            type="checkbox"
                            checked={form.overtime}
                            onChange={e => setForm({ ...form, overtime: e.target.checked })}
                            className="w-4 h-4 rounded accent-amber-500"
                        />
                        <div className="flex items-center gap-1.5">
                            <Zap className="w-4 h-4 text-amber-500" />
                            <span className="text-xs font-bold text-amber-400">Tiempo extra</span>
                        </div>
                    </label>
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-slate-800 flex gap-3">
                    <button
                        onClick={onClose}
                        className="flex-1 px-4 py-3 border border-slate-700 rounded-2xl font-bold text-slate-500 hover:bg-slate-800 transition-all"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={isSaving || previewHours <= 0}
                        className="flex-1 px-4 py-3 bg-green-600 text-white rounded-2xl font-black shadow-lg hover:bg-green-700 active:scale-95 transition-all disabled:bg-slate-300 flex items-center justify-center gap-2"
                    >
                        <Save className="w-4 h-4" />
                        {isSaving ? 'Guardando...' : 'Registrar'}
                    </button>
                </div>
            </div>
        </div>
    );
}
