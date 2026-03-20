/**
 * Milestone Modal — V5
 * =====================
 * Create/edit a milestone linked to a project.
 * Now uses dynamic milestone types from Managed Lists (milestoneTypes collection).
 */

import React, { useState, useEffect } from 'react';
import { X, Target, Calendar, Save, Loader2, Plus, Trash2 } from 'lucide-react';
import { useAppData } from '../../contexts/AppDataContext';
import { useEngineeringData } from '../../hooks/useEngineeringData';

export default function MilestoneModal({ isOpen, onClose, onSave, teamMembers = [], milestone = null }) {
    const { handleSaveManagedList } = useAppData();
    const { milestoneTypes } = useEngineeringData();

    // Use name directly as value — same data as the managed list
    const typeOptions = (milestoneTypes || []).map(t => t.name);

    const defaultType = typeOptions[0] || '';

    const [form, setForm] = useState({
        name: '',
        description: '',
        type: defaultType,
        startDate: '',
        dueDate: '',
        ownerId: '',
    });
    const [saving, setSaving] = useState(false);
    const [showTypeManager, setShowTypeManager] = useState(false);
    const [editTypes, setEditTypes] = useState([]);
    const [savingTypes, setSavingTypes] = useState(false);

    // Open the type manager popup
    const openTypeManager = () => {
        setEditTypes(typeOptions.map((name, i) => ({ id: `e-${i}`, name, original: name })));
        setShowTypeManager(true);
    };

    const handleAddEditType = () => {
        setEditTypes(prev => [...prev, { id: `n-${Date.now()}`, name: '', original: null }]);
    };

    const handleSaveTypes = async () => {
        setSavingTypes(true);
        const renames = editTypes
            .filter(i => i.original && i.name.trim() && i.original !== i.name.trim())
            .map(i => ({ oldName: i.original, newName: i.name.trim() }));
        const added = editTypes.filter(i => !i.original && i.name.trim()).map(i => i.name.trim());
        const remainingOriginals = editTypes.map(i => i.original).filter(Boolean);
        const deleted = typeOptions.filter(name => !remainingOriginals.includes(name));
        try {
            await handleSaveManagedList({ type: 'milestoneType', data: { renames, deleted, added } });
            setShowTypeManager(false);
        } catch (err) {
            console.error('Error saving milestone types:', err);
            alert('Error al guardar: ' + (err.message || 'Error desconocido'));
        }
        setSavingTypes(false);
    };

    useEffect(() => {
        if (milestone) {
            setForm({
                name: milestone.name || '',
                description: milestone.description || '',
                type: milestone.type || defaultType,
                startDate: milestone.startDate ? milestone.startDate.split('T')[0] : '',
                dueDate: milestone.dueDate ? milestone.dueDate.split('T')[0] : '',
                ownerId: milestone.ownerId || '',
            });
        } else {
            setForm({
                name: '',
                description: '',
                type: defaultType,
                startDate: '',
                dueDate: '',
                ownerId: '',
            });
        }
    }, [milestone, isOpen, defaultType]);

    const handleSave = async () => {
        if (!form.name.trim()) return;
        setSaving(true);
        try {
            await onSave({
                name: form.name.trim(),
                description: form.description.trim(),
                type: form.type,
                startDate: form.startDate || null,
                dueDate: form.dueDate || null,
                ownerId: form.ownerId || null,
            });
            onClose();
        } catch (err) {
            console.error('Error saving milestone:', err);
        } finally {
            setSaving(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
            <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-lg mx-4" onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="flex items-center justify-between p-5 border-b border-slate-800">
                    <div className="flex items-center gap-2">
                        <div className="w-9 h-9 bg-purple-600/20 border border-purple-500/30 rounded-xl flex items-center justify-center">
                            <Target className="w-4 h-4 text-purple-400" />
                        </div>
                        <h3 className="font-bold text-lg text-white">{milestone ? 'Editar Milestone' : 'Nuevo Milestone'}</h3>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-white transition cursor-pointer">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-5 space-y-4 max-h-[65vh] overflow-y-auto">
                    {/* Name */}
                    <div>
                        <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">Nombre *</label>
                        <input
                            type="text"
                            value={form.name}
                            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                            placeholder="Ej: Setup inicial, Commissioning FAT..."
                            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-purple-500 transition"
                            autoFocus
                        />
                    </div>

                    {/* Type — dynamic from milestoneTypes */}
                    <div>
                        <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2 block">Tipo</label>
                        <div className="flex gap-2 items-center">
                            <select
                                value={form.type}
                                onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
                                className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-purple-500 transition cursor-pointer"
                            >
                                <option value="">Seleccionar tipo...</option>
                                {typeOptions.map(name => (
                                    <option key={name} value={name}>{name}</option>
                                ))}
                            </select>
                            <button
                                type="button"
                                onClick={openTypeManager}
                                className="w-10 h-10 flex items-center justify-center bg-purple-600 text-white rounded-xl hover:bg-purple-700 transition cursor-pointer shrink-0"
                                title="Gestionar tipos de milestone"
                            >
                                <Plus className="w-5 h-5" />
                            </button>
                        </div>
                        {typeOptions.length === 0 && (
                            <p className="text-[10px] text-slate-500 mt-2 italic">
                                💡 Presiona + para agregar tipos de milestone.
                            </p>
                        )}
                    </div>

                    {/* ═══ Type Manager Popup ═══ */}
                    {showTypeManager && (
                        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowTypeManager(false)}>
                            <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-md mx-4" onClick={e => e.stopPropagation()}>
                                {/* Header */}
                                <div className="p-4 border-b border-slate-800 flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <div className="w-8 h-8 bg-purple-500/15 rounded-xl flex items-center justify-center">
                                            <Target className="w-4 h-4 text-purple-400" />
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-sm text-white">Tipos de Milestone</h4>
                                            <p className="text-[10px] text-slate-500">{editTypes.filter(t => t.name.trim()).length} tipos</p>
                                        </div>
                                    </div>
                                    <button onClick={() => setShowTypeManager(false)} className="text-slate-400 hover:text-white transition cursor-pointer">
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>
                                {/* Body */}
                                <div className="p-4 space-y-2 max-h-64 overflow-y-auto">
                                    {editTypes.map(item => (
                                        <div key={item.id} className="flex items-center gap-2">
                                            <input
                                                value={item.name}
                                                onChange={e => setEditTypes(prev => prev.map(t => t.id === item.id ? { ...t, name: e.target.value } : t))}
                                                placeholder="Nuevo tipo..."
                                                className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                                            />
                                            <button
                                                onClick={() => setEditTypes(prev => prev.filter(t => t.id !== item.id))}
                                                className="p-2 text-red-400 hover:bg-red-500/15 rounded-lg transition cursor-pointer"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    ))}
                                    <button onClick={handleAddEditType}
                                        className="w-full mt-2 p-2 text-xs font-bold text-purple-400 bg-purple-500/10 rounded-lg flex items-center justify-center hover:bg-purple-500/20 transition cursor-pointer">
                                        <Plus className="w-3.5 h-3.5 mr-1" /> Agregar otro
                                    </button>
                                </div>
                                {/* Footer */}
                                <div className="flex items-center justify-end gap-2 p-4 border-t border-slate-800">
                                    <button onClick={() => setShowTypeManager(false)}
                                        className="text-xs font-bold text-slate-400 bg-slate-800 px-3 py-1.5 rounded-lg hover:bg-slate-700 transition cursor-pointer">
                                        Cancelar
                                    </button>
                                    <button onClick={handleSaveTypes} disabled={savingTypes}
                                        className="text-xs font-bold text-white bg-purple-600 px-4 py-1.5 rounded-lg hover:bg-purple-700 transition disabled:opacity-50 cursor-pointer">
                                        {savingTypes ? '...' : 'Guardar'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Description */}
                    <div>
                        <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">Descripción</label>
                        <textarea
                            value={form.description}
                            onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                            placeholder="Descripción corta del milestone..."
                            rows={2}
                            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-purple-500 transition resize-none"
                        />
                    </div>

                    {/* Dates */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">Fecha Inicio</label>
                            <input
                                type="date"
                                value={form.startDate}
                                onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))}
                                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-purple-500 transition"
                            />
                        </div>
                        <div>
                            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">Fecha Límite</label>
                            <input
                                type="date"
                                value={form.dueDate}
                                onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))}
                                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-purple-500 transition"
                            />
                        </div>
                    </div>

                    {/* Owner */}
                    {teamMembers.length > 0 && (
                        <div>
                            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">Responsable</label>
                            <select
                                value={form.ownerId}
                                onChange={e => setForm(f => ({ ...f, ownerId: e.target.value }))}
                                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-purple-500 transition"
                            >
                                <option value="">Sin asignar</option>
                                {teamMembers.map(m => (
                                    <option key={m.uid} value={m.uid}>{m.displayName || m.email}</option>
                                ))}
                            </select>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-3 p-5 border-t border-slate-800">
                    <button onClick={onClose}
                        className="px-5 py-2.5 text-sm font-bold text-slate-400 hover:text-white transition cursor-pointer">
                        Cancelar
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={!form.name.trim() || saving}
                        className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition cursor-pointer ${
                            form.name.trim() && !saving
                                ? 'bg-purple-600 text-white hover:bg-purple-700 shadow-lg shadow-purple-900/30'
                                : 'bg-slate-700 text-slate-400 cursor-not-allowed'
                        }`}
                    >
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        {saving ? 'Guardando...' : 'Guardar'}
                    </button>
                </div>
            </div>
        </div>
    );
}
