import React, { useState } from 'react';
import { useEngineeringData } from '../../hooks/useEngineeringData';
import { createDelayCause, updateDelayCause, deleteDelayCause } from '../../services/delayService';
import { Plus, Edit2, Trash2, Check, X, AlertOctagon } from 'lucide-react';

export default function DelayCausesAdmin() {
    const { delayCauses } = useEngineeringData();
    const [isEditing, setIsEditing] = useState(null);
    const [editForm, setEditForm] = useState({ name: '', description: '', active: true, order: 0 });
    const [isCreating, setIsCreating] = useState(false);

    const handleCreate = async () => {
        if (!editForm.name.trim()) return;
        try {
            await createDelayCause(editForm);
            setIsCreating(false);
            setEditForm({ name: '', description: '', active: true, order: 0 });
        } catch (error) {
            console.error("Error creating delay cause", error);
        }
    };

    const handleUpdate = async (id) => {
        if (!editForm.name.trim()) return;
        try {
            await updateDelayCause(id, editForm);
            setIsEditing(null);
        } catch (error) {
            console.error("Error updating delay cause", error);
        }
    };

    const handleDelete = async (id) => {
        if (!confirm('¿Estás seguro de eliminar esta causa de retraso?')) return;
        try {
            await deleteDelayCause(id);
        } catch (error) {
            console.error("Error deleting delay cause", error);
        }
    };

    const startEdit = (cause) => {
        setIsEditing(cause.id);
        setEditForm({ ...cause });
    };

    const startCreate = () => {
        setIsCreating(true);
        setEditForm({ name: '', description: '', active: true, order: delayCauses.length });
    };

    const cancelEdit = () => {
        setIsEditing(null);
        setIsCreating(false);
    };

    return (
        <div className="bg-slate-900 p-6 rounded-3xl border border-slate-800 shadow-lg mt-6">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-rose-100 rounded-2xl flex items-center justify-center">
                        <AlertOctagon className="w-5 h-5 text-rose-600" />
                    </div>
                    <div>
                        <h3 className="font-bold text-lg text-white tracking-tight">Causas de Retraso</h3>
                        <p className="text-xs text-slate-400">Configura los motivos bloqueantes para proyectos y tareas.</p>
                    </div>
                </div>
                <button
                    onClick={startCreate}
                    disabled={isCreating}
                    className="flex items-center gap-2 bg-indigo-50 text-indigo-400 hover:bg-indigo-600/20 px-4 py-2 rounded-xl text-sm font-bold transition-colors disabled:opacity-50"
                >
                    <Plus className="w-4 h-4" /> Agregar Causa
                </button>
            </div>

            <div className="space-y-3">
                {isCreating && (
                    <div className="flex items-center gap-3 bg-slate-800 p-3 rounded-xl border border-slate-700">
                        <input
                            type="text"
                            placeholder="Nombre de la causa"
                            value={editForm.name}
                            onChange={(e) => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                            className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                        />
                        <input
                            type="text"
                            placeholder="Descripción (opcional)"
                            value={editForm.description}
                            onChange={(e) => setEditForm(prev => ({ ...prev, description: e.target.value }))}
                            className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                        />
                        <button onClick={handleCreate} className="p-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">
                            <Check className="w-4 h-4" />
                        </button>
                        <button onClick={cancelEdit} className="p-2 bg-slate-200 text-slate-600 rounded-lg hover:bg-slate-300">
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                )}

                {delayCauses.map(cause => (
                    <div key={cause.id} className="flex items-center justify-between bg-slate-800 p-3 rounded-xl border border-slate-800 group">
                        {isEditing === cause.id ? (
                            <div className="flex-1 flex items-center gap-3 mr-3">
                                <input
                                    type="text"
                                    value={editForm.name}
                                    onChange={(e) => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                                    className="flex-1 bg-slate-900 border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-indigo-500"
                                />
                                <input
                                    type="text"
                                    value={editForm.description}
                                    onChange={(e) => setEditForm(prev => ({ ...prev, description: e.target.value }))}
                                    className="flex-1 bg-slate-900 border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-indigo-500"
                                />
                                <label className="flex items-center gap-2 text-sm font-bold text-slate-600">
                                    <input
                                        type="checkbox"
                                        checked={editForm.active}
                                        onChange={(e) => setEditForm(prev => ({ ...prev, active: e.target.checked }))}
                                        className="rounded border-slate-300 text-indigo-400 focus:ring-indigo-600"
                                    />
                                    Activo
                                </label>
                            </div>
                        ) : (
                            <div className="flex-1 flex flex-col">
                                <span className={`font-bold text-sm ${cause.active ? 'text-slate-800' : 'text-slate-400 line-through'}`}>{cause.name}</span>
                                {cause.description && <span className="text-xs text-slate-500">{cause.description}</span>}
                            </div>
                        )}

                        <div className="flex items-center gap-2">
                            {isEditing === cause.id ? (
                                <>
                                    <button onClick={() => handleUpdate(cause.id)} className="p-1.5 text-emerald-400 bg-emerald-500/15 rounded-lg hover:bg-emerald-100">
                                        <Check className="w-4 h-4" />
                                    </button>
                                    <button onClick={cancelEdit} className="p-1.5 text-slate-500 bg-slate-800 rounded-lg hover:bg-slate-200">
                                        <X className="w-4 h-4" />
                                    </button>
                                </>
                            ) : (
                                <>
                                    <button onClick={() => startEdit(cause)} className="p-1.5 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity hover:text-indigo-400 hover:bg-indigo-50 rounded-lg">
                                        <Edit2 className="w-4 h-4" />
                                    </button>
                                    <button onClick={() => handleDelete(cause.id)} className="p-1.5 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity hover:text-rose-600 hover:bg-rose-50 rounded-lg">
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
