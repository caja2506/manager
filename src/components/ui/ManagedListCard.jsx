import React, { useState } from 'react';
import { Edit2, Trash2, Plus, Search } from 'lucide-react';

// ============================================================
// Generic List Card — reusable for simple name-only lists
// ============================================================
export default function ManagedListCard({ title, subtitle, icon: Icon, iconBg, iconColor, items, onSave }) {
    const [isEditing, setIsEditing] = useState(false);
    const [editItems, setEditItems] = useState([]);
    const [search, setSearch] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    const startEdit = () => {
        setEditItems(items.map((name, i) => ({ id: `e-${i}`, name, original: name })));
        setIsEditing(true);
    };

    const handleAdd = () => {
        setEditItems(prev => [...prev, { id: `n-${Date.now()}`, name: '', original: null }]);
    };

    const handleRemove = (id) => {
        setEditItems(prev => prev.filter(i => i.id !== id));
    };

    const handleChange = (id, value) => {
        setEditItems(prev => prev.map(i => i.id === id ? { ...i, name: value } : i));
    };

    const handleSave = async () => {
        setIsSaving(true);
        const renames = editItems
            .filter(i => i.original && i.name.trim() && i.original !== i.name.trim())
            .map(i => ({ oldName: i.original, newName: i.name.trim() }));
        const added = editItems.filter(i => !i.original && i.name.trim()).map(i => i.name.trim());
        const remainingOriginals = editItems.map(i => i.original).filter(Boolean);
        const deleted = items.filter(name => !remainingOriginals.includes(name));
        try {
            await onSave({ renames, deleted, added });
            setIsEditing(false);
        } catch (err) {
            console.error('Error saving managed list:', err);
            alert('Error al guardar: ' + (err.message || 'Error desconocido'));
        }
        setIsSaving(false);
    };

    const cancel = () => {
        setIsEditing(false);
        setEditItems([]);
    };

    const filtered = items.filter(n => n.toLowerCase().includes(search.toLowerCase()));

    return (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-lg overflow-hidden">
            {/* Header */}
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
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
                    <button onClick={startEdit} className="flex items-center gap-1.5 text-xs font-bold text-indigo-500 dark:text-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-300 bg-indigo-50 dark:bg-indigo-500/10 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 px-3 py-1.5 rounded-lg transition-colors">
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
            <div className="p-4">
                {isEditing ? (
                    <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                        {editItems.map(item => (
                            <div key={item.id} className="flex items-center gap-2">
                                <input
                                    value={item.name}
                                    onChange={e => handleChange(item.id, e.target.value)}
                                    placeholder="Nuevo valor..."
                                    className="flex-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                />
                                <button onClick={() => handleRemove(item.id)} className="p-2 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/15 rounded-lg transition-colors">
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
                        {items.length > 5 && (
                            <div className="relative mb-3">
                                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input
                                    value={search}
                                    onChange={e => setSearch(e.target.value)}
                                    placeholder="Buscar..."
                                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg pl-9 pr-3 py-2 text-xs text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                />
                            </div>
                        )}
                        <div className="space-y-1 max-h-64 overflow-y-auto pr-1">
                            {filtered.length === 0 && (
                                <p className="text-xs text-slate-500 text-center py-4">Sin resultados</p>
                            )}
                            {filtered.map((name, idx) => (
                                <div key={idx} className="flex items-center gap-2 px-3 py-2 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-100 dark:border-transparent">
                                    <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full flex-shrink-0" />
                                    <span className="text-sm text-slate-700 dark:text-slate-200 font-medium">{name}</span>
                                </div>
                            ))}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
