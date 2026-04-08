import React, { useState } from 'react';
import { Compass, Edit2, Plus, Trash2, Search } from 'lucide-react';
import { db } from '../../firebase';
import { collection, doc, writeBatch } from 'firebase/firestore';
import { COLLECTIONS } from '../../models/schemas';

export default function WorkAreasCard({ workAreas = [] }) {
    const [isEditing, setIsEditing] = useState(false);
    const [editItems, setEditItems] = useState([]);
    const [search, setSearch] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    const startEdit = () => {
        setEditItems(workAreas.map(c => ({ id: c.id, name: c.name, color: c.color || '#6366f1', isNew: false })));
        setIsEditing(true);
    };

    const handleAdd = () => {
        setEditItems(prev => [...prev, { id: `n-${Date.now()}`, name: '', color: '#6366f1', isNew: true }]);
    };

    const handleRemove = (id) => {
        setEditItems(prev => prev.filter(i => i.id !== id));
    };

    const handleChange = (id, field, value) => {
        setEditItems(prev => prev.map(i => i.id === id ? { ...i, [field]: value } : i));
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const batch = writeBatch(db);
            const collRef = collection(db, COLLECTIONS.WORK_AREA_TYPES);

            // New items
            const toAdd = editItems.filter(i => i.isNew && i.name.trim());
            for (const item of toAdd) {
                batch.set(doc(collRef), { name: item.name.trim(), color: item.color });
            }

            // Updates
            const toUpdate = editItems.filter(i => !i.isNew);
            for (const item of toUpdate) {
                const original = workAreas.find(w => w.id === item.id);
                if (original && (original.name !== item.name.trim() || original.color !== item.color)) {
                    batch.update(doc(collRef, item.id), { name: item.name.trim(), color: item.color });
                }
            }

            // Deletes
            const keptIds = editItems.filter(i => !i.isNew).map(i => i.id);
            for (const wa of workAreas) {
                if (!keptIds.includes(wa.id)) {
                    batch.delete(doc(collRef, wa.id));
                }
            }

            await batch.commit();
            setIsEditing(false);
        } catch (err) {
            console.error('Error saving work areas:', err);
            alert('Error al guardar: ' + err.message);
        }
        setIsSaving(false);
    };

    const cancel = () => {
        setIsEditing(false);
        setEditItems([]);
    };

    const filtered = workAreas.filter(n => n.name.toLowerCase().includes(search.toLowerCase()));

    return (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-lg overflow-hidden flex flex-col h-[400px]">
            {/* Header */}
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-teal-100 dark:bg-teal-500/10 rounded-2xl flex items-center justify-center">
                        <Compass className="w-5 h-5 text-teal-600 dark:text-teal-400" />
                    </div>
                    <div>
                        <h3 className="font-bold text-slate-800 dark:text-white text-sm">Áreas de Trabajo</h3>
                        <p className="text-[11px] text-slate-500">Disciplinas y grupos · {workAreas.length} registros</p>
                    </div>
                </div>
                {!isEditing ? (
                    <button onClick={startEdit} className="flex items-center gap-1.5 text-xs font-bold text-indigo-500 hover:text-indigo-600 dark:text-indigo-400 dark:hover:text-indigo-300 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-500/10 dark:hover:bg-indigo-500/20 px-3 py-1.5 rounded-lg transition-colors">
                        <Edit2 className="w-3.5 h-3.5" /> Editar
                    </button>
                ) : (
                    <div className="flex gap-2">
                        <button onClick={cancel} className="text-xs font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">Cancelar</button>
                        <button onClick={handleSave} disabled={isSaving} className="text-xs font-bold text-white bg-indigo-600 px-4 py-1.5 rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50">
                            {isSaving ? '...' : 'Guardar'}
                        </button>
                    </div>
                )}
            </div>

            {/* Body */}
            <div className="p-4 flex-1 overflow-hidden flex flex-col">
                {isEditing ? (
                    <div className="space-y-2 flex-1 overflow-y-auto pr-1 custom-scrollbar">
                        {editItems.map(item => (
                            <div key={item.id} className="flex items-center gap-2">
                                <input
                                    type="color"
                                    value={item.color}
                                    onChange={e => handleChange(item.id, 'color', e.target.value)}
                                    className="w-8 h-8 rounded shrink-0 border-0 p-0 cursor-pointer"
                                />
                                <input
                                    value={item.name}
                                    onChange={e => handleChange(item.id, 'name', e.target.value)}
                                    placeholder="Nombre del área..."
                                    className="flex-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-sm text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                />
                                <button onClick={() => handleRemove(item.id)} className="p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/15 rounded-lg transition-colors">
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        ))}
                        <button onClick={handleAdd} className="w-full mt-2 p-2 text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10 rounded-lg flex items-center justify-center hover:bg-indigo-100 dark:hover:bg-indigo-500/20 transition-colors">
                            <Plus className="w-3.5 h-3.5 mr-1" /> Agregar otro
                        </button>
                    </div>
                ) : (
                    <>
                        {workAreas.length > 5 && (
                            <div className="relative mb-3 flex-shrink-0">
                                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input
                                    value={search}
                                    onChange={e => setSearch(e.target.value)}
                                    placeholder="Buscar..."
                                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg pl-9 pr-3 py-2 text-xs text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                />
                            </div>
                        )}
                        <div className="space-y-1 flex-1 overflow-y-auto pr-1 custom-scrollbar">
                            {filtered.length === 0 && (
                                <p className="text-xs text-slate-500 text-center py-4">Sin resultados</p>
                            )}
                            {filtered.map(wa => (
                                <div key={wa.id} className="flex items-center gap-2 px-3 py-2 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-100 dark:border-transparent">
                                    <div 
                                        className="w-2.5 h-2.5 rounded-full flex-shrink-0" 
                                        style={{ backgroundColor: wa.color || '#6366f1' }}
                                    />
                                    <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{wa.name}</span>
                                </div>
                            ))}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
