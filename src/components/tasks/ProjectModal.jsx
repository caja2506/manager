import React, { useState, useEffect } from 'react';
import { X, Save, FolderGit2, Calendar, User } from 'lucide-react';
import {
    PROJECT_STATUS, PROJECT_STATUS_CONFIG,
    TASK_PRIORITY, TASK_PRIORITY_CONFIG,
} from '../../models/schemas';
import { createProject, updateProject } from '../../services/taskService';

export default function ProjectModal({ isOpen, onClose, project, teamMembers, userId }) {
    const isNew = !project;

    const [form, setForm] = useState({
        name: '',
        description: '',
        status: PROJECT_STATUS.PLANNING,
        priority: TASK_PRIORITY.MEDIUM,
        ownerId: '',
        startDate: '',
        targetEndDate: '',
    });

    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (project) {
            setForm({
                name: project.name || '',
                description: project.description || '',
                status: project.status || PROJECT_STATUS.PLANNING,
                priority: project.priority || TASK_PRIORITY.MEDIUM,
                ownerId: project.ownerId || '',
                startDate: project.startDate ? project.startDate.split('T')[0] : '',
                targetEndDate: project.targetEndDate ? project.targetEndDate.split('T')[0] : '',
            });
        } else {
            setForm({
                name: '', description: '', status: PROJECT_STATUS.PLANNING,
                priority: TASK_PRIORITY.MEDIUM, ownerId: userId || '',
                startDate: new Date().toISOString().split('T')[0], targetEndDate: '',
            });
        }
    }, [project, userId]);

    if (!isOpen) return null;

    const handleSave = async () => {
        if (!form.name.trim()) return;
        setIsSaving(true);
        try {
            const data = {
                ...form,
                startDate: form.startDate ? new Date(form.startDate).toISOString() : null,
                targetEndDate: form.targetEndDate ? new Date(form.targetEndDate).toISOString() : null,
            };
            if (isNew) {
                await createProject(data, userId);
            } else {
                await updateProject(project.id, data);
            }
            onClose();
        } catch (err) {
            console.error('Error saving project:', err);
        }
        setIsSaving(false);
    };

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[300] flex items-center justify-center p-4">
            <div className="bg-slate-900 rounded-2xl shadow-2xl border border-slate-800 w-full max-w-lg animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-slate-800">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-indigo-600/20 rounded-2xl flex items-center justify-center">
                            <FolderGit2 className="w-5 h-5 text-indigo-400" />
                        </div>
                        <h2 className="font-black text-xl tracking-tight">
                            {isNew ? 'Nuevo Proyecto' : 'Editar Proyecto'}
                        </h2>
                    </div>
                    <button onClick={onClose} className="p-2 text-slate-400 hover:bg-slate-800 rounded-xl">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-6 space-y-4">
                    {/* Name */}
                    <div>
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1 block">Nombre del proyecto *</span>
                        <input
                            value={form.name}
                            onChange={e => setForm({ ...form, name: e.target.value })}
                            placeholder="Ej: Celda Robotizada XYZ"
                            className="w-full px-4 py-3 border border-slate-700 rounded-2xl text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-800"
                        />
                    </div>

                    {/* Description */}
                    <div>
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1 block">Descripción</span>
                        <textarea
                            value={form.description}
                            onChange={e => setForm({ ...form, description: e.target.value })}
                            placeholder="Alcance, objetivos, notas..."
                            className="w-full px-4 py-3 border border-slate-700 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-800"
                            rows={3}
                        />
                    </div>

                    {/* Row: Status + Priority */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1 block">Estado</span>
                            <select
                                value={form.status}
                                onChange={e => setForm({ ...form, status: e.target.value })}
                                className="w-full px-3 py-2.5 border border-slate-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-800"
                            >
                                {Object.entries(PROJECT_STATUS_CONFIG).map(([key, cfg]) => (
                                    <option key={key} value={key}>{cfg.icon} {cfg.label}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1 block">Prioridad</span>
                            <select
                                value={form.priority}
                                onChange={e => setForm({ ...form, priority: e.target.value })}
                                className="w-full px-3 py-2.5 border border-slate-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-800"
                            >
                                {Object.entries(TASK_PRIORITY_CONFIG).map(([key, cfg]) => (
                                    <option key={key} value={key}>{cfg.icon} {cfg.label}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Row: Owner */}
                    <div>
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1 block">
                            <User className="w-3 h-3 inline mr-1" />Responsable
                        </span>
                        <select
                            value={form.ownerId}
                            onChange={e => setForm({ ...form, ownerId: e.target.value })}
                            className="w-full px-3 py-2.5 border border-slate-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-800"
                        >
                            <option value="">Sin asignar</option>
                            {teamMembers.map(u => (
                                <option key={u.uid} value={u.uid}>{u.displayName || u.email}</option>
                            ))}
                        </select>
                    </div>

                    {/* Row: Dates */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1 block">
                                <Calendar className="w-3 h-3 inline mr-1" />Inicio
                            </span>
                            <input
                                type="date"
                                value={form.startDate}
                                onChange={e => setForm({ ...form, startDate: e.target.value })}
                                className="w-full px-3 py-2.5 border border-slate-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-800"
                            />
                        </div>
                        <div>
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1 block">
                                <Calendar className="w-3 h-3 inline mr-1" />Meta de cierre
                            </span>
                            <input
                                type="date"
                                value={form.targetEndDate}
                                onChange={e => setForm({ ...form, targetEndDate: e.target.value })}
                                className="w-full px-3 py-2.5 border border-slate-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-800"
                            />
                        </div>
                    </div>
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
                        disabled={isSaving || !form.name.trim()}
                        className="flex-1 px-4 py-3 bg-indigo-600 text-white rounded-2xl font-black shadow-lg hover:bg-indigo-700 active:scale-95 transition-all disabled:bg-slate-300 flex items-center justify-center gap-2"
                    >
                        <Save className="w-4 h-4" />
                        {isSaving ? 'Guardando...' : isNew ? 'Crear Proyecto' : 'Guardar'}
                    </button>
                </div>
            </div>
        </div>
    );
}
