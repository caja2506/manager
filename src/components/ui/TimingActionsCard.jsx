import React, { useState } from 'react';
import { Edit2, Trash2, Plus, Search, Check, X } from 'lucide-react';

/**
 * TimingActionsCard — Card especializada para acciones de timing
 * ==============================================================
 * Muestra código (abreviatura) + descripción (significado).
 * CRUD vía Supabase directo (no usa ManagedListCard genérico).
 */
export default function TimingActionsCard({ title, subtitle, icon: Icon, iconBg, iconColor, items, onSave }) {
    const [isEditing, setIsEditing] = useState(false);
    const [editItems, setEditItems] = useState([]);
    const [search, setSearch] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    const startEdit = () => {
        setEditItems(items.map((item, i) => ({
            id: `e-${i}`,
            name: item.name,
            description: item.description || '',
            originalName: item.name,
        })));
        setIsEditing(true);
    };

    const handleAdd = () => {
        setEditItems(prev => [...prev, { id: `n-${Date.now()}`, name: '', description: '', originalName: null }]);
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
            await onSave(editItems.filter(i => i.name.trim()));
            setIsEditing(false);
        } catch (err) {
            console.error('Error saving timing actions:', err);
            alert('Error al guardar: ' + (err.message || 'Error desconocido'));
        }
        setIsSaving(false);
    };

    const cancel = () => {
        setIsEditing(false);
        setEditItems([]);
    };

    const filtered = items.filter(item =>
        item.name.toLowerCase().includes(search.toLowerCase()) ||
        (item.description || '').toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-lg overflow-hidden h-full flex flex-col">
            {/* Header */}
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 ${iconBg} rounded-2xl flex items-center justify-center`}>
                        <Icon className={`w-5 h-5 ${iconColor}`} />
                    </div>
                    <div>
                        <h3 className="font-bold text-slate-800 dark:text-white text-sm">{title}</h3>
                        <p className="text-[11px] text-slate-500">{subtitle} · {items.length} registros</p>
                    </div>
                </div>
                {!isEditing ? (
                    <button onClick={startEdit} className="flex items-center gap-1.5 text-xs font-bold text-indigo-500 dark:text-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-300 bg-indigo-50 dark:bg-indigo-500/10 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 px-3 py-1.5 rounded-lg transition-colors cursor-pointer">
                        <Edit2 className="w-3.5 h-3.5" /> Editar
                    </button>
                ) : (
                    <div className="flex gap-2">
                        <button onClick={cancel} className="text-xs font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer">Cancelar</button>
                        <button onClick={handleSave} disabled={isSaving} className="text-xs font-bold text-white bg-indigo-600 px-4 py-1.5 rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 cursor-pointer">
                            {isSaving ? '...' : 'Guardar'}
                        </button>
                    </div>
                )}
            </div>

            {/* Body */}
            <div className="p-4 flex-1 overflow-hidden flex flex-col">
                {isEditing ? (
                    <div className="space-y-2 flex-1 overflow-y-auto pr-1">
                        {editItems.map(item => (
                            <div key={item.id} className="flex items-center gap-2">
                                <input
                                    value={item.name}
                                    onChange={e => handleChange(item.id, 'name', e.target.value.toUpperCase())}
                                    placeholder="CÓDIGO"
                                    className="w-20 shrink-0 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-2 text-xs font-black text-cyan-600 dark:text-cyan-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 uppercase text-center"
                                />
                                <input
                                    value={item.description}
                                    onChange={e => handleChange(item.id, 'description', e.target.value)}
                                    placeholder="Descripción / Significado..."
                                    className="flex-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                />
                                <button onClick={() => handleRemove(item.id)} className="p-2 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/15 rounded-lg transition-colors cursor-pointer shrink-0">
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        ))}
                        <button onClick={handleAdd} className="w-full mt-2 p-2 text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10 rounded-lg flex items-center justify-center hover:bg-indigo-100 dark:hover:bg-indigo-500/20 transition-colors cursor-pointer">
                            <Plus className="w-3.5 h-3.5 mr-1" /> Agregar acción
                        </button>
                    </div>
                ) : (
                    <>
                        {items.length > 5 && (
                            <div className="relative mb-3 shrink-0">
                                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input
                                    value={search}
                                    onChange={e => setSearch(e.target.value)}
                                    placeholder="Buscar..."
                                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg pl-9 pr-3 py-2 text-xs text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                />
                            </div>
                        )}
                        <div className="space-y-1 flex-1 overflow-y-auto pr-1">
                            {filtered.length === 0 && (
                                <p className="text-xs text-slate-500 text-center py-4">Sin resultados</p>
                            )}
                            {filtered.map((item, idx) => (
                                <div key={idx} className="flex items-center gap-3 px-3 py-2.5 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-100 dark:border-transparent">
                                    <span className="inline-flex items-center justify-center min-w-[3.5rem] px-2 py-0.5 bg-cyan-100 dark:bg-cyan-500/15 text-cyan-700 dark:text-cyan-400 rounded-md text-[11px] font-black tracking-wide">
                                        {item.name}
                                    </span>
                                    <span className="text-sm text-slate-600 dark:text-slate-300 font-medium">
                                        {item.description || '—'}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
