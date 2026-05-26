import React, { useState, useEffect, useMemo } from 'react';
import { X, Save, Clock, Zap, ListTodo, FolderGit2, FileText } from 'lucide-react';
import { createManualTimeLog, updateTimeLog } from '../../services/timeService';

/**
 * ManualTimeEntry — supports CREATE and EDIT modes.
 * Pass `editLog` prop to open in edit mode with pre-filled data.
 */
export default function ManualTimeEntry({
    isOpen, onClose, tasks, projects, userId, teamMembers = [], editLog = null
}) {
    const isEditMode = !!editLog;

    const getLocalDateString = (d = new Date()) => {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    };

    // Helpers de tiempo
    const timeToMinutes = (timeStr) => {
        if (!timeStr) return 540; // default 09:00 (9 * 60)
        const [h, m] = timeStr.split(':').map(Number);
        return (h || 0) * 60 + (m || 0);
    };

    const minutesToTime = (mins) => {
        const h = Math.floor(mins / 60) % 24;
        const m = Math.round(mins % 60);
        return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    };

    const calculateDuration = (start, end) => {
        const startMins = timeToMinutes(start);
        let endMins = timeToMinutes(end);
        if (endMins < startMins) endMins += 1440; // Cruza la medianoche
        return (endMins - startMins) / 60;
    };

    const [form, setForm] = useState({
        taskId: '',
        projectId: '',
        date: getLocalDateString(),
        startHour: '09:00',
        endHour: '10:00',
        notes: '',
        overtime: false,
    });
    const [workedHours, setWorkedHours] = useState(1);
    const [selectedUserId, setSelectedUserId] = useState(userId || '');
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState('');

    // Sincronizadores bidireccionales
    const handleStartHourChange = (newStart) => {
        const startMins = timeToMinutes(newStart);
        const endMins = (startMins + Math.round(workedHours * 60)) % 1440;
        setForm(f => ({
            ...f,
            startHour: newStart,
            endHour: minutesToTime(endMins)
        }));
    };

    const handleWorkedHoursChange = (newHours) => {
        const hours = Math.max(0.25, Math.min(24, Number(newHours)));
        setWorkedHours(hours);
        const startMins = timeToMinutes(form.startHour);
        const endMins = (startMins + Math.round(hours * 60)) % 1440;
        setForm(f => ({
            ...f,
            endHour: minutesToTime(endMins)
        }));
    };

    const handleEndHourChange = (newEnd) => {
        const duration = calculateDuration(form.startHour, newEnd);
        setForm(f => ({ ...f, endHour: newEnd }));
        setWorkedHours(duration);
    };

    // Populate form when editing
    useEffect(() => {
        if (editLog && isOpen) {
            const start = editLog.startTime ? new Date(editLog.startTime) : null;
            const end = editLog.endTime ? new Date(editLog.endTime) : null;
            const startStr = start ? start.toTimeString().slice(0, 5) : '09:00';
            const endStr = end ? end.toTimeString().slice(0, 5) : '10:00';
            const duration = calculateDuration(startStr, endStr);
            setForm({
                taskId: editLog.taskId || '',
                projectId: editLog.projectId || '',
                date: start ? getLocalDateString(start) : getLocalDateString(),
                startHour: startStr,
                endHour: endStr,
                notes: editLog.notes || '',
                overtime: editLog.overtime || false,
            });
            setWorkedHours(duration);
            setSelectedUserId(editLog.userId || userId || '');
        } else if (isOpen && !editLog) {
            setForm({
                taskId: '', projectId: '',
                date: getLocalDateString(),
                startHour: '09:00', endHour: '10:00', notes: '', overtime: false,
            });
            setWorkedHours(1);
            setSelectedUserId(userId || '');
        }
    }, [editLog, isOpen, userId]);

    // Filter tasks by selected project
    const filteredTasks = useMemo(() => {
        if (!tasks) return [];
        return tasks.filter(t => {
            if (t.status === 'completed' || t.status === 'cancelled') return false;
            if (!form.projectId) return !t.projectId;
            return t.projectId === form.projectId;
        });
    }, [tasks, form.projectId]);

    if (!isOpen) return null;

    const handleSave = async () => {
        if (!form.date || !form.startHour || !form.endHour) return;
        setIsSaving(true);
        setError('');
        try {
            // Parse the date and time explicitly to avoid browser quirks with ISO strings
            const [y, m, d] = form.date.split('-').map(Number);
            const [sh, sm] = form.startHour.split(':').map(Number);
            const [eh, em] = form.endHour.split(':').map(Number);
            
            const startDate = new Date(y, m - 1, d, sh, sm, 0);
            const endDate = new Date(y, m - 1, d, eh, em, 0);

            // Output as fully-qualified UTC ISO strings
            const startTime = startDate.toISOString();
            const endTime = endDate.toISOString();

            console.log("DEBUG TZ -> Local Start:", startDate.toString());
            console.log("DEBUG TZ -> ISO Start:", startTime);

            if (isEditMode) {
                await updateTimeLog(editLog.id, {
                    taskId: form.taskId || null,
                    projectId: form.projectId || null,
                    startTime,
                    endTime,
                    notes: form.notes,
                    overtime: form.overtime,
                });
            } else {
                await createManualTimeLog({
                    taskId: form.taskId || null,
                    projectId: form.projectId || null,
                    userId: selectedUserId || userId,
                    startTime,
                    endTime,
                    notes: form.notes,
                    overtime: form.overtime,
                });
            }
            onClose();
        } catch (err) {
            console.error('Error saving time log:', err);
            setError(err.message || 'Error guardando registro');
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
    })();    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[300] flex items-center justify-center p-4">
            {/* Custom Range Sliders Premium Styling */}
            <style>{`
                .premium-slider {
                    -webkit-appearance: none;
                    appearance: none;
                    width: 100%;
                    height: 6px;
                    border-radius: 9999px;
                    background: #1e293b; /* slate-800 */
                    outline: none;
                    transition: background 0.15s;
                }
                .premium-slider::-webkit-slider-thumb {
                    -webkit-appearance: none;
                    appearance: none;
                    width: 16px;
                    height: 16px;
                    border-radius: 50%;
                    background: #6366f1; /* indigo-500 */
                    cursor: pointer;
                    box-shadow: 0 0 10px rgba(99, 102, 241, 0.6);
                    transition: transform 0.1s, background-color 0.15s;
                }
                .premium-slider::-webkit-slider-thumb:hover {
                    transform: scale(1.2);
                    background: #4f46e5; /* indigo-600 */
                }
                .premium-slider::-moz-range-thumb {
                    width: 16px;
                    height: 16px;
                    border-radius: 50%;
                    background: #6366f1;
                    cursor: pointer;
                    border: none;
                    box-shadow: 0 0 10px rgba(99, 102, 241, 0.6);
                    transition: transform 0.1s, background-color 0.15s;
                }
                .premium-slider::-moz-range-thumb:hover {
                    transform: scale(1.2);
                    background: #4f46e5;
                }
            `}</style>

            <div className="bg-slate-900 rounded-2xl shadow-2xl border border-slate-800 w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-slate-800">
                    <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 ${isEditMode ? 'bg-indigo-500/10' : 'bg-green-500/10'} rounded-2xl flex items-center justify-center`}>
                            <Clock className={`w-5 h-5 ${isEditMode ? 'text-indigo-400' : 'text-green-400'}`} />
                        </div>
                        <h2 className="font-black text-lg tracking-tight text-white">
                            {isEditMode ? 'Editar Registro de Horas' : 'Registro de Horas Manual'}
                        </h2>
                    </div>
                    <button onClick={onClose} className="p-2 text-slate-400 hover:bg-slate-800 rounded-xl transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-6 overflow-y-auto flex-1">
                    {error && (
                        <div className="text-xs font-bold text-red-400 bg-red-500/15 border border-red-500/30 rounded-xl px-3 py-2 mb-4">
                            {error}
                        </div>
                    )}

                    {/* TWO-COLUMN GRID LAYOUT */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        
                        {/* LEFT COLUMN: General Fields */}
                        <div className="space-y-4">
                            {/* Colaborador / Técnico selector */}
                            {teamMembers.length > 0 && (
                                <div>
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1.5 block">
                                        Colaborador / Técnico
                                    </span>
                                    <select
                                        value={selectedUserId}
                                        onChange={e => setSelectedUserId(e.target.value)}
                                        className="w-full px-3 py-2.5 border border-slate-700 rounded-xl text-sm outline-none focus:ring-1 focus:ring-indigo-500 bg-slate-800 text-slate-200 font-bold"
                                    >
                                        {teamMembers.filter(u => {
                                            const uid = u.uid || u.id;
                                            return uid && !uid.startsWith('ext_');
                                        }).map(u => (
                                            <option key={u.uid || u.id} value={u.uid || u.id}>
                                                {u.displayName || u.email || 'Usuario'}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            {/* Project selector */}
                            <div>
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1.5 block">
                                    <FolderGit2 className="w-3.5 h-3.5 inline mr-1 text-indigo-400" />Proyecto
                                </span>
                                <select
                                    value={form.projectId}
                                    onChange={e => setForm({ ...form, projectId: e.target.value, taskId: '' })}
                                    className="w-full px-3 py-2.5 border border-slate-700 rounded-xl text-sm outline-none focus:ring-1 focus:ring-indigo-500 bg-slate-800 text-slate-200"
                                >
                                    <option value="">Sin proyecto</option>
                                    {projects.map(p => (
                                        <option key={p.id} value={p.id}>{p.name}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Task selector (filtered by project) */}
                            <div>
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1.5 block">
                                    <ListTodo className="w-3.5 h-3.5 inline mr-1 text-indigo-400" />Tarea
                                </span>
                                <select
                                    value={form.taskId}
                                    onChange={e => {
                                        const newTaskId = e.target.value;
                                        setForm(f => ({ ...f, taskId: newTaskId }));
                                        const t = tasks.find(t => t.id === newTaskId);
                                        if (t?.projectId && !form.projectId) {
                                            setForm(f => ({ ...f, projectId: t.projectId }));
                                        }
                                    }}
                                    className="w-full px-3 py-2.5 border border-slate-700 rounded-xl text-sm outline-none focus:ring-1 focus:ring-indigo-500 bg-slate-800 text-slate-200"
                                >
                                    <option value="">Sin tarea</option>
                                    {filteredTasks.map(t => (
                                        <option key={t.id} value={t.id}>{t.title}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Date */}
                            <div>
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1.5 block">Fecha</span>
                                <input
                                    type="date"
                                    value={form.date}
                                    onChange={e => setForm({ ...form, date: e.target.value })}
                                    className="w-full px-3 py-2.5 border border-slate-700 rounded-xl text-sm outline-none focus:ring-1 focus:ring-indigo-500 bg-slate-800 text-slate-200"
                                />
                            </div>

                            {/* Notes */}
                            <div>
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1.5 block">
                                    <FileText className="w-3.5 h-3.5 inline mr-1 text-indigo-400" />Notas
                                </span>
                                <textarea
                                    value={form.notes}
                                    onChange={e => setForm({ ...form, notes: e.target.value })}
                                    placeholder="¿Qué lograste avanzar hoy?"
                                    rows="3"
                                    className="w-full px-3 py-2.5 border border-slate-700 rounded-xl text-sm outline-none focus:ring-1 focus:ring-indigo-500 bg-slate-800 text-slate-200 resize-none"
                                />
                            </div>
                        </div>

                        {/* RIGHT COLUMN: Sliders & Times */}
                        <div className="space-y-4 flex flex-col justify-between">
                            
                            {/* Sliders Block */}
                            <div className="space-y-4">
                                {/* Slider Hora de Inicio */}
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 block">
                                            Hora de Inicio
                                        </span>
                                        <input
                                            type="time"
                                            value={form.startHour}
                                            onChange={e => handleStartHourChange(e.target.value)}
                                            className="px-2.5 py-1 border border-slate-700 rounded-lg text-xs outline-none focus:ring-1 focus:ring-indigo-500 bg-slate-800 font-medium text-white"
                                        />
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <input
                                            type="range"
                                            min="0"
                                            max="95"
                                            step="1"
                                            value={Math.floor(timeToMinutes(form.startHour) / 15)}
                                            onChange={e => {
                                                const mins = Number(e.target.value) * 15;
                                                handleStartHourChange(minutesToTime(mins));
                                            }}
                                            className="premium-slider"
                                        />
                                        <span className="text-xs font-bold text-slate-400 min-w-[70px] text-right font-mono">
                                            {(() => {
                                                const [h, m] = form.startHour.split(':').map(Number);
                                                const ampm = h >= 12 ? 'PM' : 'AM';
                                                const dispH = h % 12 === 0 ? 12 : h % 12;
                                                return `${dispH}:${String(m).padStart(2, '0')} ${ampm}`;
                                            })()}
                                        </span>
                                    </div>
                                </div>

                                {/* Slider Horas Trabajadas */}
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 block">
                                            Horas Trabajadas
                                        </span>
                                        <div className="flex items-center gap-1.5">
                                            <input
                                                type="number"
                                                min="0.25"
                                                max="24"
                                                step="0.25"
                                                value={workedHours}
                                                onChange={e => handleWorkedHoursChange(Number(e.target.value))}
                                                className="w-16 px-2 py-1 border border-slate-700 rounded-lg text-xs outline-none focus:ring-1 focus:ring-indigo-500 bg-slate-800 text-center font-bold text-indigo-400"
                                            />
                                            <span className="text-xs text-slate-450 font-bold">h</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <input
                                            type="range"
                                            min="0.25"
                                            max="24"
                                            step="0.25"
                                            value={workedHours}
                                            onChange={e => handleWorkedHoursChange(Number(e.target.value))}
                                            className="premium-slider"
                                        />
                                        <span className="text-xs font-bold text-slate-400 min-w-[70px] text-right font-mono">
                                            {workedHours.toFixed(2)}h
                                        </span>
                                    </div>
                                </div>

                                {/* Hora de Fin (calculada / ajustable) */}
                                <div className="flex items-center justify-between bg-slate-950/40 p-3 rounded-xl border border-slate-850">
                                    <div className="flex flex-col">
                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                                            Hora de Fin
                                        </span>
                                        {(() => {
                                            const startMins = timeToMinutes(form.startHour);
                                            const endMins = timeToMinutes(form.endHour);
                                            if (endMins < startMins) {
                                                return <span className="text-[9px] text-amber-500 font-bold ml-1 mt-0.5">⚠️ Siguiente día</span>;
                                            }
                                            return null;
                                        })()}
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md">
                                            {(() => {
                                                const [h, m] = form.endHour.split(':').map(Number);
                                                const ampm = h >= 12 ? 'PM' : 'AM';
                                                const dispH = h % 12 === 0 ? 12 : h % 12;
                                                return `${dispH}:${String(m).padStart(2, '0')} ${ampm}`;
                                            })()}
                                        </span>
                                        <input
                                            type="time"
                                            value={form.endHour}
                                            onChange={e => handleEndHourChange(e.target.value)}
                                            className="px-2.5 py-1 border border-slate-700 rounded-lg text-xs outline-none focus:ring-1 focus:ring-indigo-500 bg-slate-800 font-medium text-white"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Horas Totales Indicator */}
                            <div className="flex items-center justify-between py-2 border-t border-slate-850 mt-2">
                                <div className="text-left">
                                    <span className="text-3xl font-black text-indigo-400 tabular-nums">{workedHours.toFixed(2)}h</span>
                                    <p className="text-[10px] text-slate-400 font-bold mt-0.5">Total de Horas</p>
                                </div>

                                {/* Overtime toggle */}
                                <label className="flex items-center gap-3 px-3 py-2 bg-amber-500/10 border border-amber-500/20 rounded-xl cursor-pointer hover:bg-amber-500/15 transition-colors select-none">
                                    <input
                                        type="checkbox"
                                        checked={form.overtime}
                                        onChange={e => setForm({ ...form, overtime: e.target.checked })}
                                        className="w-4 h-4 rounded accent-amber-500"
                                    />
                                    <div className="flex items-center gap-1.5">
                                        <Zap className="w-3.5 h-3.5 text-amber-500" />
                                        <span className="text-[11px] font-bold text-amber-450">Tiempo extra</span>
                                    </div>
                                </label>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-slate-800 flex gap-3">
                    <button
                        onClick={onClose}
                        className="flex-1 px-4 py-3 border border-slate-700 hover:bg-slate-800 rounded-2xl font-bold text-slate-400 transition-colors"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={isSaving || workedHours <= 0}
                        className={`flex-1 px-4 py-3 ${isEditMode ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-indigo-600 hover:bg-indigo-500'} text-white rounded-2xl font-black shadow-lg active:scale-95 transition-all disabled:bg-slate-800 disabled:text-slate-600 disabled:shadow-none flex items-center justify-center gap-2`}
                    >
                        <Save className="w-4 h-4" />
                        {isSaving ? 'Guardando...' : isEditMode ? 'Actualizar' : 'Registrar'}
                    </button>
                </div>
            </div>
        </div>
    );
}
